"""
Orchestrator agent.

Coordinates the four specialist Managed Agents (deep_insights, reports, scans,
research) to produce a single patient-friendly understanding guide from the
records a user has already uploaded.

Architecture
------------
Per the user requirement ("for the orchestrator try to use Gemini 3.5 Flash")
and the May 19, 2026 Managed Agents launch blog post — Antigravity itself is
*built on Gemini 3.5 Flash*. So we deliberately use the Antigravity managed
agent (`antigravity-preview-05-2026`) as the orchestrator's final synthesis
brain, with a dedicated Orchestrator AGENTS.md persona mounted inline.

The orchestration logic itself (which sub-agents to call, what sub-queries to
issue, how to merge their outputs) runs in plain Python here on the backend.
That is the same pattern the Deep Insights pipeline uses for HyDE: deterministic
Python upstream, Managed Agents API for the final patient-facing synthesis.

End-to-end flow
---------------
1. Inspect the user's `user_medical_records` to figure out which kinds of
   documents they have (lab PDFs vs. scans vs. mixed).
2. Plan a small set of sub-queries (always called "facets") for each
   specialist agent that's relevant given the upload mix.
3. Call each specialist agent. Every call is recorded in
   `agent_trace[]` with: agent_name, why, sub_query, output_excerpt.
4. Build a big merged evidence block.
5. Call the Orchestrator Managed Agent with that evidence block as the input
   and the Orchestrator persona mounted at `.agents/AGENTS.md`. This is the
   step that emits the final markdown "understanding guide".
6. Return `(report_markdown, agent_trace[], logs[])`.
"""

from __future__ import annotations

import os
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Iterator

from dotenv import load_dotenv

DEFAULT_ENV_FILE = Path(__file__).with_name(".env")
_BACKEND_ROOT = Path(__file__).resolve().parents[4]


# ---------------------------------------------------------------------------
# Tunables (env-overridable)
# ---------------------------------------------------------------------------

DEFAULT_REPORTS_FACETS = (
    "Summarize the most recent lab values and flag anything outside the "
    "reference range, citing each value with [doc:<record_id>].",
    "Explain any doctor or physician note text in plain English, citing each "
    "claim with [doc:<record_id>].",
)
DEFAULT_SCANS_FACETS = (
    "Summarize the latest scan/imaging impression in plain English, citing "
    "[doc:<record_id>] for every claim.",
)
DEFAULT_DEEP_INSIGHTS_FACETS = (
    "What are the top 3 things I, as the patient, should understand about my "
    "current uploaded records?",
)
DEFAULT_RESEARCH_FACETS = (
    "Provide general medical background on the conditions and lab markers "
    "mentioned in the patient's records (e.g. LDL, HbA1c, hypertension). "
    "Cite RxNorm/MedlinePlus/DailyMed where applicable.",
)


@dataclass
class AgentTraceEntry:
    """Single specialist invocation, surfaced as-is in the UI trace panel."""

    agent: str
    why: str
    sub_query: str
    success: bool
    output_excerpt: str
    output_full: str
    logs: list[str] = field(default_factory=list)


@dataclass
class OrchestratorResult:
    user_id: str
    goal: str
    upload_mix: dict[str, int]
    agent_trace: list[AgentTraceEntry]
    final_report_markdown: str
    logs: list[str] = field(default_factory=list)
    managed_agent_id: str = "antigravity-preview-05-2026"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _ensure_backend_on_path() -> None:
    backend_root = str(_BACKEND_ROOT)
    if backend_root not in sys.path:
        sys.path.insert(0, backend_root)


def _load_env(env_file: str | Path | None = None) -> None:
    resolved = Path(env_file) if env_file else None
    if resolved is None and DEFAULT_ENV_FILE.exists():
        resolved = DEFAULT_ENV_FILE
    if resolved is not None and resolved.exists():
        load_dotenv(resolved, override=True)
        return
    repo_env = _BACKEND_ROOT.parent / ".env"
    if repo_env.exists():
        load_dotenv(repo_env, override=False)


