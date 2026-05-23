from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from types import ModuleType


DEFAULT_ENV_FILE = Path(__file__).with_name(".env")
_PIPELINE_PATH = Path(__file__).with_name("scans_pipeline.py")
_MODULE_NAME = "scans_pipeline_module"


def _load_pipeline_module() -> ModuleType:
    if _MODULE_NAME in sys.modules:
        return sys.modules[_MODULE_NAME]

    spec = importlib.util.spec_from_file_location(_MODULE_NAME, _PIPELINE_PATH)
    if spec is None or spec.loader is None:
        raise ImportError(f"Could not load scans_pipeline.py from {_PIPELINE_PATH}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[_MODULE_NAME] = module
    spec.loader.exec_module(module)
    return module


def run_scans_agent(
    query: str,
    user_id: str,
    env_file: str | Path | None = None,
    *,
    limit: int | None = None,
    model_name: str | None = None,
) -> str:
    cleaned_query = query.strip()
    if not cleaned_query:
        raise ValueError("Query must not be empty.")
    if not user_id or not user_id.strip():
        raise ValueError("user_id is required for scans_agent.")

    resolved_env = env_file
    if resolved_env is None and DEFAULT_ENV_FILE.exists():
        resolved_env = DEFAULT_ENV_FILE

    pipeline = _load_pipeline_module()
    return pipeline.run_pipeline_to_text(
        query=cleaned_query,
        user_id=user_id.strip(),
        env_file=resolved_env,
        limit=limit,
        model_name=model_name,
    )


def main() -> None:
    query = input("Enter your scan question: ").strip()
    user_id = input("User UUID: ").strip()
    if not query:
        raise SystemExit("No query provided.")
    if not user_id:
        raise SystemExit("user_id is required.")
    print(run_scans_agent(query, user_id=user_id))


if __name__ == "__main__":
    main()
