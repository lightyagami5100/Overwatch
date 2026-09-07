"""
Intelligence processor: extracts entities, classifies threats, and maps
relationships from raw unstructured text and security logs.

Uses a multi-tier extraction approach:
  1. Regex & Defang normalization for IPs, IPv6, CIDR, domains, URLs, CVEs,
     MITRE ATT&CK IDs, Hashes (MD5/SHA1/SHA256/SHA512), and Crypto wallets.
  2. SpaCy (en_core_web_sm) for ORG, GPE, PERSON extraction.
  3. LLM (MiniMax / Mistral / DeepSeek via Ollama) for ambiguous / natural-language entities.
  4. STIX 2.1 Bundle serialization engine.
Falls back gracefully at every tier.
"""

import hashlib
import ipaddress
import re
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional, List, Dict, Set, Tuple, Any
import logging

logger = logging.getLogger(__name__)

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
        _spacy_available = False
except ImportError:
    _spacy_available = False


# ---------------------------------------------------------------------------
# Defang & Refang Normalization Engine
# ---------------------------------------------------------------------------

def normalize_defanged(text: str) -> str:
    """
    Normalize defanged security indicators into standard machine-readable format.
    Handles hxxp://, [.] or (dot), [at] or (@), [:] or (colon), etc.
    """
    normalized = text
    # hxxp:// or hxxps:// or fxp://
    normalized = re.sub(r'\bhxxp(s)?:\/\/', r'http\1://', normalized, flags=re.IGNORECASE)
    normalized = re.sub(r'\bfxp(s)?:\/\/', r'ftp\1://', normalized, flags=re.IGNORECASE)
    # [.] or (dot) or {dot} or [dot] or (.) -> .
    normalized = re.sub(r'\[\.\]|\(dot\)|\{dot\}|\[dot\]|\(\.\)', '.', normalized, flags=re.IGNORECASE)
    # [:] or (colon) or {colon} -> :
    normalized = re.sub(r'\[\:\]|\(colon\)|\{colon\}', ':', normalized, flags=re.IGNORECASE)
    # [@] or (at) or [at] or {at} or me[at] -> @
    normalized = re.sub(r'\[@\]|\(at\)|\{at\}|\[at\]', '@', normalized, flags=re.IGNORECASE)
    # [/] or (slash) -> /
    normalized = re.sub(r'\[\/\]|\(slash\)', '/', normalized, flags=re.IGNORECASE)
    return normalized


def defang_indicator(text: str) -> str:
    """Convert dangerous indicators to safe defanged format for reports."""
    defanged = text
    defanged = re.sub(r'http(s)?://', r'hxxp\1://', defanged, flags=re.IGNORECASE)
    defanged = defanged.replace('.', '[.]')
    defanged = defanged.replace('@', '[@]')
    return defanged


# ---------------------------------------------------------------------------
# Comprehensive Regex Patterns
# ---------------------------------------------------------------------------

IP_RAW_PATTERN = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")
CIDR_PATTERN = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}/\d{1,2}\b")
IPV6_PATTERN = re.compile(r"\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,7}:|(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}\b")
EMAIL_PATTERN = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
DOMAIN_PATTERN = re.compile(
    r"\b(?:[a-z0-9](?:[a-z0-9\-]*[a-z0-9])?\.)+(?:com|net|org|io|ru|cn|uk|de|"
    r"fr|gov|edu|mil|co|info|biz|local|xyz|onion|site|top|me|cc|cloud|app|tech|gov|net|live)\b",
    re.IGNORECASE,
)
CVE_PATTERN = re.compile(r"\bCVE-\d{4}-\d{4,}\b", re.IGNORECASE)
MITRE_PATTERN = re.compile(r"\bT\d{4}(?:\.\d{3})?\b", re.IGNORECASE)
BTC_WALLET_PATTERN = re.compile(r"\b(?:bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}\b")
ETH_WALLET_PATTERN = re.compile(r"\b0x[a-fA-F0-9]{40}\b")
MD5_PATTERN = re.compile(r"\b[a-fA-F0-9]{32}\b")
SHA1_PATTERN = re.compile(r"\b[a-fA-F0-9]{40}\b")
SHA256_PATTERN = re.compile(r"\b[a-fA-F0-9]{64}\b")
SHA512_PATTERN = re.compile(r"\b[a-fA-F0-9]{128}\b")
FILE_PATTERN = re.compile(r"\b[\w\-\.]+\.(?:exe|dll|elf|so|bin|py|sh|ps1|vbs|bat|pdf|docx|zip|tar|gz|jpg|png|pcap|msi|vba)\b", re.IGNORECASE)

