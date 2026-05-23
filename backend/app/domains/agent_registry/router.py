from fastapi import APIRouter, HTTPException
from typing import List
from app.domains.agent_registry.schemas import AgentCreateRequest, AgentCreateResponse, AgentDetailResponse
from app.domains.agent_registry.services import AgentRegistryService

router = APIRouter(prefix="/api/agents", tags=["Agent Registry"])

@router.post("", response_model=AgentCreateResponse)
async def create_agent(request: AgentCreateRequest):
    try:
        agent = AgentRegistryService.create_agent(
            agent_id=request.id,
            description=request.description,
            system_instruction=request.system_instruction,
            tools=request.tools,
            files=request.files
        )
        return AgentCreateResponse(
            success=True,
            agent_id=agent.id,
            description=agent.description or "",
            system_instruction=agent.system_instruction or ""
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to register agent: {str(e)}")

@router.get("")
async def list_agents():
    try:
        agents = AgentRegistryService.list_agents()
        return {"agents": agents}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list agents: {str(e)}")

@router.get("/{agent_id}", response_model=AgentDetailResponse)
async def get_agent(agent_id: str):
    try:
        agent = AgentRegistryService.get_agent(agent_id)
        return AgentDetailResponse(
            id=agent.id,
            description=agent.description or "",
            system_instruction=agent.system_instruction or "",
            base_agent=agent.base_agent or ""
        )
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Agent '{agent_id}' not found: {str(e)}")

@router.delete("/{agent_id}")
async def delete_agent(agent_id: str):
    try:
        AgentRegistryService.delete_agent(agent_id)
        return {"success": True, "message": f"Agent '{agent_id}' deleted successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete agent: {str(e)}")
