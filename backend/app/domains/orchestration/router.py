"""
Orchestration HTTP surface.

This module exposes two related endpoints:

- POST `/api/chat`
    Backwards-compatible chat endpoint. When `agent_id` is one of the four
    *logical* pipeline ids (deep_insights / reports / scans / research) the
    request is dispatched to the corresponding specialist agent. When
    `agent_id` is missing or refers to a registered Managed Agent, the
    request runs through the LangGraph deep-insights graph as before.

- POST `/api/chat/generate-report`
    Triggers the new Orchestrator agent (a Managed Agent wrapper built on
    `antigravity-preview-05-2026`, which is itself Gemini 3.5 Flash per the
    May 19, 2026 launch blog post). The orchestrator calls multiple
    specialist agents under the hood and synthesizes the final understanding
    guide via the Managed Agents API.

All endpoints return a `logs` array. The frontend renders it as the
"which-agent-was-called-and-why" trace panel.
"""

import json
import logging
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Any, List, Optional
from app.core.config import DEFAULT_BASE_AGENT
from app.domains.orchestration.graph import graph

logger = logging.getLogger("health_assistant.orchestration.router")

router = APIRouter(prefix="/api/chat", tags=["Orchestration"])


# Logical pipeline identifiers the frontend / external callers may send.
# Each maps to a specialist agent module. The /api/chat handler dispatches on
# these so we don't have to fork the URL space per agent — the frontend just
# picks an `agent_id` based on which button the user clicked.
LOGICAL_DEEP_INSIGHTS = {"deep-insights-agent", "deep_insights_agent", "deep-insights", "deep_insights"}
LOGICAL_REPORTS = {"reports-agent", "reports_agent", "reports"}
LOGICAL_SCANS = {"scans-agent", "scans_agent", "scans"}
LOGICAL_RESEARCH = {"research-agent", "research_agent", "research"}
LOGICAL_ORCHESTRATOR = {"orchestrator-agent", "orchestrator_agent", "orchestrator"}

ALL_LOGICAL_IDS = (
    LOGICAL_DEEP_INSIGHTS
    | LOGICAL_REPORTS
    | LOGICAL_SCANS
    | LOGICAL_RESEARCH
    | LOGICAL_ORCHESTRATOR
)


def _normalize_logical_id(agent_id: Optional[str]) -> Optional[str]:
    if not agent_id:
        return None
    key = agent_id.strip().lower()
    if key in LOGICAL_DEEP_INSIGHTS:
        return "deep_insights"
    if key in LOGICAL_REPORTS:
        return "reports"
    if key in LOGICAL_SCANS:
        return "scans"
    if key in LOGICAL_RESEARCH:
        return "research"
    if key in LOGICAL_ORCHESTRATOR:
        return "orchestrator"
    return None


def resolve_managed_agent_id(requested_agent_id: Optional[str]) -> str:
    """Map logical pipeline names to the real Managed Agent backing synthesis."""
    if not requested_agent_id:
        return DEFAULT_BASE_AGENT
    if requested_agent_id.strip().lower() in ALL_LOGICAL_IDS:
        return DEFAULT_BASE_AGENT
    return requested_agent_id


class SkillConfig(BaseModel):
    name: str = Field(..., description="Name of the custom skill")
    content: str = Field(..., description="Content of the SKILL.md file")


class ChatRequest(BaseModel):
    message: str = Field(..., description="User query or instruction")
    agent_id: Optional[str] = Field(
        None,
        description=(
            "Logical pipeline id (deep_insights / reports / scans / research / "
            "orchestrator) OR a registered Managed Agent id. When omitted the "
            "deep-insights graph runs (legacy behavior)."
        ),
    )
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
    agent_route: str = Field(
        "deep_insights",
        description="Which logical pipeline actually handled the request.",
    )


