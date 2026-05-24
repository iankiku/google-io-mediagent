"""
Public entrypoint for the orchestrator agent.

Mirrors the pattern used by `deep_insights_agent/agent.py`,
`reports_agent/agent.py`, etc. — a thin wrapper that loads the pipeline
module lazily and exposes a single `run_orchestrator_agent()` function plus
a CLI `main()`.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from .orchestrator_pipeline import (
    OrchestratorResult,
    run_orchestrator,
    run_orchestrator_events,
    trace_as_dicts,
)

DEFAULT_ENV_FILE = Path(__file__).with_name(".env")


def run_orchestrator_agent(
    user_id: str,
    goal: str = "",
    env_file: str | Path | None = None,
    *,
    managed_agent_id: str | None = None,
) -> OrchestratorResult:
    """
    Run the full orchestrator pipeline and return the structured result.

    Use this from the FastAPI router (which serializes `agent_trace` for the
    UI trace panel) or from a notebook / CLI for debugging.
    """
    if not user_id or not user_id.strip():
        raise ValueError("user_id is required for orchestrator_agent.")

    resolved_env = env_file
    if resolved_env is None and DEFAULT_ENV_FILE.exists():
        resolved_env = DEFAULT_ENV_FILE

    return run_orchestrator(
        user_id=user_id.strip(),
        goal=goal,
        env_file=resolved_env,
        managed_agent_id=managed_agent_id,
    )


def main() -> None:
    user_id = input("User UUID: ").strip()
    goal = input("Optional goal (press Enter for default): ").strip()
    if not user_id:
        raise SystemExit("user_id is required.")
    result = run_orchestrator_agent(user_id=user_id, goal=goal)
    print("\n=== Agent Trace ===")
    for entry in result.agent_trace:
        print(
            f"- {entry.agent} ({'ok' if entry.success else 'error'}): "
            f"{entry.why}\n  sub-query: {entry.sub_query}\n"
            f"  excerpt: {entry.output_excerpt}\n"
        )
    print("\n=== Final Report (Markdown) ===")
    print(result.final_report_markdown)
    print("\n=== Pipeline Logs ===")
    for line in result.logs:
        print(line)


if __name__ == "__main__":
    main()


__all__ = [
    "run_orchestrator_agent",
    "run_orchestrator_events",
    "trace_as_dicts",
    "OrchestratorResult",
]
