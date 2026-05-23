from pydantic import BaseModel
from typing import List


class ScoredContext(BaseModel):
    record_id: str
    chunk_content: str
    score: float
    reason: str


class RetrievalResult(BaseModel):
    contexts: List[ScoredContext]
    hypothetical_answers: List[str]
    query: str
