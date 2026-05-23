import os
import json
import uuid
import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

from google.genai import types

from app.core.config import client
from app.core.db import get_db_connection
from app.domains.interpreter.schemas import (
    Role,
    Turn,
    SessionState,
    LanguageCode,
)
from app.domains.interpreter.vocab import build_vocab_block
from app.domains.interpreter.prompts import (
    render_patient_prompt,
    render_doctor_prompt,
)
from app.domains.interpreter.stt import transcribe
from app.domains.ingestion.services import chunk_text, generate_embedding

logger = logging.getLogger("interpreter.services")

CLEANUP_MODEL = os.getenv("INTERPRETER_CLEANUP_MODEL", "gemini-2.5-flash")

# In-memory session store. Single-process, OK for hackathon. Restart = lose sessions.
_SESSIONS: dict[str, SessionState] = {}


def _fetch_preferred_language(user_id: str) -> LanguageCode:
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT preferred_language FROM users WHERE id = %s;", (user_id,))
        row = cur.fetchone()
        if not row or not row.get("preferred_language"):
            return "en-US"
        return row["preferred_language"]
    finally:
        cur.close()
        conn.close()


def start_session(user_id: str) -> SessionState:
    source_language = _fetch_preferred_language(user_id)
    session = SessionState(
        session_id=str(uuid.uuid4()),
        user_id=user_id,
        source_language=source_language,
        turns=[],
        started_at=datetime.now(timezone.utc),
    )
    _SESSIONS[session.session_id] = session
    logger.info(f"session {session.session_id} started for user {user_id} ({source_language})")
    return session


def get_session(session_id: str) -> SessionState:
    sess = _SESSIONS.get(session_id)
    if not sess:
        raise KeyError(f"session {session_id} not found")
    return sess


async def _cleanup_pass(raw: str, role: Role, source_language: str, vocab_block: str) -> str:
    """Run the cleanup/translation prompt against raw transcript text."""
    if not raw or raw.strip() == "":
        return ""
    if role == "patient":
        system_prompt = render_patient_prompt(
            source_language=source_language,
            vocab_block=vocab_block,
        )
    else:
        # doctor speaks English, output renders in patient's language
        system_prompt = render_doctor_prompt(
            target_language=source_language,
            vocab_block=vocab_block,
        )

    response = await asyncio.to_thread(
        client.models.generate_content,
        model=CLEANUP_MODEL,
        contents=[raw],
        config=types.GenerateContentConfig(system_instruction=system_prompt),
    )
    cleaned = (response.text or "").strip()
    if cleaned.upper().strip(".\"' ") == "EMPTY":
        return ""
    return cleaned


async def submit_turn(
    session_id: str,
    role: Role,
    audio_bytes: bytes,
    mime_type: str = "audio/webm",
) -> Turn:
    session = get_session(session_id)

    if role == "patient":
        stt_lang = session.source_language
    else:
        stt_lang = "en-US"  # doctor always speaks English

    raw = await transcribe(audio_bytes, source_language=stt_lang, mime_type=mime_type)

    vocab_block = build_vocab_block(
        user_id=session.user_id,
        source_language=session.source_language,
    )
    cleaned = await _cleanup_pass(
        raw=raw,
        role=role,
        source_language=session.source_language,
        vocab_block=vocab_block,
    )

    turn = Turn(
        turn_index=len(session.turns),
        role=role,
        raw=raw,
        cleaned=cleaned,
        created_at=datetime.now(timezone.utc),
    )
    session.turns.append(turn)
    return turn


def end_session(session_id: str) -> str:
    """Persist the session as a user_medical_records row and return the record_id."""
    session = get_session(session_id)
    session.ended_at = datetime.now(timezone.utc)

    record_id = _persist_session(session)
    _SESSIONS.pop(session_id, None)
    return record_id


def _persist_session(session: SessionState) -> str:
    extracted = {
        "summary": (
            f"Visit transcript ({len(session.turns)} turns) — "
            f"source language {session.source_language}, started "
            f"{session.started_at.isoformat()}"
        ),
        "key_findings": [],
        "medications": [],
        "diagnoses": [],
        "allergies": [],
        "lab_metrics": [],
        "turns": [t.model_dump(mode="json") for t in session.turns],
        "started_at": session.started_at.isoformat(),
        "ended_at": (session.ended_at or datetime.now(timezone.utc)).isoformat(),
        "source_language": session.source_language,
    }

    # Build a single English-side concatenation for embedding.
    # Patient turns: `cleaned` is already English. Doctor turns: `raw` is the English text.
    english_lines: list[str] = []
    for t in session.turns:
        prefix = "Patient: " if t.role == "patient" else "Doctor: "
        text = t.cleaned if t.role == "patient" else t.raw
        if text:
            english_lines.append(prefix + text)
    embedding_text = "\n".join(english_lines) or extracted["summary"]

    conn = get_db_connection()
    cur = conn.cursor()
    try:
        file_name = f"visit_{session.session_id}.json"
        cur.execute(
            """
            INSERT INTO user_medical_records (user_id, file_name, file_path, file_type, extracted_summary)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id;
            """,
            (
                session.user_id,
                file_name,
                f"inline://visit/{session.session_id}",  # no GCS upload — content is inline in extracted_summary
                "visit_transcript",
                json.dumps(extracted),
            ),
        )
        record_id = cur.fetchone()["id"]

        chunks = chunk_text(embedding_text)
        for idx, chunk in enumerate(chunks):
            embedding = generate_embedding(chunk)
            cur.execute(
                """
                INSERT INTO user_record_embeddings (record_id, user_id, chunk_index, chunk_content, embedding)
                VALUES (%s, %s, %s, %s, %s);
                """,
                (record_id, session.user_id, idx, chunk, embedding),
            )
        conn.commit()
        return str(record_id)
    except Exception as e:
        conn.rollback()
        logger.error(f"failed to persist visit session {session.session_id}: {e}")
        raise
    finally:
        cur.close()
        conn.close()
