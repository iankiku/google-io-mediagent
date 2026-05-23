import json
from google.genai import types
from app.core.config import client

PROMPT_PATIENT_TO_CLINICAL = """You are a medical scribe. Normalize this Indian English patient utterance into concise American clinical English. Preserve every value, timeframe, and qualifier. Add nothing not said. Output two fields: `clinical` (one to three sentences) and `extracted` (a JSON object with detected `symptom`, `onset`, `severity`, `associated`, `medications_mentioned`)."""

PROMPT_DOCTOR_TO_SIMPLIFIED = """You are explaining the doctor's words to a Hindi-English-speaking patient at a 6th-grade reading level using familiar register. Use Indian English idioms where natural. Add nothing the doctor did not say. Output: `simplified` (one to three sentences) and `extracted` (JSON with `plan_items`, `medications_prescribed`, `tests_ordered`, `followup`)."""


def process_turn(
    audio_bytes: bytes | None,
    text: str | None,
    role: str,
    mime_type: str = "audio/webm",
) -> dict:
    """Process a single interpreter turn through Gemini."""
    prompt = PROMPT_PATIENT_TO_CLINICAL if role == "patient" else PROMPT_DOCTOR_TO_SIMPLIFIED

    parts: list = [types.Part.from_text(text=prompt)]

    if audio_bytes:
        parts.append(
            types.Part.from_bytes(data=audio_bytes, mime_type=mime_type)
        )
        raw_transcript = "audio input"
    elif text:
        parts.append(types.Part.from_text(text=text))
        raw_transcript = text
    else:
        raise ValueError("Either audio_bytes or text must be provided")

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=[types.Content(role="user", parts=parts)],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
        ),
    )

    try:
        result = json.loads(response.text)
    except (json.JSONDecodeError, TypeError):
        result = {"error": "Failed to parse Gemini response", "raw": response.text}

    if role == "patient":
        cleaned = result.get("clinical", "")
    else:
        cleaned = result.get("simplified", "")

    extracted = result.get("extracted", {})

    return {
        "raw_transcript": raw_transcript,
        "cleaned": cleaned,
        "extracted": extracted,
    }
