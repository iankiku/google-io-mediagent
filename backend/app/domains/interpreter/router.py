import uuid
import json
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional, List
from app.core.db import get_db_connection
from app.domains.interpreter.schemas import TurnResponse
from app.domains.interpreter.services import process_turn

router = APIRouter(prefix="/api/interpreter", tags=["Interpreter"])

# In-memory turn counter per request (stateless -- frontend tracks turn_index)
_turn_counter: dict[str, int] = {}


@router.post("/turn", response_model=TurnResponse)
async def interpreter_turn(
    role: str = Form(...),
    session_id: Optional[str] = Form(None),
    text: Optional[str] = Form(None),
    audio: Optional[UploadFile] = File(None),
):
    audio_bytes = None
    mime_type = "audio/webm"

    if audio:
        audio_bytes = await audio.read()
        mime_type = audio.content_type or "audio/webm"

    if not audio_bytes and not text:
        raise HTTPException(status_code=400, detail="Either audio or text must be provided")

    if role not in ("patient", "doctor"):
        raise HTTPException(status_code=400, detail="Role must be 'patient' or 'doctor'")

    try:
        result = process_turn(
            audio_bytes=audio_bytes,
            text=text,
            role=role,
            mime_type=mime_type,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Interpreter processing failed: {str(e)}")

    key = session_id or "default"
    _turn_counter[key] = _turn_counter.get(key, 0) + 1

    return TurnResponse(
        raw_transcript=result["raw_transcript"],
        cleaned=result["cleaned"],
        extracted=result["extracted"],
        role=role,
        turn_index=_turn_counter[key],
    )


@router.post("/end")
async def end_session(
    user_id: str = Form(...),
    turns: str = Form(...),
):
    """
    End an interpreter session. Saves the full visit transcript as a medical record.
    Accepts user_id and turns (JSON string of turn dicts).
    """
    try:
        turns_list: List[dict] = json.loads(turns)
    except (json.JSONDecodeError, TypeError):
        raise HTTPException(status_code=400, detail="turns must be a valid JSON array")

    record_id = str(uuid.uuid4())
    extracted_summary = json.dumps({
        "type": "visit_transcript",
        "turn_count": len(turns_list),
        "turns": turns_list,
    })

    conn = get_db_connection()
    cur = conn.cursor()
    try:
        # Ensure user exists
        cur.execute("SELECT id FROM users WHERE id = %s;", (user_id,))
        user = cur.fetchone()
        if not user:
            cur.execute(
                "INSERT INTO users (id, phone_number) VALUES (%s, %s);",
                (user_id, f"+0000000000_{uuid.uuid4().hex[:6]}"),
            )

        cur.execute(
            """
            INSERT INTO user_medical_records (id, user_id, file_name, file_type, extracted_summary)
            VALUES (%s, %s, %s, %s, %s);
            """,
            (record_id, user_id, "visit_transcript.json", "visit_transcript", extracted_summary),
        )
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save session: {str(e)}")
    finally:
        cur.close()
        conn.close()

    _turn_counter.clear()

    return {
        "success": True,
        "record_id": record_id,
        "message": f"Visit transcript saved with {len(turns_list)} turns.",
    }
