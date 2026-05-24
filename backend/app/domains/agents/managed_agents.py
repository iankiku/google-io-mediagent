"""
Shared helper for invoking the Gemini Managed Agents API across all 4 pipeline
agents (deep_insights, reports, scans, research) and the orchestrator.

Why this module exists
----------------------
Until this refactor only `deep_insights_agent` actually went through
`client.interactions.create`. `reports_agent`, `scans_agent`, and
`research_agent` did final synthesis with a raw `client.models.generate_content`
call. That bypassed the sandboxed managed-agent harness (no AGENTS.md mounting,
no tool routing, no per-pipeline persona overlay).

This module centralizes the contract so every agent is a Managed Agent wrapper:

    interaction = client.interactions.create(
        agent=<Managed Agent ID, defaults to Antigravity>,
        input=<prompt body>,
        system_instruction=<base role>,
        environment={"type":"remote", "sources":[
            {"type":"inline", "target":".agents/AGENTS.md", "content":<persona>},
            ...
        ]},
        tools=[{"type":"code_execution"|"google_search"|"url_context"}],
        previous_interaction_id=<optional>,
    )

We expose one entrypoint, `synthesize_via_managed_agent`, that all agents call.
It returns `(output_text, logs, interaction_id, environment_id)` so callers can
surface trace info in the UI and (optionally) continue a session.

References
----------
- https://ai.google.dev/gemini-api/docs/managed-agents-quickstart
- https://ai.google.dev/gemini-api/docs/custom-agents
- https://ai.google.dev/gemini-api/docs/antigravity-agent
- https://ai.google.dev/gemini-api/docs/agent-environment
- Blog: https://blog.google/innovation-and-ai/technology/developers-tools/managed-agents-gemini-api/
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional

# Default base agent (Antigravity) — built on Gemini 3.5 Flash per the launch
# blog post. Used for every pipeline unless the caller overrides it.
DEFAULT_MANAGED_AGENT = "antigravity-preview-05-2026"


@dataclass
class ManagedAgentResult:
    output_text: str
    logs: list[str] = field(default_factory=list)
    interaction_id: Optional[str] = None
    environment_id: Optional[str] = None
    agent_id: str = DEFAULT_MANAGED_AGENT
    error: Optional[str] = None


# ---------------------------------------------------------------------------
# Persona / AGENTS.md overlays per pipeline.
#
# Each entry is the inline AGENTS.md content that gets mounted into the
# Antigravity sandbox via the Managed Agents API environment.sources list.
# The Antigravity runtime auto-loads `.agents/AGENTS.md` as system context, so
# this is how we keep each agent's behavior distinct while still using the
# same underlying base agent.
# ---------------------------------------------------------------------------

DEEP_INSIGHTS_AGENTS_MD = """\
# Deep Insights Agent

You are the **Deep Insights** specialist inside a multi-agent medical assistant.

## Scope
- You receive a HyDE-retrieved, reranked, grounded medical context block built
  from BOTH the patient's own records (pgvector `user_record_embeddings`) and
  the general medical KB (`general_medical_knowledge`).
- Your job is to answer the patient's question using that grounded context.

## Citation invariant (HARD RULE)
Every medical statement MUST be one of:
1. A value from the patient's records, cited as `[doc:<record_id>]` or the
   source document name.
2. A definition from a citable reference, cited as `LOINC:<code>`,
   `RxNorm:<rxcui>`, or `MedlinePlus:<url>`.
3. Explicitly framed as a question to bring to the doctor (not a claim).

No free-form medical synthesis without a citation. Ever.

## Style
- Plain language. Indian English register where natural.
- Translate complex terms but never lose precision.
- If the retrieved context is insufficient, say so and recommend the next step
  (e.g. "upload your latest lipid panel" or "ask Dr. Patel on Thursday").

## Boilerplate when advice territory is reached
> "I'm not a doctor — I can help you understand and remember. Let's bring this
>  to Dr. Patel on Thursday."
"""


REPORTS_AGENTS_MD = """\
# Reports Agent

You are the **Reports** specialist inside a multi-agent medical assistant.

## Scope
- You only see retrieved chunks from lab PDFs and doctor/physician notes
  (filtered by `REPORT_RECORD_FILTER`). You do not see scans, check-ins, or
  Rx-bottle records.

