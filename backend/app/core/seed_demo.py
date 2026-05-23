"""
Demo seed for Zoie hackathon — patient Ravi Kumar.

Idempotent: if a user with Ravi's phone number already exists, the script
exits early without touching anything. To re-seed from scratch, drop the
user row first (cascade delete handles everything downstream).

Run with: python -m app.core.seed_demo
"""

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from app.core.db import get_db_connection, initialize_database
from app.domains.ingestion.services import chunk_text, generate_embedding

logger = logging.getLogger("health_assistant.seed_demo")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")


RAVI_PHONE = "+15551234567"
RAVI_TELEGRAM_ID = "ravi_demo"
# Voice-interpreter hint only (per memory `feedback_english_default_outside_voice`).
# Canonical enum from `project_interpreter_wispr_scope`: hi-en-IN | hi-IN | zh-CN | en-US.
# Messaging layer (Telegram, chat, AI summaries) does NOT consult this — always English there.
RAVI_LANGUAGE = "hi-en-IN"


# 7 days of Indian-English check-ins. Index 0 = oldest (7 days ago), 6 = today.
CHECKINS = [
    ("Slight head paining in evening, manageable. Sleeping was fine.", 3),
    ("Headache again in morning, took paracetamol. Walked little less today.", 4),
    ("Head paining whole afternoon, also some giddiness when getting up from chair.", 5),
    ("Bad headache today, BP feels little high. Eating proper but sleeping less.", 6),
    ("Head was paining yesterday also today, some giddiness in morning. Pulse rate seems fast.", 7),
    ("Better today, paracetamol helping. Still some pressure feeling in temples.", 5),
    ("Head paining again morning, giddiness when standing. Heart beating fast for short time.", 7),
]

# 7 days of biometric snapshots — destabilizing baseline.
# Each tuple: (hrv_ms, resting_hr_bpm, peak_hr_bpm, steps, sleep_score, sleep_hours, respiratory_rate, skin_temp_delta_f)
BIOMETRICS = [
    (52.0, 66.0, 132.0, 8800, 82, 7.8, 14.0, 0.0),
    (51.0, 68.0, 128.0, 8500, 80, 7.5, 14.2, 0.0),
    (50.0, 69.0, 130.0, 8200, 78, 7.2, 14.5, 0.1),
    (49.0, 70.0, 135.0, 7800, 76, 7.0, 15.0, 0.1),
    (48.0, 72.0, 138.0, 7500, 73, 6.7, 15.3, 0.0),
    (47.0, 73.0, 130.0, 6800, 72, 6.5, 15.5, -0.1),
    (45.0, 74.0, 128.0, 6200, 71, 6.4, 16.0, -0.2),  # demo day
]


LAB_PDF_SUMMARY = {
    "summary": (
        "Comprehensive Metabolic Panel & Lipid Profile from May 15, 2026, ordered by Dr. Sarah Jenkins. "
        "Several lipid markers elevated; fasting glucose borderline. Recommend follow-up at scheduled cardiology visit."
    ),
    "key_findings": [
        "LDL cholesterol elevated (160 mg/dL, reference <100)",
        "Total cholesterol elevated (228 mg/dL, reference <200)",
        "HDL low-normal (42 mg/dL)",
        "Triglycerides high (180 mg/dL)",
        "Fasting glucose borderline (108 mg/dL)",
        "HbA1c borderline (5.9%)",
    ],
    "medications": ["lisinopril 10mg daily, oral (per active prescription)"],
    "diagnoses": ["Stage 1 hypertension (managed)", "Hyperlipidemia"],
    "allergies": [],
    "lab_metrics": [
        {"metric": "LDL Cholesterol", "value": "160 mg/dL", "status": "High"},
        {"metric": "Total Cholesterol", "value": "228 mg/dL", "status": "High"},
        {"metric": "HDL Cholesterol", "value": "42 mg/dL", "status": "Low"},
        {"metric": "Triglycerides", "value": "180 mg/dL", "status": "High"},
        {"metric": "Fasting Glucose", "value": "108 mg/dL", "status": "Borderline"},
        {"metric": "HbA1c", "value": "5.9%", "status": "Borderline"},
    ],
}


RX_BOTTLE_SUMMARY = {
    "summary": "Lisinopril 10mg daily, prescribed by Dr. Aris Patel for hypertension management. Refill due in 30 days.",
    "key_findings": ["Active prescription: lisinopril 10mg PO daily"],
    "medications": ["lisinopril 10mg daily, oral"],
    "diagnoses": ["Stage 1 hypertension"],
    "allergies": [],
    "lab_metrics": [],
}


