import json
import logging

from google.genai import types
from app.core.config import client
from app.core.db import get_db_connection

logger = logging.getLogger("health_assistant.checkins.services")


def force_trigger(user_id: str) -> str:
    """
    Fetches the user's recent check-ins from DB, then composes a proactive
    Hindi-English check-in message using Gemini 2.5 Flash.
    """
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Fetch user info
        cur.execute("SELECT id, phone_number, telegram_id FROM users WHERE id = %s::uuid;", (user_id,))
        user = cur.fetchone()
        if not user:
            return f"User {user_id} not found."

        # Fetch recent check-in records (last 7)
        cur.execute(
            """
            SELECT file_name, extracted_summary, created_at
            FROM user_medical_records
            WHERE user_id = %s::uuid AND file_type = 'checkin'
            ORDER BY created_at DESC
            LIMIT 7;
            """,
            (user_id,)
        )
        checkins = cur.fetchall()

        if not checkins:
            checkin_context = "No recent check-ins found."
        else:
            checkin_lines = []
            for c in checkins:
                summary = c.get("extracted_summary", "{}")
                try:
                    parsed = json.loads(summary) if isinstance(summary, str) else summary
                    text = parsed.get("summary", str(summary))
                    severity = parsed.get("headache_severity", "N/A")
                    day = parsed.get("day", "?")
                except (json.JSONDecodeError, AttributeError):
                    text = str(summary)
                    severity = "N/A"
                    day = "?"
                checkin_lines.append(f"Day {day}: {text} (Headache severity: {severity}/10)")
            checkin_context = "\n".join(checkin_lines)

        # Compose proactive message using Gemini
        prompt = f"""You are Zoie, a caring health assistant for Indian patients.
Compose a brief Hindi-English (Hinglish) proactive check-in message for patient Ravi.

Recent check-in history:
{checkin_context}

Key observations from the data:
- Headache severity has been escalating over the past week
- Patient reported giddiness and high BP sensation
- Pattern suggests possible uncontrolled hypertension

Instructions:
- Use familiar Indian English idioms and Hinglish naturally (e.g., "Ravi bhai", "theek hai?", "kal se")
- Keep it warm but not condescending
- Reference specific data points from the check-ins
- End by asking if they want to set up an appointment with their doctor
- Keep the message to 3-4 sentences maximum
- Do NOT give medical advice, only express concern and suggest seeing the doctor"""

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction="You are Zoie, a warm and caring health companion for Indian patients. You speak in natural Hindi-English (Hinglish). You never give medical advice — you help patients track, understand, and remember to bring concerns to their doctor."
            )
        )
        return response.text.strip()

    except Exception as e:
        logger.error(f"force_trigger failed for user {user_id}: {e}")
        return f"Sorry, I could not generate a check-in message. Error: {str(e)}"
    finally:
        cur.close()
        conn.close()
