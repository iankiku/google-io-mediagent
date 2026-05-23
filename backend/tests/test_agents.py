from __future__ import annotations

import json
import os
import unittest
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parents[2]
load_dotenv(ROOT_DIR / ".env")


def _require_live_environment() -> None:
    if not os.getenv("GEMINI_API_KEY"):
        raise unittest.SkipTest("GEMINI_API_KEY is required for live agent integration tests.")


def _fetch_demo_user_id() -> str:
    from app.core.db import get_db_connection
    from app.core.seed_demo import DEMO_PHONE

    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT id::text AS id FROM users WHERE phone_number = %s;", (DEMO_PHONE,))
        row = cur.fetchone()
        if not row:
            raise AssertionError("Demo user was not created by seed().")
        return row["id"]
    finally:
        cur.close()
        conn.close()


def _ensure_scan_record(user_id: str) -> None:
    from app.core.db import get_db_connection
    from app.domains.ingestion.services import generate_embedding

    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT id::text AS id
            FROM user_medical_records
            WHERE user_id = %s::uuid AND file_name = 'Test_Chest_Xray_Report.txt'
            LIMIT 1;
            """,
            (user_id,),
        )
        if cur.fetchone():
            return

        scan_summary = {
            "summary": "Chest X-ray report. Impression: no acute cardiopulmonary abnormality. Lungs are clear.",
            "key_findings": [
                "Chest X-ray impression: no acute cardiopulmonary abnormality",
                "Lungs are clear without focal consolidation",
            ],
            "medications": [],
            "diagnoses": [],
            "allergies": [],
            "lab_metrics": [],
        }
        scan_text = (
            "Medical Record: Test_Chest_Xray_Report.txt\n"
            "Summary: Chest X-ray report. Impression: no acute cardiopulmonary abnormality. "
            "Lungs are clear without focal consolidation.\n"
            "Key Findings: Chest X-ray impression: no acute cardiopulmonary abnormality; lungs clear.\n"
        )

        cur.execute(
            """
            INSERT INTO user_medical_records (user_id, file_name, file_path, file_type, extracted_summary)
            VALUES (%s::uuid, %s, %s, %s, %s)
            RETURNING id::text AS id;
            """,
            (
                user_id,
                "Test_Chest_Xray_Report.txt",
                f"/tests/{user_id}/Test_Chest_Xray_Report.txt",
                "scan_report",
                json.dumps(scan_summary),
            ),
        )
        record_id = cur.fetchone()["id"]
        embedding = generate_embedding(scan_text)
        cur.execute(
            """
            INSERT INTO user_record_embeddings (record_id, user_id, chunk_index, chunk_content, embedding)
            VALUES (%s::uuid, %s::uuid, %s, %s, %s);
            """,
            (record_id, user_id, 0, scan_text, embedding),
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


def _ensure_lab_report_record(user_id: str) -> None:
    from app.core.db import get_db_connection
    from app.core.seed_demo import LAB_SUMMARY
    from app.domains.ingestion.services import generate_embedding

    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT id::text AS id
            FROM user_medical_records
            WHERE user_id = %s::uuid AND file_name = 'Lipid_Panel_May_2026.pdf'
            LIMIT 1;
            """,
            (user_id,),
        )
        if cur.fetchone():
            return

        lab_text = (
            "Medical Record: Lipid_Panel_May_2026.pdf\n"
            f"Summary: {LAB_SUMMARY['summary']}\n"
            f"Key Findings: {', '.join(LAB_SUMMARY['key_findings'])}\n"
            f"Diagnoses: {', '.join(LAB_SUMMARY['diagnoses'])}\n"
            "Lab Values: LDL Cholesterol: 160 mg/dL (High) LOINC:13457-7, "
            "Total Cholesterol: 220 mg/dL (High) LOINC:2093-3, "
            "Fasting Glucose: 108 mg/dL (Normal) LOINC:1558-6"
        )

        cur.execute(
            """
            INSERT INTO user_medical_records (user_id, file_name, file_path, file_type, extracted_summary)
            VALUES (%s::uuid, %s, %s, %s, %s)
            RETURNING id::text AS id;
            """,
            (
                user_id,
                "Lipid_Panel_May_2026.pdf",
                f"/tests/{user_id}/Lipid_Panel_May_2026.pdf",
                "application/pdf",
                json.dumps(LAB_SUMMARY),
            ),
        )
        record_id = cur.fetchone()["id"]
        embedding = generate_embedding(lab_text)
        cur.execute(
            """
            INSERT INTO user_record_embeddings (record_id, user_id, chunk_index, chunk_content, embedding)
            VALUES (%s::uuid, %s::uuid, %s, %s, %s);
            """,
            (record_id, user_id, 0, lab_text, embedding),
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


class LiveAgentIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        _require_live_environment()

        from app.core.db import initialize_database
        from app.core.seed_demo import seed
        from app.domains.agents.deep_insights_agent import agent as deep_insights_agent
        from app.domains.agents.reports_agent import agent as reports_agent
        from app.domains.agents.research_agent import agent as research_agent
        from app.domains.agents.scans_agent import agent as scans_agent

        cls.deep_insights_agent = deep_insights_agent
        cls.reports_agent = reports_agent
        cls.research_agent = research_agent
        cls.scans_agent = scans_agent

        initialize_database()
        seed()
        cls.user_id = _fetch_demo_user_id()
        _ensure_lab_report_record(cls.user_id)
        _ensure_scan_record(cls.user_id)

    def assert_valid_agent_result(self, result: str) -> None:
        self.assertIsInstance(result, str)
        self.assertGreater(len(result.strip()), 20)
        self.assertNotIn("Traceback", result)
        self.assertNotIn("Error executing managed agent interaction", result)

    def test_research_agent_executes_real_pipeline(self) -> None:
        result = self.research_agent.run_research_agent("metformin warnings in adults")
        self.assert_valid_agent_result(result)
        self.assertIn("Final Answer", result)

    def test_deep_insights_agent_executes_real_pipeline(self) -> None:
        result = self.deep_insights_agent.run_deep_insights_agent(
            "what does my LDL cholesterol value mean?",
            user_id=self.user_id,
            k_iterations=1,
            top_k=2,
        )
        self.assert_valid_agent_result(result)
        self.assertIn("Final Answer", result)

    def test_scans_agent_executes_real_pipeline(self) -> None:
        result = self.scans_agent.run_scans_agent(
            "what does the chest xray impression say?",
            user_id=self.user_id,
            limit=3,
        )
        self.assert_valid_agent_result(result)
        self.assertIn("Final Answer", result)
        self.assertIn("Chest", result)

    def test_reports_agent_executes_real_pipeline(self) -> None:
        result = self.reports_agent.run_reports_agent(
            "explain my LDL result from the lab report",
            user_id=self.user_id,
            limit=3,
        )
        self.assert_valid_agent_result(result)
        self.assertIn("Final Answer", result)
        self.assertIn("LDL", result)

    def test_all_agents_reject_empty_queries(self) -> None:
        agent_calls = [
            lambda: self.research_agent.run_research_agent(" "),
            lambda: self.deep_insights_agent.run_deep_insights_agent(" "),
            lambda: self.scans_agent.run_scans_agent(" ", user_id="00000000-0000-0000-0000-000000000001"),
            lambda: self.reports_agent.run_reports_agent(" ", user_id="00000000-0000-0000-0000-000000000001"),
        ]

        for call in agent_calls:
            with self.subTest(call=call):
                with self.assertRaises(ValueError):
                    call()

    def test_scans_and_reports_require_user_id(self) -> None:
        with self.assertRaises(ValueError):
            self.scans_agent.run_scans_agent("scan question", user_id="")

        with self.assertRaises(ValueError):
            self.reports_agent.run_reports_agent("report question", user_id="")


if __name__ == "__main__":
    unittest.main()
