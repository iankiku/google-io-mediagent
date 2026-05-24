"""
Service layer for the Vapi voice-assistant domain.

Pipeline (called by `router.create_voice_assistant_from_records`):

    user_id
        |
        v
    fetch_user_pdf_records()       (postgres: user_medical_records + user_record_embeddings)
        |
        v
    build_voice_briefing()         (Gemini 2.5 Flash compresses structured + raw chunks into
                                    a short, spoken-style briefing)
        |
        v
    create_vapi_assistant()        (POST https://api.vapi.ai/assistant with the briefing
                                    baked into the system prompt)
        |
        v
    { assistant_id, public_key, ... }   returned all the way to the browser, which then
                                        runs `new Vapi(publicKey).start(assistantId)`.
"""

from __future__ import annotations

import json
import logging
import os
from typing import List, Optional, Tuple

import requests
from google.genai import types

from app.core.config import client as gemini_client
from app.core.db import get_db_connection
from app.domains.vapi.schemas import (
    DEFAULT_VAPI_VOICE_ID,
    VoiceAssistantRecordRef,
)

logger = logging.getLogger("health_assistant.vapi.services")


VAPI_API_BASE = "https://api.vapi.ai"
VAPI_ASSISTANT_TIMEOUT_SEC = 30.0

# Sizing guards. The Vapi REST API doesn't publish a hard system-prompt limit
# but anything > ~10 KB starts to hurt LLM latency and cost during the call,
# and the assistant gets distracted. Empirically 4-6 KB of briefing is the
# sweet spot.
MAX_RAW_CONTEXT_CHARS = 12_000      # ceiling fed *into* Gemini for compression
MAX_BRIEFING_CHARS = 6_000          # ceiling baked into the assistant system prompt
GEMINI_BRIEFING_MODEL = os.getenv("VAPI_BRIEFING_MODEL", "gemini-2.5-flash")


# ---------------------------------------------------------------------------
# 1. Record retrieval
# ---------------------------------------------------------------------------

def fetch_user_pdf_records(
    user_id: str,
    *,
    record_id: Optional[str] = None,
    chunk_limit_per_record: int = 6,
) -> List[dict]:
    """
    Pull PDF-like medical records for a user, including the structured
    `extracted_summary` (already-parsed ClinicalSummary JSON) and a handful
    of raw embedding chunks per record for additional context the structured
    summary may have lost.

    "PDF-like" here is intentionally permissive — we include anything whose
    file_type or file_name suggests a document the user would expect to
    "chat with" by voice (lab PDFs, doctor notes, plain text reports, etc.).
    Images-only records and prescription bottles are excluded.
    """
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        # NB: psycopg2 treats every `%` in the query string as a parameter
        # placeholder, so bare `LIKE '%report%'` literals would corrupt the
        # placeholder count and raise "tuple index out of range" before the
        # query ever hits postgres. We bind every LIKE pattern as a real
        # parameter instead.
        params: List = [user_id]
        sql = """
            SELECT
                id::text AS record_id,
                file_name,
                file_type,
                extracted_summary,
                created_at
            FROM user_medical_records
            WHERE user_id = %s::uuid
        """
        if record_id:
            sql += " AND id = %s::uuid"
            params.append(record_id)
        else:
            filename_like_patterns = [
                "%.pdf",
                "%.txt",
                "%report%",
                "%lab%",
                "%note%",
            ]
            sql += """
              AND (
                  lower(file_type) IN (
                      'application/pdf', 'pdf', 'text/plain', 'txt',
                      'physician_note', 'doctor_note', 'md_note',
                      'lab_report', 'report'
                  )
                  OR lower(file_name) LIKE ANY(%s)
              )
              AND lower(file_type) NOT IN ('checkin', 'rx_bottle')
            """
            params.append(filename_like_patterns)
        sql += " ORDER BY created_at DESC;"

        cur.execute(sql, tuple(params))
        rows = cur.fetchall()
        if not rows:
            return []

        record_ids = [r["record_id"] for r in rows]
        cur.execute(
            """
            SELECT record_id::text AS record_id, chunk_index, chunk_content
            FROM user_record_embeddings
            WHERE record_id = ANY(%s::uuid[])
            ORDER BY record_id, chunk_index ASC;
            """,
            (record_ids,),
        )
        chunk_rows = cur.fetchall()
        chunks_by_record: dict[str, list[str]] = {}
        for chunk_row in chunk_rows:
            rid = chunk_row["record_id"]
            chunks_by_record.setdefault(rid, []).append(chunk_row["chunk_content"])

        out: List[dict] = []
        for row in rows:
            rid = row["record_id"]
            parsed_summary: Optional[dict] = None
            raw_summary = row.get("extracted_summary")
            if raw_summary:
                try:
                    parsed_summary = json.loads(raw_summary)
                except (TypeError, ValueError):
                    parsed_summary = {"summary": str(raw_summary)}

            out.append(
                {
                    "record_id": rid,
                    "file_name": row["file_name"],
                    "file_type": row["file_type"],
                    "summary": parsed_summary or {},
                    "chunks": chunks_by_record.get(rid, [])[:chunk_limit_per_record],
                }
            )
        return out
    finally:
        cur.close()
        conn.close()