HEALTH_SUMMARY_TEXT = (
    "Recent clinical data indicates a destabilizing baseline over the past seven days. "
    "Resting heart rate trended from 66 to 74 BPM while HRV narrowed from 52 to 45 ms — both signals of elevated autonomic stress. "
    "Sleep score declined from 82 to 71, and self-reported headache severity rose from 3 to 7 on a 10-point scale. "
    "May 15 lipid panel shows LDL at 160 mg/dL (high), total cholesterol 228 mg/dL (high), and borderline fasting glucose at 108 mg/dL. "
    "Currently on lisinopril 10mg daily for hypertension. "
    "Overall trajectory warrants discussion at the scheduled follow-up with Dr. Patel on Thursday."
)


AFIB_ALERT = {
    "alert_type": "afib",
    "severity": "critical",
    "status": "dormant",
    "title": "Irregular Rhythm Detected",
    "body": (
        "Your Apple Watch detected a sustained heart rate of 113 BPM while inactive for 10 minutes, "
        "along with irregular rhythm patterns consistent with AFib."
    ),
    "metric_data": {
        "peak_bpm": 113,
        "duration_minutes": 10,
        "pattern": "irregular_rhythm",
        "device": "Apple Watch Series 9",
        "cardiologist_on_call": "Dr. Aris Patel",
        "recommended_protocol": [
            "Remain seated and rest for 15 minutes",
            "Perform a manual ECG using Apple Watch",
            "Ensure you are well hydrated",
        ],
    },
}


def _ravi_exists(cur) -> Optional[str]:
    cur.execute("SELECT id FROM users WHERE phone_number = %s;", (RAVI_PHONE,))
    row = cur.fetchone()
    return str(row["id"]) if row else None


def _insert_user(cur) -> str:
    cur.execute(
        """
        INSERT INTO users (phone_number, telegram_id, preferred_language)
        VALUES (%s, %s, %s)
        RETURNING id;
        """,
        (RAVI_PHONE, RAVI_TELEGRAM_ID, RAVI_LANGUAGE),
    )
    return str(cur.fetchone()["id"])


def _insert_record_with_embedding(
    cur,
    user_id: str,
    file_name: str,
    file_path: str,
    file_type: str,
    extracted_summary: str,
    embed_text: str,
    created_at: Optional[datetime] = None,
) -> str:
    """Insert one user_medical_records row + embed its text into user_record_embeddings."""
    if created_at:
        cur.execute(
            """
            INSERT INTO user_medical_records (user_id, file_name, file_path, file_type, extracted_summary, created_at)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id;
            """,
            (user_id, file_name, file_path, file_type, extracted_summary, created_at),
        )
    else:
        cur.execute(
            """
            INSERT INTO user_medical_records (user_id, file_name, file_path, file_type, extracted_summary)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id;
            """,
            (user_id, file_name, file_path, file_type, extracted_summary),
        )
    record_id = str(cur.fetchone()["id"])

    chunks = chunk_text(embed_text)
    for idx, chunk in enumerate(chunks):
        embedding = generate_embedding(chunk)
        cur.execute(
            """
            INSERT INTO user_record_embeddings (record_id, user_id, chunk_index, chunk_content, embedding)
            VALUES (%s, %s, %s, %s, %s);
            """,
            (record_id, user_id, idx, chunk, embedding),
        )
    return record_id


def _seed_checkins(cur, user_id: str, demo_day: datetime) -> None:
    for i, (text, severity) in enumerate(CHECKINS):
        day_offset = len(CHECKINS) - 1 - i  # i=0 -> 6 days ago, i=6 -> today
        recorded_at = demo_day - timedelta(days=day_offset)
        summary = {
            "text": text,
            "severity_0_10": severity,
            "primary_symptom": "headache",
            "associated": ["orthostatic_dizziness"] if "giddiness" in text else [],
            "recorded_at": recorded_at.isoformat(),
            "language": "en-IN",
        }
        embed_text = (
            f"Daily check-in ({recorded_at.date().isoformat()}): {text} "
            f"Headache severity {severity}/10. "
            f"Patient-reported in Indian English."
        )
        _insert_record_with_embedding(
            cur,
            user_id=user_id,
            file_name=f"checkin_{recorded_at.date().isoformat()}.json",
            file_path=f"seed://checkin/{recorded_at.date().isoformat()}",
            file_type="checkin",
            extracted_summary=json.dumps(summary),
            embed_text=embed_text,
            created_at=recorded_at,
        )
    logger.info("Inserted %d check-ins.", len(CHECKINS))


def _seed_biometrics(cur, user_id: str, demo_day: datetime) -> None:
    for i, row in enumerate(BIOMETRICS):
        day_offset = len(BIOMETRICS) - 1 - i
        recorded_at = demo_day - timedelta(days=day_offset)
        hrv, rest_hr, peak_hr, steps, sleep_score, sleep_hours, resp, temp = row
        cur.execute(
            """
            INSERT INTO user_biometrics
            (user_id, recorded_at, source, hrv_ms, resting_hr_bpm, peak_hr_bpm, steps,
             sleep_score, sleep_hours, respiratory_rate, skin_temp_delta_f, notes)
            VALUES (%s, %s, 'apple_watch', %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (user_id, recorded_at, source) DO NOTHING;
            """,
            (
                user_id, recorded_at, hrv, rest_hr, peak_hr, steps,
                sleep_score, sleep_hours, resp, temp,
                "Synthetic seed for hackathon demo.",
            ),
        )
    logger.info("Inserted %d biometric snapshots.", len(BIOMETRICS))


