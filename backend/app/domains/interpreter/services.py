import json
from google.genai import types
from app.core.config import client

PROMPT_PATIENT_TO_CLINICAL = """You are a medical scribe. The patient is speaking (may be in Hindi, Mandarin, Indian English, or American English). Normalize their utterance into concise American clinical English. Preserve every value, timeframe, and qualifier. Add nothing not said.

Return a JSON object with exactly these fields:
- `raw`: the verbatim transcript in the speaker's source language (Han characters, Devanagari, etc., kept as-is — no translation in this field)
- `clinical`: one to three sentences of American clinical English
- `extracted`: object with `symptom`, `onset`, `severity`, `associated`, `medications_mentioned`"""

PROMPT_DOCTOR_TO_SIMPLIFIED = """You are explaining the doctor's words to a Hindi/Mandarin/Indian-English-speaking patient at a 6th-grade reading level using familiar register. Use the patient's likely register where natural. Add nothing the doctor did not say.

Return a JSON object with exactly these fields:
- `raw`: the verbatim English transcript of what the doctor said
- `simplified`: one to three sentences explaining it for the patient
- `extracted`: object with `plan_items`, `medications_prescribed`, `tests_ordered`, `followup`"""


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
        fallback_raw = ""
    elif text:
        parts.append(types.Part.from_text(text=text))
        fallback_raw = text
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

    raw_transcript = result.get("raw", "") or fallback_raw

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
