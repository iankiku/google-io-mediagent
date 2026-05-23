import logging
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.domains.interpreter.schemas import (
    StartSessionRequest,
    StartSessionResponse,
    TurnResponse,
    EndSessionResponse,
)
from app.domains.interpreter.services import (
    start_session,
    submit_turn,
    end_session,
    get_session,
)

logger = logging.getLogger("interpreter.router")

router = APIRouter(prefix="/api/interpreter", tags=["Interpreter"])


@router.post("/start", response_model=StartSessionResponse)
def start(req: StartSessionRequest) -> StartSessionResponse:
    try:
        session = start_session(req.user_id)
    except Exception as e:
        logger.error(f"start_session failed: {e}")
        raise HTTPException(status_code=500, detail=f"start_session failed: {e}")
    return StartSessionResponse(
        session_id=session.session_id,
        source_language=session.source_language,
        target_language="en-US",
    )


@router.post("/turn", response_model=TurnResponse)
async def turn(
    session_id: str = Form(...),
    role: str = Form(...),
    audio: UploadFile = File(...),
) -> TurnResponse:
    if role not in ("patient", "doctor"):
        raise HTTPException(status_code=400, detail="role must be 'patient' or 'doctor'")
    try:
        get_session(session_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"session {session_id} not found")

    audio_bytes = await audio.read()
    mime_type = audio.content_type or "audio/webm"
    try:
        t = await submit_turn(
            session_id=session_id,
            role=role,  # type: ignore[arg-type]
            audio_bytes=audio_bytes,
            mime_type=mime_type,
        )
    except Exception as e:
        logger.error(f"submit_turn failed: {e}")
        raise HTTPException(status_code=500, detail=f"submit_turn failed: {e}")
    return TurnResponse(
        session_id=session_id,
        turn_index=t.turn_index,
        role=t.role,
        raw=t.raw,
        cleaned=t.cleaned,
        created_at=t.created_at,
    )


@router.post("/end", response_model=EndSessionResponse)
def end(session_id: str = Form(...)) -> EndSessionResponse:
    try:
        session = get_session(session_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"session {session_id} not found")
    turn_count = len(session.turns)
    try:
        record_id = end_session(session_id)
    except Exception as e:
        logger.error(f"end_session failed: {e}")
        raise HTTPException(status_code=500, detail=f"end_session failed: {e}")
    return EndSessionResponse(
        session_id=session_id,
        record_id=record_id,
        turn_count=turn_count,
    )
