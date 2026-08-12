"""
Tool Registry — Loads plugin JSON configs, provides category grouping,
input sanitization, output capping, and safe async execution.
"""

import json
import os
import re
import glob
import asyncio
import logging
from typing import List, Dict, Any, Optional
from collections import defaultdict

logger = logging.getLogger(__name__)

PLUGINS_DIR = os.path.join(os.path.dirname(__file__), "..", "plugins")

# Maximum output size in bytes (10 KB)
MAX_OUTPUT_BYTES = 10 * 1024

# Characters that are NOT allowed in targets (shell metacharacters)
UNSAFE_CHARS = re.compile(r'[;&|`$(){}!\n\r\\<>]')


def sanitize_target(target: str) -> str:
    """Strip dangerous shell metacharacters from a target string."""
    sanitized = UNSAFE_CHARS.sub('', target).strip()
    # Also limit length to prevent abuse
    return sanitized[:512]


def cap_output(output: str, max_bytes: int = MAX_OUTPUT_BYTES) -> str:
    """Truncate output to max_bytes, appending a notice if truncated."""
    encoded = output.encode("utf-8", errors="replace")
    if len(encoded) <= max_bytes:
        return output
    truncated = encoded[:max_bytes].decode("utf-8", errors="replace")
    return truncated + f"\n\n[OUTPUT TRUNCATED — {len(encoded)} bytes total, showing first {max_bytes}]"


class ToolRegistry:
    def __init__(self):
        self.tools: Dict[str, Dict[str, Any]] = {}
        self.load_plugins()

    def load_plugins(self):
        """Scan the plugins directory for JSON configuration files and load them."""
        if not os.path.exists(PLUGINS_DIR):
            os.makedirs(PLUGINS_DIR, exist_ok=True)
            return

        for filepath in glob.glob(os.path.join(PLUGINS_DIR, "*.json")):
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    tool_config = json.load(f)
                    name = tool_config.get("name")
                    if name:
                        # Apply defaults for backward compatibility
                        tool_config.setdefault("display_name", name.replace("_", " ").title())
                        tool_config.setdefault("speed", "fast")
                        tool_config.setdefault("danger_level", "safe")
                        tool_config.setdefault("timeout", 15)
                        tool_config.setdefault("description", "")
                        tool_config.setdefault("runner", "native")
                        self.tools[name] = tool_config
            except Exception as e:
                logger.error(f"Failed to load plugin {filepath}: {e}")

        logger.info(f"Loaded {len(self.tools)} tool plugins")

    def get_tools_for_entity(self, entity_type: str) -> List[Dict[str, Any]]:
        """Return a list of tools that support the given entity type."""
        available_tools = []
        for tool in self.tools.values():
            if entity_type in tool.get("entity_type", []):
                available_tools.append(tool)
        return available_tools

    def get_tools_grouped_by_category(self, entity_type: Optional[str] = None) -> Dict[str, List[Dict[str, Any]]]:
        """
        Return tools grouped by category.
        If entity_type is provided, only return tools that support that entity type.
        """
        grouped: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        for tool in self.tools.values():
            if entity_type and entity_type not in tool.get("entity_type", []):
                continue
            category = tool.get("category", "Uncategorized")
            # Return a clean subset of fields for the API
            grouped[category].append({
                "name": tool["name"],
                "display_name": tool.get("display_name", tool["name"]),
                "category": category,
                "speed": tool.get("speed", "fast"),
                "danger_level": tool.get("danger_level", "safe"),
                "description": tool.get("description", ""),
                "entity_type": tool.get("entity_type", []),
            })
        return dict(grouped)

    async def execute_tool(self, tool_name: str, target: str, timeout: int = 15) -> str:
        """Execute a tool's command asynchronously with sanitization and output capping."""
        tool = self.tools.get(tool_name)
        if not tool:
            return f"[ERROR] Tool '{tool_name}' not found in registry."

        command_template = tool.get("command", "")
        if not command_template:
            return f"[ERROR] Tool '{tool_name}' has no command configured."

        # Sanitize the target input
        safe_target = sanitize_target(target)
        if not safe_target:
            return "[ERROR] Invalid target after sanitization."

        # Use the tool's configured timeout, or the provided one
        tool_timeout = tool.get("timeout", timeout)

        # Safely inject the sanitized target into the command template
        cmd = command_template.format(target=safe_target)

        try:
            proc = await asyncio.create_subprocess_shell(
                cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            try:
                stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=tool_timeout)
            except asyncio.TimeoutError:
                proc.kill()
                await proc.communicate()
                return f"[TIMEOUT] Tool '{tool_name}' timed out after {tool_timeout}s."

            if proc.returncode == 0:
                output = stdout.decode("utf-8", errors="replace").strip()
                return cap_output(output) if output else "[NO OUTPUT]"
            else:
                err = stderr.decode("utf-8", errors="replace").strip()
                out = stdout.decode("utf-8", errors="replace").strip()
                # Some tools write to stderr even on success
                combined = out or err
                if combined:
                    return cap_output(combined)
                return f"[ERROR] Exit code {proc.returncode}"
        except Exception as e:
            logger.error(f"Error running tool {tool_name}: {e}")
            return f"[ERROR] {str(e)}"


# Global registry instance
registry = ToolRegistry()
