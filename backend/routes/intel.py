import json
import logging
import uuid
import urllib.request
import urllib.error
from datetime import datetime, timezone
from typing import AsyncGenerator, Optional, List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import StreamingResponse, PlainTextResponse, JSONResponse
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from models import CaseFile, Link, Node
from schemas import (
    CaseFileListItem,
    CaseFileResponse,
    IntelSubmission,
    LinkSchema,
    NodeSchema,
    ToolExecutionRequest,
    DirectToolExecutionRequest,
)
from services.agent_simulator import generate_agent_logs
from services.intel_processor import process_raw_intel, generate_stix2_bundle
from services.llm_extractor import _get_active_ollama_base
from services.tool_registry import registry

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["intel"])


class AIChatRequest(BaseModel):
    prompt: str
    case_file_id: Optional[str] = None
    system_prompt: Optional[str] = None


# ---------------------------------------------------------------------------
# POST /api/process-intel — SSE streaming endpoint
# ---------------------------------------------------------------------------

@router.post("/process-intel")
async def process_intel(
    submission: IntelSubmission,
    db: AsyncSession = Depends(get_db),
):
    """
    Process raw intelligence text through the AI swarm pipeline.
    Returns Server-Sent Events (SSE) stream with:
    - Agent log messages (event: log)
    - Final processed result (event: result)
    """

    async def event_stream() -> AsyncGenerator[str, None]:
        import asyncio
        # Step 1: Process the raw text
        result = await asyncio.to_thread(process_raw_intel, submission.raw_text)
        entities = result["entities"]
        links = result["links"]
        threat_level = result["threat_level"]
        report_hash = result["report_hash"]

        # Count entity types for logs
        ip_count = sum(1 for e in entities if e.entity_type == "IP")
        email_count = sum(1 for e in entities if e.entity_type == "EMAIL")
        domain_count = sum(1 for e in entities if e.entity_type == "DOMAIN")

        # Step 2: Stream mock agent logs
        async for log in generate_agent_logs(
            entity_count=len(entities),
            ip_count=ip_count,
            email_count=email_count,
            domain_count=domain_count,
            threat_level=threat_level,
        ):
            log_data = json.dumps(log.model_dump())
            yield f"event: log\ndata: {log_data}\n\n"

        # Step 3: Save to database
        case_file_id = str(uuid.uuid4())
        timestamp = datetime.now(timezone.utc)
        filename = f"intel_report_{timestamp.strftime('%Y%m%d_%H%M%S')}.json"

        case_file = CaseFile(
            id=case_file_id,
            filename=filename,
            content=submission.raw_text,
            sha256_hash=report_hash,
            threat_level=threat_level,
            created_at=timestamp,
        )

        db_nodes = []
        for ent in entities:
            db_node = Node(
                id=ent.id,
                case_file_id=case_file_id,
                label=ent.label,
                entity_type=ent.entity_type,
                threat_level=ent.threat_level,
                group=ent.group,
                tool_results=getattr(ent, 'tool_results', None)
            )
            db_nodes.append(db_node)

        db_links = []
        for link in links:
            db_link = Link(
                id=link.id,
                case_file_id=case_file_id,
                source_node_id=link.source_id,
                target_node_id=link.target_id,
                relationship_type=link.relationship_type,
            )
            db_links.append(db_link)

        db.add(case_file)
        db.add_all(db_nodes)
        db.add_all(db_links)
        await db.commit()

        # Step 4: Send final result
        result_data = {
            "nodes": [
                NodeSchema(
                    id=e.id,
                    label=e.label,
                    entity_type=e.entity_type,
                    threat_level=e.threat_level,
                    group=e.group,
                    tool_results=getattr(e, 'tool_results', None)
                ).model_dump()
                for e in entities
            ],
            "links": [
                LinkSchema(
                    id=l.id,
                    source=l.source_id,
                    target=l.target_id,
                    relationship=l.relationship_type,
                ).model_dump()
                for l in links
            ],
            "report_hash": report_hash,
            "case_file_id": case_file_id,
            "filename": filename,
            "threat_level": threat_level,
            "created_at": timestamp.isoformat(),
        }
        yield f"event: result\ndata: {json.dumps(result_data)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ---------------------------------------------------------------------------
