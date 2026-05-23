"""
Demo seed script for the Zoie hackathon project.
Creates user "Ravi Kumar" with 7 daily check-ins, 1 lab report, and 1 Rx record.
Idempotent: skips if user already exists.

Run with: python -m app.core.seed_demo
"""
import json
import logging
from datetime import datetime, timedelta, timezone

from app.core.db import get_db_connection
from app.domains.ingestion.services import generate_embedding

logger = logging.getLogger("health_assistant.seed_demo")
logging.basicConfig(level=logging.INFO)

DEMO_PHONE = "+15551234567"
DEMO_TELEGRAM_ID = "ravi_demo"
DEMO_NAME = "Ravi Kumar"

CHECKIN_RECORDS = [
    {"day": 1, "text": "Feeling okay today, slight headache in evening", "severity": 3},
    {"day": 2, "text": "Head paining more today, took paracetamol", "severity": 4},
    {"day": 3, "text": "Headache continuing, also some giddiness in morning", "severity": 5},
    {"day": 4, "text": "Not good today, head was paining whole day, BP felt high", "severity": 6},
    {"day": 5, "text": "Very bad headache today, had to lie down after lunch", "severity": 7},
    {"day": 6, "text": "Slightly better after rest, headache mild", "severity": 5},
    {"day": 7, "text": "Head paining again, giddiness also came back", "severity": 7},
]

LAB_SUMMARY = {
    "summary": "Lipid panel results from May 2026. LDL cholesterol elevated at 160 mg/dL (High). Total cholesterol elevated at 220 mg/dL (High). Fasting glucose within normal range at 108 mg/dL.",
    "key_findings": [
        "LDL Cholesterol: 160 mg/dL (High) — LOINC:13457-7",
        "Total Cholesterol: 220 mg/dL (High) — LOINC:2093-3",
        "Fasting Glucose: 108 mg/dL (Normal) — LOINC:1558-6"
    ],
    "medications": [],
    "diagnoses": ["Hyperlipidemia — elevated LDL and total cholesterol"],
    "allergies": [],
    "lab_metrics": [
        {"metric": "LDL Cholesterol", "value": "160 mg/dL", "status": "High", "loinc_code": "13457-7"},
        {"metric": "Total Cholesterol", "value": "220 mg/dL", "status": "High", "loinc_code": "2093-3"},
        {"metric": "Fasting Glucose", "value": "108 mg/dL", "status": "Normal", "loinc_code": "1558-6"}
    ]
}

RX_SUMMARY = {
    "summary": "Prescription bottle for Lisinopril 10mg. ACE inhibitor prescribed for blood pressure management.",
    "key_findings": [
        "Medication: Lisinopril 10mg — RxNorm:29046",
        "Drug class: ACE inhibitor",
        "Dosage: 10mg once daily",
        "Common side effects: dry cough, dizziness, headache, hyperkalemia"
    ],
    "medications": ["Lisinopril 10mg, once daily"],
    "diagnoses": ["Hypertension (managed)"],
    "allergies": [],
    "lab_metrics": []
}


