from pydantic import BaseModel, Field
from typing import List, Optional, Dict

class AgentCreateRequest(BaseModel):
    id: str = Field(..., description="Unique slug/identifier for the agent")
    description: Optional[str] = Field(None, description="Description of agent capabilities")
    system_instruction: str = Field(..., description="Core persona or developer instructions")
    tools: Optional[List[str]] = Field(None, description="Available tools: ['code_execution', 'google_search', 'url_context']")
    files: Optional[List[Dict[str, str]]] = Field(None, description="List of inline workspace files: [{'target': '.agents/AGENTS.md', 'content': '...'}]")

class AgentCreateResponse(BaseModel):
    success: bool
    agent_id: str
    description: str
    system_instruction: str

class AgentDetailResponse(BaseModel):
    id: str
    description: str
    system_instruction: str
    base_agent: str
