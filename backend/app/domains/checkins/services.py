"""
Side-effect layer for proactive check-ins.

All DB queries, Gemini calls, and Telegram sends live here. Pure rule logic
stays in rules.py; the daemon loop lives in scheduler.py. The HTTP router and
the scheduler both call into this module so there is exactly one
compose-and-send code path.
"""
import json
import logging
from typing import Optional

from google.genai import types

from app.core.config import client
from app.core.db import get_db_connection
from app.domains.telegram.bot import bot

logger = logging.getLogger("health_assistant.checkins.services")


PROACTIVE_PROMPT = """
You are Zoie, a warm and concise health companion messaging the patient on
Telegram. Your job in this turn: compose ONE short proactive check-in message.

Voice and constraints:
- Plain conversational American English. No honorifics, no code-switching,
  no ethnic register markers, no transliterated words from other languages.
- 2-3 sentences MAXIMUM.
- Warm but professional — care without being saccharine.
- End with a soft question, not a directive.
- No medical advice, no diagnosis — Zoie is a memory and interpreter layer,
  not a doctor.
- Plain text only, no markdown.
- Refer to the recipient by first name only if the context provides one;
  otherwise no name at all.

Why you are reaching out right now:
{signal_reason}

Recent context to weave in (do not repeat verbatim, summarize naturally):
{context_summary}
"""


FALLBACK_MESSAGE = (
    "Hi — just checking in. Your recent metrics looked a bit off, and I wanted "
    "to see how you're feeling. Would it help if I set up an appointment with "
    "your doctor?"
)


def fetch_eligible_users() -> list:
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT id, phone_number, telegram_id, last_checkin_at,
                   checkin_cadence_hours
            FROM users
            WHERE telegram_id IS NOT NULL;
            """
        )
        return [dict(r) for r in cur.fetchall() or []]
    finally:
        cur.close()
        conn.close()


def fetch_recent_biometrics(user_id: str, days: int = 5) -> list:
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT recorded_at, resting_hr_bpm, hrv_ms, sleep_score
            FROM user_biometrics
            WHERE user_id = %s
            ORDER BY recorded_at DESC
            LIMIT %s;
            """,
            (user_id, days),
        )
        return [dict(r) for r in cur.fetchall() or []]
    finally:
        cur.close()
        conn.close()


def recent_alert_exists(user_id: str, alert_type: str, within_hours: int) -> bool:
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT id FROM user_alerts
            WHERE user_id = %s
              AND alert_type = %s
              AND created_at > (CURRENT_TIMESTAMP - (%s || ' hours')::INTERVAL)
            LIMIT 1;
            """,
            (user_id, alert_type, str(within_hours)),
        )
        return cur.fetchone() is not None
    finally:
        cur.close()
        conn.close()


def build_context_summary(user_id: str) -> str:
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT recorded_at, resting_hr_bpm, hrv_ms, sleep_score
            FROM user_biometrics
            WHERE user_id = %s
            ORDER BY recorded_at DESC
            LIMIT 3;
            """,
            (user_id,),
        )
        bios = cur.fetchall() or []

        cur.execute(
            """
            SELECT extracted_summary
            FROM user_medical_records
            WHERE user_id = %s AND file_type = 'checkin'
            ORDER BY created_at DESC
            LIMIT 2;
            """,
            (user_id,),
        )
        checkins = cur.fetchall() or []
    finally:
        cur.close()
        conn.close()

    parts = []
    if bios:
        bio_lines = [
            f"- {b['recorded_at'].date().isoformat()}: resting HR {b['resting_hr_bpm']} bpm, "
            f"HRV {b['hrv_ms']} ms, sleep {b['sleep_score']}/100"
            for b in bios
        ]
        parts.append("Recent biometrics:\n" + "\n".join(bio_lines))
    if checkins:
        parts.append(
            "Recent self-reports: "
            + "; ".join((c["extracted_summary"] or "")[:200] for c in checkins)
        )
    return "\n\n".join(parts) if parts else "No recent context available."


def compose_proactive_message(context_summary: str, signal_reason: str) -> str:
    prompt = PROACTIVE_PROMPT.format(
        signal_reason=signal_reason,
        context_summary=context_summary,
    )
    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(temperature=0.7),
        )
        text = (response.text or "").strip()
        return text or FALLBACK_MESSAGE
    except Exception as e:
        logger.error("Gemini compose failed: %s", e)
        return FALLBACK_MESSAGE


def send_proactive_ping(
    user: dict,
    message: str,
    signal_kind: str,
    signal_reason: str,
    alert_type: Optional[str] = None,
    metric_data: Optional[dict] = None,
) -> dict:
    telegram_sent = False
    telegram_error: Optional[str] = None
    if bot and user.get("telegram_id"):
        try:
            bot.send_message(chat_id=user["telegram_id"], text=message)
            telegram_sent = True
        except Exception as e:
            telegram_error = str(e)
            logger.error("Telegram send failed: %s", e)
    else:
        telegram_error = "Telegram bot unavailable or user has no telegram_id"

    alert_id = _record_alert(
        user_id=user["id"],
        alert_type=alert_type or f"proactive_{signal_kind}",
        title=f"Proactive {signal_kind} check-in",
        body=signal_reason,
        metric_data=metric_data or {},
    )

    if telegram_sent:
        _bump_last_checkin_at(user["id"])

    return {
        "user_id": user["id"],
        "composed_message": message,
        "signal_kind": signal_kind,
        "signal_reason": signal_reason,
        "telegram_sent": telegram_sent,
        "telegram_error": telegram_error,
        "alert_id": alert_id,
    }


def _record_alert(
    user_id: str,
    alert_type: str,
    title: str,
    body: str,
    metric_data: dict,
) -> Optional[str]:
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            INSERT INTO user_alerts
                (user_id, alert_type, severity, status, title, body, metric_data, triggered_at)
            VALUES (%s, %s, 'warning', 'active', %s, %s, %s::jsonb, CURRENT_TIMESTAMP)
            RETURNING id;
            """,
            (user_id, alert_type, title, body, json.dumps(metric_data)),
        )
        row = cur.fetchone()
        conn.commit()
        return str(row["id"]) if row else None
    except Exception as e:
        conn.rollback()
        logger.error("Alert insert failed: %s", e)
        return None
    finally:
        cur.close()
        conn.close()


def _bump_last_checkin_at(user_id: str) -> None:
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "UPDATE users SET last_checkin_at = CURRENT_TIMESTAMP WHERE id = %s;",
            (user_id,),
        )
        conn.commit()
    except Exception as e:
        conn.rollback()
        logger.error("last_checkin_at bump failed: %s", e)
    finally:
        cur.close()
        conn.close()
