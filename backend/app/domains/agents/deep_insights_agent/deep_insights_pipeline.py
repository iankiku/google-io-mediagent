from __future__ import annotations

import os
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

DEFAULT_ENV_FILE = Path(__file__).with_name(".env")
_BACKEND_ROOT = Path(__file__).resolve().parents[4]

DEFAULT_BASE_ROLE = (
    "You are a helpful medical assistant specializing in interpreting patient health records. "
    "Answer clearly in plain language, cite retrieved context, and never invent clinical facts."
)

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
""".strip()


@dataclass
class Settings:
    k_iterations: int
    top_k: int
    managed_agent_id: str
    synthesis_tools: list[str]


@dataclass
class PipelineResult:
    query: str
    user_id: str
    hypothetical_answers: list[str]
    contexts: list[Any]
    final_answer: str
    managed_agent_id: str
    logs: list[str] = field(default_factory=list)


def _ensure_backend_on_path() -> None:
    backend_root = str(_BACKEND_ROOT)
    if backend_root not in sys.path:
        sys.path.insert(0, backend_root)


def _import_backend_modules() -> tuple[Any, Any, Any, Any]:
    _ensure_backend_on_path()
    from app.core.config import DEFAULT_BASE_AGENT, client
    from app.domains.retrieval.schemas import RetrievalResult
    from app.domains.retrieval.services import retrieve

    return client, retrieve, RetrievalResult, DEFAULT_BASE_AGENT


# Strictly greetings, thanks, farewells, and identity small-talk.
# Anything else (including ambiguous health questions) must go through the
# full pipeline. We intentionally keep this conservative.
_FAST_PATH_PATTERNS = (
    # Greetings
    r"^(hi|hii+|hey+|hello+|yo|sup|howdy|namaste|salaam|hola|"
    r"good\s*(morning|afternoon|evening|night))\b[\s!,.?]*"
    r"(zoe|zoie)?[\s!,.?]*$",
    # Thanks / farewells
    r"^(thanks|thank\s*you|thx|ty|cheers|much\s*appreciated)[\s!.?]*$",
    r"^(bye|goodbye|see\s*ya|see\s*you|talk\s*later|cya)[\s!.?]*$",
    # Identity / capability small-talk
    r"^how\s*('?s|\s*is)?\s*(it\s*going|you\s*doing|are\s*you)[\s?.!]*$",
    r"^(who|what)\s*are\s*you[\s?.!]*$",
    r"^what\s*(can|do)\s*you\s*do[\s?.!]*$",
    r"^what'?s\s*up[\s?.!]*$",
    r"^are\s*you\s*there[\s?.!]*$",
)


def _is_general_query(query: str) -> bool:
    """Return True only for greetings / small-talk; anything medical or unclear goes through retrieval."""
    cleaned = query.strip().lower()
    if not cleaned:
        return False
    return any(re.fullmatch(pattern, cleaned) is not None for pattern in _FAST_PATH_PATTERNS)


def maybe_generate_general_response(query: str) -> tuple[str | None, list[str]]:
    """
    Fast path for greetings / small-talk to avoid retrieval+rerank cost.
    Returns (response, logs). response is None when the query should use Deep Insights.
    """
    if not _is_general_query(query):
        return None, []

    logs = ["[DeepInsights] Fast-path matched greeting/small-talk. Skipping retrieval pipeline."]
    client, _, _, _ = _import_backend_modules()
    from google.genai import types as _types

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=query.strip(),
            config=_types.GenerateContentConfig(
                system_instruction=(
                    "You are Zoe, a warm and friendly health companion. "
                    "The user has sent a greeting or general small-talk message. "
                    "Reply briefly in 1-2 sentences, warm and conversational. "
                    "Do NOT mention retrieval pipelines, agents, or internal system details. "
                    "If they greet you, greet them back and gently invite them to share "
                    "how they're feeling or ask about their records."
                ),
            ),
        )
        text = (response.text or "").strip()
        logs.append("[DeepInsights] Fast-path response generated successfully.")
        return text or "Hi! How can I help you today?", logs
    except Exception as exc:
        logs.append(f"[DeepInsights] Fast-path generation failed: {exc}")
        return "Hi! How can I help you today?", logs


def load_settings(env_file: str | Path | None = None) -> Settings:
    resolved = Path(env_file) if env_file else None
    if resolved is None and DEFAULT_ENV_FILE.exists():
        resolved = DEFAULT_ENV_FILE
    if resolved is not None and resolved.exists():
        load_dotenv(resolved, override=True)
    else:
        repo_env = _BACKEND_ROOT.parent / ".env"
        if repo_env.exists():
            load_dotenv(repo_env, override=False)

    k_iterations = int(os.getenv("DEEP_INSIGHTS_K_ITERATIONS", "2"))
    top_k = int(os.getenv("DEEP_INSIGHTS_TOP_K", "2"))
    managed_agent_id = os.getenv("DEEP_INSIGHTS_MANAGED_AGENT_ID", "").strip()

    _ensure_backend_on_path()
    from app.core.config import DEFAULT_BASE_AGENT

    return Settings(
        k_iterations=k_iterations,
        top_k=top_k,
        managed_agent_id=managed_agent_id or DEFAULT_BASE_AGENT,
        synthesis_tools=[],
    )


def build_grounded_system_instruction(
    retrieval_result: Any,
    base_system_instruction: str = DEFAULT_BASE_ROLE,
) -> str:
    system_instruction = f"{INVARIANT_SYSTEM_INSTRUCTION}\n{base_system_instruction.strip()}"

    if not retrieval_result.contexts:
        return system_instruction

    context_block = (
        "### Retrieved Medical Context (Grounded Source of Truth):\n"
        + "\n".join(
            [
                f"- [doc:{c.record_id}] (relevance: {c.score}/10): {c.chunk_content}"
                for c in retrieval_result.contexts
            ]
        )
    )
    return (
        f"{system_instruction}\n\n"
        f"[Grounded Medical Context]\n{context_block}\n\n"
        "Strict ground rules: Base your answers primarily on the patient's retrieved records when available. "
        "Cite every medical claim with [doc:<record_id>], LOINC:<code>, or RxNorm:<rxcui>. "
        "Be helpful, clear, and translate complex terms into plain language. "
        "If the user asks general chronic disease questions, refer to the reference guidelines."
    )


def synthesize_grounded_answer(
    query: str,
    system_instruction: str,
    *,
    managed_agent_id: str,
    tools: list[str] | None = None,
    custom_agents_md: str | None = None,
    custom_skills: list[dict] | None = None,
) -> tuple[str, list[str]]:
    client, _, _, _ = _import_backend_modules()
    logs: list[str] = []

    api_tools = [{"type": tool_name} for tool_name in (tools or [])]
    environment_config: Any = "remote"

    if custom_agents_md or custom_skills:
        sources = []
        if custom_agents_md:
            sources.append(
                {
                    "type": "inline",
                    "target": ".agents/AGENTS.md",
                    "content": custom_agents_md,
                }
            )
            logs.append(
                f"[DeepInsights] Overlaying custom inline AGENTS.md "
                f"(length: {len(custom_agents_md)} chars)"
            )
        for skill in custom_skills or []:
            skill_name = skill.get("name")
            skill_content = skill.get("content")
            if skill_name and skill_content:
                sources.append(
                    {
                        "type": "inline",
                        "target": f".agents/skills/{skill_name}/SKILL.md",
                        "content": skill_content,
                    }
                )
                logs.append(
                    f"[DeepInsights] Overlaying custom inline skill '{skill_name}' "
                    f"(length: {len(skill_content)} chars)"
                )
        environment_config = {"type": "remote", "sources": sources}

    logs.append(f"[DeepInsights] Invoking Managed Agent '{managed_agent_id}'...")

    try:
        interaction = client.interactions.create(
            agent=managed_agent_id,
            input=query,
            system_instruction=system_instruction,
            tools=api_tools,
            environment=environment_config,
        )
        logs.append("[DeepInsights] Interaction succeeded.")
        return interaction.output_text, logs
    except Exception as exc:
        logs.append(f"[DeepInsights] Interaction failed: {exc}")
        return f"Error executing managed agent interaction: {exc}", logs


def run_retrieval(
    query: str,
    user_id: str | None,
    *,
    k_iterations: int | None = None,
    top_k: int | None = None,
    env_file: str | Path | None = None,
) -> Any:
    settings = load_settings(env_file)
    resolved_k = k_iterations if k_iterations is not None else settings.k_iterations
    resolved_top_k = top_k if top_k is not None else settings.top_k
    _, retrieve, _, _ = _import_backend_modules()
    return retrieve(user_id or "", query, k_iterations=resolved_k, top_k=resolved_top_k)


def run_pipeline(
    query: str,
    *,
    user_id: str | None = None,
    env_file: str | Path | None = None,
    base_system_instruction: str = DEFAULT_BASE_ROLE,
    managed_agent_id: str | None = None,
    tools: list[str] | None = None,
    custom_agents_md: str | None = None,
    custom_skills: list[dict] | None = None,
    k_iterations: int | None = None,
    top_k: int | None = None,
) -> PipelineResult:
    cleaned_query = query.strip()
    if not cleaned_query:
        raise ValueError("Query must not be empty.")

    settings = load_settings(env_file)
    resolved_k = k_iterations if k_iterations is not None else settings.k_iterations
    resolved_top_k = top_k if top_k is not None else settings.top_k
    resolved_agent = managed_agent_id or settings.managed_agent_id
    resolved_tools = tools if tools is not None else settings.synthesis_tools

    logs: list[str] = [
        f"[DeepInsights] Running HyDE retrieval for query: '{cleaned_query}'",
        f"[DeepInsights] user_id={user_id or '(none)'} k_iterations={resolved_k} top_k={resolved_top_k}",
    ]

    fast_response, fast_logs = maybe_generate_general_response(cleaned_query)
    if fast_response is not None:
        logs.extend(fast_logs)
        return PipelineResult(
            query=cleaned_query,
            user_id=user_id or "",
            hypothetical_answers=[],
            contexts=[],
            final_answer=fast_response,
            managed_agent_id=resolved_agent,
            logs=logs,
        )

    retrieval_result = run_retrieval(
        cleaned_query,
        user_id,
        k_iterations=resolved_k,
        top_k=resolved_top_k,
    )

    if retrieval_result.contexts:
        logs.append(
            f"[DeepInsights] HyDE retrieved {len(retrieval_result.contexts)} reranked contexts."
        )
        logs.append(
            "[DeepInsights] HyDE iterations produced "
            f"{len(retrieval_result.hypothetical_answers)} hypothetical answers."
        )
    else:
        logs.append("[DeepInsights] HyDE retrieval returned no relevant contexts.")

    system_instruction = build_grounded_system_instruction(
        retrieval_result,
        base_system_instruction=base_system_instruction,
    )

    final_answer, synthesis_logs = synthesize_grounded_answer(
        cleaned_query,
        system_instruction,
        managed_agent_id=resolved_agent,
        tools=resolved_tools,
        custom_agents_md=custom_agents_md,
        custom_skills=custom_skills,
    )
    logs.extend(synthesis_logs)

    return PipelineResult(
        query=cleaned_query,
        user_id=user_id or "",
        hypothetical_answers=list(retrieval_result.hypothetical_answers),
        contexts=list(retrieval_result.contexts),
        final_answer=final_answer,
        managed_agent_id=resolved_agent,
        logs=logs,
    )


def format_result(result: PipelineResult) -> str:
    lines: list[str] = []

    lines.append("=== HyDE Retrieval ===")
    if result.hypothetical_answers:
        for index, hypothetical in enumerate(result.hypothetical_answers, start=1):
            lines.append(f"Iteration {index} hypothetical:")
            lines.append(hypothetical)
            lines.append("")
    else:
        lines.append("No hypothetical answers were generated.")
        lines.append("")

    lines.append("=== Top Grounded Context ===")
    if result.contexts:
        for context in result.contexts:
            lines.append(
                f"- [doc:{context.record_id}] (relevance: {context.score}/10): "
                f"{context.chunk_content}"
            )
            if getattr(context, "reason", ""):
                lines.append(f"  rerank reason: {context.reason}")
    else:
        lines.append("No contexts were retrieved from pgvector.")

    lines.append("")
    lines.append("=== Final Answer ===")
    lines.append(result.final_answer)

    lines.append("")
    lines.append("=== Pipeline Logs ===")
    for log_line in result.logs:
        lines.append(log_line)

    return "\n".join(lines)


def run_pipeline_to_text(
    query: str,
    *,
    user_id: str | None = None,
    env_file: str | Path | None = None,
    base_system_instruction: str = DEFAULT_BASE_ROLE,
    managed_agent_id: str | None = None,
    tools: list[str] | None = None,
    custom_agents_md: str | None = None,
    custom_skills: list[dict] | None = None,
    k_iterations: int | None = None,
    top_k: int | None = None,
) -> str:
    return format_result(
        run_pipeline(
            query,
            user_id=user_id,
            env_file=env_file,
            base_system_instruction=base_system_instruction,
            managed_agent_id=managed_agent_id,
            tools=tools,
            custom_agents_md=custom_agents_md,
            custom_skills=custom_skills,
            k_iterations=k_iterations,
            top_k=top_k,
        )
    )


def main() -> None:
    query = input("Enter your medical query: ").strip()
    user_id = input("User UUID (optional, press Enter to skip): ").strip() or None
    if not query:
        raise SystemExit("No query provided.")
    print(
        run_pipeline_to_text(
            query,
            user_id=user_id,
            env_file=DEFAULT_ENV_FILE if DEFAULT_ENV_FILE.exists() else None,
        )
    )


if __name__ == "__main__":
    main()
