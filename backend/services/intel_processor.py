"""
Intelligence processor: extracts entities, classifies threats, and maps
relationships from raw unstructured text.

Uses SpaCy (en_core_web_sm) for ORG, GPE, PERSON extraction alongside
regex patterns for IPs, emails, domains, CVEs, and hashes. Falls back
to regex-only if SpaCy model loading fails.
"""

import hashlib
import re
import uuid
from dataclasses import dataclass, field
from typing import Optional

# ---------------------------------------------------------------------------
# SpaCy loading with graceful fallback
# ---------------------------------------------------------------------------

_nlp = None
_spacy_available = False

try:
    import spacy

    try:
        _nlp = spacy.load("en_core_web_sm")
        _spacy_available = True
    except OSError:
        # Model not installed — fall back silently
        _spacy_available = False
except ImportError:
    _spacy_available = False


# ---------------------------------------------------------------------------
# Regex patterns
# ---------------------------------------------------------------------------

IP_PATTERN = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")
EMAIL_PATTERN = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
DOMAIN_PATTERN = re.compile(
    r"\b(?:[a-z0-9](?:[a-z0-9\-]*[a-z0-9])?\.)+(?:com|net|org|io|ru|cn|uk|de|"
    r"fr|gov|edu|mil|co|info|biz|local|xyz|onion|site|top)\b",
    re.IGNORECASE,
)
CVE_PATTERN = re.compile(r"CVE-\d{4}-\d{4,}", re.IGNORECASE)
HASH_PATTERN = re.compile(r"\b[a-fA-F0-9]{32,64}\b")
FILE_PATTERN = re.compile(r"\b[\w\-\.]+\.(?:jpg|jpeg|png|gif|pdf|docx|zip)\b", re.IGNORECASE)
# Basic check for base64 strings longer than 20 chars
B64_PATTERN = re.compile(r"\b(?:[A-Za-z0-9+/]{4}){5,}(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?\b")

# Threat keywords
CRITICAL_KEYWORDS = {
    "malicious",
    "attack",
    "exploit",
    "exfiltration",
    "c2",
    "command and control",
    "ransomware",
    "apt",
    "compromised",
    "breach",
    "critical",
    "trojan",
    "backdoor",
    "rootkit",
    "zero-day",
    "payload",
    "beacon",
}

SUSPICIOUS_KEYWORDS = {
    "suspicious",
    "unusual",
    "anomaly",
    "unknown",
    "unauthorized",
    "failed",
    "lateral movement",
    "brute force",
    "reconnaissance",
    "scanning",
    "abnormal",
}


@dataclass
class ExtractedEntity:
    """A single extracted entity with metadata."""

    label: str
    entity_type: str  # IP, EMAIL, DOMAIN, ORG, PERSON, GPE, CVE, HASH
    threat_level: str = "BENIGN"
    group: int = 0
    id: str = field(default_factory=lambda: str(uuid.uuid4()))


@dataclass
class EntityLink:
    """A relationship between two entities."""

    source_id: str
    target_id: str
    relationship_type: str
    id: str = field(default_factory=lambda: str(uuid.uuid4()))


def _classify_threat(text: str) -> str:
    """Classify overall threat level based on keyword presence."""
    text_lower = text.lower()
    critical_count = sum(1 for kw in CRITICAL_KEYWORDS if kw in text_lower)
    suspicious_count = sum(1 for kw in SUSPICIOUS_KEYWORDS if kw in text_lower)

    if critical_count >= 2:
        return "CRITICAL"
    elif critical_count >= 1 or suspicious_count >= 2:
        return "SUSPICIOUS"
    elif suspicious_count >= 1:
        return "SUSPICIOUS"
    return "BENIGN"


