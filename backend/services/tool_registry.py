"""
Tool Registry — Loads plugin JSON configs, dynamically scans installed system tools,
provides category grouping, input sanitization, output capping, custom tool creation,
and safe async streaming execution with adaptive and user-configurable timeouts.
"""

import json
import os
import re
import glob
import asyncio
import signal
import shutil
import logging
from typing import List, Dict, Any, Optional, AsyncGenerator
from collections import defaultdict

from services.dynamic_scanner import tool_scanner, find_system_binary, SPEED_DEFAULT_TIMEOUTS

logger = logging.getLogger(__name__)

PLUGINS_DIR = os.path.join(os.path.dirname(__file__), "..", "plugins")

# Maximum output size in bytes (64 KB)
MAX_OUTPUT_BYTES = 64 * 1024

# Characters that are NOT allowed in targets (shell injection prevention)
UNSAFE_CHARS = re.compile(r'[;&|`$(){}!\n\r\\<>]')


def sanitize_target(target: str) -> str:
    """Strip dangerous shell metacharacters from a target string."""
    sanitized = UNSAFE_CHARS.sub('', target).strip()
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
        self.custom_tools: Dict[str, Dict[str, Any]] = {}
        self.reload_all()

    def reload_all(self):
        """Scan plugins directory and merge with dynamic system scanner."""
        self.tools = {}
        
        # 1. Load dynamically scanned system tools
        scanned = tool_scanner.scan_and_catalog()
        for name, meta in scanned.items():
            self.tools[name] = dict(meta)

        # 2. Overlay static JSON plugins
        if os.path.exists(PLUGINS_DIR):
            for filepath in glob.glob(os.path.join(PLUGINS_DIR, "*.json")):
                try:
                    with open(filepath, "r", encoding="utf-8") as f:
                        tool_config = json.load(f)
                        name = tool_config.get("name")
                        if name:
                            tool_config.setdefault("display_name", name.replace("_", " ").title())
                            speed = tool_config.get("speed", "fast")
                            tool_config.setdefault("speed", speed)
                            tool_config.setdefault("danger_level", "safe")
                            tool_config.setdefault("timeout", SPEED_DEFAULT_TIMEOUTS.get(speed, 60))
                            tool_config.setdefault("description", "")
                            
                            bin_name = tool_config.get("command", "").split()[0] if tool_config.get("command") else name
                            bin_path = find_system_binary(bin_name)
                            tool_config["installed"] = bin_path is not None
                            tool_config["path"] = bin_path or ""
                            
                            self.tools[name] = tool_config
                except Exception as e:
                    logger.error(f"Failed to load plugin {filepath}: {e}")

        # 3. Overlay custom user-defined tools
        for name, tool_config in self.custom_tools.items():
            self.tools[name] = tool_config

        logger.info(f"Tool Registry loaded {len(self.tools)} total tools.")

    def register_custom_tool(self, tool_def: Dict[str, Any]) -> Dict[str, Any]:
        """Allow analysts to add custom commands on the fly."""
        name = tool_def.get("name", "").strip().lower().replace(" ", "_")
        if not name:
            raise ValueError("Tool name is required")
        
        speed = tool_def.get("speed", "medium")
        custom_config = {
            "name": name,
            "display_name": tool_def.get("display_name", name.title()),
            "category": tool_def.get("category", "Custom Suite"),
            "description": tool_def.get("description", ""),
            "command": tool_def.get("command", ""),
            "speed": speed,
            "timeout": tool_def.get("timeout") or SPEED_DEFAULT_TIMEOUTS.get(speed, 120),
            "danger_level": tool_def.get("danger_level", "safe"),
            "entity_type": tool_def.get("entity_type", ["TEXT"]),
            "default_args": tool_def.get("default_args", ""),
            "installed": True,
            "path": "custom",
            "is_custom": True
        }
        self.custom_tools[name] = custom_config
        self.tools[name] = custom_config
        return custom_config

    def get_tool(self, name: str) -> Optional[Dict[str, Any]]:
        return self.tools.get(name)

    def get_tools_grouped_by_category(self, entity_type: Optional[str] = None) -> Dict[str, List[Dict[str, Any]]]:
        """Return all cataloged tools grouped by their category with optional entity filter."""
        grouped: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        for tool in self.tools.values():
            if entity_type:
                tool_entities = [et.upper() for et in tool.get("entity_type", [])]
                if entity_type.upper() not in tool_entities:
                    continue
            grouped[tool.get("category", "Other")].append(tool)
        
        for cat in grouped:
            grouped[cat].sort(key=lambda t: (not t.get("installed", False), t.get("display_name", t["name"]).lower()))
        return dict(grouped)

    def get_tools_for_entity(self, entity_type: str) -> List[Dict[str, Any]]:
        """Return only tools that support the given entity type."""
        matching = []
        for tool in self.tools.values():
            tool_entities = [et.upper() for et in tool.get("entity_type", [])]
            if entity_type.upper() in tool_entities:
                matching.append(tool)
        matching.sort(key=lambda t: (not t.get("installed", False), t.get("display_name", t["name"]).lower()))
        return matching

    def search(self, query: str = "", category: Optional[str] = None, entity_type: Optional[str] = None) -> List[Dict[str, Any]]:
        return tool_scanner.search_tools(query=query, category=category, entity_type=entity_type)

    async def execute_tool(self, tool_name: str, target: str, custom_flags: Optional[str] = None, timeout: Optional[int] = None) -> str:
        """Execute a tool's command asynchronously with sanitization and output capping."""
        chunks = []
        async for chunk in self.execute_tool_stream(tool_name, target, custom_flags, timeout):
            chunks.append(chunk)
        return "".join(chunks)

    async def execute_tool_stream(
        self,
        tool_name: str,
        target: str,
        custom_flags: Optional[str] = None,
        timeout: Optional[int] = None
    ) -> AsyncGenerator[str, None]:
        """
        Execute tool and stream output chunks in real-time.
        Yields text chunks as stdout/stderr arrive with hardened process management.
        """
        tool = self.tools.get(tool_name)
        if not tool:
            yield f"[ERROR] Tool '{tool_name}' not found in registry.\n"
            return

        command_template = tool.get("command", "")
        if not command_template:
            yield f"[ERROR] Tool '{tool_name}' has no command configured.\n"
            return

        safe_target = sanitize_target(target)
        if not safe_target:
            yield "[ERROR] Invalid or empty target after sanitization.\n"
            return

        # Determine effective timeout
        if timeout and timeout > 0:
            effective_timeout = min(max(timeout, 5), 900)
            timeout_note = f"{effective_timeout}s (user configured)"
        else:
            speed = tool.get("speed", "medium")
            effective_timeout = tool.get("timeout", SPEED_DEFAULT_TIMEOUTS.get(speed, 120))
            timeout_note = f"{effective_timeout}s (adaptive default for {speed} scan)"

        # 1. Resolve binary existence
        first_word = command_template.split()[0]
        resolved_bin_path = find_system_binary(first_word)
        
        if not resolved_bin_path and not tool.get("is_custom", False):
            yield f"[!] Tool binary '{first_word}' is not found on your system PATH.\n"
            yield f"[i] To install this tool on EndeavourOS / Arch Linux, run:\n"
            yield f"    sudo pacman -S {first_word.lower()}\n"
            yield f"    (or check BlackArch: sudo pacman -S blackarch-{first_word.lower()})\n\n"
            return

        # 2. Rewrite command if exact binary is resolved
        if resolved_bin_path:
            actual_bin = os.path.basename(resolved_bin_path)
            if first_word != actual_bin and first_word.lower() == actual_bin.lower():
                command_template = actual_bin + command_template[len(first_word):]

        # Build final command
        if "{target}" in command_template:
            cmd = command_template.replace("{target}", safe_target)
        else:
            cmd = f"{command_template} {safe_target}"

        if custom_flags:
            safe_flags = sanitize_target(custom_flags)
            cmd = f"{cmd} {safe_flags}"

        yield f"[*] Initializing execution sequence for {tool.get('display_name', tool_name)}...\n"
        yield f"[*] Executing: {cmd}\n"
        yield f"[*] Target: {safe_target} | Timeout: {timeout_note}\n"
        yield f"--------------------------------------------------\n"

        proc = None
        try:
            # Launch in a new process group for clean process tree termination
            proc = await asyncio.create_subprocess_shell(
                cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                start_new_session=True,
            )

            total_bytes = 0

            # Stream stdout and stderr with timeout
            try:
                while proc.returncode is None:
                    try:
                        line = await asyncio.wait_for(proc.stdout.readline(), timeout=0.1)
                        if line:
                            decoded = line.decode("utf-8", errors="replace")
                            total_bytes += len(line)
                            if total_bytes <= MAX_OUTPUT_BYTES:
                                yield decoded
                        else:
                            break
                    except asyncio.TimeoutError:
                        if proc.returncode is not None:
                            break
                        await asyncio.sleep(0.05)

                stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=effective_timeout)
                if stdout:
                    yield stdout.decode("utf-8", errors="replace")
                if stderr:
                    err_txt = stderr.decode("utf-8", errors="replace").strip()
                    if err_txt:
                        yield f"\n[STDERR]\n{err_txt}\n"
                        lower_err = err_txt.lower()
                        if "privilege" in lower_err or "root" in lower_err or "permission denied" in lower_err or "operation not permitted" in lower_err:
                            yield f"\n[!] PERMISSION NOTE: This scan requested elevated / raw socket capabilities.\n"
                            yield f"[i] Remediation: Use unprivileged flags (e.g. -sT -Pn for nmap) or run: sudo setcap cap_net_raw,cap_net_admin=eip {resolved_bin_path or first_word}\n"
                        elif "wordlist" in lower_err or "no wordlist" in lower_err:
                            yield f"\n[!] ARGUMENT NOTE: This tool requires a wordlist path.\n"
                            yield f"[i] Remediation: Add custom flags (e.g., -w /usr/share/wordlists/dirb/common.txt)\n"

                yield f"\n[+] Process finished with exit code {proc.returncode}\n"

            except asyncio.TimeoutError:
                if proc:
                    try:
                        os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
                        await asyncio.sleep(0.5)
                        os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
                    except Exception:
                        try:
                            proc.kill()
                        except Exception:
                            pass
                yield f"\n[!] TIMEOUT: Tool '{tool_name}' exceeded {effective_timeout}s limit.\n"
                yield f"[i] Tip: You can adjust execution timeout using the timeout dropdown before launching.\n"

        except Exception as e:
            logger.error(f"Execution error for {tool_name}: {e}")
            yield f"\n[ERROR] Execution failed: {str(e)}\n"


# Global registry instance
registry = ToolRegistry()
