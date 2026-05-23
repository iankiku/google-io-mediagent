"""
End-to-end interpreter CLI for manual verification without the frontend.

Usage:
    python -m app.domains.interpreter.cli \
        --audio path/to/clip.webm \
        --role patient \
        --user-id 11111111-1111-1111-1111-111111111111

Prints the resulting Turn (raw + cleaned). Useful for Hindi->English and
Mandarin->English smoke tests, and the reverse direction (doctor English ->
patient's preferred_language) by toggling --role doctor.
"""
import argparse
import asyncio
import json
import sys
from pathlib import Path

from app.domains.interpreter.services import start_session, submit_turn, end_session


def _mime_for(path: Path) -> str:
    ext = path.suffix.lower()
    return {
        ".webm": "audio/webm",
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".m4a": "audio/mp4",
        ".ogg": "audio/ogg",
        ".flac": "audio/flac",
    }.get(ext, "audio/webm")


async def _run(audio_path: Path, role: str, user_id: str, keep_session: bool) -> int:
    if not audio_path.exists():
        print(f"error: audio file not found: {audio_path}", file=sys.stderr)
        return 2
    if role not in ("patient", "doctor"):
        print("error: --role must be 'patient' or 'doctor'", file=sys.stderr)
        return 2

    audio_bytes = audio_path.read_bytes()
    mime_type = _mime_for(audio_path)

    session = start_session(user_id)
    print(json.dumps({
        "event": "session_started",
        "session_id": session.session_id,
        "user_id": user_id,
        "source_language": session.source_language,
    }, indent=2))

    turn = await submit_turn(
        session_id=session.session_id,
        role=role,  # type: ignore[arg-type]
        audio_bytes=audio_bytes,
        mime_type=mime_type,
    )
    print(json.dumps({
        "event": "turn",
        "role": turn.role,
        "turn_index": turn.turn_index,
        "raw": turn.raw,
        "cleaned": turn.cleaned,
    }, indent=2, ensure_ascii=False))

    if not keep_session:
        record_id = end_session(session.session_id)
        print(json.dumps({
            "event": "session_ended",
            "record_id": record_id,
        }, indent=2))
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description="Interpreter pipeline CLI")
    p.add_argument("--audio", required=True, type=Path, help="Path to an audio file (webm/mp3/wav/m4a/ogg/flac)")
    p.add_argument("--role", required=True, choices=["patient", "doctor"], help="Speaker role")
    p.add_argument("--user-id", required=True, help="Existing user UUID (drives preferred_language)")
    p.add_argument("--keep-session", action="store_true", help="Skip end_session (don't persist a visit_transcript row)")
    args = p.parse_args()
    return asyncio.run(_run(args.audio, args.role, args.user_id, args.keep_session))


if __name__ == "__main__":
    raise SystemExit(main())
