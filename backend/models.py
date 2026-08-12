"""
SQLAlchemy ORM models for the DeepTrace evidence vault.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""

    pass


class CaseFile(Base):
    """
    Represents a single processed intelligence report stored in the vault.
    Each case file has a SHA-256 hash for chain-of-custody verification.
    """

    __tablename__ = "case_files"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    filename = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    sha256_hash = Column(String(64), nullable=False, index=True)
    threat_level = Column(
        Enum("CRITICAL", "SUSPICIOUS", "BENIGN", name="threat_level_enum"),
        nullable=False,
        default="BENIGN",
    )
    created_at = Column(
        DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    nodes = relationship(
        "Node", back_populates="case_file", cascade="all, delete-orphan"
    )
    links = relationship(
        "Link", back_populates="case_file", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<CaseFile(id={self.id}, filename={self.filename}, threat={self.threat_level})>"


class Node(Base):
    """
    An extracted entity node (IP, Email, Domain, ORG, PERSON, GPE, etc.).
    """

    __tablename__ = "nodes"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    case_file_id = Column(
        String(36), ForeignKey("case_files.id", ondelete="CASCADE"), nullable=False
    )
    label = Column(String(255), nullable=False)
    entity_type = Column(String(50), nullable=False)  # IP, EMAIL, DOMAIN, ORG, etc.
    threat_level = Column(
        Enum("CRITICAL", "SUSPICIOUS", "BENIGN", name="threat_level_enum",
             create_constraint=False),
        nullable=False,
        default="BENIGN",
    )
    group = Column(Integer, nullable=False, default=0)  # For graph coloring
    tool_results = Column(Text, nullable=True)  # Store active tool scan results

    # Relationships
    case_file = relationship("CaseFile", back_populates="nodes")

    def __repr__(self) -> str:
        return f"<Node(label={self.label}, type={self.entity_type})>"


class Link(Base):
    """
    A relationship link between two entity nodes.
    """

    __tablename__ = "links"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    case_file_id = Column(
        String(36), ForeignKey("case_files.id", ondelete="CASCADE"), nullable=False
    )
    source_node_id = Column(
        String(36), ForeignKey("nodes.id", ondelete="CASCADE"), nullable=False
    )
    target_node_id = Column(
        String(36), ForeignKey("nodes.id", ondelete="CASCADE"), nullable=False
    )
    relationship_type = Column(String(100), nullable=False, default="related_to")

    # Relationships
    case_file = relationship("CaseFile", back_populates="links")
    source_node = relationship("Node", foreign_keys=[source_node_id])
    target_node = relationship("Node", foreign_keys=[target_node_id])

    def __repr__(self) -> str:
        return f"<Link(source={self.source_node_id} -> target={self.target_node_id})>"