def _run_specialist(
    pipeline: str,
    message: str,
    user_id: Optional[str],
) -> ChatResponse:
    """
    Dispatch to one of the four non-deep-insights specialist agents and
    package its output into a ChatResponse so the frontend sees a uniform
    shape regardless of which agent ran.
    """
    if pipeline in ("reports", "scans") and not user_id:
        raise HTTPException(
            status_code=400,
            detail=f"user_id is required for the '{pipeline}' agent.",
        )

    try:
        if pipeline == "reports":
            from app.domains.agents.reports_agent.reports_pipeline import (
                run_pipeline as run_reports_pipeline,
            )

            result = run_reports_pipeline(message, user_id=user_id or "")
            return ChatResponse(
                response=result.final_answer,
                logs=list(result.logs),
                tools_used=[],
                system_instruction="(Reports persona mounted at .agents/AGENTS.md)",
                validation_status="not_applicable",
                agent_route="reports",
            )
        if pipeline == "scans":
            from app.domains.agents.scans_agent.scans_pipeline import (
                run_pipeline as run_scans_pipeline,
            )

            result = run_scans_pipeline(message, user_id=user_id or "")
            return ChatResponse(
                response=result.final_answer,
                logs=list(result.logs),
                tools_used=[],
                system_instruction="(Scans persona mounted at .agents/AGENTS.md)",
                validation_status="not_applicable",
                agent_route="scans",
            )
        if pipeline == "research":
            from app.domains.agents.research_agent.medical_rag import (
                run_pipeline_full as run_research_pipeline_full,
            )

            result, research_logs = run_research_pipeline_full(message)
            logs: List[str] = [
                "[ResearchAgent] Routing query across public medical APIs "
                "(RxNorm / MedlinePlus / DailyMed / openFDA / MeSH).",
            ]
            for sel in result.routing_decision.selected_sources:
                logs.append(
                    f"[ResearchAgent] Selected source '{sel.source}': "
                    f"{sel.rationale}"
                )
            for source_result in result.source_results:
                logs.append(
                    f"[ResearchAgent] {source_result.source}: "
                    f"{source_result.status} ({len(source_result.hits)} hits) "
                    f"via {source_result.strategy}"
                )
            logs.extend(research_logs)
            return ChatResponse(
                response=result.final_answer,
                logs=logs,
                tools_used=[],
                system_instruction="(Research persona mounted at .agents/AGENTS.md)",
                validation_status="not_applicable",
                agent_route="research",
            )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Specialist agent '{pipeline}' failed: {exc}",
        )

    raise HTTPException(status_code=400, detail=f"Unknown pipeline '{pipeline}'.")


