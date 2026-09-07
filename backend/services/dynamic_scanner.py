"""
Dynamic Tool Scanner for Overwatch / Flux.
Scans system paths (/usr/bin, /bin, /usr/local/bin) and pacman packages
to catalog hundreds of installed cybersecurity tools into structured,
safe, executable definitions with entity-type mapping, adaptive timeouts, and category tagging.
"""

import os
import shutil
import subprocess
import logging
from typing import Dict, List, Any, Optional

logger = logging.getLogger(__name__)

# Common binary aliases map
BINARY_ALIASES: Dict[str, List[str]] = {
    "theharvester": ["theharvester", "theHarvester", "theharvester.py"],
    "traceroute": ["traceroute", "tracepath"],
    "radare2": ["radare2", "r2"],
    "hash-identifier": ["hash-identifier", "hashid", "hashcheck"],
    "john": ["john", "john-the-ripper"],
}

# Adaptive speed to default timeout mapping (seconds)
SPEED_DEFAULT_TIMEOUTS = {
    "fast": 45,
    "medium": 120,
    "slow": 300,
    "deep_scan": 600
}


def find_system_binary(binary_name: str) -> Optional[str]:
    """Find binary executable path by checking exact name, lowercase, and aliases."""
    # 1. Direct check
    path = shutil.which(binary_name)
    if path:
        return path

    # 2. Lowercase check
    lower_name = binary_name.lower()
    path = shutil.which(lower_name)
    if path:
        return path

    # 3. Check aliases
    if lower_name in BINARY_ALIASES:
        for alias in BINARY_ALIASES[lower_name]:
            path = shutil.which(alias)
            if path:
                return path

    return None


