import os
import sys
import unittest
from datetime import datetime, timezone

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from services.intel_processor import process_raw_intel, generate_stix2_bundle
from models import Node, Link


class TestIntelAdvanced(unittest.TestCase):
    def test_version_string_suppression(self):
        text = "Deploying software version 1.2.3.4 and nginx-1.18.0.1 on server."
        result = process_raw_intel(text)
        labels = [n.label for n in result["entities"]]
        self.assertNotIn("1.2.3.4", labels)
        self.assertNotIn("1.18.0.1", labels)

    def test_valid_ipv4_and_defanging(self):
        text = "Attacking host hxxps://evil-c2[.]ru:8443 beaconing to 198.51.100.45 and invalid 999.888.777.666"
        result = process_raw_intel(text)
        labels = [n.label for n in result["entities"]]
        self.assertIn("198.51.100.45", labels)
        self.assertNotIn("999.888.777.666", labels)
        self.assertIn("evil-c2.ru", labels)

    def test_stix2_bundle_generation(self):
        nodes = [
            Node(
                id="n1",
                case_file_id="c1",
                label="198.51.100.45",
                entity_type="IP",
                threat_level="CRITICAL",
                group=1,
            )
        ]
        links = []
        bundle = generate_stix2_bundle(
            "c1",
            "test.log",
            "CRITICAL",
            "a" * 64,
            datetime.now(timezone.utc),
            nodes,
            links,
            "raw text",
        )
        self.assertEqual(bundle["type"], "bundle")
        self.assertEqual(bundle["spec_version"], "2.1")
        self.assertTrue(len(bundle["objects"]) >= 2)
        report = [o for o in bundle["objects"] if o["type"] == "report"][0]
        self.assertIn("Overwatch Incident Report", report["name"])


if __name__ == "__main__":
    unittest.main()
