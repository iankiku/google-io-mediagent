import os
import asyncio
import logging
from typing import Optional

from google.genai import types

from app.core.config import client

logger = logging.getLogger("interpreter.stt")

# Toggle Live API vs batch Flash STT. Set INTERPRETER_STT_MODE=batch as escape hatch.
STT_MODE = os.getenv("INTERPRETER_STT_MODE", "live").lower()
LIVE_MODEL = os.getenv("INTERPRETER_LIVE_MODEL", "gemini-2.0-flash-exp")
BATCH_MODEL = os.getenv("INTERPRETER_BATCH_MODEL", "gemini-2.5-flash")


_BCP47_TO_GENAI_HINT = {
    "hi-IN": "Hindi",
    "zh-CN": "Mandarin Chinese",
    "hi-en-IN": "Indian English (English with Hindi code-switching)",
    "en-US": "American English",
}


async def transcribe(audio_bytes: bytes, source_language: str, mime_type: str = "audio/webm") -> str:
    """Return the raw verbatim transcript of `audio_bytes` in its source language.

    Primary path: Gemini Live API streaming session.
    Fallback path (INTERPRETER_STT_MODE=batch): Gemini Flash non-streaming with audio Part.
    Both paths return plain text with no cleanup applied — that happens downstream.
    """
    if STT_MODE == "batch":
        return await _transcribe_batch(audio_bytes, source_language, mime_type)
    try:
        return await _transcribe_live(audio_bytes, source_language, mime_type)
    except Exception as e:
        logger.warning(f"live transcription failed, falling back to batch: {e}")
        return await _transcribe_batch(audio_bytes, source_language, mime_type)


async def _transcribe_live(audio_bytes: bytes, source_language: str, mime_type: str) -> str:
    """Open a per-turn Gemini Live API session, send the audio, return finalized text."""
    lang_hint = _BCP47_TO_GENAI_HINT.get(source_language, source_language)
    system_instruction = (
        f"Transcribe the user's speech verbatim. The speaker is using {lang_hint}. "
        f"Preserve their exact wording, including regional idioms. "
        f"Do not translate, do not clean up, do not paraphrase. "
        f"Return only the transcript text."
    )

    config = types.LiveConnectConfig(
        response_modalities=["TEXT"],
        system_instruction=types.Content(
            role="user",
            parts=[types.Part(text=system_instruction)],
        ),
    )

    transcript_parts: list[str] = []
    async with client.aio.live.connect(model=LIVE_MODEL, config=config) as session:
        await session.send(
            input=types.Blob(data=audio_bytes, mime_type=mime_type),
            end_of_turn=True,
        )
        async for response in session.receive():
            if response.text:
                transcript_parts.append(response.text)
            if getattr(response, "server_content", None) and getattr(
                response.server_content, "turn_complete", False
            ):
                break
    return "".join(transcript_parts).strip()


async def _transcribe_batch(audio_bytes: bytes, source_language: str, mime_type: str) -> str:
    """Single-shot non-streaming Gemini Flash audio understanding. Same Google stack."""
    lang_hint = _BCP47_TO_GENAI_HINT.get(source_language, source_language)
    instruction = (
        f"Transcribe the following audio verbatim. The speaker is using {lang_hint}. "
        f"Preserve exact wording, including regional idioms. "
        f"Do not translate, clean up, or paraphrase. Return only the transcript text."
    )
    audio_part = types.Part.from_bytes(data=audio_bytes, mime_type=mime_type)
    response = await asyncio.to_thread(
        client.models.generate_content,
        model=BATCH_MODEL,
        contents=[instruction, audio_part],
    )
    return (response.text or "").strip()
