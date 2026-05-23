import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
from app.core.config import DEFAULT_BASE_AGENT
from app.domains.orchestration.graph import graph

logger = logging.getLogger("health_assistant.orchestration.router")

router = APIRouter(prefix="/api/chat", tags=["Orchestration"])

# Logical pipeline identifiers the frontend / external callers may send.
# These are NOT real Managed Agent IDs registered with the GenAI Client —
# they are pipeline markers. They all resolve to DEFAULT_BASE_AGENT because
# /api/chat always runs the deep-insights pipeline (HyDE + rerank + grounded
# synthesis); the underlying Managed Agent only powers the final synthesis call.
LOGICAL_PIPELINE_AGENT_IDS = {
    "deep-insights-agent",
    "deep_insights_agent",
    "deep-insights",
    "deep_insights",
    "reports-agent",
    "reports_agent",
    "scans-agent",
    "scans_agent",
    "research-agent",
    "research_agent",
}


def resolve_managed_agent_id(requested_agent_id: Optional[str]) -> str:
    """Map logical pipeline names to the real Managed Agent backing synthesis."""
    if not requested_agent_id:
        return DEFAULT_BASE_AGENT
    if requested_agent_id.strip().lower() in LOGICAL_PIPELINE_AGENT_IDS:
        return DEFAULT_BASE_AGENT
    return requested_agent_id

class SkillConfig(BaseModel):
    name: str = Field(..., description="Name of the custom skill")
    content: str = Field(..., description="Content of the SKILL.md file")

class ChatRequest(BaseModel):
    message: str = Field(..., description="User query or instruction")
    agent_id: Optional[str] = Field(None, description="Specific persistent Agent ID to target")
    user_id: Optional[str] = Field(None, description="Contextual User UUID for private medical data lookups")
    needs_validation: bool = Field(False, description="Enable verification/validator node in LangGraph")
    chat_history: Optional[List[dict]] = Field(default_factory=list, description="List of previous messages: [{'role': 'user'|'model', 'content': str}]")
    custom_agents_md: Optional[str] = Field(None, description="Inline AGENTS.md content to overlay")
    custom_skills: Optional[List[SkillConfig]] = Field(None, description="Inline skills to mount")

class ChatResponse(BaseModel):
    response: str
    logs: List[str]
    tools_used: List[str]
    system_instruction: str
    validation_status: str

@router.post("", response_model=ChatResponse)
async def chat(request: ChatRequest):
    try:
        resolved_agent_id = resolve_managed_agent_id(request.agent_id)
        logs: List[str] = [
            f"[Graph] Starting execution graph targeting agent '{resolved_agent_id}'."
        ]
        if request.agent_id and request.agent_id != resolved_agent_id:
            logs.append(
                f"[Graph] Resolved logical pipeline id '{request.agent_id}' "
                f"to managed agent '{resolved_agent_id}'."
            )

        initial_state = {
            "messages": request.chat_history or [],
            "latest_input": request.message,
            "target_agent_id": resolved_agent_id,
            "system_instruction": "",
            "tools": [],
            "agent_response": "",
            "iteration": 0,
            "needs_validation": request.needs_validation,
            "validation_status": "pending",
            "logs": logs,
            "custom_agents_md": request.custom_agents_md,
            "custom_skills": [s.model_dump() for s in request.custom_skills] if request.custom_skills else [],
            "user_id": request.user_id
        }

        result = graph.invoke(initial_state)
        
        return ChatResponse(
            response=result.get("agent_response", ""),
            logs=result.get("logs", []),
            tools_used=result.get("tools", []),
            system_instruction=result.get("system_instruction", ""),
            validation_status=result.get("validation_status", "pending")
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Graph execution failed: {str(e)}")
