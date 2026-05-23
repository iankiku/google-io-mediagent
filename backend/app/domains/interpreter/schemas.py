from pydantic import BaseModel, Field
from typing import Literal, Optional
from datetime import datetime
from uuid import UUID

Role = Literal["patient", "doctor"]
LanguageCode = Literal["en-US", "hi-IN", "zh-CN", "hi-en-IN"]


class StartSessionRequest(BaseModel):
    user_id: str


class StartSessionResponse(BaseModel):
    session_id: str
    source_language: LanguageCode
    target_language: LanguageCode  # always "en-US" for patient direction; flips per turn


class TurnResponse(BaseModel):
    session_id: str
    turn_index: int
    role: Role
    raw: str               # what the speaker actually said (in source language)
    cleaned: str           # post-cleanup, in target language (English for patient turn, patient lang for doctor turn)
    created_at: datetime


class Turn(BaseModel):
    turn_index: int
    role: Role
    raw: str
    cleaned: str
    created_at: datetime


class SessionState(BaseModel):
    session_id: str
    user_id: str
    source_language: LanguageCode  # patient's preferred_language; doctor side translates TO this
    turns: list[Turn] = Field(default_factory=list)
    started_at: datetime
    ended_at: Optional[datetime] = None


class EndSessionResponse(BaseModel):
    session_id: str
    record_id: str
    turn_count: int