# Suppress software version false positives matching IPv4 regex (e.g. "v1.2.3.4", "version 2.4.1.0", "nginx-1.18.0.1")
VERSION_CONTEXT_PATTERN = re.compile(
    r"(?:version|ver|v|build|release|sdk|node|python|kernel|[a-z0-9_\-\.]+[\-/v_])\s*v?$",
    re.IGNORECASE,
)

CRITICAL_KEYWORDS = {
    "malicious", "attack", "exploit", "exfiltration", "c2", "command and control",
    "ransomware", "apt", "compromised", "breach", "critical", "trojan", "backdoor",
    "rootkit", "zero-day", "payload", "beacon", "cobalt strike", "mimikatz",
    "privilege escalation", "lateral movement", "persistence", "keylogger",
    "unauthorized access", "data exfiltration", "credential dumping"
}

SUSPICIOUS_KEYWORDS = {
    "suspicious", "unusual", "anomaly", "unknown", "unauthorized", "failed",
    "brute force", "reconnaissance", "scanning", "abnormal", "unregistered",
    "port scan", "fuzzing", "probing", "suspicious login", "elevated", "warning"
}


@dataclass
class ExtractedEntity:
    """A single extracted entity with metadata."""
    label: str
    entity_type: str  # IP, CIDR, EMAIL, DOMAIN, ORG, PERSON, GPE, CVE, MITRE, HASH, WALLET, FILE
    threat_level: str = "BENIGN"
    group: int = 0
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    tool_results: Optional[str] = None


@dataclass
class EntityLink:
    """A relationship between two entities."""
    source_id: str
    target_id: str
    relationship_type: str
    id: str = field(default_factory=lambda: str(uuid.uuid4()))


def _is_valid_ipv4(ip_str: str, surrounding_context: str = "") -> bool:
    """
    Validate that an IPv4 candidate has valid 0-255 octets
    and is not a software version number (e.g., 'version 1.2.3.4' or 'v1.0.0.1').
    """
    try:
        ipaddress.IPv4Address(ip_str)
        # Check context for version prefixes
        if surrounding_context:
            prefix = surrounding_context.strip().lower()
            if VERSION_CONTEXT_PATTERN.search(prefix):
                return False
        return True
    except (ipaddress.AddressValueError, ValueError):
        return False