## Rules
- Cite every patient-specific statement with `[doc:<record_id>]`.
- Explain lab values and doctor-note language in plain English.
- Do not diagnose or prescribe.
- If the retrieved reports are insufficient, say exactly which report or note
  is missing (e.g. "I don't see a recent lipid panel — please upload it").
- When the answer approaches advice, frame it as a question to take to the
  doctor.
"""


SCANS_AGENTS_MD = """\
# Scans Agent

You are the **Scans** specialist inside a multi-agent medical assistant
(MedGemma-style behavior over text summaries — no raw image bytes in v1).

## Scope
- You only see retrieved chunks from imaging/radiology-style records
  (filtered by `SCAN_RECORD_FILTER`).
- You never see raw pixels. You reason over the OCR/extracted text only.

## Rules
- Cite every patient-specific statement with `[doc:<record_id>]`.
- Use plain language but do not diagnose.
- If the retrieved scan text is insufficient, say so and recommend uploading
  the relevant scan/report.
- If advice is needed, frame it as a question for the doctor.
"""


RESEARCH_AGENTS_MD = """\
# Research Agent

You are the **Research** specialist inside a multi-agent medical assistant.

## Scope
- You synthesize from public medical APIs (RxNorm, MedlinePlus, DailyMed,
  openFDA, MeSH) that have already been retrieved upstream. You do NOT see
  the patient's private records.

## Rules
- Use ONLY the routed retrieval evidence in the prompt unless google_search
  grounding is explicitly enabled.
- If a source returned no hits or errored, say so explicitly.
- Do not claim clinical certainty. This is informational, not advice.
- Cite sources inline (e.g. `RxNorm:<rxcui>`, `MedlinePlus:<url>`,
  `DailyMed:<setid>`).
- Output sections: short answer · routed sources rationale · per-source
  findings · normalized entities/codes · caveats.
"""


ORCHESTRATOR_AGENTS_MD = """\
# Orchestrator Agent

You are the **Orchestrator** inside a multi-agent medical assistant. You
coordinate four specialist agents (deep_insights, reports, scans, research)
to produce a single understanding guide for the patient about their uploaded
medical resources.

## Inputs you receive
- The user's high-level goal (e.g. "Generate a one-page report I can
  understand").
- A bundle of pre-fetched specialist outputs — each tagged with which agent
  produced it and what sub-query was used.

## What to produce
A **patient-friendly understanding guide** with these sections:

1. **Plain-English summary** — what each uploaded record actually says.
2. **What the labs / scans mean for me** — translated values and findings,
   each cited back to the originating doc via `[doc:<record_id>]`.
3. **Background knowledge** — relevant general medical context cited from
   the research agent (`RxNorm:`, `MedlinePlus:`, etc.).
4. **Questions to ask my doctor** — 3–5 specific, actionable questions.
5. **Next steps** — what to upload, track, or follow up on.

## Rules
- Never invent records or values. Every patient-specific claim MUST be
  attributed to a specialist agent's output with a `[doc:]` or source code.
