"""
HTTP surface for the Vapi voice-assistant domain.

Currently exposes a single endpoint:

    POST /api/vapi/assistants/create-from-records
        Body  = CreateVoiceAssistantRequest
        Reply = CreateVoiceAssistantResponse

The frontend hits this from the "Talk to Agent instead" button on
`/talk/appointment-return`, receives an assistant id + the Vapi public key,
and then starts a browser voice call with the @vapi-ai/web SDK.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException

from app.domains.vapi.schemas import (
    CreateVoiceAssistantRequest,
    CreateVoiceAssistantResponse,
    VoiceAssistantRecordRef,
)
from app.domains.vapi.services import (
    build_voice_briefing,
    create_vapi_assistant,
    fetch_user_pdf_records,
    get_vapi_public_key,
)

logger = logging.getLogger("health_assistant.vapi.router")

router = APIRouter(prefix="/api/vapi", tags=["Vapi"])


@router.post(
    "/assistants/create-from-records",
    response_model=CreateVoiceAssistantResponse,
)
def create_voice_assistant_from_records(
    request: CreateVoiceAssistantRequest,
) -> CreateVoiceAssistantResponse:
    user_id = (request.user_id or "").strip()
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id is required.")

    logs: list[str] = [
        f"[Vapi] Building voice assistant for user_id={user_id} "
        f"(record_id={request.record_id or 'all'})."
    ]

    try:
        records = fetch_user_pdf_records(user_id, record_id=request.record_id)
    except Exception as exc:
        logger.exception("Failed to fetch user PDF records for Vapi briefing.")
        raise HTTPException(
            status_code=500,
            detail=f"Could not load your medical records: {exc}",
        ) from exc

    if not records:
        raise HTTPException(
            status_code=404,
            detail=(
                "No PDF-like medical records found for this user. "
                "Upload a PDF on this page first, then try 'Talk to Agent' again."
            ),
        )
    logs.append(f"[Vapi] Loaded {len(records)} record(s) from postgres.")

    record_refs = [
        VoiceAssistantRecordRef(
            record_id=r["record_id"],
            file_name=r["file_name"],
            file_type=r["file_type"],
        )
        for r in records
    ]

    briefing, briefing_logs = build_voice_briefing(records)
    logs.extend(briefing_logs)

    try:
        public_key = get_vapi_public_key()
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    try:
        assistant_id, create_logs = create_vapi_assistant(
            briefing=briefing,
            user_id=user_id,
            record_refs=record_refs,
            voice_id=request.voice_id,
            first_message=request.first_message,
        )
    except RuntimeError as exc:
        # Includes Vapi 4xx/5xx and network errors — surface clean 502 so the
        # frontend can show the detail without crashing.
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    logs.extend(create_logs)

    return CreateVoiceAssistantResponse(
        assistant_id=assistant_id,
        public_key=public_key,
        voice_id=request.voice_id,
        records_included=record_refs,
        briefing_excerpt=briefing[:600],
        briefing_char_count=len(briefing),
        logs=logs,
    )