def _seed_lab_pdf(cur, user_id: str, demo_day: datetime) -> str:
    lab_date = demo_day - timedelta(days=8)
    embed_text = (
        f"Medical Record: Comprehensive Metabolic Panel {lab_date.date().isoformat()}\n"
        f"Summary: {LAB_PDF_SUMMARY['summary']}\n"
        f"Key Findings: {', '.join(LAB_PDF_SUMMARY['key_findings'])}\n"
        f"Medications: {', '.join(LAB_PDF_SUMMARY['medications'])}\n"
        f"Diagnoses: {', '.join(LAB_PDF_SUMMARY['diagnoses'])}\n"
        f"Lab Values: "
        + ", ".join(
            f"{m['metric']}: {m['value']} ({m['status']})"
            for m in LAB_PDF_SUMMARY["lab_metrics"]
        )
    )
    return _insert_record_with_embedding(
        cur,
        user_id=user_id,
        file_name="comprehensive_metabolic_panel_may15.pdf",
        file_path="seed://lab_pdf/cmp_may15",
        file_type="lab_pdf",
        extracted_summary=json.dumps(LAB_PDF_SUMMARY),
        embed_text=embed_text,
        created_at=lab_date,
    )


def _seed_rx(cur, user_id: str, demo_day: datetime) -> str:
    rx_date = demo_day - timedelta(days=30)
    embed_text = (
        f"Medical Record: Active prescription — lisinopril 10mg daily\n"
        f"Summary: {RX_BOTTLE_SUMMARY['summary']}\n"
        f"Medications: {', '.join(RX_BOTTLE_SUMMARY['medications'])}\n"
        f"Diagnoses: {', '.join(RX_BOTTLE_SUMMARY['diagnoses'])}"
    )
    return _insert_record_with_embedding(
        cur,
        user_id=user_id,
        file_name="rx_lisinopril_10mg.jpg",
        file_path="seed://rx_bottle/lisinopril",
        file_type="rx_bottle",
        extracted_summary=json.dumps(RX_BOTTLE_SUMMARY),
        embed_text=embed_text,
        created_at=rx_date,
    )


def _seed_health_summary(cur, user_id: str, demo_day: datetime) -> str:
    summary_payload = {
        "summary": HEALTH_SUMMARY_TEXT,
        "generated_by": "zoie_health_summarizer_v1",
        "as_of": demo_day.isoformat(),
    }
    return _insert_record_with_embedding(
        cur,
        user_id=user_id,
        file_name="zoie_health_status_summary.md",
        file_path="seed://health_summary/latest",
        file_type="health_summary",
        extracted_summary=json.dumps(summary_payload),
        embed_text=HEALTH_SUMMARY_TEXT,
        created_at=demo_day,
    )


def _seed_dormant_afib_alert(cur, user_id: str) -> str:
    cur.execute(
        """
        INSERT INTO user_alerts
        (user_id, alert_type, severity, status, title, body, metric_data)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        RETURNING id;
        """,
        (
            user_id,
            AFIB_ALERT["alert_type"],
            AFIB_ALERT["severity"],
            AFIB_ALERT["status"],
            AFIB_ALERT["title"],
            AFIB_ALERT["body"],
            json.dumps(AFIB_ALERT["metric_data"]),
        ),
    )
    return str(cur.fetchone()["id"])


def seed_ravi() -> None:
    initialize_database()
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        existing = _ravi_exists(cur)
        if existing:
            logger.info("Ravi already seeded (user_id=%s). Nothing to do.", existing)
            return

        demo_day = datetime.now(timezone.utc).replace(hour=9, minute=0, second=0, microsecond=0)
        user_id = _insert_user(cur)
        logger.info("Inserted user Ravi Kumar with id=%s.", user_id)

        _seed_checkins(cur, user_id, demo_day)
        _seed_biometrics(cur, user_id, demo_day)
        lab_id = _seed_lab_pdf(cur, user_id, demo_day)
        logger.info("Inserted lab PDF record id=%s.", lab_id)
        rx_id = _seed_rx(cur, user_id, demo_day)
        logger.info("Inserted Rx record id=%s.", rx_id)
        summary_id = _seed_health_summary(cur, user_id, demo_day)
        logger.info("Inserted health summary record id=%s.", summary_id)
        alert_id = _seed_dormant_afib_alert(cur, user_id)
        logger.info("Inserted dormant AFib alert id=%s.", alert_id)

        conn.commit()
        logger.info("Seed complete. Ravi Kumar (user_id=%s) is ready for demo.", user_id)
    except Exception as e:
        conn.rollback()
        logger.error("Seed failed, rolled back: %s", e)
        raise
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    seed_ravi()
