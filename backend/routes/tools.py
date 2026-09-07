"""
API routes for tool discovery, catalog search, custom tool creation,
and real-time streaming tool execution.
"""

from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Query, HTTPException, Body
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from services.tool_registry import registry

router = APIRouter(prefix="/api/tools", tags=["tools"])


class CustomToolRequest(BaseModel):
    name: str = Field(..., description="Tool identifier (e.g. 'custom_recon')")
    display_name: Optional[str] = Field(None, description="Human friendly title")
    category: str = Field("Custom Suite", description="Tool category")
    description: str = Field("", description="Tool documentation or purpose")
    command: str = Field(..., description="Command template with {target}")
    speed: str = Field("fast", description="fast, medium, slow")
    timeout: Optional[int] = Field(None, description="Timeout in seconds")
    danger_level: str = Field("safe", description="safe, caution, dangerous")
    entity_type: List[str] = Field(["TEXT"], description="Supported entity types")


class StreamExecutionRequest(BaseModel):
    tool_name: str
    target: str
    custom_flags: Optional[str] = None
    timeout: Optional[int] = None


@router.get("/all")
async def get_all_tools():
    """Return all cataloged tools (predefined + BlackArch system tools + plugins + custom)."""
    tools = list(registry.tools.values())
    installed_count = sum(1 for t in tools if t.get("installed", False))
    return {
        "tools": tools,
        "total": len(tools),
        "installed_count": installed_count
    }


@router.get("/categories")
async def get_tool_categories(
    entity_type: Optional[str] = Query(None, description="Filter tools by entity type (IP, DOMAIN, EMAIL, etc.)")
):
    """Return all available tools grouped by category."""
    grouped = registry.get_tools_grouped_by_category(entity_type)
    return {
        "categories": grouped,
        "total_tools": sum(len(tools) for tools in grouped.values()),
    }


@router.get("/search")
async def search_tools(
    q: str = Query("", description="Search term across name, category, and description"),
    category: Optional[str] = Query(None, description="Filter by category"),
    entity_type: Optional[str] = Query(None, description="Filter by entity type"),
):
    """Fuzzy search across tool names, categories, and capabilities."""
    results = registry.search(query=q, category=category, entity_type=entity_type)
    return {
        "query": q,
        "results": results,
        "count": len(results)
    }


@router.get("/for-entity/{entity_type}")
async def get_tools_for_entity(entity_type: str):
    """Return a list of tools available for a specific entity type."""
    tools = registry.get_tools_for_entity(entity_type)
    return {
        "entity_type": entity_type,
        "tools": tools,
        "total": len(tools),
    }


@router.post("/execute-stream")
async def execute_tool_stream(req: StreamExecutionRequest):
    """
    Execute tool and stream output line by line over Server-Sent Events (SSE).
    Allows real-time terminal output streaming in the frontend.
    """
    async def event_generator():
        async for chunk in registry.execute_tool_stream(
            tool_name=req.tool_name,
            target=req.target,
            custom_flags=req.custom_flags,
            timeout=req.timeout,
        ):
            # Send raw text chunks in SSE data format
            lines = chunk.splitlines(keepends=True)
            for line in lines:
                import json
                payload = json.dumps({"chunk": line})
                yield f"data: {payload}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/custom")
async def register_custom_tool(req: CustomToolRequest):
    """Register a custom tool command."""
    try:
        tool_config = registry.register_custom_tool(req.dict())
        return {"status": "success", "tool": tool_config}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
