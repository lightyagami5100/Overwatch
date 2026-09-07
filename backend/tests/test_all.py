import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from services.dynamic_scanner import tool_scanner
from services.tool_registry import registry
from services.intel_processor import normalize_defanged, extract_entities, process_raw_intel, compute_report_hash


class TestIntelProcessor(unittest.TestCase):
    def test_defang_normalization(self):
        sample = "Check out hxxps://malicious[.]site[.]com:8080/payload and IP 192[.]168[.]1[.]100"
        normalized = normalize_defanged(sample)
        self.assertIn("https://malicious.site.com:8080/payload", normalized)
        self.assertIn("192.168.1.100", normalized)

    def test_entity_extraction_advanced(self):
        text = """
        INCIDENT: Critical Threat Actor observed
        C2 Domain: beacon-dark.xyz
        Attacker IP: 10.20.30.40
        IPv6 Target: 2001:0db8:85a3:0000:0000:8a2e:0370:7334
        Subnet Affected: 172.16.0.0/16
        SHA256 Payload: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
        MITRE Technique: T1059.001
        Attacker Wallet: bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq
        Contact Email: soc-alert@defense.local
        """
        entities = extract_entities(text)
        types_found = {e.entity_type for e in entities}
        labels_found = {e.label for e in entities}

        self.assertIn("IP", types_found)
        self.assertIn("DOMAIN", types_found)
        self.assertIn("CIDR", types_found)
        self.assertIn("HASH", types_found)
        self.assertIn("MITRE", types_found)
        self.assertIn("WALLET", types_found)
        self.assertIn("EMAIL", types_found)
        self.assertIn("beacon-dark.xyz", labels_found)

    def test_report_hashing(self):
        content = "Security Incident Report Alpha"
        h1 = compute_report_hash(content)
        h2 = compute_report_hash(content)
        self.assertEqual(h1, h2)
        self.assertEqual(len(h1), 64)


class TestDynamicToolScanner(unittest.TestCase):
    def test_tool_catalog(self):
        tools = tool_scanner.get_all_tools()
        self.assertGreater(len(tools), 15)
        self.assertIn("nmap", tools)
        self.assertIn("dig", tools)
        self.assertIn("whois", tools)

    def test_tool_search(self):
        results = tool_scanner.search_tools(query="dns")
        self.assertTrue(len(results) > 0)
        found_names = [r["name"] for r in results]
        self.assertTrue(any("dig" in n or "dns" in n for n in found_names))

    def test_custom_tool_registration(self):
        custom = registry.register_custom_tool({
            "name": "test_echo_scan",
            "display_name": "Test Echo Scan",
            "category": "Testing",
            "command": "echo 'SCAN: {target}'",
            "entity_type": ["IP", "DOMAIN"]
        })
        self.assertEqual(custom["name"], "test_echo_scan")
        self.assertIn("test_echo_scan", registry.tools)


if __name__ == "__main__":
    unittest.main()
