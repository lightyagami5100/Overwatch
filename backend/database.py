"""
Database engine, session management, and seed data for DeepTrace.
"""

import hashlib
import uuid
from datetime import datetime, timezone

from sqlalchemy import event, inspect
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from models import Base, CaseFile, Link, Node

DATABASE_URL = "sqlite+aiosqlite:///./deeptrace.db"

engine = create_async_engine(DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db():
    """Dependency injection for database sessions."""
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()


def _sha256(content: str) -> str:
    """Compute SHA-256 hex digest of content string."""
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


# ---------------------------------------------------------------------------
# Seed data: two realistic mock case files
# ---------------------------------------------------------------------------

SEED_CASE_1_CONTENT = """INCIDENT REPORT: APT-29 Exfiltration Alert
Date: 2026-08-09T14:32:00Z
Severity: CRITICAL

Threat intelligence indicates APT-29 (Cozy Bear) activity targeting internal
infrastructure. Suspicious outbound connections detected from 10.0.14.55 to
known C2 domain darknode-c2.ru. Exfiltration of credentials observed via
compromised account admin@globecorp.com. Secondary beacon established to
185.220.101.34. Malware hash: a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4.
Affected organization: GlobeCorp Industries."""

SEED_CASE_2_CONTENT = """INCIDENT REPORT: Internal Network Anomaly
Date: 2026-08-10T09:15:00Z
Severity: SUSPICIOUS

Unusual lateral movement detected between workstations on subnet 192.168.5.0/24.
Source IP 192.168.5.112 initiated RDP sessions to 192.168.5.200 outside
business hours. User j.smith@internal.local performed 47 failed authentication
attempts. No known IOCs matched. Escalating for review."""


async def _seed_database(session: AsyncSession) -> None:
    """Insert two realistic mock case files with nodes and links."""

    # --- Case 1: APT-29 ---
    case1_id = str(uuid.uuid4())
    case1 = CaseFile(
        id=case1_id,
        filename="APT-29_Exfiltration_Alert.json",
        content=SEED_CASE_1_CONTENT,
        sha256_hash=_sha256(SEED_CASE_1_CONTENT),
        threat_level="CRITICAL",
        created_at=datetime(2026, 8, 9, 14, 32, 0, tzinfo=timezone.utc),
    )

    n1_id, n2_id, n3_id, n4_id, n5_id = [str(uuid.uuid4()) for _ in range(5)]
    nodes_1 = [
        Node(
            id=n1_id,
            case_file_id=case1_id,
            label="10.0.14.55",
            entity_type="IP",
            threat_level="CRITICAL",
            group=1,
        ),
        Node(
            id=n2_id,
            case_file_id=case1_id,
            label="darknode-c2.ru",
            entity_type="DOMAIN",
            threat_level="CRITICAL",
            group=1,
        ),
        Node(
            id=n3_id,
            case_file_id=case1_id,
            label="admin@globecorp.com",
            entity_type="EMAIL",
            threat_level="CRITICAL",
            group=1,
        ),
        Node(
            id=n4_id,
            case_file_id=case1_id,
            label="185.220.101.34",
            entity_type="IP",
            threat_level="CRITICAL",
            group=1,
        ),
        Node(
            id=n5_id,
            case_file_id=case1_id,
            label="GlobeCorp Industries",
            entity_type="ORG",
            threat_level="SUSPICIOUS",
            group=2,
        ),
    ]
    links_1 = [
        Link(
            id=str(uuid.uuid4()),
            case_file_id=case1_id,
            source_node_id=n1_id,
            target_node_id=n2_id,
            relationship_type="connected_to",
        ),
        Link(
            id=str(uuid.uuid4()),
            case_file_id=case1_id,
            source_node_id=n3_id,
            target_node_id=n2_id,
            relationship_type="credential_exfil_via",
        ),
        Link(
            id=str(uuid.uuid4()),
            case_file_id=case1_id,
            source_node_id=n4_id,
            target_node_id=n2_id,
            relationship_type="beacon_to",
        ),
        Link(
            id=str(uuid.uuid4()),
            case_file_id=case1_id,
            source_node_id=n3_id,
            target_node_id=n5_id,
            relationship_type="belongs_to",
        ),
    ]

    # --- Case 2: Internal Anomaly ---
    case2_id = str(uuid.uuid4())
    case2 = CaseFile(
        id=case2_id,
        filename="Internal_Network_Anomaly.json",
        content=SEED_CASE_2_CONTENT,
        sha256_hash=_sha256(SEED_CASE_2_CONTENT),
        threat_level="SUSPICIOUS",
        created_at=datetime(2026, 8, 10, 9, 15, 0, tzinfo=timezone.utc),
    )

    n6_id, n7_id, n8_id = [str(uuid.uuid4()) for _ in range(3)]
    nodes_2 = [
        Node(
            id=n6_id,
            case_file_id=case2_id,
            label="192.168.5.112",
            entity_type="IP",
            threat_level="SUSPICIOUS",
            group=2,
        ),
        Node(
            id=n7_id,
            case_file_id=case2_id,
            label="192.168.5.200",
            entity_type="IP",
            threat_level="SUSPICIOUS",
            group=2,
        ),
        Node(
            id=n8_id,
            case_file_id=case2_id,
            label="j.smith@internal.local",
            entity_type="EMAIL",
            threat_level="SUSPICIOUS",
            group=2,
        ),
    ]
    links_2 = [
        Link(
            id=str(uuid.uuid4()),
            case_file_id=case2_id,
            source_node_id=n6_id,
            target_node_id=n7_id,
            relationship_type="rdp_session_to",
        ),
        Link(
            id=str(uuid.uuid4()),
            case_file_id=case2_id,
            source_node_id=n8_id,
            target_node_id=n6_id,
            relationship_type="authenticated_from",
        ),
    ]

    session.add_all([case1, case2] + nodes_1 + links_1 + nodes_2 + links_2)
    await session.commit()


async def init_db() -> None:
    """Create all tables and seed with mock data if empty."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Check if CaseFile table is empty and seed if needed
    async with async_session() as session:
        from sqlalchemy import select, func

        result = await session.execute(select(func.count(CaseFile.id)))
        count = result.scalar()
        if count == 0:
            await _seed_database(session)
