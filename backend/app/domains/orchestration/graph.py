import json
from typing import TypedDict, List
from langgraph.graph import StateGraph, END
from google.genai import types
from app.core.config import client, DEFAULT_BASE_AGENT

# Define the state representation
class AgentState(TypedDict):
    messages: List[dict]           # Chat history: [{"role": "user"|"model", "content": str}]
    latest_input: str              # The latest prompt from the user
    target_agent_id: str           # The agent to invoke (e.g., "antigravity-preview-05-2026" or a custom registered ID)
    system_instruction: str        # Custom system instruction to override or extend behavior
    tools: List[str]               # Enabled tools, e.g. ["code_execution", "google_search", "url_context"]
    agent_response: str            # The output of the managed agent interaction
    iteration: int                 # Loop counter for verification
    needs_validation: bool         # Whether output validation is enabled
    validation_status: str         # "passed", "failed", "pending"
    logs: List[str]                # Execution steps and routing logs
    custom_agents_md: str          # Custom AGENTS.md content to overlay
    custom_skills: List[dict]      # Custom skills list to mount

# Node 1: Router
# Uses Gemini to analyze user query and configure the correct agent, instructions, and tools.
def router_node(state: AgentState) -> dict:
    latest_input = state.get("latest_input", "")
    logs = state.get("logs", [])
    logs.append("[Router] Analyzing query to determine optimal agent configuration...")
    
    # We will ask Gemini to structure the routing decision in JSON
    prompt = f"""
    Analyze the user prompt and decide the best routing configuration for a managed agent session.
    User prompt: "{latest_input}"

    Determine:
    1. A specialized system instruction (role definition, tone, requirements).
    2. Which tools the agent will require from the available list: ["code_execution", "google_search", "url_context"].
       - If the user wants computations, data analysis, chart generation, or coding, include "code_execution".
       - If they ask about current events, news, or general search, include "google_search".
       - If they provide links, include "url_context".
    
    Return your response strictly in the following JSON format:
    {{
        "system_instruction": "Your customized agent instructions here...",
        "tools": ["tool1", "tool2"]
    }}
    """
    
    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                system_instruction="You are a routing agent for a multi-agent backend system. Always respond with pure JSON."
            )
        )
        decision = json.loads(response.text)
        system_instruction = decision.get("system_instruction", "You are a helpful assistant.")
        tools = decision.get("tools", ["code_execution", "google_search", "url_context"])
    except Exception as e:
        # Fallback config
        system_instruction = "You are a helpful assistant with access to search and code execution."
        tools = ["code_execution", "google_search", "url_context"]
        logs.append(f"[Router] Routing failed with error: {str(e)}. Using fallback configuration.")

    logs.append(f"[Router] Selected tools: {tools}")
    logs.append(f"[Router] Custom instruction length: {len(system_instruction)} chars")

    return {
        "system_instruction": system_instruction,
        "tools": tools,
        "logs": logs
    }

