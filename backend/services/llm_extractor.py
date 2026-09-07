"""
LLM-powered entity extraction using Ollama (prefers MiniMax cloud model).

Sends raw intelligence text to the LLM with a structured prompt that asks
for JSON output. Falls back gracefully (returns []) when Ollama is
unreachable or the response isn't valid JSON.
"""

import os
import json
import logging
import urllib.request
import urllib.error

logger = logging.getLogger(__name__)

# Candidate Ollama base URLs to probe
DEFAULT_CANDIDATES = [
    os.environ.get("OLLAMA_HOST", "").strip(),
    "http://127.0.0.1:11435",
    "http://127.0.0.1:11434",
    "http://localhost:11435",
    "http://localhost:11434",
]

# Prefer MiniMax for its strong reasoning; fall back to any available model.
PREFERRED_MODELS = [
    "minimax-m3:cloud",
    "mistral:latest",
    "deepseek-r1:8b",
    "gemma3:1b",
    "llama3:latest",
    "qwen2.5:latest",
]


def _get_active_ollama_base() -> tuple[str | None, str | None]:
    """Find an active Ollama instance and its best available model."""
    for base in DEFAULT_CANDIDATES:
        if not base:
            continue
        if not base.startswith("http"):
            base = f"http://{base}"
        base = base.rstrip("/")

        try:
            req = urllib.request.Request(
                f"{base}/api/tags",
                headers={"Content-Type": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=2) as resp:
                data = json.loads(resp.read().decode())
                available = {m["name"] for m in data.get("models", [])}
                for preferred in PREFERRED_MODELS:
                    if preferred in available:
                        return base, preferred
                # Fall back to whatever is first
                if available:
                    return base, next(iter(available))
                return base, None
        except Exception:
            continue
    return None, None

EXTRACTION_PROMPT = """\
You are a cybersecurity threat-intelligence analyst.

TASK: Extract every entity you can find from the TEXT below.

ENTITY TYPES (use ONLY these):
  IP       – IPv4 / IPv6 addresses
  EMAIL    – email addresses
  DOMAIN   – hostnames / domain names
  ORG      – organisations, companies, APT groups, threat-actor groups
  PERSON   – individual names, usernames, aliases, handles
  GPE      – countries, cities, geopolitical locations
  CVE      – CVE identifiers
  HASH     – file hashes (MD5 / SHA-1 / SHA-256)

RULES:
1. Return ONLY a JSON array.  No markdown fences, no commentary.
2. Each element must be an object with exactly these keys:
   {{ "label": "<value>", "entity_type": "<TYPE>" }}
3. If the text mentions a threat actor group name, use entity_type "ORG".
4. If the text mentions a person's name or alias/handle, use "PERSON".
5. If a country or city is mentioned, use "GPE".
6. Normalise labels: strip surrounding whitespace and quotes.
7. If no entities are found, return an empty array: []
8. Do NOT invent entities that are not in the text.

TEXT:
{text}

JSON:"""


def _get_available_model() -> str | None:
    """Pick the best available model from Ollama."""
    try:
        req = urllib.request.Request(
            f"{OLLAMA_BASE}/api/tags",
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=3) as resp:
            data = json.loads(resp.read().decode())
            available = {m["name"] for m in data.get("models", [])}
            for preferred in PREFERRED_MODELS:
                if preferred in available:
                    return preferred
            # Fall back to whatever is first
            return next(iter(available), None)
    except Exception as exc:
        logger.debug(f"Could not list Ollama models: {exc}")
        return None


def _parse_json_response(text: str) -> list[dict]:
    """Best-effort JSON array extraction from LLM output."""
    text = text.strip()

    # Strip markdown code fences if present
    if text.startswith("```"):
        lines = text.splitlines()
        lines = [l for l in lines if not l.strip().startswith("```")]
        text = "\n".join(lines).strip()

    # Try direct parse
    try:
        parsed = json.loads(text)
        if isinstance(parsed, list):
            return parsed
    except json.JSONDecodeError:
        pass

    # Try to find the first [ ... ] block
    start = text.find("[")
    end = text.rfind("]")
    if start != -1 and end != -1 and end > start:
        try:
            parsed = json.loads(text[start : end + 1])
            if isinstance(parsed, list):
                return parsed
        except json.JSONDecodeError:
            pass

    return []


# Allowed entity types (must match frontend GraphNode.entity_type union)
_VALID_TYPES = {"IP", "EMAIL", "DOMAIN", "ORG", "PERSON", "GPE", "CVE", "HASH"}

# Map common LLM inventions to valid types
_TYPE_ALIASES = {
    "THREAT_ACTOR": "ORG",
    "APT": "ORG",
    "GROUP": "ORG",
    "MALWARE": "ORG",
    "CAMPAIGN": "ORG",
    "USERNAME": "PERSON",
    "HANDLE": "PERSON",
    "ALIAS": "PERSON",
    "COUNTRY": "GPE",
    "CITY": "GPE",
    "LOCATION": "GPE",
    "URL": "DOMAIN",
    "HOSTNAME": "DOMAIN",
    "FILE_HASH": "HASH",
    "MD5": "HASH",
    "SHA256": "HASH",
    "SHA1": "HASH",
    "VULNERABILITY": "CVE",
    "ORGANIZATION": "ORG",
    "ORGANISATION": "ORG",
}


def _normalise_entity(raw: dict) -> dict | None:
    """Validate and normalise a single entity dict from the LLM."""
    label = raw.get("label", "").strip()
    etype = raw.get("entity_type", "").strip().upper()

    if not label or len(label) < 2:
        return None

    # Map aliases
    etype = _TYPE_ALIASES.get(etype, etype)

    if etype not in _VALID_TYPES:
        return None

    return {"label": label, "entity_type": etype}


def extract_entities_with_llm(raw_text: str) -> list[dict]:
    """
    Call the LLM to extract entities from *raw_text*.

    Returns a list of ``{"label": ..., "entity_type": ...}`` dicts.
    Returns ``[]`` on any failure so the caller can fall back to
    regex / SpaCy extraction without interruption.
    """
    base_url, model = _get_active_ollama_base()
    if not base_url or not model:
        logger.debug("No Ollama instance or model available – skipping LLM extraction.")
        return []

    logger.info(f"Running LLM entity extraction via {base_url} with model '{model}' ...")

    try:
        prompt = EXTRACTION_PROMPT.format(text=raw_text[:4000])

        payload = json.dumps(
            {
                "model": model,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0.1,
                    "num_predict": 2048,
                },
            }
        ).encode("utf-8")

        req = urllib.request.Request(
            f"{base_url}/api/generate",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        # Generous timeout — cloud model can be slow on first call
        with urllib.request.urlopen(req, timeout=90) as resp:
            result = json.loads(resp.read().decode())
            response_text = result.get("response", "")

        raw_entities = _parse_json_response(response_text)

        entities = []
        for raw in raw_entities:
            normalised = _normalise_entity(raw)
            if normalised:
                entities.append(normalised)

        logger.info(f"LLM extracted {len(entities)} entities using {model}.")
        return entities

    except urllib.error.URLError as exc:
        logger.warning(f"LLM extraction failed (network): {exc}")
        return []
    except Exception as exc:
        logger.warning(f"LLM extraction failed: {exc}")
        return []