# ---------------------------------------------------------------------------
# 2. Briefing construction
# ---------------------------------------------------------------------------

def _format_record_block(record: dict) -> str:
    """Render one record into the prompt fed to the briefing LLM."""
    summary = record.get("summary") or {}
    lines = [
        f"--- BEGIN RECORD ({record['file_name']} | {record['file_type']}) ---",
    ]
    if summary.get("summary"):
        lines.append(f"Summary: {summary['summary']}")
    if summary.get("key_findings"):
        lines.append("Key findings:")
        for finding in summary["key_findings"]:
            lines.append(f"  - {finding}")
    if summary.get("medications"):
        lines.append("Medications: " + ", ".join(summary["medications"]))
    if summary.get("diagnoses"):
        lines.append("Diagnoses: " + ", ".join(summary["diagnoses"]))
    if summary.get("allergies"):
        lines.append("Allergies: " + ", ".join(summary["allergies"]))
    if summary.get("lab_metrics"):
        lines.append("Lab metrics:")
        for metric in summary["lab_metrics"]:
            if isinstance(metric, dict):
                lines.append(
                    "  - "
                    + f"{metric.get('metric', '?')}: "
                    + f"{metric.get('value', '?')} "
                    + f"({metric.get('status', '?')})"
                )
    if record.get("chunks"):
        lines.append("Raw extracted chunks (for additional grounding):")
        for chunk in record["chunks"]:
            cleaned = " ".join(chunk.split())
            lines.append(f"  > {cleaned}")
    lines.append("--- END RECORD ---")
    return "\n".join(lines)


def _truncate(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    head = text[: limit - 200]
    return head + "\n\n[... truncated for length ...]"


def build_voice_briefing(records: List[dict], *, log_prefix: str = "[Vapi]") -> Tuple[str, List[str]]:
    """
    Compress a list of patient records into a tight, voice-friendly briefing
    that can be baked into the assistant's system prompt.

    The output is plain prose + short bullet sections, written so the LLM
    can quickly reference it during a back-and-forth phone-style chat. We
    intentionally do *not* keep the original JSON or distance scores — those
    are noisy for a TTS-driven conversation.
    """
    logs = [f"{log_prefix} Building voice briefing from {len(records)} record(s)."]

    raw_blocks = [_format_record_block(r) for r in records]
    raw_context = "\n\n".join(raw_blocks)
    truncated_input = _truncate(raw_context, MAX_RAW_CONTEXT_CHARS)
    if len(truncated_input) < len(raw_context):
        logs.append(
            f"{log_prefix} Truncated raw record context from "
            f"{len(raw_context)} -> {len(truncated_input)} chars before briefing."
        )

    system_instruction = (
        "You are preparing a briefing for a voice assistant that will speak with "
        "a patient about their own medical records. Compress the records into a "
        "tight, plain-English briefing the voice assistant can reference live "
        "during a spoken conversation.\n\n"
        "Rules:\n"
        "- Use short paragraphs and bullet points; aim for 800-2000 words.\n"
        "- Translate medical jargon into patient-friendly language, but keep the "
        "original term in parentheses when useful (e.g. 'high blood pressure (hypertension)').\n"
        "- Include every key finding, medication, diagnosis, allergy, and abnormal "
        "lab value. Note normal lab values in a single line.\n"
        "- Where multiple records exist, give each record its own labeled section.\n"
        "- Do NOT invent data, do NOT diagnose, do NOT give treatment advice.\n"
        "- End with a short 'common questions you might ask' section listing "
        "3-5 things the patient is most likely to wonder about."
    )

    prompt = (
        "Records to compress into the briefing:\n\n"
        + truncated_input
    )

    try:
        response = gemini_client.models.generate_content(
            model=GEMINI_BRIEFING_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.2,
            ),
        )
        briefing = getattr(response, "text", None) or str(response)
    except Exception as exc:
        logger.exception("Voice briefing generation failed; falling back to raw blocks.")
        logs.append(
            f"{log_prefix} Gemini briefing failed ({exc}); using raw record dump as fallback."
        )
        briefing = truncated_input

    briefing = _truncate(briefing.strip(), MAX_BRIEFING_CHARS)
    logs.append(f"{log_prefix} Briefing ready ({len(briefing)} chars).")
    return briefing, logs


# ---------------------------------------------------------------------------
# 3. Vapi assistant creation
# ---------------------------------------------------------------------------