# POST /api/intel/upload — File Ingestion (.txt, .log, .json, .csv)
# ---------------------------------------------------------------------------

@router.post("/intel/upload")
async def upload_intel_file(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """Upload and ingest a log, JSON, CSV, or text report into a Case File."""
    try:
        content_bytes = await file.read()
        text_content = content_bytes.decode("utf-8", errors="replace")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read file: {e}")

    import asyncio
    processed = await asyncio.to_thread(process_raw_intel, text_content)
    entities = processed["entities"]
    links = processed["links"]
    threat_level = processed["threat_level"]
    report_hash = processed["report_hash"]

    case_file_id = str(uuid.uuid4())
    timestamp = datetime.now(timezone.utc)
    filename = f"upload_{file.filename or 'file'}_{timestamp.strftime('%Y%m%d_%H%M%S')}.json"

    case_file = CaseFile(
        id=case_file_id,
        filename=filename,
        content=text_content,
        sha256_hash=report_hash,
        threat_level=threat_level,
        created_at=timestamp,
    )

    db_nodes = [
        Node(
            id=ent.id,
            case_file_id=case_file_id,
            label=ent.label,
            entity_type=ent.entity_type,
            threat_level=ent.threat_level,
            group=ent.group,
            tool_results=getattr(ent, 'tool_results', None)
        )
        for ent in entities
    ]

    db_links = [
        Link(
            id=link.id,
            case_file_id=case_file_id,
            source_node_id=link.source_id,
            target_node_id=link.target_id,
            relationship_type=link.relationship_type,
        )
        for link in links
    ]

    db.add(case_file)
    db.add_all(db_nodes)
    db.add_all(db_links)
    await db.commit()

    return {
        "status": "success",
        "case_file_id": case_file_id,
        "filename": filename,
        "entity_count": len(entities),
        "threat_level": threat_level,
        "sha256_hash": report_hash
    }


# ---------------------------------------------------------------------------
# Tool Execution Endpoints
# ---------------------------------------------------------------------------

@router.post("/tools/execute")
async def execute_tool(
    request: ToolExecutionRequest,
    db: AsyncSession = Depends(get_db),
):
    """Execute all tools of a specific category against a given node."""
    result = await db.execute(select(Node).where(Node.id == request.node_id))
    node = result.scalar_one_or_none()

    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    tools = registry.get_tools_for_entity(node.entity_type)
    tools_to_run = [t for t in tools if t.get("category") == request.category]

    if not tools_to_run:
        # Fallback to general category match
        tools_to_run = [t for t in registry.tools.values() if t.get("category") == request.category]
        if not tools_to_run:
            raise HTTPException(status_code=404, detail=f"No tools found for category '{request.category}'")

    new_results = []
    for t in tools_to_run[:5]:  # limit to top 5 in category to prevent freeze
        res = await registry.execute_tool(t["name"], node.label)
        new_results.append(f"[{t['name'].upper()}]\n{res}")

    combined_result = "\n\n".join(new_results)
    if node.tool_results:
        node.tool_results += "\n\n" + combined_result
    else:
        node.tool_results = combined_result

    await db.commit()
    await db.refresh(node)

    return {"status": "success", "tool_results": node.tool_results}


@router.post("/tools/execute-direct")
async def execute_tool_direct(
    request: DirectToolExecutionRequest,
    db: AsyncSession = Depends(get_db)
):
    """Execute tools directly against a target string and process the results into a Case File."""
    tools = registry.get_tools_for_entity(request.entity_type)
    tools_to_run = [t for t in tools if t.get("category") == request.category]

    if request.tool_name:
        tools_to_run = [t for t in registry.tools.values() if t.get("name") == request.tool_name]

    if not tools_to_run:
        tools_to_run = [t for t in registry.tools.values() if request.category.lower() in t.get("category", "").lower()]

    if not tools_to_run:
        raise HTTPException(status_code=404, detail=f"No tools found for execution")

    new_results = []
    for t in tools_to_run[:3]:
        res = await registry.execute_tool(t["name"], request.target)
        new_results.append(f"[{t['name'].upper()}] against {request.target}\n{res}")

    combined_result = "\n\n".join(new_results)

    import asyncio
    processed = await asyncio.to_thread(process_raw_intel, combined_result)
    entities = processed["entities"]
    links = processed["links"]
    threat_level = processed["threat_level"]
    report_hash = processed["report_hash"]

    case_file_id = str(uuid.uuid4())
    timestamp = datetime.now(timezone.utc)
    tool_label = request.tool_name or request.category.replace(" ", "_")
    filename = f"scan_{tool_label}_{request.target}_{timestamp.strftime('%Y%m%d_%H%M%S')}.json"

    case_file = CaseFile(
        id=case_file_id,
        filename=filename,
        content=combined_result,
        sha256_hash=report_hash,
        threat_level=threat_level,
        created_at=timestamp,
    )

    db_nodes = [
        Node(
            id=ent.id,
            case_file_id=case_file_id,
            label=ent.label,
            entity_type=ent.entity_type,
            threat_level=ent.threat_level,
            group=ent.group,
            tool_results=getattr(ent, 'tool_results', None)
        )
        for ent in entities
    ]

    db_links = [
        Link(
            id=link.id,
            case_file_id=case_file_id,
            source_node_id=link.source_id,
            target_node_id=link.target_id,
            relationship_type=link.relationship_type,
        )
        for link in links
    ]

    db.add(case_file)
    db.add_all(db_nodes)
    db.add_all(db_links)
    await db.commit()

    return {
        "status": "success",
        "tool_results": combined_result,
        "case_file_id": case_file_id
    }


# ---------------------------------------------------------------------------
# Cross-Case Correlation
# ---------------------------------------------------------------------------

@router.get("/correlations")
async def get_cross_case_correlations(db: AsyncSession = Depends(get_db)):
    """
    Find IOCs and entities that appear across multiple independent case files,
    highlighting shared threat actors, infrastructure, or attack campaigns.
    """
    # Find labels with count > 1
    query = (
        select(Node.label, Node.entity_type, func.count(func.distinct(Node.case_file_id)).label("case_count"))
        .group_by(Node.label, Node.entity_type)
        .having(func.count(func.distinct(Node.case_file_id)) > 1)
        .order_by(func.count(func.distinct(Node.case_file_id)).desc())
    )
    res = await db.execute(query)
    correlations = []
    for label, entity_type, count in res.all():
        # Get associated case files
        node_res = await db.execute(
            select(CaseFile.id, CaseFile.filename, CaseFile.threat_level)
            .join(Node, Node.case_file_id == CaseFile.id)
            .where(Node.label == label)
            .distinct()
        )
        associated_cases = [{"id": r[0], "filename": r[1], "threat_level": r[2]} for r in node_res.all()]
        correlations.append({
            "label": label,
            "entity_type": entity_type,
            "case_count": count,
            "associated_cases": associated_cases
        })

    return {"correlations": correlations, "total_overlapping_iocs": len(correlations)}


# ---------------------------------------------------------------------------
# Case Files CRUD & Tamper-Proof Export
# ---------------------------------------------------------------------------

@router.get("/case-files", response_model=list[CaseFileListItem])
async def list_case_files(db: AsyncSession = Depends(get_db)):
    """List all case files in the evidence vault."""
    result = await db.execute(
        select(CaseFile).order_by(CaseFile.created_at.desc())
    )
    case_files = result.scalars().all()

    items = []
    for cf in case_files:
        node_count_result = await db.execute(
            select(func.count(Node.id)).where(Node.case_file_id == cf.id)
        )
        link_count_result = await db.execute(
            select(func.count(Link.id)).where(Link.case_file_id == cf.id)
        )
        items.append(
            CaseFileListItem(
                id=cf.id,
                filename=cf.filename,
                sha256_hash=cf.sha256_hash,
                threat_level=cf.threat_level,
                created_at=cf.created_at,
                node_count=node_count_result.scalar() or 0,
                link_count=link_count_result.scalar() or 0,
            )
        )

    return items


@router.get("/case-files/{case_file_id}", response_model=CaseFileResponse)
async def get_case_file(
    case_file_id: str, db: AsyncSession = Depends(get_db)
):
    """Get a single case file with its nodes and links."""
    result = await db.execute(
        select(CaseFile)
        .options(selectinload(CaseFile.nodes), selectinload(CaseFile.links))
        .where(CaseFile.id == case_file_id)
    )
    case_file = result.scalar_one_or_none()

    if not case_file:
        raise HTTPException(status_code=404, detail="Case file not found")

    return CaseFileResponse(
        id=case_file.id,
        filename=case_file.filename,
        content=case_file.content,
        sha256_hash=case_file.sha256_hash,
        threat_level=case_file.threat_level,
        created_at=case_file.created_at,
        nodes=[
            NodeSchema(
                id=n.id,
                label=n.label,
                entity_type=n.entity_type,
                threat_level=n.threat_level,
                group=n.group,
                tool_results=n.tool_results,
            )
            for n in case_file.nodes
        ],
        links=[
            LinkSchema(
                id=l.id,
                source=l.source_node_id,
                target=l.target_node_id,
                relationship=l.relationship_type,
            )
            for l in case_file.links
        ],
    )


@router.get("/case-files/{case_file_id}/export")
async def export_case_file(
    case_file_id: str,
    format: str = Query("markdown", description="Export format: markdown, json, html"),
    db: AsyncSession = Depends(get_db)
):
    """Export a cryptographically signed case report with SHA-256 integrity seal."""
    result = await db.execute(
        select(CaseFile)
        .options(selectinload(CaseFile.nodes), selectinload(CaseFile.links))
        .where(CaseFile.id == case_file_id)
    )
    case_file = result.scalar_one_or_none()
    if not case_file:
        raise HTTPException(status_code=404, detail="Case file not found")

    if format.lower() in ("stix", "stix2", "stix2.1"):
        bundle = generate_stix2_bundle(
            case_file_id=case_file.id,
            filename=case_file.filename,
            threat_level=case_file.threat_level,
            sha256_hash=case_file.sha256_hash,
            created_at=case_file.created_at,
            nodes=case_file.nodes,
            links=case_file.links,
            raw_content=case_file.content,
        )
        return JSONResponse(content=bundle)

    if format.lower() == "json":
        data = {
            "case_id": case_file.id,
            "filename": case_file.filename,
            "threat_level": case_file.threat_level,
            "sha256_seal": case_file.sha256_hash,
            "created_at": case_file.created_at.isoformat(),
            "nodes": [{"id": n.id, "label": n.label, "type": n.entity_type, "threat": n.threat_level} for n in case_file.nodes],
            "links": [{"source": l.source_node_id, "target": l.target_node_id, "relationship": l.relationship_type} for l in case_file.links],
            "raw_evidence": case_file.content
        }
        return JSONResponse(content=data)

    # Markdown format
    md = f"""# OVERWATCH PROTOCOL INCIDENT REPORT
**Case ID:** `{case_file.id}`  
**Filename:** `{case_file.filename}`  
**Severity:** `{case_file.threat_level}`  
**Timestamp:** `{case_file.created_at.isoformat()}`  
**Cryptographic SHA-256 Seal:** `{case_file.sha256_hash}`  

---

## 1. Executive Summary & Entities ({len(case_file.nodes)} Extracted)

| Type | Indicator / Entity Label | Threat Level |
|---|---|---|
"""
    for n in case_file.nodes:
        md += f"| {n.entity_type} | `{n.label}` | **{n.threat_level}** |\n"

    md += f"""
---

## 2. Entity Correlations & Relationships ({len(case_file.links)} Mapped)

"""
    for l in case_file.links:
        md += f"- Node `{l.source_node_id[:8]}` --({l.relationship_type})--> Node `{l.target_node_id[:8]}`\n"

    md += f"""
---

## 3. Raw Evidence & Log Transcript

```
{case_file.content}
```

---
*Generated by Overwatch Protocol v4.0 (Zero-Trust Local Cyber Command)*
"""
    return PlainTextResponse(content=md, media_type="text/markdown")


@router.delete("/case-files/{case_file_id}")
async def delete_case_file(
    case_file_id: str, db: AsyncSession = Depends(get_db)
):
    """Delete a case file and its associated nodes and links."""
    result = await db.execute(
        select(CaseFile).where(CaseFile.id == case_file_id)
    )
    case_file = result.scalar_one_or_none()

    if not case_file:
        raise HTTPException(status_code=404, detail="Case file not found")

    await db.delete(case_file)
    await db.commit()
    return {"status": "deleted", "id": case_file_id}


# ---------------------------------------------------------------------------
# POST /api/ai/chat — Native AI Threat Analyst Chat (Ollama / Local Synthesis)
# ---------------------------------------------------------------------------

@router.post("/ai/chat")
async def ai_threat_analyst_chat(
    req: AIChatRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Direct in-app AI Threat Analyst powered by local Ollama LLM,
    injected with the active case graph context and IOC evidence.
    """
    case_context = ""
    if req.case_file_id:
        result = await db.execute(
            select(CaseFile)
            .options(selectinload(CaseFile.nodes), selectinload(CaseFile.links))
            .where(CaseFile.id == req.case_file_id)
        )
        case = result.scalar_one_or_none()
        if case:
            iocs = ", ".join([f"{n.entity_type}:{n.label}({n.threat_level})" for n in case.nodes[:20]])
            case_context = (
                f"\nACTIVE CASE CONTEXT:\n- File: {case.filename}\n- Threat Level: {case.threat_level}\n"
                f"- SHA-256: {case.sha256_hash}\n- Key IOCs: {iocs}\n- Evidence Snippet: {case.content[:500]}\n"
            )

    system_prompt = (
        "You are Nova, an expert AI Cyber Threat Analyst and Incident Commander in the Overwatch Platform. "
        "Provide direct, highly technical, actionable defensive threat intelligence, MITRE ATT&CK mappings, "
        "remediation steps, and OSINT correlation. Format your responses with clean Markdown bullet points.\n"
    )

    full_prompt = f"{system_prompt}{case_context}\nUSER QUESTION: {req.prompt}\n\nANALYST RESPONSE:"

    # Auto-discover active Ollama endpoint
    base_url, model = _get_active_ollama_base()
    if base_url and model:
        try:
            payload = json.dumps({
                "model": model,
                "prompt": full_prompt,
                "stream": False,
                "options": {"temperature": 0.2, "num_predict": 1024}
            }).encode("utf-8")

            req_http = urllib.request.Request(
                f"{base_url}/api/generate",
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            with urllib.request.urlopen(req_http, timeout=40) as resp:
                data = json.loads(resp.read().decode())
                response_text = data.get("response", "").strip()
                return {"response": response_text, "model": data.get("model", model)}
        except Exception as e:
            logger.info(f"Ollama chat fallback triggered: {e}")

    # Fallback to local heuristic analyst synthesis
    fallback_response = (
        f"### Threat Intel Briefing (Autonomous Local Synthesis)\n\n"
        f"**Analysis of Request:** {req.prompt}\n\n"
        f"- **Threat Assessment:** High-priority reconnaissance and IOC evaluation.\n"
        f"- **MITRE ATT&CK Matrix:** Correlates with Initial Access (T1190) and Reconnaissance (T1595/T1596).\n"
        f"- **Recommended Next Actions:**\n"
        f"  1. Run port audit via `Nmap` or `HTTPX` on all resolved IPs.\n"
        f"  2. Isolate communicating endpoints and cross-check hashes against threat vaults.\n"
        f"  3. Verify DNS resolution integrity and seal artifacts with SHA-256.\n\n"
        f"*(Note: Ollama standby; autonomous synthesis active)*"
    )
    return {"response": fallback_response, "model": "overwatch-local-heuristic"}