def _classify_entity_threat(entity_label: str, text: str) -> str:
    """Classify individual entity threat by checking context proximity."""
    text_lower = text.lower()
    label_lower = entity_label.lower()

    # Split on sentence boundaries (period followed by space/newline, or
    # newlines), avoiding splits inside IPs/domains
    sentences = re.split(r"(?<=[.!?])\s+|\n+", text)
    entity_sentences: list[str] = []

    for i, s in enumerate(sentences):
        if label_lower in s.lower():
            # Include neighboring sentences for broader context
            context = s.lower()
            if i > 0:
                context = sentences[i - 1].lower() + " " + context
            if i < len(sentences) - 1:
                context = context + " " + sentences[i + 1].lower()
            entity_sentences.append(context)

    # Also check the overall text for association
    if not entity_sentences:
        entity_sentences = [text_lower]

    for sentence in entity_sentences:
        for kw in CRITICAL_KEYWORDS:
            if kw in sentence:
                return "CRITICAL"
        for kw in SUSPICIOUS_KEYWORDS:
            if kw in sentence:
                return "SUSPICIOUS"

    return "BENIGN"


def _threat_to_group(threat_level: str) -> int:
    """Map threat level to numeric group for graph coloring."""
    return {"CRITICAL": 1, "SUSPICIOUS": 2, "BENIGN": 3}.get(threat_level, 3)


def extract_entities(raw_text: str) -> list[ExtractedEntity]:
    """
    Extract entities from raw text using regex and optionally SpaCy.
    Returns deduplicated list of ExtractedEntity objects.
    """
    seen_labels: set[str] = set()
    entities: list[ExtractedEntity] = []

    def _add(label: str, etype: str) -> Optional[ExtractedEntity]:
        normalized = label.strip().lower()
        if normalized in seen_labels or len(normalized) < 2:
            return None
        seen_labels.add(normalized)
        threat = _classify_entity_threat(label, raw_text)
        ent = ExtractedEntity(
            label=label.strip(),
            entity_type=etype,
            threat_level=threat,
            group=_threat_to_group(threat),
        )
        entities.append(ent)
        return ent

    # --- Regex extraction ---
    # Emails first (so domains from emails can be excluded)
    email_domains: set[str] = set()
    for match in EMAIL_PATTERN.finditer(raw_text):
        email = match.group()
        _add(email, "EMAIL")
        domain_part = email.split("@")[1].lower()
        email_domains.add(domain_part)

    for match in IP_PATTERN.finditer(raw_text):
        ip = match.group()
        # Validate octets
        octets = ip.split(".")
        if all(0 <= int(o) <= 255 for o in octets):
            _add(ip, "IP")

    for match in DOMAIN_PATTERN.finditer(raw_text):
        domain = match.group()
        # Exclude if it's part of an email address already captured
        if domain.lower() not in email_domains:
            _add(domain, "DOMAIN")

    for match in CVE_PATTERN.finditer(raw_text):
        _add(match.group(), "CVE")

    for match in HASH_PATTERN.finditer(raw_text):
        val = match.group()
        # Only keep if looks like a real hash (32 or 64 hex chars)
        if len(val) in (32, 40, 64):
            _add(val, "HASH")

    for match in FILE_PATTERN.finditer(raw_text):
        _add(match.group(), "FILE_IMAGE")

    for match in B64_PATTERN.finditer(raw_text):
        _add(match.group(), "TEXT_BLOB")

    # --- SpaCy extraction (ORG, GPE, PERSON) ---
    _spacy_blocklist = {
        "malware", "ransomware", "trojan", "rootkit", "backdoor",
        "payload", "beacon", "exploit", "phishing", "botnet",
        "keylogger", "spyware", "adware", "worm",
    }
    if _spacy_available and _nlp is not None:
        doc = _nlp(raw_text)
        for ent in doc.ents:
            if ent.label_ in ("ORG", "GPE", "PERSON"):
                text_val = ent.text.strip()
                # Skip if text looks like an IP, number, or is too short
                if IP_PATTERN.fullmatch(text_val):
                    continue
                if re.fullmatch(r"[\d\s.,:]+", text_val):
                    continue
                if len(text_val) < 3:
                    continue
                # Skip if text contains an IP or starts with "IP"
                if text_val.upper().startswith("IP "):
                    continue
                # Skip known cybersecurity false positives
                if text_val.lower() in _spacy_blocklist:
                    continue
                # Strip leading generic prefixes
                for prefix in ("Organization ", "Company ", "Corp "):
                    if text_val.startswith(prefix):
                        text_val = text_val[len(prefix):]
                _add(text_val, ent.label_)

    return entities


