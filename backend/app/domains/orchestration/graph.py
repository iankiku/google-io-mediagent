import json
import re
from typing import TypedDict, List, Optional
from langgraph.graph import StateGraph, END
from google.genai import types
from app.core.config import client, DEFAULT_BASE_AGENT
from app.domains.agents.deep_insights_agent.deep_insights_pipeline import (
    DEFAULT_BASE_ROLE,
    build_grounded_system_instruction,
    maybe_generate_general_response,
    run_retrieval,
    synthesize_grounded_answer,
)

class AgentState(TypedDict):
    messages: List[dict]           # Chat history
    latest_input: str              # Latest user prompt
    target_agent_id: str           # Target agent ID
    system_instruction: str        # Custom system instruction
    tools: List[str]               # Enabled tools
    agent_response: str            # Agent response text
    iteration: int                 # Loop counter
    needs_validation: bool         # Validation flag
    validation_status: str         # Validation status
    logs: List[str]                # Execution logs
    custom_agents_md: str          # Custom AGENTS.md overlay
    custom_skills: List[dict]      # Custom skills list
    user_id: Optional[str]         # User ID for data isolation

# Node 1: Router
def router_node(state: AgentState) -> dict:
    latest_input = state.get("latest_input", "")
    logs = state.get("logs", [])
    logs.append("[Router] Analyzing query to determine optimal agent configuration...")
    
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

# Logical pipeline identifiers (mirrors orchestration/router.py). Kept here so
# the graph stays self-defensive when invoked directly (e.g. from the Telegram bot).
_LOGICAL_PIPELINE_AGENT_IDS = {
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


def _normalize_managed_agent_id(requested: Optional[str]) -> str:
    if not requested:
        return DEFAULT_BASE_AGENT
    if requested.strip().lower() in _LOGICAL_PIPELINE_AGENT_IDS:
        return DEFAULT_BASE_AGENT
    return requested


# Node 2: Execution
def execution_node(state: AgentState) -> dict:
    latest_input = state.get("latest_input", "")
    requested_target = state.get("target_agent_id") or DEFAULT_BASE_AGENT
    target_agent_id = _normalize_managed_agent_id(requested_target)
    system_instruction = state.get("system_instruction", "")
    tools = state.get("tools", [])
    logs = state.get("logs", [])
    iteration = state.get("iteration", 0) + 1
    user_id = state.get("user_id")

    logs.append(f"[Executor] Running deep insights pipeline for query: '{latest_input}'")
    if requested_target != target_agent_id:
        logs.append(
            f"[Executor] Normalized logical pipeline id '{requested_target}' "
            f"to managed agent '{target_agent_id}'."
        )

    fast_response, fast_logs = maybe_generate_general_response(latest_input)
    if fast_response is not None:
        for log_line in fast_logs:
            logs.append(log_line.replace("[DeepInsights]", "[Executor]"))
        logs.append("[Executor] Returned fast-path general response.")
        return {
            "agent_response": fast_response,
            "iteration": iteration,
            "logs": logs,
        }

    retrieval_result = run_retrieval(latest_input, user_id)

    if retrieval_result.contexts:
        logs.append(f"[Executor] HyDE retrieved {len(retrieval_result.contexts)} reranked contexts.")
        logs.append(
            f"[Executor] HyDE iterations produced {len(retrieval_result.hypothetical_answers)} hypothetical answers."
        )
    else:
        logs.append("[Executor] HyDE retrieval returned no relevant contexts.")

    system_instruction = build_grounded_system_instruction(
        retrieval_result,
        base_system_instruction=system_instruction or DEFAULT_BASE_ROLE,
    )

    logs.append(f"[Executor] Invoking Managed Agent '{target_agent_id}' (Iteration {iteration})...")

    custom_agents_md = state.get("custom_agents_md")
    custom_skills = state.get("custom_skills") or []

    agent_response, synthesis_logs = synthesize_grounded_answer(
        latest_input,
        system_instruction,
        managed_agent_id=target_agent_id,
        tools=tools,
        custom_agents_md=custom_agents_md,
        custom_skills=custom_skills,
    )
    for log_line in synthesis_logs:
        logs.append(log_line.replace("[DeepInsights]", "[Executor]"))

    return {
        "agent_response": agent_response,
        "iteration": iteration,
        "logs": logs
    }

# Node 3: Validator
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

    # Citation-presence check: medical claims must have citation tokens
    medical_keywords = re.compile(r'(mg/dL|cholesterol|glucose|BP|HbA1c|blood pressure|LDL|potassium|creatinine|lisinopril|metformin)', re.IGNORECASE)
    citation_tokens = re.compile(r'(LOINC:|RxNorm:|MedlinePlus:|ICD-10:|\[doc:)')
    if medical_keywords.search(agent_response) and not citation_tokens.search(agent_response):
        passed = False
        feedback = "Response contains medical claims without citation tokens. Add LOINC:, RxNorm:, or [doc:] citations."

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

def should_continue(state: AgentState) -> str:
    if not state.get("needs_validation", False):
        return END
        
    if state.get("iteration", 0) >= 3:
        state.get("logs", []).append("[Graph] Max verification iterations reached. Terminating graph.")
        return END
        
    status = state.get("validation_status", "pending")
    if status == "passed":
        return END
    elif status == "failed":
        state.get("logs", []).append("[Graph] Re-routing to execution node for refinement.")
        return "execution"
    else:
        return END

builder = StateGraph(AgentState)

builder.add_node("router", router_node)
builder.add_node("execution", execution_node)
builder.add_node("validator", validator_node)

builder.set_entry_point("router")
builder.add_edge("router", "execution")

builder.add_conditional_edges(
    "execution",
    lambda state: "validator" if state.get("needs_validation", False) else END,
    {
        "validator": "validator",
        END: END
    }
)

builder.add_conditional_edges(
    "validator",
    should_continue,
    {
        "execution": "execution",
        END: END
    }
)

graph = builder.compile()