def _is_valid_ipv6(ip_str: str) -> bool:
    """Validate that an IPv6 candidate is a valid RFC-compliant address."""
    try:
        ipaddress.IPv6Address(ip_str)
        return True
    except (ipaddress.AddressValueError, ValueError):
        return False


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
    """Classify individual entity threat by checking sentence proximity."""
    text_lower = text.lower()
    label_lower = entity_label.lower()

    sentences = re.split(r"(?<=[.!?])\s+|\n+", text)
    entity_sentences: list[str] = []

    for i, s in enumerate(sentences):
        if label_lower in s.lower():
            context = s.lower()
            if i > 0:
                context = sentences[i - 1].lower() + " " + context
            if i < len(sentences) - 1:
                context = context + " " + sentences[i + 1].lower()
            entity_sentences.append(context)

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
    Extract entities from raw text using a multi-tier approach:
      1. Normalization & Regex (IPs, IPv6, CIDR, emails, domains, hashes, CVEs, MITRE, Crypto)
      2. SpaCy NER (ORG, GPE, PERSON)
      3. LLM via Ollama (ambiguous / contextual entities)
    """
    normalized_text = normalize_defanged(raw_text)
    seen_labels: set[str] = set()
    entities: list[ExtractedEntity] = []

    def _add(label: str, etype: str) -> Optional[ExtractedEntity]:
        clean = label.strip().rstrip(".,:;)")
        normalized = clean.lower()
        if normalized in seen_labels or len(clean) < 2:
            return None

        # Strict type guard
        if etype == "IP":
            if not _is_valid_ipv4(clean) and not _is_valid_ipv6(clean):
                return None
        elif etype in ("DOMAIN", "ORG", "PERSON", "GPE"):
            if re.fullmatch(r"(?:\d{1,3}\.){3}\d{1,3}", clean):
                return None

        seen_labels.add(normalized)
        threat = _classify_entity_threat(clean, normalized_text)
        ent = ExtractedEntity(
            label=clean,
            entity_type=etype,
            threat_level=threat,
            group=_threat_to_group(threat),
        )
        entities.append(ent)
        return ent

    # --- Tier 1: Specialized Regex Extraction ---
    # 1. Emails & domains
    email_domains: set[str] = set()
    for match in EMAIL_PATTERN.finditer(normalized_text):
        email = match.group()
        _add(email, "EMAIL")
        domain_part = email.split("@")[1].lower()
        email_domains.add(domain_part)

    # 2. CIDR Subnets
    cidr_matches: set[str] = set()
    for match in CIDR_PATTERN.finditer(normalized_text):
        cidr_str = match.group()
        try:
            ipaddress.IPv4Network(cidr_str, strict=False)
            _add(cidr_str, "CIDR")
            cidr_matches.add(cidr_str.split("/")[0])
        except Exception:
            pass

    # 3. IPv4 (Strict 0-255 octets & version string suppression)
    for match in IP_RAW_PATTERN.finditer(normalized_text):
        ip = match.group()
        if ip in cidr_matches:
            continue
        start_idx = match.start()
        context_before = normalized_text[max(0, start_idx - 20):start_idx]
        if _is_valid_ipv4(ip, context_before):
            _add(ip, "IP")

    # 4. IPv6
    for match in IPV6_PATTERN.finditer(normalized_text):
        ipv6_str = match.group()
        try:
            ipaddress.IPv6Address(ipv6_str)
            _add(ipv6_str, "IP")
        except Exception:
            pass

    # 5. Domains
    for match in DOMAIN_PATTERN.finditer(normalized_text):
        domain = match.group()
        if domain.lower() not in email_domains:
            _add(domain, "DOMAIN")

    # 6. CVEs
    for match in CVE_PATTERN.finditer(normalized_text):
        _add(match.group().upper(), "CVE")

    # 7. MITRE ATT&CK Techniques
    for match in MITRE_PATTERN.finditer(normalized_text):
        _add(match.group().upper(), "MITRE")

    # 8. Cryptographic Hashes
    # SHA-512
    for match in SHA512_PATTERN.finditer(normalized_text):
        _add(match.group().lower(), "HASH")
    # SHA-256
    for match in SHA256_PATTERN.finditer(normalized_text):
        _add(match.group().lower(), "HASH")
    # SHA-1
    for match in SHA1_PATTERN.finditer(normalized_text):
        _add(match.group().lower(), "HASH")
    # MD5
    for match in MD5_PATTERN.finditer(normalized_text):
        _add(match.group().lower(), "HASH")

    # 9. Crypto Wallets
    for match in BTC_WALLET_PATTERN.finditer(normalized_text):
        _add(match.group(), "WALLET")
    for match in ETH_WALLET_PATTERN.finditer(normalized_text):
        _add(match.group(), "WALLET")

    # 10. File Artifacts
    for match in FILE_PATTERN.finditer(normalized_text):
        _add(match.group(), "FILE")

    # --- Tier 2: SpaCy NER (ORG, GPE, PERSON) ---
    _spacy_blocklist = {
        "malware", "ransomware", "trojan", "rootkit", "backdoor",
        "payload", "beacon", "exploit", "phishing", "botnet",
        "keylogger", "spyware", "adware", "worm", "incident report",
        "threat intelligence", "severity", "critical", "suspicious", "benign"
    }
    if _spacy_available and _nlp is not None:
        try:
            doc = _nlp(normalized_text)
            for ent in doc.ents:
                if ent.label_ in ("ORG", "GPE", "PERSON"):
                    text_val = ent.text.strip()
                    if IP_RAW_PATTERN.fullmatch(text_val) or re.fullmatch(r"[\d\s.,:]+", text_val):
                        continue
                    if len(text_val) < 3 or text_val.lower() in _spacy_blocklist:
                        continue
                    if text_val.upper().startswith("IP "):
                        continue
                    for prefix in ("Organization ", "Company ", "Corp "):
                        if text_val.startswith(prefix):
                            text_val = text_val[len(prefix):]
                    _add(text_val, ent.label_)
        except Exception as exc:
            logger.debug(f"SpaCy processing skipped: {exc}")

    # --- Tier 3: LLM Extraction (Ollama Enrichment) ---
    try:
        from services.llm_extractor import extract_entities_with_llm
        llm_entities = extract_entities_with_llm(normalized_text)
        for ent_dict in llm_entities:
            label = ent_dict.get("label", "")
            etype = ent_dict.get("entity_type", "")
            if label and etype:
                _add(label, etype)
    except Exception as exc:
        logger.debug(f"LLM extraction skipped: {exc}")

    return entities


def build_relationships(entities: list[ExtractedEntity], raw_text: str) -> list[EntityLink]:
    """
    Build relationship links between extracted entities based on
    co-occurrence in sentences and contextual ontology.
    """
    links: list[EntityLink] = []
    normalized_text = normalize_defanged(raw_text)
    sentences = re.split(r"(?<=[.!?])\s+|\n+", normalized_text)

    label_to_entity = {e.label.lower(): e for e in entities}
    linked_pairs: set[tuple[str, str]] = set()

    for sentence in sentences:
        sentence_lower = sentence.lower()
        sentence_entities = [e for e in entities if e.label.lower() in sentence_lower]

        for i, src in enumerate(sentence_entities):
            for tgt in sentence_entities[i + 1:]:
                pair = tuple(sorted([src.id, tgt.id]))
                if pair not in linked_pairs:
                    linked_pairs.add(pair)
                    rel = _infer_relationship(src, tgt)
                    links.append(
                        EntityLink(
                            source_id=src.id,
                            target_id=tgt.id,
                            relationship_type=rel,
                        )
                    )

    # Cross-link emails to their root domain
    for ent in entities:
        if ent.entity_type == "EMAIL" and "@" in ent.label:
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
        frozenset(["IP", "DOMAIN"]): "resolves_to",
        frozenset(["IP", "IP"]): "communicates_with",
        frozenset(["IP", "CIDR"]): "member_of_subnet",
        frozenset(["EMAIL", "DOMAIN"]): "associated_domain",
        frozenset(["EMAIL", "IP"]): "authenticated_from",
        frozenset(["EMAIL", "ORG"]): "belongs_to",
        frozenset(["IP", "ORG"]): "hosted_by",
        frozenset(["DOMAIN", "ORG"]): "registered_by",
        frozenset(["CVE", "IP"]): "vulnerability_on",
        frozenset(["CVE", "DOMAIN"]): "vulnerability_on",
        frozenset(["CVE", "MITRE"]): "maps_to_technique",
        frozenset(["HASH", "IP"]): "observed_at",
        frozenset(["HASH", "FILE"]): "file_digest",
        frozenset(["HASH", "DOMAIN"]): "c2_payload",
        frozenset(["WALLET", "PERSON"]): "owned_by",
        frozenset(["WALLET", "ORG"]): "associated_wallet",
    }

    return relationship_map.get(type_pair, "related_to")


def compute_report_hash(content: str) -> str:
    """Compute SHA-256 hash of report content for integrity verification."""
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def process_raw_intel(raw_text: str) -> dict:
    """Full processing pipeline: extract, classify, map, hash."""
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


# ---------------------------------------------------------------------------
# STIX 2.1 JSON Bundle Generator
# ---------------------------------------------------------------------------

def generate_stix2_bundle(
    case_file_id: str,
    filename: str,
    threat_level: str,
    sha256_hash: str,
    created_at: datetime,
    nodes: list[Any],
    links: list[Any],
    raw_content: str,
) -> dict:
    """
    Generate an authentic OASIS STIX 2.1 Specification JSON Bundle
    with Indicators, Observed Data, Relationships, and Report SDOs.
    """
    created_str = created_at.strftime("%Y-%m-%dT%H:%M:%S.000Z") if isinstance(created_at, datetime) else str(created_at)
    bundle_id = f"bundle--{uuid.uuid5(uuid.NAMESPACE_DNS, case_file_id)}"

    confidence_map = {"CRITICAL": 95, "SUSPICIOUS": 70, "BENIGN": 20}
    confidence = confidence_map.get(threat_level, 50)

    stix_objects = []
    object_refs = []

    # Map each extracted entity to a STIX Indicator / SCO pattern
    node_to_stix_id: dict[str, str] = {}

    for node in nodes:
        node_id = getattr(node, "id", str(uuid.uuid4()))
        label = getattr(node, "label", "")
        etype = getattr(node, "entity_type", "TEXT")
        node_threat = getattr(node, "threat_level", "BENIGN")

        pattern = None
        if etype == "IP":
            pattern = f"[ipv4-addr:value = '{label}']"
        elif etype == "DOMAIN":
            pattern = f"[domain-name:value = '{label}']"
        elif etype == "EMAIL":
            pattern = f"[email-addr:value = '{label}']"
        elif etype == "HASH":
            if len(label) == 32:
                pattern = f"[file:hashes.MD5 = '{label}']"
            elif len(label) == 40:
                pattern = f"[file:hashes.'SHA-1' = '{label}']"
            elif len(label) == 64:
                pattern = f"[file:hashes.'SHA-256' = '{label}']"
            else:
                pattern = f"[file:hashes.'SHA-512' = '{label}']"
        elif etype == "CVE":
            pattern = f"[vulnerability:name = '{label}']"
        elif etype == "MITRE":
            pattern = f"[attack-pattern:external_references[0].external_id = '{label}']"
        elif etype == "FILE":
            pattern = f"[file:name = '{label}']"
        else:
            pattern = f"[x-custom:value = '{label}']"

        stix_id = f"indicator--{uuid.uuid5(uuid.NAMESPACE_DNS, node_id)}"
        node_to_stix_id[node_id] = stix_id

        indicator_obj = {
            "type": "indicator",
            "spec_version": "2.1",
            "id": stix_id,
            "created": created_str,
            "modified": created_str,
            "name": f"{etype}: {label}",
            "description": f"Extracted {etype} indicator with {node_threat} threat rating.",
            "indicator_types": ["malicious-activity" if node_threat == "CRITICAL" else "anomalous-activity"],
            "pattern": pattern,
            "pattern_type": "stix",
            "pattern_version": "2.1",
            "valid_from": created_str,
            "confidence": confidence_map.get(node_threat, 40),
            "labels": [etype.lower(), node_threat.lower()],
        }
        stix_objects.append(indicator_obj)
        object_refs.append(stix_id)

    # Add STIX Relationships
    for link in links:
        src_id = getattr(link, "source_node_id", "")
        tgt_id = getattr(link, "target_node_id", "")
        rel_type = getattr(link, "relationship_type", "related-to").replace("_", "-")

        stix_src = node_to_stix_id.get(src_id)
        stix_tgt = node_to_stix_id.get(tgt_id)

        if stix_src and stix_tgt:
            rel_obj = {
                "type": "relationship",
                "spec_version": "2.1",
                "id": f"relationship--{uuid.uuid4()}",
                "created": created_str,
                "modified": created_str,
                "relationship_type": rel_type,
                "source_ref": stix_src,
                "target_ref": stix_tgt,
            }
            stix_objects.append(rel_obj)
            object_refs.append(rel_obj["id"])

    # Master STIX Report SDO
    report_id = f"report--{uuid.uuid5(uuid.NAMESPACE_DNS, case_file_id)}"
    report_obj = {
        "type": "report",
        "spec_version": "2.1",
        "id": report_id,
        "created": created_str,
        "modified": created_str,
        "name": f"Overwatch Incident Report — {filename}",
        "description": f"Cyber incident report with {threat_level} severity rating. Cryptographic SHA-256 seal: {sha256_hash}",
        "report_types": ["threat-report"],
        "published": created_str,
        "confidence": confidence,
        "object_refs": object_refs,
        "labels": ["overwatch-protocol", threat_level.lower()],
    }
    stix_objects.append(report_obj)

    return {
        "type": "bundle",
        "id": bundle_id,
        "spec_version": "2.1",
        "objects": stix_objects,
    }
