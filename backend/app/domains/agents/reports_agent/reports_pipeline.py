from __future__ import annotations

import os
import sys
from pathlib import Path

from dotenv import load_dotenv

DEFAULT_ENV_FILE = Path(__file__).with_name(".env")
_BACKEND_ROOT = Path(__file__).resolve().parents[4]

DEFAULT_REPORTS_MODEL = "gemini-3.5-flash"
REPORTS_SYSTEM_INSTRUCTION = """
You are a medical reports explanation agent.

You only answer from retrieved lab PDFs and doctor/physician note records provided in
the prompt. Do not use check-ins, prescriptions, or scan-only records as evidence.

Rules:
- Cite every patient-specific statement with [doc:<record_id>].
- Explain lab values and doctor-note language in plain English.
- Do not diagnose or prescribe.
- If the retrieved reports are insufficient, say exactly what report/note is missing.
- When the answer approaches advice, frame it as a question to take to the doctor.
""".strip()


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


def run_pipeline(
    query: str,
    *,
    user_id: str,
    env_file: str | Path | None = None,
    limit: int | None = None,
    model_name: str | None = None,
):
    cleaned_query = query.strip()
    if not cleaned_query:
        raise ValueError("Query must not be empty.")
    if not user_id or not user_id.strip():
        raise ValueError("user_id is required for reports_agent.")

    _load_env(env_file)
    _ensure_backend_on_path()

    from app.domains.agents.patient_record_text_rag import (
        REPORT_RECORD_FILTER,
        SimpleRecordRagResult,
        retrieve_patient_record_contexts,
        synthesize_from_patient_records,
    )

    resolved_limit = limit if limit is not None else int(os.getenv("REPORTS_TOP_K", "5"))
    resolved_model = model_name or os.getenv("REPORTS_MODEL", DEFAULT_REPORTS_MODEL)

    logs = [
        f"[ReportsAgent] One-shot scoped retrieval for user_id={user_id}",
        f"[ReportsAgent] filter={REPORT_RECORD_FILTER.name} limit={resolved_limit} model={resolved_model}",
        "[ReportsAgent] Patient records only; general medical KB is intentionally not queried in v1.",
    ]

    contexts = retrieve_patient_record_contexts(
        user_id=user_id,
        query=cleaned_query,
        record_filter=REPORT_RECORD_FILTER,
        limit=resolved_limit,
    )
    logs.append(f"[ReportsAgent] Retrieved {len(contexts)} report-like contexts.")

    answer = synthesize_from_patient_records(
        query=cleaned_query,
        contexts=contexts,
        model_name=resolved_model,
        system_instruction=REPORTS_SYSTEM_INSTRUCTION,
    )

    return SimpleRecordRagResult(
        query=cleaned_query,
        user_id=user_id,
        filter_name="reports",
        contexts=contexts,
        final_answer=answer,
        model_name=resolved_model,
        logs=logs,
    )


def run_pipeline_to_text(
    query: str,
    *,
    user_id: str,
    env_file: str | Path | None = None,
    limit: int | None = None,
    model_name: str | None = None,
) -> str:
    _ensure_backend_on_path()
    from app.domains.agents.patient_record_text_rag import format_simple_record_rag_result

    return format_simple_record_rag_result(
        run_pipeline(
            query,
            user_id=user_id,
            env_file=env_file,
            limit=limit,
            model_name=model_name,
        )
    )


def main() -> None:
    query = input("Enter your report question: ").strip()
    user_id = input("User UUID: ").strip()
    if not query:
        raise SystemExit("No query provided.")
    if not user_id:
        raise SystemExit("user_id is required.")
    print(run_pipeline_to_text(query, user_id=user_id))


if __name__ == "__main__":
    main()