@router.post("", response_model=ChatResponse)
async def chat(request: ChatRequest):
    pipeline = _normalize_logical_id(request.agent_id)

    # Specialist agents (reports / scans / research) get their own dispatch
    # path because they have their own retrieval pipelines. Deep insights and
    # orchestrator both fall through to dedicated handlers below.
    if pipeline in {"reports", "scans", "research"}:
        return _run_specialist(pipeline, request.message, request.user_id)

    if pipeline == "orchestrator":
        # The dedicated /generate-report endpoint is the recommended way to
        # call the orchestrator, but we also accept it through /api/chat for
        # consistency. The output shape is squashed into ChatResponse so the
        # frontend chat surface can still display it.
        return await _run_orchestrator_chat(request)

    # Legacy / Deep Insights path — runs the full LangGraph (router → executor
    # → optional validator).
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
            "user_id": request.user_id,
        }

        result = graph.invoke(initial_state)

        return ChatResponse(
            response=result.get("agent_response", ""),
            logs=result.get("logs", []),
            tools_used=result.get("tools", []),
            system_instruction=result.get("system_instruction", ""),
            validation_status=result.get("validation_status", "pending"),
            agent_route="deep_insights",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Graph execution failed: {str(e)}")


# ---------------------------------------------------------------------------
# Orchestrator endpoint
# ---------------------------------------------------------------------------

class GenerateReportRequest(BaseModel):
    user_id: str = Field(..., description="User UUID whose records should be summarized.")
    goal: Optional[str] = Field(
        "",
        description=(
            "Optional natural-language framing of what the report should "
            "answer. When empty, the orchestrator uses its default goal."
        ),
    )
    managed_agent_id: Optional[str] = Field(
        None,
        description=(
            "Override the Managed Agent used for the final synthesis. "
            "Defaults to Antigravity (Gemini 3.5 Flash)."
        ),
    )


class AgentTracePayload(BaseModel):
    agent: str
    why: str
    sub_query: str
    success: bool
    output_excerpt: str
    output_full: str
    logs: List[str] = Field(default_factory=list)


class GenerateReportResponse(BaseModel):
    report_markdown: str
    agent_trace: List[AgentTracePayload]
    upload_mix: dict
    logs: List[str]
    managed_agent_id: str


async def _run_orchestrator_chat(request: ChatRequest) -> ChatResponse:
    """Adapter so the orchestrator can also be invoked via /api/chat."""
    if not request.user_id:
        raise HTTPException(
            status_code=400,
            detail="user_id is required for the orchestrator agent.",
        )

    from app.domains.agents.orchestrator_agent.agent import (
        run_orchestrator_agent,
    )

    try:
        result = run_orchestrator_agent(
            user_id=request.user_id,
            goal=request.message,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Orchestrator failed: {exc}",
        )

    logs = list(result.logs)
    for entry in result.agent_trace:
        # Surface sub-agent logs into the parent log stream so the trace panel
        # can render them inline with the orchestrator's own logs.
        for line in entry.logs:
            logs.append(line)

    return ChatResponse(
        response=result.final_report_markdown,
        logs=logs,
        tools_used=[],
        system_instruction="(Orchestrator persona mounted at .agents/AGENTS.md)",
        validation_status="not_applicable",
        agent_route="orchestrator",
    )


@router.post("/generate-report/stream")
def generate_report_stream(request: GenerateReportRequest) -> StreamingResponse:
    """
    Streams the orchestrator's progress as Server-Sent Events so the UI can
    show "which specialist is being called right now and with what sub-query"
    in real time instead of one generic "Orchestrator running…" line.

    Each event is delivered as a single SSE block:

        data: {"type": <event_type>, ...}\n\n

    See ``run_orchestrator_events`` for the event sequence
    (plan → agent_start → agent_complete → … → synthesis_start →
    synthesis_complete → done).
    """
    from app.domains.agents.orchestrator_agent.agent import (
        run_orchestrator_events,
    )

    def _sse_iter():
        try:
            for event_type, payload in run_orchestrator_events(
                user_id=request.user_id,
                goal=request.goal or "",
                managed_agent_id=request.managed_agent_id,
            ):
                envelope = {"type": event_type, **payload}
                yield f"data: {json.dumps(envelope, default=str)}\n\n"
        except ValueError as exc:
            yield (
                "data: "
                + json.dumps({"type": "error", "detail": str(exc)})
                + "\n\n"
            )
        except Exception as exc:  # pragma: no cover - defensive guard
            logger.exception("Orchestrator stream failed")
            yield (
                "data: "
                + json.dumps(
                    {
                        "type": "error",
                        "detail": f"Orchestrator failed: {exc}",
                    }
                )
                + "\n\n"
            )

    return StreamingResponse(
        _sse_iter(),
        media_type="text/event-stream",
        headers={
            # SSE clients (and most reverse proxies) expect these headers so
            # the response is not buffered.
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/generate-report", response_model=GenerateReportResponse)
async def generate_report(request: GenerateReportRequest) -> GenerateReportResponse:
    """
    Run the orchestrator agent end-to-end and return the structured result
    including the per-sub-agent trace.
    """
    from app.domains.agents.orchestrator_agent.agent import (
        run_orchestrator_agent,
        trace_as_dicts,
    )

    try:
        result = run_orchestrator_agent(
            user_id=request.user_id,
            goal=request.goal or "",
            managed_agent_id=request.managed_agent_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Orchestrator failed: {exc}")

    trace_payload: List[AgentTracePayload] = [
        AgentTracePayload(**entry) for entry in trace_as_dicts(result)
    ]

    return GenerateReportResponse(
        report_markdown=result.final_report_markdown,
        agent_trace=trace_payload,
        upload_mix=result.upload_mix,
        logs=result.logs,
        managed_agent_id=result.managed_agent_id,
    )
