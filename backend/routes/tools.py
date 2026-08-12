"""
API routes for tool discovery and metadata.
Provides endpoints for the frontend to dynamically discover
available tools based on entity type.
"""

from typing import Optional

from fastapi import APIRouter, Query

from services.tool_registry import registry

router = APIRouter(prefix="/api/tools", tags=["tools"])


@router.get("/categories")
async def get_tool_categories(
    entity_type: Optional[str] = Query(None, description="Filter tools by entity type (IP, DOMAIN, EMAIL, etc.)")
):
    """
    Return all available tools grouped by category.
    Optionally filter by entity_type to only show relevant tools.
    """
    grouped = registry.get_tools_grouped_by_category(entity_type)
    return {
        "categories": grouped,
        "total_tools": sum(len(tools) for tools in grouped.values()),
    }


@router.get("/for-entity/{entity_type}")
async def get_tools_for_entity(entity_type: str):
    """Return a flat list of tools available for a specific entity type."""
    tools = registry.get_tools_for_entity(entity_type)
    return {
        "entity_type": entity_type,
        "tools": [
            {
                "name": t["name"],
                "display_name": t.get("display_name", t["name"]),
                "category": t.get("category", "Uncategorized"),
                "speed": t.get("speed", "fast"),
                "danger_level": t.get("danger_level", "safe"),
                "description": t.get("description", ""),
            }
            for t in tools
        ],
        "total": len(tools),
    }
