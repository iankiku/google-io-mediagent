import json
import re
from typing import TypedDict, List, Optional
from langgraph.graph import StateGraph, END
from google.genai import types
from app.core.config import client, DEFAULT_BASE_AGENT
from app.domains.retrieval.services import retrieve

INVARIANT_SYSTEM_INSTRUCTION = """
CRITICAL RULE — Citation Invariant:
Every medical statement you produce must be either:
(i) a value from the patient's records, cited as [doc:<record_id>] or with the source document name
(ii) a definition from a citable reference, cited as LOINC:<code>, RxNorm:<rxcui>, or MedlinePlus:<url>
(iii) explicitly framed as a question to bring to the doctor, not a claim

No free-form medical synthesis without a citation. Ever.

When your response approaches advice territory, include this line:
"I'm not a doctor — I can help you understand and remember. Let's bring this to Dr. Patel on Thursday."

When speaking to the patient, use Indian English register where natural — familiar idioms, not dumbed-down language.
"""

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

# Node 2: Execution
def execution_node(state: AgentState) -> dict:
    latest_input = state.get("latest_input", "")
    target_agent_id = state.get("target_agent_id") or DEFAULT_BASE_AGENT
    system_instruction = state.get("system_instruction", "")
    tools = state.get("tools", [])
    logs = state.get("logs", [])
    iteration = state.get("iteration", 0) + 1
    user_id = state.get("user_id")

    logs.append(f"[Executor] Running HyDE retrieval pipeline for query: '{latest_input}'")

    context_parts = []

    # HyDE retrieval (replaces direct pgvector calls)
    retrieval_user_id = user_id or ""
    retrieval_result = retrieve(retrieval_user_id, latest_input)

    if retrieval_result.contexts:
        context_parts.append(
            "### Retrieved Medical Context (Grounded Source of Truth):\n" +
            "\n".join([
                f"- [doc:{c.record_id}] (relevance: {c.score}/10): {c.chunk_content}"
                for c in retrieval_result.contexts
            ])
        )
        logs.append(f"[Executor] HyDE retrieved {len(retrieval_result.contexts)} reranked contexts.")
        logs.append(f"[Executor] HyDE iterations produced {len(retrieval_result.hypothetical_answers)} hypothetical answers.")
    else:
        logs.append("[Executor] HyDE retrieval returned no relevant contexts.")

    # Prepend citation invariant to system instruction
    system_instruction = INVARIANT_SYSTEM_INSTRUCTION + "\n" + system_instruction

    if context_parts:
        context_str = "\n\n".join(context_parts)
        system_instruction += f"\n\n[Grounded Medical Context]\n{context_str}\n\nStrict ground rules: Base your answers primarily on the patient's retrieved records when available. Cite every medical claim with [doc:<record_id>], LOINC:<code>, or RxNorm:<rxcui>. Be helpful, clear, and translate complex terms into plain language. If the user asks general chronic disease questions, refer to the reference guidelines."
        
    logs.append(f"[Executor] Invoking Managed Agent '{target_agent_id}' (Iteration {iteration})...")
    
    api_tools = []
    for t in tools:
        api_tools.append({"type": t})

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
