from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
from app.core.config import DEFAULT_BASE_AGENT
from app.domains.orchestration.graph import graph

router = APIRouter(prefix="/api/chat", tags=["Orchestration"])

class SkillConfig(BaseModel):
    name: str = Field(..., description="Name of the custom skill")
    content: str = Field(..., description="Content of the SKILL.md file")

class ChatRequest(BaseModel):
    message: str = Field(..., description="User query or instruction")
    agent_id: Optional[str] = Field(None, description="Specific persistent Agent ID to target")
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
        # Initialize LangGraph state
        initial_state = {
            "messages": request.chat_history or [],
            "latest_input": request.message,
            "target_agent_id": request.agent_id or DEFAULT_BASE_AGENT,
            "system_instruction": "",
            "tools": [],
            "agent_response": "",
            "iteration": 0,
            "needs_validation": request.needs_validation,
            "validation_status": "pending",
            "logs": [f"[Graph] Starting execution graph targeting agent '{request.agent_id or DEFAULT_BASE_AGENT}'."],
            "custom_agents_md": request.custom_agents_md,
            "custom_skills": [s.model_dump() for s in request.custom_skills] if request.custom_skills else []
        }
        
        # Execute the LangGraph
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