def _build_assistant_system_prompt(briefing: str) -> str:
    """Wrap the briefing in the persona instructions the voice assistant runs under."""
    return (
        "You are a warm, careful medical-records voice assistant. Your job is "
        "to help the patient understand what is in their own uploaded medical "
        "PDF(s). You speak conversationally and concisely (1-3 sentences per "
        "turn unless the patient explicitly asks for detail). You never "
        "diagnose, never prescribe, and you never invent data that is not in "
        "the briefing below. If the patient asks something the records do not "
        "cover, say so plainly and suggest a question they can take to their "
        "physician.\n\n"
        "Voice-UX rules:\n"
        "- Keep responses short and conversational; this is a spoken call.\n"
        "- Avoid reading long lists of numbers verbatim; summarize first, "
        "then offer to read the specific values if the patient asks.\n"
        "- When you cite a lab value, give the value, the unit, and whether "
        "it is normal/high/low.\n"
        "- If the patient asks a clinical question outside the records, "
        "explicitly redirect: 'That is a great question for your doctor.'\n\n"
        "BRIEFING ON THIS PATIENT'S UPLOADED PDFs:\n"
        "=========================================\n"
        f"{briefing}\n"
        "=========================================\n"
    )


def create_vapi_assistant(
    *,
    briefing: str,
    user_id: str,
    record_refs: List[VoiceAssistantRecordRef],
    voice_id: str = DEFAULT_VAPI_VOICE_ID,
    first_message: Optional[str] = None,
    log_prefix: str = "[Vapi]",
) -> Tuple[str, List[str]]:
    """
    POST a new assistant to https://api.vapi.ai/assistant and return its id.

    Defaults are picked so the call works without the user adding ANY extra
    provider credentials on the Vapi dashboard:

    - model:     openai / gpt-4o-mini (Vapi has built-in OpenAI creds)
    - voice:     vapi / "Elliot"      (Vapi-native voice; no external creds)
    - transcriber: omitted            (Vapi auto-picks Deepgram nova-3)
    """
    private_key = os.getenv("VAPI_PRIVATE_KEY")
    if not private_key:
        raise RuntimeError(
            "VAPI_PRIVATE_KEY is not set in the environment. "
            "Add it to your .env (see .env.example)."
        )

    logs = [
        f"{log_prefix} Creating Vapi assistant via REST "
        f"(voice={voice_id}, records={len(record_refs)})."
    ]

    system_prompt = _build_assistant_system_prompt(briefing)
    default_first_message = (
        "Hi — I've reviewed the medical PDF you just uploaded. "
        "What would you like to ask about it?"
    )

    payload = {
        "name": f"Medical PDF Voice Assistant — {user_id[:8]}",
        "model": {
            "provider": "openai",
            "model": "gpt-4o-mini",
            "temperature": 0.3,
            "messages": [
                {"role": "system", "content": system_prompt},
            ],
        },
        "voice": {
            "provider": "vapi",
            "voiceId": voice_id,
        },
        "firstMessage": first_message or default_first_message,
        "firstMessageMode": "assistant-speaks-first",
        "endCallMessage": "Take care — goodbye!",
        "endCallPhrases": ["goodbye", "bye", "end the call", "hang up"],
        "maxDurationSeconds": 600,
        "backgroundSound": "off",
        "metadata": {
            "source": "appointment-return",
            "user_id": user_id,
            "record_ids": [r.record_id for r in record_refs],
        },
    }

    try:
        resp = requests.post(
            f"{VAPI_API_BASE}/assistant",
            json=payload,
            headers={
                "Authorization": f"Bearer {private_key}",
                "Content-Type": "application/json",
            },
            timeout=VAPI_ASSISTANT_TIMEOUT_SEC,
        )
    except requests.RequestException as exc:
        logger.exception("Vapi assistant create request failed at the network layer.")
        raise RuntimeError(f"Vapi network error: {exc}") from exc

    if resp.status_code >= 400:
        # Vapi returns helpful error bodies — surface them up so the
        # frontend can show what was wrong instead of "Internal Server Error".
        try:
            body = resp.json()
        except ValueError:
            body = resp.text
        raise RuntimeError(
            f"Vapi rejected assistant creation (HTTP {resp.status_code}): {body}"
        )

    data = resp.json()
    assistant_id = data.get("id")
    if not assistant_id:
        raise RuntimeError(f"Vapi response missing 'id': {data}")

    logs.append(f"{log_prefix} Vapi assistant created (id={assistant_id}).")
    return assistant_id, logs


def get_vapi_public_key() -> str:
    """
    Return the Vapi public key from the environment. This is the SDK
    initialization key the browser needs — it is safe to expose to clients.
    """
    public_key = os.getenv("VAPI_PUBLIC_KEY")
    if not public_key:
        raise RuntimeError(
            "VAPI_PUBLIC_KEY is not set in the environment. "
            "Add it to your .env (see .env.example)."
        )
    return public_key
