from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from types import ModuleType


DEFAULT_ENV_FILE = Path(__file__).with_name('.env')
_MEDICAL_RAG_PATH = Path(__file__).with_name('medical_rag.py')
_MODULE_NAME = 'medical_rag_module'


def _load_medical_rag_module() -> ModuleType:
    if _MODULE_NAME in sys.modules:
        return sys.modules[_MODULE_NAME]

    spec = importlib.util.spec_from_file_location(_MODULE_NAME, _MEDICAL_RAG_PATH)
    if spec is None or spec.loader is None:
        raise ImportError(f'Could not load medical_rag.py from {_MEDICAL_RAG_PATH}')
    module = importlib.util.module_from_spec(spec)
    sys.modules[_MODULE_NAME] = module
    spec.loader.exec_module(module)
    return module


def run_research_agent(query: str, env_file: str | Path | None = None) -> str:
    cleaned_query = query.strip()
    if not cleaned_query:
        raise ValueError('Query must not be empty.')

    resolved_env = env_file
    if resolved_env is None and DEFAULT_ENV_FILE.exists():
        resolved_env = DEFAULT_ENV_FILE

    medical_rag = _load_medical_rag_module()
    return medical_rag.run_pipeline_to_text(query=cleaned_query, env_file=resolved_env)


def main() -> None:
    query = input('Enter your medical query: ').strip()
    if not query:
        raise SystemExit('No query provided.')
    print(run_research_agent(query))


if __name__ == '__main__':
    main()