def build_relationships(
    entities: list[ExtractedEntity], raw_text: str
) -> list[EntityLink]:
    """
    Build relationship links between extracted entities based on
    co-occurrence in sentences and logical connections.
    """
    links: list[EntityLink] = []
    sentences = re.split(r"(?<=[.!?])\s+|\n+", raw_text)

    # Index: entity label -> entity
    label_to_entity = {e.label.lower(): e for e in entities}

    # Find co-occurring entities within the same sentence
    linked_pairs: set[tuple[str, str]] = set()

    for sentence in sentences:
        sentence_lower = sentence.lower()
        sentence_entities = [
            e for e in entities if e.label.lower() in sentence_lower
        ]

        for i, src in enumerate(sentence_entities):
            for tgt in sentence_entities[i + 1:]:
                pair = tuple(sorted([src.id, tgt.id]))
                if pair not in linked_pairs:
                    linked_pairs.add(pair)
                    # Determine relationship type
                    rel = _infer_relationship(src, tgt)
                    links.append(
                        EntityLink(
                            source_id=src.id,
                            target_id=tgt.id,
                            relationship_type=rel,
                        )
                    )

    # Link emails to their domain if domain is also an entity
    for ent in entities:
        if ent.entity_type == "EMAIL":
            domain_part = ent.label.split("@")[1].lower()
            if domain_part in label_to_entity:
                domain_ent = label_to_entity[domain_part]
                pair = tuple(sorted([ent.id, domain_ent.id]))
                if pair not in linked_pairs:
                    linked_pairs.add(pair)
                    links.append(
                        EntityLink(
                            source_id=ent.id,
                            target_id=domain_ent.id,
                            relationship_type="email_domain",
                        )
                    )

    return links


def _infer_relationship(src: ExtractedEntity, tgt: ExtractedEntity) -> str:
    """Infer a relationship label between two entities based on types."""
    type_pair = frozenset([src.entity_type, tgt.entity_type])

    relationship_map = {
        frozenset(["IP", "DOMAIN"]): "connected_to",
        frozenset(["IP", "IP"]): "communicates_with",
        frozenset(["EMAIL", "DOMAIN"]): "associated_with",
        frozenset(["EMAIL", "IP"]): "authenticated_from",
        frozenset(["EMAIL", "ORG"]): "belongs_to",
        frozenset(["IP", "ORG"]): "targets",
        frozenset(["DOMAIN", "ORG"]): "registered_by",
        frozenset(["CVE", "IP"]): "exploited_on",
        frozenset(["CVE", "DOMAIN"]): "exploited_on",
        frozenset(["HASH", "IP"]): "observed_at",
        frozenset(["HASH", "DOMAIN"]): "observed_at",
    }

    return relationship_map.get(type_pair, "related_to")


def compute_report_hash(content: str) -> str:
    """Compute SHA-256 hash of report content for integrity verification."""
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def process_raw_intel(raw_text: str) -> dict:
    """
    Full processing pipeline: extract, classify, map, hash.

    Returns a dict with entities, links, overall threat level, and hash.
    """
    entities = extract_entities(raw_text)
    links = build_relationships(entities, raw_text)
    threat_level = _classify_threat(raw_text)
    report_hash = compute_report_hash(raw_text)

    return {
        "entities": entities,
        "links": links,
        "threat_level": threat_level,
        "report_hash": report_hash,
    }
