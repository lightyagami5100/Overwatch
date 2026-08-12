import asyncio
import subprocess
import logging

logger = logging.getLogger(__name__)

async def run_command_async(cmd: list[str], timeout: int = 5) -> str:
    """Run a shell command asynchronously and safely."""
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        except asyncio.TimeoutError:
            proc.kill()
            await proc.communicate()
            return f"[ERROR] Command {' '.join(cmd)} timed out after {timeout} seconds."

        if proc.returncode == 0:
            return stdout.decode('utf-8').strip()
        else:
            return f"[ERROR] {stderr.decode('utf-8').strip() or stdout.decode('utf-8').strip()}"
    except FileNotFoundError:
        return f"[ERROR] Command '{cmd[0]}' not found on this system."
    except Exception as e:
        logger.error(f"Error running command {cmd}: {e}")
        return f"[ERROR] {str(e)}"

async def run_ping(ip: str) -> str:
    """Run ping to check host liveness."""
    output = await run_command_async(["ping", "-c", "1", "-W", "2", ip])
    if "[ERROR]" in output:
        return f"Host unreachable or ping failed."
    if "0 received" in output or "100% packet loss" in output:
        return f"Host is down."
    
    # Extract latency
    try:
        time_part = [line for line in output.split('\n') if 'time=' in line][0]
        latency = time_part.split('time=')[1].split()[0]
        return f"Host is UP (latency: {latency}ms)."
    except:
        return "Host is UP."

async def run_whois(target: str) -> str:
    """Run whois to get registration data."""
    output = await run_command_async(["whois", target], timeout=10)
    if "[ERROR]" in output:
        return "WHOIS data unavailable."
    
    # Try to extract Organization or Name
    lines = output.split('\n')
    org = next((line.split(':')[1].strip() for line in lines if line.lower().startswith('orgname') or line.lower().startswith('organization') or line.lower().startswith('registrant organization')), None)
    
    if org:
        return f"Registered to: {org}"
    return "WHOIS lookup completed (No organization found)."

async def run_nslookup(domain: str) -> str:
    """Run nslookup to resolve DNS records."""
    output = await run_command_async(["nslookup", domain])
    if "[ERROR]" in output or "NXDOMAIN" in output or "can't find" in output:
        return "DNS resolution failed."
    
    # Extract IPs
    lines = output.split('\n')
    ips = []
    found_name = False
    for line in lines:
        if "Name:" in line:
            found_name = True
        elif found_name and "Address:" in line:
            ips.append(line.split(':')[1].strip())
            
    if ips:
        return f"Resolves to: {', '.join(ips)}"
    return "No IP addresses found."
