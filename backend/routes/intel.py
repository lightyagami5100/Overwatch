"""
API routes for intelligence processing and evidence vault operations.

POST /api/process-intel uses Server-Sent Events (SSE) to stream
agent logs in real-time, then sends the final processed result.
"""

import json
import uuid
from datetime import datetime, timezone
from typing import AsyncGenerator

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
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
)
from services.agent_simulator import generate_agent_logs
from services.intel_processor import process_raw_intel

router = APIRouter(prefix="/api", tags=["intel"])


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
# POST /api/tools/execute — Execute a specific tool category
# ---------------------------------------------------------------------------

from schemas import ToolExecutionRequest, DirectToolExecutionRequest
from services.tool_registry import registry

@router.get("/tools")
async def get_all_tools():
    """Get all tools grouped by category."""
    grouped = registry.get_tools_grouped_by_category()
    return {"categories": grouped}

@router.post("/tools/execute")
async def execute_tool(
    request: ToolExecutionRequest,
    db: AsyncSession = Depends(get_db),
):
    """Execute all tools of a specific category against a given node."""
    # 1. Fetch the node
    result = await db.execute(select(Node).where(Node.id == request.node_id))
    node = result.scalar_one_or_none()
    
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
        
    # 2. Get tools for this entity type
    tools = registry.get_tools_for_entity(node.entity_type)
    
    # 3. Filter by category
    tools_to_run = [t for t in tools if t.get("category") == request.category]
    
    if not tools_to_run:
        raise HTTPException(status_code=404, detail=f"No tools found for category '{request.category}' and entity type '{node.entity_type}'")
        
    # 4. Execute tools
    new_results = []
    for t in tools_to_run:
        res = await registry.execute_tool(t["name"], node.label)
        new_results.append(f"[{t['name'].upper()}]\n{res}")
        
    # 5. Append to DB
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
    
    # If a specific tool_name is provided, narrow down to just that tool
    if request.tool_name:
        tools_to_run = [t for t in tools_to_run if t.get("name") == request.tool_name]
    
    if not tools_to_run:
        raise HTTPException(status_code=404, detail=f"No tools found for category '{request.category}' and entity type '{request.entity_type}'")
        
    new_results = []
    for t in tools_to_run:
        res = await registry.execute_tool(t["name"], request.target)
        new_results.append(f"[{t['name'].upper()}] against {request.target}\n{res}")
        
    combined_result = "\n\n".join(new_results)
    
    import asyncio
    # Send the raw terminal output through the NLP pipeline
    processed = await asyncio.to_thread(process_raw_intel, combined_result)
    entities = processed["entities"]
    links = processed["links"]
    threat_level = processed["threat_level"]
    report_hash = processed["report_hash"]
    
    # Save to database
    case_file_id = str(uuid.uuid4())
    timestamp = datetime.now(timezone.utc)
    filename = f"quickscan_{request.target}_{timestamp.strftime('%Y%m%d_%H%M%S')}.json"

    case_file = CaseFile(
        id=case_file_id,
        filename=filename,
        content=combined_result,
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
    
    return {
        "status": "success", 
        "tool_results": combined_result,
        "case_file_id": case_file_id
    }


# ---------------------------------------------------------------------------
# GET /api/case-files — List all case files
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
        # Count nodes and links
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


# ---------------------------------------------------------------------------
# GET /api/case-files/{id} — Get full case file with graph data
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# DELETE /api/case-files/{id}
# ---------------------------------------------------------------------------


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
