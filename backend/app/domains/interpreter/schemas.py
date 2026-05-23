from pydantic import BaseModel
from typing import Literal, Optional, List


class TurnRequest(BaseModel):
    role: Literal["patient", "doctor"]


class TurnResponse(BaseModel):
    raw_transcript: str
    cleaned: str
    extracted: dict
    role: str
    turn_index: int


class SessionResponse(BaseModel):
    session_id: str
    turns: List[TurnResponse]
