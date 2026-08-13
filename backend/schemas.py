"""
Pydantic schemas for API request/response serialization.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------


class IntelSubmission(BaseModel):
    """Raw intelligence text submitted for processing."""

    raw_text: str = Field(
        ...,
        min_length=2,
        description="Raw unstructured text containing security intelligence.",
        examples=[
            "Suspicious login from IP 192.168.1.50 using admin@company.com. "
            "Target domain was malicious-site.com."
        ],
    )


class ToolExecutionRequest(BaseModel):
    """Request to execute a category of tools against a specific node."""
    node_id: str = Field(..., description="The ID of the Node entity to target.")
    category: str = Field(..., description="The category of tools to run (e.g. 'Fast Network Scan').")


class DirectToolExecutionRequest(BaseModel):
    """Request to execute tools directly against a target string without a graph node."""
    target: str = Field(..., description="The target string (IP, domain, email, etc).")
    entity_type: str = Field(..., description="The type of entity (e.g. 'IP', 'EMAIL').")
    category: str = Field(..., description="The category of tools to run.")
    tool_name: Optional[str] = Field(None, description="If provided, run only this specific tool instead of all tools in the category.")


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------


class NodeSchema(BaseModel):
    """A single entity node in the threat graph."""

    id: str
    label: str
    entity_type: str  # IP, EMAIL, DOMAIN, ORG, PERSON, GPE, CVE, HASH
    threat_level: str  # CRITICAL, SUSPICIOUS, BENIGN
    group: int  # Numeric group for graph coloring
    tool_results: Optional[str] = None


class LinkSchema(BaseModel):
    """A relationship edge between two nodes."""

    id: str
    source: str  # Source node ID
    target: str  # Target node ID
    relationship: str  # e.g., "connected_to", "credential_exfil_via"


class ProcessedIntel(BaseModel):
    """Structured output from the AI processing pipeline."""

    nodes: list[NodeSchema]
    links: list[LinkSchema]
    report_hash: str  # SHA-256 of the generated report
    case_file_id: str
    filename: str
    threat_level: str
    created_at: datetime


class CaseFileResponse(BaseModel):
    """Full case file response including nodes and links."""

    id: str
    filename: str
    content: str
    sha256_hash: str
    threat_level: str
    created_at: datetime
    nodes: list[NodeSchema]
    links: list[LinkSchema]


class CaseFileListItem(BaseModel):
    """Lightweight case file item for vault listing."""

    id: str
    filename: str
    sha256_hash: str
    threat_level: str
    created_at: datetime
    node_count: int
    link_count: int


class AgentLog(BaseModel):
    """A single log message from the AI agent swarm."""

    timestamp: str
    agent: str
    message: str
    level: str = "INFO"  # INFO, SUCCESS, WARNING, ERROR