# Node 2: Managed Agent Execution
# Invokes the Gemini API interactions service with the routing decisions.
def execution_node(state: AgentState) -> dict:
    latest_input = state.get("latest_input", "")
    target_agent_id = state.get("target_agent_id") or DEFAULT_BASE_AGENT
    system_instruction = state.get("system_instruction", "")
    tools = state.get("tools", [])
    logs = state.get("logs", [])
    iteration = state.get("iteration", 0) + 1
    
    logs.append(f"[Executor] Invoking Managed Agent '{target_agent_id}' (Iteration {iteration})...")
    
    # Map tool string to types.Tool
    api_tools = []
    for t in tools:
        api_tools.append({"type": t})

    # Build environment structure dynamically for inline customization
    custom_agents_md = state.get("custom_agents_md")
    custom_skills = state.get("custom_skills") or []
    
    environment_config = "remote"
    
    if custom_agents_md or custom_skills:
        sources = []
        if custom_agents_md:
            sources.append({
                "type": "inline",
                "target": ".agents/AGENTS.md",
                "content": custom_agents_md
            })
            logs.append(f"[Executor] Overlaying custom inline AGENTS.md (length: {len(custom_agents_md)} chars)")
            
        for skill in custom_skills:
            skill_name = skill.get("name")
            skill_content = skill.get("content")
            if skill_name and skill_content:
                sources.append({
                    "type": "inline",
                    "target": f".agents/skills/{skill_name}/SKILL.md",
                    "content": skill_content
                })
                logs.append(f"[Executor] Overlaying custom inline skill '{skill_name}' (length: {len(skill_content)} chars)")
                
        environment_config = {
            "type": "remote",
            "sources": sources
        }

    try:
        interaction = client.interactions.create(
            agent=target_agent_id,
            input=latest_input,
            system_instruction=system_instruction,
            tools=api_tools,
            environment=environment_config
        )
        agent_response = interaction.output_text
        logs.append("[Executor] Interaction succeeded.")
    except Exception as e:
        agent_response = f"Error executing managed agent interaction: {str(e)}"
        logs.append(f"[Executor] Interaction failed with error: {str(e)}")

    return {
        "agent_response": agent_response,
        "iteration": iteration,
        "logs": logs
    }

# Node 3: Output Validator
# Uses Gemini to inspect the output. If it finds critical errors or unmet requirements, it marks the validation as failed.
def validator_node(state: AgentState) -> dict:
    latest_input = state.get("latest_input", "")
    agent_response = state.get("agent_response", "")
    logs = state.get("logs", [])
    
    logs.append("[Validator] Validating agent output against initial prompt constraints...")
    
    prompt = f"""
    Review if the Agent's Response sufficiently answers the User Query.
    
    User Query: "{latest_input}"
    Agent's Response: "{agent_response}"
    
    Does the response answer the user query clearly and correctly?
    Return a JSON object in this format:
    {{
        "validation_passed": true/false,
        "feedback": "Detailed feedback if failed, or empty string if passed"
    }}
    """
    
    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                system_instruction="You are a quality assurance validator. Your job is to check if the generated output meets the user's requirements."
            )
        )
        decision = json.loads(response.text)
        passed = decision.get("validation_passed", True)
        feedback = decision.get("feedback", "")
    except Exception as e:
        passed = True
        feedback = ""
        logs.append(f"[Validator] Validation failed to run: {str(e)}. Defaulting to PASS.")

    if passed:
        logs.append("[Validator] Output validation passed!")
        validation_status = "passed"
    else:
        logs.append(f"[Validator] Output validation failed: {feedback}")
        validation_status = "failed"
        
    return {
        "validation_status": validation_status,
        "logs": logs
    }

# Conditional edge logic
def should_continue(state: AgentState) -> str:
    # If validation is disabled, end immediately
    if not state.get("needs_validation", False):
        return END
        
    # If iteration exceeds limit, end to avoid infinite loop
    if state.get("iteration", 0) >= 3:
        state.get("logs", []).append("[Graph] Max verification iterations reached. Terminating graph.")
        return END
        
    # Check validation status
    status = state.get("validation_status", "pending")
    if status == "passed":
        return END
    elif status == "failed":
        # Loop back to executor
        state.get("logs", []).append("[Graph] Re-routing to execution node for refinement.")
        return "execution"
    else:
        return END

# Build the LangGraph Workflow
builder = StateGraph(AgentState)

builder.add_node("router", router_node)
builder.add_node("execution", execution_node)
builder.add_node("validator", validator_node)

builder.set_entry_point("router")
builder.add_edge("router", "execution")

# execution can continue to validator or end
builder.add_conditional_edges(
    "execution",
    lambda state: "validator" if state.get("needs_validation", False) else END,
    {
        "validator": "validator",
        END: END
    }
)

# validator can loop back to execution or end
builder.add_conditional_edges(
    "validator",
    should_continue,
    {
        "execution": "execution",
        END: END
    }
)

graph = builder.compile()