def seed():
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Check if user exists
        cur.execute("SELECT id FROM users WHERE phone_number = %s;", (DEMO_PHONE,))
        existing = cur.fetchone()
        if existing:
            logger.info(f"User '{DEMO_NAME}' already exists (id={existing['id']}). Skipping seed.")
            return

        # Insert user
        cur.execute(
            """
            INSERT INTO users (phone_number, telegram_id)
            VALUES (%s, %s)
            RETURNING id;
            """,
            (DEMO_PHONE, DEMO_TELEGRAM_ID)
        )
        user_row = cur.fetchone()
        user_id = str(user_row["id"])
        logger.info(f"Created user '{DEMO_NAME}' with id={user_id}")

        now = datetime.now(timezone.utc)

        # --- Insert 7 daily check-in records ---
        for checkin in CHECKIN_RECORDS:
            day_offset = checkin["day"] - 1
            record_date = now - timedelta(days=7 - checkin["day"])
            checkin_text = f"Daily Check-in (Day {checkin['day']}): {checkin['text']}. Headache severity: {checkin['severity']}/10."
            checkin_summary = json.dumps({
                "summary": checkin["text"],
                "headache_severity": checkin["severity"],
                "day": checkin["day"],
                "patient_name": DEMO_NAME
            })

            cur.execute(
                """
                INSERT INTO user_medical_records (user_id, file_name, file_path, file_type, extracted_summary, created_at)
                VALUES (%s::uuid, %s, %s, %s, %s, %s)
                RETURNING id;
                """,
                (
                    user_id,
                    f"checkin_day_{checkin['day']}",
                    f"/checkins/{user_id}/day_{checkin['day']}",
                    "checkin",
                    checkin_summary,
                    record_date
                )
            )
            record_row = cur.fetchone()
            record_id = str(record_row["id"])

            # Generate embedding and insert
            embedding = generate_embedding(checkin_text)
            cur.execute(
                """
                INSERT INTO user_record_embeddings (record_id, user_id, chunk_index, chunk_content, embedding)
                VALUES (%s::uuid, %s::uuid, %s, %s, %s);
                """,
                (record_id, user_id, 0, checkin_text, embedding)
            )
            logger.info(f"  Seeded check-in Day {checkin['day']} (record_id={record_id})")

        # --- Insert lab report ---
        lab_text = (
            f"Medical Record: Lipid_Panel_May_2026.pdf\n"
            f"Summary: {LAB_SUMMARY['summary']}\n"
            f"Key Findings: {', '.join(LAB_SUMMARY['key_findings'])}\n"
            f"Diagnoses: {', '.join(LAB_SUMMARY['diagnoses'])}\n"
            f"Lab Values: LDL Cholesterol: 160 mg/dL (High) LOINC:13457-7, "
            f"Total Cholesterol: 220 mg/dL (High) LOINC:2093-3, "
            f"Fasting Glucose: 108 mg/dL (Normal) LOINC:1558-6"
        )

        cur.execute(
            """
            INSERT INTO user_medical_records (user_id, file_name, file_path, file_type, extracted_summary)
            VALUES (%s::uuid, %s, %s, %s, %s)
            RETURNING id;
            """,
            (
                user_id,
                "Lipid_Panel_May_2026.pdf",
                f"/uploads/{user_id}/Lipid_Panel_May_2026.pdf",
                "application/pdf",
                json.dumps(LAB_SUMMARY)
            )
        )
        lab_record_id = str(cur.fetchone()["id"])

        lab_embedding = generate_embedding(lab_text)
        cur.execute(
            """
            INSERT INTO user_record_embeddings (record_id, user_id, chunk_index, chunk_content, embedding)
            VALUES (%s::uuid, %s::uuid, %s, %s, %s);
            """,
            (lab_record_id, user_id, 0, lab_text, lab_embedding)
        )
        logger.info(f"  Seeded lab report (record_id={lab_record_id})")

        # --- Insert Rx record ---
        rx_text = (
            f"Medical Record: Lisinopril_10mg.jpg\n"
            f"Summary: {RX_SUMMARY['summary']}\n"
            f"Key Findings: {', '.join(RX_SUMMARY['key_findings'])}\n"
            f"Medications: {', '.join(RX_SUMMARY['medications'])}\n"
            f"Diagnoses: {', '.join(RX_SUMMARY['diagnoses'])}"
        )

        cur.execute(
            """
            INSERT INTO user_medical_records (user_id, file_name, file_path, file_type, extracted_summary)
            VALUES (%s::uuid, %s, %s, %s, %s)
            RETURNING id;
            """,
            (
                user_id,
                "Lisinopril_10mg.jpg",
                f"/uploads/{user_id}/Lisinopril_10mg.jpg",
                "rx_bottle",
                json.dumps(RX_SUMMARY)
            )
        )
        rx_record_id = str(cur.fetchone()["id"])

        rx_embedding = generate_embedding(rx_text)
        cur.execute(
            """
            INSERT INTO user_record_embeddings (record_id, user_id, chunk_index, chunk_content, embedding)
            VALUES (%s::uuid, %s::uuid, %s, %s, %s);
            """,
            (rx_record_id, user_id, 0, rx_text, rx_embedding)
        )
        logger.info(f"  Seeded Rx record (record_id={rx_record_id})")

        conn.commit()
        logger.info(f"Demo seed complete. User '{DEMO_NAME}' has 9 records (7 check-ins + 1 lab + 1 Rx).")

    except Exception as e:
        conn.rollback()
        logger.error(f"Seed failed: {e}")
        raise
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    seed()