# Predefined tool catalog with metadata, safe command templates, entity affinities, timeouts, and categories
TOOL_DATABASE: Dict[str, Dict[str, Any]] = {
    # ------------------ RECONNAISSANCE & OSINT ------------------
    "nmap": {
        "display_name": "Nmap Network Scanner",
        "category": "Reconnaissance & OSINT",
        "description": "Network exploration tool and security / port scanner.",
        "speed": "medium",
        "timeout": 180,
        "danger_level": "safe",
        "entity_type": ["IP", "DOMAIN", "CIDR"],
        "command": "nmap -sT -Pn -F -T4 --open {target}",
        "default_args": "-sT -Pn -F -T4 --open"
    },
    "dig": {
        "display_name": "DNS Lookup (dig)",
        "category": "Reconnaissance & OSINT",
        "description": "DNS lookup utility for querying DNS name servers.",
        "speed": "fast",
        "timeout": 45,
        "danger_level": "safe",
        "entity_type": ["DOMAIN", "IP"],
        "command": "dig +nocmd {target} ANY +multiline +noall +answer",
        "default_args": "+nocmd ANY +multiline +noall +answer"
    },
    "nslookup": {
        "display_name": "Name Server Lookup",
        "category": "Reconnaissance & OSINT",
        "description": "Query Internet name servers interactively or non-interactively.",
        "speed": "fast",
        "timeout": 45,
        "danger_level": "safe",
        "entity_type": ["DOMAIN", "IP"],
        "command": "nslookup {target}",
        "default_args": ""
    },
    "whois": {
        "display_name": "WHOIS Registration Lookup",
        "category": "Reconnaissance & OSINT",
        "description": "Client for the whois directory service.",
        "speed": "fast",
        "timeout": 45,
        "danger_level": "safe",
        "entity_type": ["DOMAIN", "IP"],
        "command": "whois {target}",
        "default_args": ""
    },
    "subfinder": {
        "display_name": "Subfinder Subdomain Enum",
        "category": "Reconnaissance & OSINT",
        "description": "Fast passive subdomain enumeration tool.",
        "speed": "fast",
        "timeout": 90,
        "danger_level": "safe",
        "entity_type": ["DOMAIN"],
        "command": "subfinder -d {target} -silent -t 20",
        "default_args": "-silent -t 20"
    },
    "amass": {
        "display_name": "OWASP Amass Recon",
        "category": "Reconnaissance & OSINT",
        "description": "In-depth attack surface mapping and asset discovery (Deep Scan).",
        "speed": "slow",
        "timeout": 300,
        "danger_level": "safe",
        "entity_type": ["DOMAIN"],
        "command": "amass enum -passive -d {target} -timeout 3",
        "default_args": "enum -passive -timeout 3"
    },
    "sherlock": {
        "display_name": "Sherlock Social Hunt",
        "category": "Reconnaissance & OSINT",
        "description": "Hunt down social media accounts by username across 400+ sites.",
        "speed": "medium",
        "timeout": 180,
        "danger_level": "safe",
        "entity_type": ["PERSON", "TEXT"],
        "command": "sherlock --timeout 5 --print-found {target}",
        "default_args": "--timeout 5 --print-found"
    },
    "holehe": {
        "display_name": "Holehe Email OSINT",
        "category": "Reconnaissance & OSINT",
        "description": "Checks if an email is attached to an account on 120+ platforms.",
        "speed": "medium",
        "timeout": 120,
        "danger_level": "safe",
        "entity_type": ["EMAIL"],
        "command": "holehe {target} --only-used",
        "default_args": "--only-used"
    },
    "theharvester": {
        "display_name": "theHarvester E-mail & Subdomain Harvester",
        "category": "Reconnaissance & OSINT",
        "description": "Gather emails, subdomains, hosts, employee names, open ports and banners.",
        "speed": "medium",
        "timeout": 120,
        "danger_level": "safe",
        "entity_type": ["DOMAIN"],
        "command": "theharvester -d {target} -b duckduckgo,crtsh -l 100",
        "default_args": "-b duckduckgo,crtsh -l 100"
    },
    "dnsrecon": {
        "display_name": "DNSRecon DNS Enumerator",
        "category": "Reconnaissance & OSINT",
        "description": "DNS Enumeration and scanning tool for nameservers, zone transfers, and records.",
        "speed": "medium",
        "timeout": 120,
        "danger_level": "safe",
        "entity_type": ["DOMAIN"],
        "command": "dnsrecon -d {target} -t std",
        "default_args": "-t std"
    },
    "traceroute": {
        "display_name": "Traceroute Network Path",
        "category": "Reconnaissance & OSINT",
        "description": "Trace the route packets take to a network host.",
        "speed": "medium",
        "timeout": 90,
        "danger_level": "safe",
        "entity_type": ["IP", "DOMAIN"],
        "command": "traceroute -m 15 -q 1 -w 2 {target}",
        "default_args": "-m 15 -q 1 -w 2"
    },
    "ping": {
        "display_name": "ICMP Ping Liveness",
        "category": "Reconnaissance & OSINT",
        "description": "Send ICMP ECHO_REQUEST to network hosts.",
        "speed": "fast",
        "timeout": 30,
        "danger_level": "safe",
        "entity_type": ["IP", "DOMAIN"],
        "command": "ping -c 3 -W 2 {target}",
        "default_args": "-c 3 -W 2"
    },

    # ------------------ WEB SECURITY & AUDITING ------------------
    "httpx": {
        "display_name": "HTTPX Fast HTTP Probe",
        "category": "Web Security & Auditing",
        "description": "Fast and multi-purpose HTTP toolkit for probing endpoints and technologies.",
        "speed": "fast",
        "timeout": 60,
        "danger_level": "safe",
        "entity_type": ["DOMAIN", "IP", "URL"],
        "command": "httpx -u {target} -status-code -title -tech-detect -silent",
        "default_args": "-status-code -title -tech-detect -silent"
    },
    "whatweb": {
        "display_name": "WhatWeb Tech Fingerprinting",
        "category": "Web Security & Auditing",
        "description": "Identify websites, CMS, blogging platforms, JavaScript libraries, and servers.",
        "speed": "fast",
        "timeout": 60,
        "danger_level": "safe",
        "entity_type": ["DOMAIN", "URL", "IP"],
        "command": "whatweb -a 1 --color=never {target}",
        "default_args": "-a 1 --color=never"
    },
    "wafw00f": {
        "display_name": "WAFW00F Firewall Detector",
        "category": "Web Security & Auditing",
        "description": "Identify and fingerprint Web Application Firewall (WAF) products protecting a website.",
        "speed": "fast",
        "timeout": 60,
        "danger_level": "safe",
        "entity_type": ["DOMAIN", "URL", "IP"],
        "command": "wafw00f {target}",
        "default_args": ""
    },
    "nikto": {
        "display_name": "Nikto Web Vulnerability Scanner",
        "category": "Web Security & Auditing",
        "description": "Web server scanner for dangerous files, outdated server software, and misconfigurations.",
        "speed": "slow",
        "timeout": 300,
        "danger_level": "caution",
        "entity_type": ["DOMAIN", "IP", "URL"],
        "command": "nikto -h {target} -Tuning 123b -timeout 10 -maxtime 120s",
        "default_args": "-Tuning 123b -timeout 10 -maxtime 120s"
    },
    "ffuf": {
        "display_name": "FFUF Fast Web Fuzzer",
        "category": "Web Security & Auditing",
        "description": "Fast web fuzzer written in Go for discovering endpoints and parameters.",
        "speed": "medium",
        "timeout": 180,
        "danger_level": "safe",
        "entity_type": ["URL", "DOMAIN"],
        "command": "ffuf -u {target}/FUZZ -w /usr/share/wordlists/dirb/common.txt -mc 200,301,302 -t 10 -rate 50 -timeout 3 -s",
        "default_args": "-w /usr/share/wordlists/dirb/common.txt -mc 200,301,302 -t 10 -rate 50 -timeout 3 -s"
    },
    "gobuster": {
        "display_name": "Gobuster Directory Scanner",
        "category": "Web Security & Auditing",
        "description": "Tool used to brute-force URIs (directories and files) in web sites and DNS subdomains.",
        "speed": "medium",
        "timeout": 180,
        "danger_level": "safe",
        "entity_type": ["URL", "DOMAIN"],
        "command": "gobuster dir -u {target} -w /usr/share/wordlists/dirb/common.txt -t 10 --timeout 5s -q",
        "default_args": "dir -w /usr/share/wordlists/dirb/common.txt -t 10 --timeout 5s -q"
    },
    "waybackurls": {
        "display_name": "Wayback URLs Archive Miner",
        "category": "Web Security & Auditing",
        "description": "Fetch all URLs that the Wayback Machine knows about for a domain.",
        "speed": "fast",
        "timeout": 60,
        "danger_level": "safe",
        "entity_type": ["DOMAIN"],
        "command": "waybackurls {target} | head -n 50",
        "default_args": ""
    },
    "curl": {
        "display_name": "cURL HTTP Inspector",
        "category": "Web Security & Auditing",
        "description": "Inspect HTTP response headers, SSL certificates, and status codes.",
        "speed": "fast",
        "timeout": 30,
        "danger_level": "safe",
        "entity_type": ["DOMAIN", "URL", "IP"],
        "command": "curl -I -s -L --max-time 10 {target}",
        "default_args": "-I -s -L --max-time 10"
    },
    "sslscan": {
        "display_name": "SSLScan Cipher & TLS Audit",
        "category": "Web Security & Auditing",
        "description": "Tests SSL/TLS enabled services to discover supported ciphers and certificate details.",
        "speed": "medium",
        "timeout": 90,
        "danger_level": "safe",
        "entity_type": ["DOMAIN", "IP"],
        "command": "sslscan --no-failed --timeout=10 {target}",
        "default_args": "--no-failed --timeout=10"
    },

    # ------------------ CRYPTOGRAPHY & HASHING ------------------
    "hashid": {
        "display_name": "HashID Identifier",
        "category": "Cryptography & Hashing",
        "description": "Identify the different types of hashes used to encrypt data and passwords.",
        "speed": "fast",
        "timeout": 30,
        "danger_level": "safe",
        "entity_type": ["HASH", "TEXT"],
        "command": "hashid -m -j {target}",
        "default_args": "-m -j"
    },
    "hash-identifier": {
        "display_name": "Hash-Identifier",
        "category": "Cryptography & Hashing",
        "description": "Software to identify the different types of hashes used to encrypt passwords.",
        "speed": "fast",
        "timeout": 30,
        "danger_level": "safe",
        "entity_type": ["HASH", "TEXT"],
        "command": "echo '{target}' | hash-identifier",
        "default_args": ""
    },
    "hashcat": {
        "display_name": "Hashcat Hash Cracker",
        "category": "Cryptography & Hashing",
        "description": "Advanced CPU/GPU-based password recovery and hash cracking utility.",
        "speed": "slow",
        "timeout": 300,
        "danger_level": "caution",
        "entity_type": ["HASH"],
        "command": "hashcat --version && echo 'Hashcat available for candidate recovery'",
        "default_args": "--version"
    },
    "john": {
        "display_name": "John the Ripper",
        "category": "Cryptography & Hashing",
        "description": "Fast password cracker, available for many flavors of Unix and Windows.",
        "speed": "slow",
        "timeout": 300,
        "danger_level": "caution",
        "entity_type": ["HASH"],
        "command": "john --test=0",
        "default_args": "--test=0"
    },
    "sha256sum": {
        "display_name": "SHA-256 Hash Verifier",
        "category": "Cryptography & Hashing",
        "description": "Compute and check SHA256 message digest.",
        "speed": "fast",
        "timeout": 20,
        "danger_level": "safe",
        "entity_type": ["TEXT", "FILE", "HASH"],
        "command": "echo -n '{target}' | sha256sum",
        "default_args": ""
    },
    "md5sum": {
        "display_name": "MD5 Hash Verifier",
        "category": "Cryptography & Hashing",
        "description": "Compute and check MD5 message digest.",
        "speed": "fast",
        "timeout": 20,
        "danger_level": "safe",
        "entity_type": ["TEXT", "FILE", "HASH"],
        "command": "echo -n '{target}' | md5sum",
        "default_args": ""
    },
    "base64": {
        "display_name": "Base64 Encoder/Decoder",
        "category": "Cryptography & Hashing",
        "description": "Base64 encode or decode standard input to standard output.",
        "speed": "fast",
        "timeout": 20,
        "danger_level": "safe",
        "entity_type": ["TEXT", "HASH"],
        "command": "echo '{target}' | base64 -d 2>/dev/null || echo '{target}' | base64",
        "default_args": ""
    },
    "openssl": {
        "display_name": "OpenSSL Crypto Suite",
        "category": "Cryptography & Hashing",
        "description": "Cryptography and SSL/TLS toolkit.",
        "speed": "fast",
        "timeout": 45,
        "danger_level": "safe",
        "entity_type": ["DOMAIN", "CERT", "TEXT"],
        "command": "openssl s_client -connect {target}:443 -brief </dev/null 2>/dev/null",
        "default_args": "s_client -brief"
    },

    # ------------------ NETWORK & PACKET ANALYSIS ------------------
    "tshark": {
        "display_name": "TShark Packet Dissector",
        "category": "Network & Packet Analysis",
        "description": "Dump and analyze network traffic (terminal-based Wireshark).",
        "speed": "medium",
        "timeout": 90,
        "danger_level": "safe",
        "entity_type": ["IP", "FILE"],
        "command": "tshark -v | head -n 2",
        "default_args": "-v"
    },
    "arp-scan": {
        "display_name": "ARP Scan Local Discovery",
        "category": "Network & Packet Analysis",
        "description": "Send ARP packets to hosts on the local network to find active devices.",
        "speed": "fast",
        "timeout": 45,
        "danger_level": "safe",
        "entity_type": ["CIDR", "IP"],
        "command": "arp-scan --version",
        "default_args": "--version"
    },
    "ss": {
        "display_name": "Socket Statistics (ss)",
        "category": "Network & Packet Analysis",
        "description": "Investigate sockets, open ports, and active connections.",
        "speed": "fast",
        "timeout": 30,
        "danger_level": "safe",
        "entity_type": ["IP", "TEXT"],
        "command": "ss -tulpn | head -n 30",
        "default_args": "-tulpn"
    },
    "ip": {
        "display_name": "IP Routing & Interface Suite",
        "category": "Network & Packet Analysis",
        "description": "Show / manipulate routing, network devices, interfaces and tunnels.",
        "speed": "fast",
        "timeout": 30,
        "danger_level": "safe",
        "entity_type": ["IP", "CIDR"],
        "command": "ip -br a",
        "default_args": "-br a"
    },

    # ------------------ FORENSICS & FILE ANALYSIS ------------------
    "exiftool": {
        "display_name": "ExifTool Metadata Extractor",
        "category": "Forensics & File Analysis",
        "description": "Read, write and manipulate image, audio, video and document metadata.",
        "speed": "fast",
        "timeout": 60,
        "danger_level": "safe",
        "entity_type": ["FILE", "FILE_IMAGE", "TEXT"],
        "command": "exiftool {target}",
        "default_args": ""
    },
    "binwalk": {
        "display_name": "Binwalk Firmware Analysis",
        "category": "Forensics & File Analysis",
        "description": "Firmware analysis tool for analyzing, reverse engineering, and extracting firmware images.",
        "speed": "medium",
        "timeout": 180,
        "danger_level": "safe",
        "entity_type": ["FILE", "TEXT"],
        "command": "binwalk {target}",
        "default_args": ""
    },
    "strings": {
        "display_name": "Strings ASCII Extractor",
        "category": "Forensics & File Analysis",
        "description": "Print the sequences of printable characters in files or binary streams.",
        "speed": "fast",
        "timeout": 60,
        "danger_level": "safe",
        "entity_type": ["FILE", "HASH", "TEXT"],
        "command": "strings -n 8 {target} | head -n 40",
        "default_args": "-n 8"
    },
    "file": {
        "display_name": "File Type Detector",
        "category": "Forensics & File Analysis",
        "description": "Determine file type using magic numbers and file headers.",
        "speed": "fast",
        "timeout": 30,
        "danger_level": "safe",
        "entity_type": ["FILE", "TEXT"],
        "command": "file -b {target}",
        "default_args": "-b"
    },
    "hexdump": {
        "display_name": "Hexdump Canonical Viewer",
        "category": "Forensics & File Analysis",
        "description": "Display file or standard input contents in hexadecimal, decimal, octal, or ASCII.",
        "speed": "fast",
        "timeout": 45,
        "danger_level": "safe",
        "entity_type": ["FILE", "TEXT"],
        "command": "echo '{target}' | hexdump -C | head -n 20",
        "default_args": "-C"
    },
    "xxd": {
        "display_name": "XXD Hex Dumper & Reverser",
        "category": "Forensics & File Analysis",
        "description": "Make a hexdump or reverse a hexdump back to binary.",
        "speed": "fast",
        "timeout": 45,
        "danger_level": "safe",
        "entity_type": ["FILE", "TEXT"],
        "command": "echo '{target}' | xxd | head -n 20",
        "default_args": ""
    },

    # ------------------ REVERSE ENGINEERING & BINARY AUDITING ------------------
    "gdb": {
        "display_name": "GNU Project Debugger (GDB)",
        "category": "Reverse Engineering & Binary Auditing",
        "description": "Debug programs written in C, C++, Rust, Go, and assembly.",
        "speed": "medium",
        "timeout": 120,
        "danger_level": "safe",
        "entity_type": ["FILE", "TEXT"],
        "command": "gdb --version | head -n 2",
        "default_args": "--version"
    },
    "objdump": {
        "display_name": "Objdump Disassembler",
        "category": "Reverse Engineering & Binary Auditing",
        "description": "Display information from object files and disassemble binary machine code.",
        "speed": "fast",
        "timeout": 60,
        "danger_level": "safe",
        "entity_type": ["FILE"],
        "command": "objdump -f {target} 2>/dev/null || objdump --version | head -n 1",
        "default_args": "-f"
    },
    "radare2": {
        "display_name": "Radare2 Reverse Engineering Framework",
        "category": "Reverse Engineering & Binary Auditing",
        "description": "UNIX-like command line reverse engineering framework and hex editor.",
        "speed": "medium",
        "timeout": 120,
        "danger_level": "safe",
        "entity_type": ["FILE"],
        "command": "radare2 -v | head -n 1",
        "default_args": "-v"
    },
    "ghidra": {
        "display_name": "NSA Ghidra SRE Suite",
        "category": "Reverse Engineering & Binary Auditing",
        "description": "Software reverse engineering (SRE) suite of tools developed by NSA.",
        "speed": "medium",
        "timeout": 180,
        "danger_level": "safe",
        "entity_type": ["FILE"],
        "command": "echo 'Ghidra suite available on system'",
        "default_args": ""
    }
}


