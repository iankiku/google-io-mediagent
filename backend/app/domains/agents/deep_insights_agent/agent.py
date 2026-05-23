from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from types import ModuleType


DEFAULT_ENV_FILE = Path(__file__).with_name(".env")
_PIPELINE_PATH = Path(__file__).with_name("deep_insights_pipeline.py")
_MODULE_NAME = "deep_insights_pipeline_module"


def _load_pipeline_module() -> ModuleType:
    if _MODULE_NAME in sys.modules:
        return sys.modules[_MODULE_NAME]

    spec = importlib.util.spec_from_file_location(_MODULE_NAME, _PIPELINE_PATH)
    if spec is None or spec.loader is None:
        raise ImportError(f"Could not load deep_insights_pipeline.py from {_PIPELINE_PATH}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[_MODULE_NAME] = module
    spec.loader.exec_module(module)
    return module


def run_deep_insights_agent(
    query: str,
    user_id: str | None = None,
    env_file: str | Path | None = None,
    *,
    k_iterations: int | None = None,
    top_k: int | None = None,
    managed_agent_id: str | None = None,
) -> str:
    """
    Run the full deep-insights pipeline: HyDE retrieval over pgvector, Flash rerank,
    then a grounded answer from the configured Gemini Managed Agent.

    Returns the same multiline formatted string as the CLI (`format_result`).
    """
    cleaned_query = query.strip()
    if not cleaned_query:
        raise ValueError("Query must not be empty.")

    resolved_env = env_file
    if resolved_env is None and DEFAULT_ENV_FILE.exists():
        resolved_env = DEFAULT_ENV_FILE

    pipeline = _load_pipeline_module()
    return pipeline.run_pipeline_to_text(
        query=cleaned_query,
        user_id=user_id,
        env_file=resolved_env,
        k_iterations=k_iterations,
        top_k=top_k,
        managed_agent_id=managed_agent_id,
    )


def main() -> None:
    query = input("Enter your medical query: ").strip()
    user_id = input("User UUID (optional, press Enter to skip): ").strip() or None
    if not query:
        raise SystemExit("No query provided.")
    print(run_deep_insights_agent(query, user_id=user_id))


if __name__ == "__main__":
    main()
