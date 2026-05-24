"""
Pydantic models for the Vapi voice-assistant domain.

These models bracket the public surface area of `/api/vapi/*`. The actual
Vapi REST API has a far larger schema (see `mcps/.../create.md`) — we only
expose the knobs that matter for "spin up a one-shot voice assistant that
knows about the user's uploaded PDFs", and let Vapi defaults fill in the
rest (transcriber → Deepgram nova-3, etc.).
"""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


# Vapi-native voices are billed/served by Vapi itself, so they work without
# the user wiring up an ElevenLabs / Cartesia / Deepgram TTS account on the
# Vapi dashboard. "Elliot" is a neutral, US-English voice that we picked as
# the default. The full enum lives in `VapiVoiceVoiceId` in the OpenAPI
# spec — change `DEFAULT_VAPI_VOICE_ID` to swap defaults globally.
DEFAULT_VAPI_VOICE_ID = "Elliot"


class CreateVoiceAssistantRequest(BaseModel):
    user_id: str = Field(
        ...,
        description="UUID of the user whose uploaded medical PDFs should be summarized into the voice assistant's system prompt.",
    )
    record_id: Optional[str] = Field(
        None,
        description=(
            "Optional specific user_medical_records.id to focus on. When omitted "
            "we pull all of the user's PDF-like records and brief over all of them."
        ),
    )
    voice_id: str = Field(
        DEFAULT_VAPI_VOICE_ID,
        description=(
            "Vapi voice id (one of the values from the VapiVoiceVoiceId enum). "
            "Defaults to 'Elliot'."
        ),
    )
    first_message: Optional[str] = Field(
        None,
        description="Override the first thing the assistant says when the call connects.",
    )


class VoiceAssistantRecordRef(BaseModel):
    record_id: str
    file_name: str
    file_type: str


class CreateVoiceAssistantResponse(BaseModel):
    assistant_id: str = Field(..., description="The freshly-created Vapi assistant id.")
    public_key: str = Field(
        ...,
        description=(
            "The Vapi public key, returned so the browser can initialize "
            "`new Vapi(publicKey)` without needing its own env var."
        ),
    )
    voice_id: str
    records_included: List[VoiceAssistantRecordRef]
    briefing_excerpt: str = Field(
        ...,
        description="First ~600 chars of the voice-friendly briefing baked into the assistant's system prompt — for debugging in the UI.",
    )
    briefing_char_count: int
    logs: List[str] = Field(
        default_factory=list,
        description="Per-step pipeline trace, shown in the dialog's debug pane.",
    )
