from typing import List, Dict, Any
from app.core.config import client, DEFAULT_BASE_AGENT

class AgentRegistryService:
    @staticmethod
    def create_agent(agent_id: str, description: str, system_instruction: str, tools: List[str] = None, files: List[Dict[str, str]] = None) -> Any:
        # Default tools
        api_tools = [{"type": t} for t in tools] if tools is not None else [
            {"type": "code_execution"},
            {"type": "google_search"},
            {"type": "url_context"}
        ]
        
        # Parse inline file sources
        sources = []
        if files:
            for f in files:
                sources.append({
                    "type": "inline",
                    "target": f.get("target"),
                    "content": f.get("content")
                })
                
        # Invoke GenAI Client
        agent = client.agents.create(
            id=agent_id,
            description=description or "",
            base_agent=DEFAULT_BASE_AGENT,
            system_instruction=system_instruction,
            tools=api_tools,
            base_environment={
                "type": "remote",
                "sources": sources
            } if sources else None
        )
        return agent

    @staticmethod
    def list_agents() -> List[Dict[str, Any]]:
        agents_response = client.agents.list()
        agents_list = []
        if hasattr(agents_response, "agents") and agents_response.agents:
            for a in agents_response.agents:
                agents_list.append({
                    "id": a.id,
                    "description": a.description or "",
                    "system_instruction": a.system_instruction or "",
                    "base_agent": a.base_agent or ""
                })
        return agents_list

    @staticmethod
    def get_agent(agent_id: str) -> Any:
        return client.agents.get(id=agent_id)

    @staticmethod
    def delete_agent(agent_id: str) -> None:
        client.agents.delete(id=agent_id)
