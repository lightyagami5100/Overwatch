"""
Agent simulator: generates realistic mock AI agent log messages
for the terminal feed with timed delays.
"""

import asyncio
from datetime import datetime, timezone
from typing import AsyncGenerator

from schemas import AgentLog


async def generate_agent_logs(
    entity_count: int,
    ip_count: int,
    email_count: int,
    domain_count: int,
    threat_level: str,
) -> AsyncGenerator[AgentLog, None]:
    """
    Yield a sequence of timed agent log messages simulating
    a multi-agent AI swarm processing intelligence data.
    """
    logs = [
        AgentLog(
            timestamp=_now(),
            agent="SWARM_CTRL",
            message="Initializing Overwatch AI Swarm...",
            level="INFO",
        ),
        AgentLog(
            timestamp=_now(),
            agent="Agent_NER",
            message="Extracting entities from raw intelligence...",
            level="INFO",
        ),
        AgentLog(
            timestamp=_now(),
            agent="Agent_NER",
            message=f"Found {ip_count} IPs, {email_count} emails, {domain_count} domains",
            level="SUCCESS",
        ),
        AgentLog(
            timestamp=_now(),
            agent="Agent_LLM",
            message="Enriching extraction with MiniMax AI analysis...",
            level="INFO",
        ),
        AgentLog(
            timestamp=_now(),
            agent="Agent_LLM",
            message=f"LLM enrichment complete — total entities: {entity_count}",
            level="SUCCESS",
        ),
        AgentLog(
            timestamp=_now(),
            agent="Agent_CLASSIFIER",
            message="Scoring threat levels via contextual analysis...",
            level="INFO",
        ),
        AgentLog(
            timestamp=_now(),
            agent="Agent_CLASSIFIER",
            message=f"Overall threat assessment: {threat_level}",
            level="WARNING" if threat_level == "CRITICAL" else "INFO",
        ),
        AgentLog(
            timestamp=_now(),
            agent="Agent_MAPPER",
            message="Building entity relationship graph...",
            level="INFO",
        ),
        AgentLog(
            timestamp=_now(),
            agent="Agent_MAPPER",
            message="Correlating co-occurring entities across sentences...",
            level="INFO",
        ),
        AgentLog(
            timestamp=_now(),
            agent="Agent_VAULT",
            message="Computing SHA-256 integrity hash...",
            level="INFO",
        ),
        AgentLog(
            timestamp=_now(),
            agent="Agent_VAULT",
            message="Evidence sealed in tamper-proof vault",
            level="SUCCESS",
        ),
        AgentLog(
            timestamp=_now(),
            agent="SWARM_CTRL",
            message=f"SWARM COMPLETE: {entity_count} entities mapped, threat level {threat_level}",
            level="SUCCESS",
        ),
    ]

    for log in logs:
        log.timestamp = _now()
        yield log
        await asyncio.sleep(0.3)  # 300ms between log lines for streaming effect


def _now() -> str:
    """Return current UTC time formatted for logs."""
    return datetime.now(timezone.utc).strftime("%H:%M:%S")