- Use plain language but keep medical precision.
- If a specialist returned nothing for some sub-query, surface that as a
  gap in section 5 (e.g. "We could not find a recent lipid panel — please
  upload it").
- Output as Markdown so the frontend can render it directly.
"""


PERSONAS = {
    "deep_insights": DEEP_INSIGHTS_AGENTS_MD,
    "reports": REPORTS_AGENTS_MD,
    "scans": SCANS_AGENTS_MD,
    "research": RESEARCH_AGENTS_MD,
    "orchestrator": ORCHESTRATOR_AGENTS_MD,
}


# ---------------------------------------------------------------------------
# Public entrypoint
# ---------------------------------------------------------------------------

def synthesize_via_managed_agent(
    *,
    input_text: str,
    system_instruction: str,
    persona_key: Optional[str] = None,
    extra_sources: Optional[list[dict]] = None,
    tools: Optional[list[str]] = None,
    managed_agent_id: str = DEFAULT_MANAGED_AGENT,
    previous_interaction_id: Optional[str] = None,
    environment_id: Optional[str] = None,
    log_prefix: str = "[ManagedAgent]",
) -> ManagedAgentResult:
    """
    Invoke the Gemini Managed Agents API for final synthesis.

    Parameters
    ----------
    input_text : str
        The user-facing prompt body. Becomes `interactions.create(input=...)`.
    system_instruction : str
        Base role string for this run. Becomes
        `interactions.create(system_instruction=...)`. The Managed Agent will
        merge this with the inline AGENTS.md mounted in `environment.sources`.
    persona_key : str | None
        One of `PERSONAS` (e.g. "deep_insights"). If set, that persona's
        AGENTS.md content is inlined at `.agents/AGENTS.md`.
    extra_sources : list[dict] | None
        Additional `environment.sources` entries. Each entry must follow the
        Managed Agents API source schema, e.g.
        `{"type":"inline","target":".agents/skills/foo/SKILL.md","content":...}`.
    tools : list[str] | None
        Tool types to enable. Allowed: "code_execution", "google_search",
        "url_context". When None, no tools are passed and the agent uses its
        defaults.
    managed_agent_id : str
        The Managed Agent ID. Defaults to Antigravity. May be a custom agent
        previously created via `client.agents.create`.
    previous_interaction_id : str | None
        When continuing a multi-turn conversation, pass the prior
        `interaction.id`. See managed-agents-quickstart docs.
    environment_id : str | None
        When continuing in the same sandbox, pass the prior
        `interaction.environment_id`. Mutually exclusive with `extra_sources`
        (the API expects either a fresh env definition OR an existing env id).
    log_prefix : str
        Prepended to every log line so the calling pipeline can identify the
        source in the UI trace panel.
    """
    # Local import keeps the GenAI client lazy so unit tests that mock the
    # backend don't have to install google-genai eagerly.
    from app.core.config import client

    logs: list[str] = []
    api_tools = [{"type": t} for t in (tools or [])]

    environment_config: Any
    if environment_id:
        environment_config = environment_id
        logs.append(
            f"{log_prefix} Reusing existing sandbox environment "
            f"'{environment_id}'."
        )
    else:
        sources: list[dict] = []
        if persona_key:
            persona_md = PERSONAS.get(persona_key)
            if persona_md:
                sources.append(
                    {
                        "type": "inline",
                        "target": ".agents/AGENTS.md",
                        "content": persona_md,
                    }
                )
                logs.append(
                    f"{log_prefix} Mounting inline AGENTS.md for persona "
                    f"'{persona_key}' ({len(persona_md)} chars)."
                )
            else:
                logs.append(
                    f"{log_prefix} Unknown persona_key '{persona_key}'; "
                    "skipping inline AGENTS.md."
                )
        if extra_sources:
            sources.extend(extra_sources)
            logs.append(
                f"{log_prefix} Mounting {len(extra_sources)} additional "
                "environment source(s)."
            )
        environment_config = (
            {"type": "remote", "sources": sources} if sources else "remote"
        )

    logs.append(
        f"{log_prefix} Invoking Managed Agent '{managed_agent_id}' via "
        "client.interactions.create."
    )

    request_kwargs: dict[str, Any] = {
        "agent": managed_agent_id,
        "input": input_text,
        "system_instruction": system_instruction,
        "environment": environment_config,
    }
    if api_tools:
        request_kwargs["tools"] = api_tools
    if previous_interaction_id:
        request_kwargs["previous_interaction_id"] = previous_interaction_id
        logs.append(
            f"{log_prefix} Continuing previous interaction "
            f"'{previous_interaction_id}'."
        )

    try:
        interaction = client.interactions.create(**request_kwargs)
        output_text = getattr(interaction, "output_text", "") or ""
        interaction_id = getattr(interaction, "id", None)
        env_id = getattr(interaction, "environment_id", None)
        logs.append(
            f"{log_prefix} Interaction succeeded "
            f"(interaction_id={interaction_id}, environment_id={env_id})."
        )
        return ManagedAgentResult(
            output_text=output_text,
            logs=logs,
            interaction_id=interaction_id,
            environment_id=env_id,
            agent_id=managed_agent_id,
        )
    except Exception as exc:  # pragma: no cover - network/api errors
        message = str(exc)
        logs.append(f"{log_prefix} Interaction failed: {message}")
        return ManagedAgentResult(
            output_text=f"Error executing managed agent interaction: {message}",
            logs=logs,
            agent_id=managed_agent_id,
            error=message,
        )