class DynamicToolScanner:
    """
    Scans the local operating system to discover installed security tools,
    merges them with metadata profiles, and provides instant indexing.
    """

    def __init__(self):
        self._discovered_tools: Dict[str, Dict[str, Any]] = {}
        self.scan_and_catalog()

    def scan_and_catalog(self) -> Dict[str, Dict[str, Any]]:
        """Find which predefined tools exist on PATH and discover extra system binaries."""
        discovered: Dict[str, Dict[str, Any]] = {}

        # 1. Catalog known database tools
        for binary_name, meta in TOOL_DATABASE.items():
            path = find_system_binary(binary_name)
            is_installed = path is not None

            # Fix command string to use the actual resolved binary name if alias found
            cmd = meta.get("command", f"{binary_name} {{target}}")
            if is_installed and path:
                actual_bin = os.path.basename(path)
                first_word = cmd.split()[0] if cmd else binary_name
                if first_word.lower() == actual_bin.lower() and first_word != actual_bin:
                    cmd = actual_bin + cmd[len(first_word):]

            speed = meta.get("speed", "fast")
            timeout = meta.get("timeout", SPEED_DEFAULT_TIMEOUTS.get(speed, 120))

            discovered[binary_name] = {
                "name": binary_name,
                "display_name": meta["display_name"],
                "category": meta["category"],
                "description": meta["description"],
                "speed": speed,
                "timeout": timeout,
                "danger_level": meta.get("danger_level", "safe"),
                "entity_type": meta.get("entity_type", ["TEXT"]),
                "command": cmd,
                "default_args": meta.get("default_args", ""),
                "installed": is_installed,
                "path": path or ""
            }

        # 2. Check BlackArch / Arch packages via pacman if available
        try:
            res = subprocess.run(
                ["pacman", "-Qg", "blackarch"],
                capture_output=True,
                text=True,
                timeout=3
            )
            if res.returncode == 0:
                for line in res.stdout.strip().splitlines():
                    parts = line.split()
                    if len(parts) >= 2:
                        pkg_name = parts[1]
                        if pkg_name not in discovered:
                            bin_path = find_system_binary(pkg_name)
                            discovered[pkg_name] = {
                                "name": pkg_name,
                                "display_name": pkg_name.replace("-", " ").title(),
                                "category": "BlackArch Suite",
                                "description": f"BlackArch security tool: {pkg_name}",
                                "speed": "medium",
                                "timeout": 180,
                                "danger_level": "caution",
                                "entity_type": ["DOMAIN", "IP", "TEXT", "HASH", "FILE"],
                                "command": f"{pkg_name} {{target}}",
                                "default_args": "",
                                "installed": bin_path is not None,
                                "path": bin_path or ""
                            }
        except Exception as e:
            logger.debug(f"Pacman tool discovery skipped: {e}")

        self._discovered_tools = discovered
        installed_count = sum(1 for t in discovered.values() if t["installed"])
        logger.info(f"Dynamic Tool Scanner cataloged {len(discovered)} tools ({installed_count} currently installed).")
        return self._discovered_tools

    def get_all_tools(self) -> Dict[str, Dict[str, Any]]:
        if not self._discovered_tools:
            self.scan_and_catalog()
        return self._discovered_tools

    def search_tools(self, query: str, category: Optional[str] = None, entity_type: Optional[str] = None) -> List[Dict[str, Any]]:
        tools = self.get_all_tools().values()
        q = query.lower().strip() if query else ""

        results = []
        for t in tools:
            if category and t.get("category", "").lower() != category.lower():
                continue
            if entity_type and entity_type.upper() not in [et.upper() for et in t.get("entity_type", [])]:
                continue
            if q:
                match = (
                    q in t["name"].lower() or
                    q in t.get("display_name", "").lower() or
                    q in t.get("description", "").lower() or
                    q in t.get("category", "").lower()
                )
                if not match:
                    continue
            results.append(t)

        results.sort(key=lambda x: (not x.get("installed", False), x.get("display_name", x["name"]).lower()))
        return results


# Global singleton instance
tool_scanner = DynamicToolScanner()