def _excerpt(text: str, limit: int = 600) -> str:
    cleaned = (text or "").strip()
    if len(cleaned) <= limit:
        return cleaned
    return cleaned[: limit - 1].rstrip() + "…"


def _classify_uploads(user_id: str) -> tuple[dict[str, int], list[dict[str, Any]]]:
    """
    Returns (mix_counts, raw_records). `mix_counts` has keys:
    `pdfs`, `images`, `notes`, `other`, `total`.
    """
    _ensure_backend_on_path()
    from app.core.db import get_db_connection

    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT id::text AS id, file_name, file_type
            FROM user_medical_records
            WHERE user_id = %s::uuid
            ORDER BY created_at DESC;
            """,
            (user_id,),
        )
        rows = cur.fetchall()
    finally:
        cur.close()
        conn.close()

    mix = {"pdfs": 0, "images": 0, "notes": 0, "other": 0, "total": 0}
    raw_records: list[dict[str, Any]] = []
    for row in rows:
        ftype = (row.get("file_type") or "").lower()
        fname = (row.get("file_name") or "").lower()
        raw_records.append(
            {"id": row.get("id"), "file_name": row.get("file_name"), "file_type": row.get("file_type")}
        )
        mix["total"] += 1
        if "pdf" in ftype or fname.endswith(".pdf"):
            mix["pdfs"] += 1
        elif ftype.startswith("image/") or any(
            fname.endswith(ext) for ext in (".png", ".jpg", ".jpeg")
        ):
            mix["images"] += 1
        elif "note" in ftype or "txt" in ftype or fname.endswith(".txt"):
            mix["notes"] += 1
        else:
            mix["other"] += 1
    return mix, raw_records


# ---------------------------------------------------------------------------
# Specialist invocations
# ---------------------------------------------------------------------------

def _call_deep_insights(user_id: str, sub_query: str, why: str) -> AgentTraceEntry:
    _ensure_backend_on_path()
    from app.domains.agents.deep_insights_agent.deep_insights_pipeline import run_pipeline

    try:
        result = run_pipeline(sub_query, user_id=user_id)
        text = result.final_answer or ""
        return AgentTraceEntry(
            agent="deep_insights",
            why=why,
            sub_query=sub_query,
            success=True,
            output_excerpt=_excerpt(text),
            output_full=text,
            logs=list(result.logs),
        )
    except Exception as exc:  # pragma: no cover - DB / network errors
        return AgentTraceEntry(
            agent="deep_insights",
            why=why,
            sub_query=sub_query,
            success=False,
            output_excerpt=f"Error: {exc}",
            output_full="",
            logs=[f"[Orchestrator] deep_insights failed: {exc}"],
        )


def _call_reports(user_id: str, sub_query: str, why: str) -> AgentTraceEntry:
    _ensure_backend_on_path()
    from app.domains.agents.reports_agent.reports_pipeline import run_pipeline

    try:
        result = run_pipeline(sub_query, user_id=user_id)
        text = result.final_answer or ""
        return AgentTraceEntry(
            agent="reports",
            why=why,
            sub_query=sub_query,
            success=True,
            output_excerpt=_excerpt(text),
            output_full=text,
            logs=list(result.logs),
        )
    except Exception as exc:  # pragma: no cover
        return AgentTraceEntry(
            agent="reports",
            why=why,
            sub_query=sub_query,
            success=False,
            output_excerpt=f"Error: {exc}",
            output_full="",
            logs=[f"[Orchestrator] reports failed: {exc}"],
        )


def _call_scans(user_id: str, sub_query: str, why: str) -> AgentTraceEntry:
    _ensure_backend_on_path()
    from app.domains.agents.scans_agent.scans_pipeline import run_pipeline

    try:
        result = run_pipeline(sub_query, user_id=user_id)
        text = result.final_answer or ""
        return AgentTraceEntry(
            agent="scans",
            why=why,
            sub_query=sub_query,
            success=True,
            output_excerpt=_excerpt(text),
            output_full=text,
            logs=list(result.logs),
        )
    except Exception as exc:  # pragma: no cover
        return AgentTraceEntry(
            agent="scans",
            why=why,
            sub_query=sub_query,
            success=False,
            output_excerpt=f"Error: {exc}",
            output_full="",
            logs=[f"[Orchestrator] scans failed: {exc}"],
        )


def _call_research(sub_query: str, why: str) -> AgentTraceEntry:
    _ensure_backend_on_path()
    from app.domains.agents.research_agent.medical_rag import run_pipeline_full

    try:
        result, logs = run_pipeline_full(sub_query)
        text = result.final_answer or ""
        return AgentTraceEntry(
            agent="research",
            why=why,
            sub_query=sub_query,
            success=True,
            output_excerpt=_excerpt(text),
            output_full=text,
            logs=list(logs),
        )
    except Exception as exc:  # pragma: no cover
        return AgentTraceEntry(
            agent="research",
            why=why,
            sub_query=sub_query,
            success=False,
            output_excerpt=f"Error: {exc}",
            output_full="",
            logs=[f"[Orchestrator] research failed: {exc}"],
        )


# ---------------------------------------------------------------------------
# Planning + synthesis
# ---------------------------------------------------------------------------

def _plan_calls(
    upload_mix: dict[str, int],
    goal: str,
) -> list[tuple[str, str, str]]:
    """
    Returns a list of (agent_name, why, sub_query) tuples describing which
    specialist agents to call and why. Deterministic — no Gemini call needed.
    """
    plan: list[tuple[str, str, str]] = []

    if upload_mix.get("total", 0) > 0:
        plan.append((
            "deep_insights",
            "Personalized HyDE+rerank pass over the patient's own records to "
            "surface the most relevant facts for the report.",
            DEFAULT_DEEP_INSIGHTS_FACETS[0],
        ))

    if upload_mix.get("pdfs", 0) > 0 or upload_mix.get("notes", 0) > 0:
        for facet in DEFAULT_REPORTS_FACETS:
            plan.append((
                "reports",
                "User uploaded lab PDFs or doctor/physician notes — the "
                "Reports specialist explains them in plain English with "
                "[doc:] citations.",
                facet,
            ))

    if upload_mix.get("images", 0) > 0:
        for facet in DEFAULT_SCANS_FACETS:
            plan.append((
                "scans",
                "User uploaded scan/imaging files — the Scans specialist "
                "summarizes the extracted impression with [doc:] citations.",
                facet,
            ))

    plan.append((
        "research",
        "Pull in general medical background (RxNorm / MedlinePlus / DailyMed "
        "/ openFDA / MeSH) so the final report can frame the patient's data "
        "with citable definitions.",
        DEFAULT_RESEARCH_FACETS[0],
    ))

    if goal.strip():
        plan.append((
            "deep_insights",
            "Goal-conditioned pass over the patient's records using the "
            "user's own framing of what the report should answer.",
            goal.strip(),
        ))

    return plan


def _build_orchestrator_input(
    *,
    goal: str,
    upload_mix: dict[str, int],
    trace: list[AgentTraceEntry],
) -> str:
    sections: list[str] = []
    sections.append("# Patient Goal")
    sections.append(goal or "Generate a one-page understanding guide for my uploaded records.")
    sections.append("")
    sections.append("# Upload Mix")
    sections.append(
        f"- PDFs: {upload_mix.get('pdfs', 0)}\n"
        f"- Images / scans: {upload_mix.get('images', 0)}\n"
        f"- Notes (txt): {upload_mix.get('notes', 0)}\n"
        f"- Other: {upload_mix.get('other', 0)}\n"
        f"- Total: {upload_mix.get('total', 0)}"
    )
    sections.append("")
    sections.append("# Specialist Agent Outputs")
    for idx, entry in enumerate(trace, start=1):
        status = "ok" if entry.success else "error"
        sections.append(
            f"\n## [{idx}] {entry.agent} ({status})\n"
            f"_Why this agent was called:_ {entry.why}\n\n"
            f"_Sub-query sent to the agent:_ {entry.sub_query}\n\n"
            f"_Agent output:_\n\n{entry.output_full or entry.output_excerpt}"
        )
    sections.append("")
    sections.append(
        "Now produce the patient-facing understanding guide as specified in "
        "your AGENTS.md (mounted at `.agents/AGENTS.md`). Use Markdown so the "
        "frontend can render it directly."
    )
    return "\n".join(sections)


# ---------------------------------------------------------------------------
# Public entrypoints — generator + sync wrapper
# ---------------------------------------------------------------------------

def run_orchestrator_events(
    *,
    user_id: str,
    goal: str = "",
    env_file: str | Path | None = None,
    managed_agent_id: str | None = None,
) -> Iterator[tuple[str, dict[str, Any]]]:
    """
    Generator form of the orchestrator. Yields `(event_type, payload)` tuples
    as each phase makes progress, so an HTTP handler can stream them as
    Server-Sent Events to the frontend for live "which-agent-now-with-what-
    query" progress.

    Event sequence
    --------------
    1. ``plan``               — initial planned call list + upload mix.
    2. For each specialist:
        a. ``agent_start``    — sub-agent invocation is about to begin.
        b. ``agent_complete`` — sub-agent finished (success or error).
    3. ``synthesis_start``    — final Antigravity synthesis is dispatched.
    4. ``synthesis_complete`` — final synthesis returned.
    5. ``done``               — full structured result (same payload as the
                                non-streaming ``/generate-report`` endpoint).

    All events also include ``"type": <event_type>`` when serialized as SSE.
    """
    if not user_id or not user_id.strip():
        raise ValueError("user_id is required for the orchestrator agent.")

    _load_env(env_file)
    _ensure_backend_on_path()
    from app.domains.agents.managed_agents import (
        DEFAULT_MANAGED_AGENT,
        synthesize_via_managed_agent,
    )

    resolved_agent_id = (
        managed_agent_id
        or os.getenv("ORCHESTRATOR_MANAGED_AGENT_ID")
        or DEFAULT_MANAGED_AGENT
    )

    logs: list[str] = [
        f"[Orchestrator] Starting end-to-end run for user_id={user_id}.",
        f"[Orchestrator] Managed Agent: '{resolved_agent_id}' (Antigravity / Gemini 3.5 Flash).",
    ]

    upload_mix, _records = _classify_uploads(user_id)
    logs.append(
        f"[Orchestrator] Upload mix: {upload_mix['total']} record(s) — "
        f"{upload_mix['pdfs']} PDFs, {upload_mix['images']} images, "
        f"{upload_mix['notes']} notes, {upload_mix['other']} other."
    )

    plan = _plan_calls(upload_mix, goal)
    logs.append(
        "[Orchestrator] Planned "
        f"{len(plan)} specialist call(s): "
        + ", ".join(f"{agent}" for agent, _, _ in plan)
        + "."
    )

    planned_payload = [
        {"index": idx, "agent": agent, "why": why, "sub_query": sub_query}
        for idx, (agent, why, sub_query) in enumerate(plan)
    ]
    yield (
        "plan",
        {
            "user_id": user_id,
            "goal": goal,
            "upload_mix": upload_mix,
            "managed_agent_id": resolved_agent_id,
            "planned_calls": planned_payload,
        },
    )

    trace: list[AgentTraceEntry] = []
    for idx, (agent_name, why, sub_query) in enumerate(plan):
        logs.append(
            f"[Orchestrator] → Calling '{agent_name}' because: {why}"
        )
        logs.append(f"[Orchestrator]   sub-query: {sub_query}")

        yield (
            "agent_start",
            {
                "index": idx,
                "agent": agent_name,
                "why": why,
                "sub_query": sub_query,
            },
        )

        if agent_name == "deep_insights":
            entry = _call_deep_insights(user_id, sub_query, why)
        elif agent_name == "reports":
            entry = _call_reports(user_id, sub_query, why)
        elif agent_name == "scans":
            entry = _call_scans(user_id, sub_query, why)
        elif agent_name == "research":
            entry = _call_research(sub_query, why)
        else:  # pragma: no cover - guard for future expansion
            continue

        trace.append(entry)
        logs.append(
            f"[Orchestrator]   {agent_name} returned "
            f"{'ok' if entry.success else 'error'} ({len(entry.output_full)} chars)."
        )

        yield (
            "agent_complete",
            {
                "index": idx,
                **asdict(entry),
            },
        )

    orchestrator_input = _build_orchestrator_input(
        goal=goal,
        upload_mix=upload_mix,
        trace=trace,
    )

    logs.append(
        "[Orchestrator] Invoking the Orchestrator Managed Agent for final "
        "synthesis with mounted .agents/AGENTS.md (Orchestrator persona)."
    )
    yield (
        "synthesis_start",
        {"managed_agent_id": resolved_agent_id},
    )

    synth = synthesize_via_managed_agent(
        input_text=orchestrator_input,
        system_instruction=(
            "You are the Orchestrator. Follow the rules in your mounted "
            ".agents/AGENTS.md. Produce a patient-facing Markdown "
            "understanding guide using only the specialist outputs in the "
            "input. Preserve [doc:<record_id>] and source citations."
        ),
        persona_key="orchestrator",
        managed_agent_id=resolved_agent_id,
        log_prefix="[Orchestrator]",
    )
    logs.extend(synth.logs)

    yield (
        "synthesis_complete",
        {
            "report_markdown": synth.output_text,
            "managed_agent_id": resolved_agent_id,
        },
    )

    final_payload: dict[str, Any] = {
        "user_id": user_id,
        "goal": goal,
        "upload_mix": upload_mix,
        "agent_trace": [asdict(t) for t in trace],
        "final_report_markdown": synth.output_text,
        "logs": logs,
        "managed_agent_id": resolved_agent_id,
    }
    yield ("done", final_payload)


def run_orchestrator(
    *,
    user_id: str,
    goal: str = "",
    env_file: str | Path | None = None,
    managed_agent_id: str | None = None,
) -> OrchestratorResult:
    """
    Synchronous wrapper around the streaming generator. Used by the
    non-streaming ``/generate-report`` endpoint and by the CLI.

    Behaves identically to the previous implementation: runs every specialist
    serially, then the final synthesis, and returns the aggregated
    OrchestratorResult once the whole pipeline finishes.
    """
    final_state: dict[str, Any] | None = None
    trace_entries: list[AgentTraceEntry] = []

    for event_type, payload in run_orchestrator_events(
        user_id=user_id,
        goal=goal,
        env_file=env_file,
        managed_agent_id=managed_agent_id,
    ):
        if event_type == "agent_complete":
            trace_entries.append(
                AgentTraceEntry(
                    agent=payload["agent"],
                    why=payload["why"],
                    sub_query=payload["sub_query"],
                    success=payload["success"],
                    output_excerpt=payload["output_excerpt"],
                    output_full=payload["output_full"],
                    logs=list(payload.get("logs", [])),
                )
            )
        elif event_type == "done":
            final_state = payload

    if final_state is None:  # pragma: no cover - generator always yields done
        raise RuntimeError(
            "Orchestrator generator finished without emitting a 'done' event."
        )

    return OrchestratorResult(
        user_id=final_state["user_id"],
        goal=final_state["goal"],
        upload_mix=final_state["upload_mix"],
        agent_trace=trace_entries,
        final_report_markdown=final_state["final_report_markdown"],
        logs=list(final_state["logs"]),
        managed_agent_id=final_state["managed_agent_id"],
    )


def trace_as_dicts(result: OrchestratorResult) -> list[dict[str, Any]]:
    return [asdict(entry) for entry in result.agent_trace]
