from __future__ import annotations

import os
import sys
from pathlib import Path

from dotenv import load_dotenv

DEFAULT_ENV_FILE = Path(__file__).with_name(".env")
_BACKEND_ROOT = Path(__file__).resolve().parents[4]

# When the model name is left at the default sentinel below, the Scans agent
# routes its final synthesis through the Managed Agents API (Antigravity /
# Gemini 3.5 Flash) instead of a raw `client.models.generate_content` call.
DEFAULT_SCANS_MODEL = "managed:antigravity"
SCANS_SYSTEM_INSTRUCTION = """
You are a MedGemma-style medical imaging explanation agent.

You only answer from retrieved scan/imaging records provided in the prompt. Do not infer
findings from images you cannot see; this v1 agent is text-only and uses extracted scan
summaries already stored in the patient's record embeddings.

Rules:
- Cite every patient-specific statement with [doc:<record_id>].
- Be clear and plain-language, but do not diagnose.
- If the retrieved scan text is insufficient, say so and recommend uploading the relevant scan/report.
- If advice is needed, frame it as a question for the doctor.
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
        raise ValueError("user_id is required for scans_agent.")

    _load_env(env_file)
    _ensure_backend_on_path()

    from app.domains.agents.patient_record_text_rag import (
        SCAN_RECORD_FILTER,
        SimpleRecordRagResult,
        retrieve_patient_record_contexts,
        synthesize_from_patient_records_via_managed_agent,
    )

    resolved_limit = limit if limit is not None else int(os.getenv("SCANS_TOP_K", "5"))
    resolved_model = model_name or os.getenv("SCANS_MODEL", DEFAULT_SCANS_MODEL)

    logs = [
        f"[ScansAgent] Text-only scoped retrieval for user_id={user_id}",
        f"[ScansAgent] filter={SCAN_RECORD_FILTER.name} limit={resolved_limit} model={resolved_model}",
        "[ScansAgent] No raw image bytes are loaded in v1; this searches extracted scan summaries only.",
        "[ScansAgent] Final synthesis routes through the Managed Agents API "
        "(Antigravity / Gemini 3.5 Flash) with the Scans persona mounted at .agents/AGENTS.md.",
    ]

    contexts = retrieve_patient_record_contexts(
        user_id=user_id,
        query=cleaned_query,
        record_filter=SCAN_RECORD_FILTER,
        limit=resolved_limit,
    )
    logs.append(f"[ScansAgent] Retrieved {len(contexts)} scan-like contexts.")

    answer, synthesis_logs = synthesize_from_patient_records_via_managed_agent(
        query=cleaned_query,
        contexts=contexts,
        system_instruction=SCANS_SYSTEM_INSTRUCTION,
        persona_key="scans",
        log_prefix="[ScansAgent]",
    )
    logs.extend(synthesis_logs)

    return SimpleRecordRagResult(
        query=cleaned_query,
        user_id=user_id,
        filter_name="scans",
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
    query = input("Enter your scan question: ").strip()
    user_id = input("User UUID: ").strip()
    if not query:
        raise SystemExit("No query provided.")
    if not user_id:
        raise SystemExit("user_id is required.")
    print(run_pipeline_to_text(query, user_id=user_id))


if __name__ == "__main__":
    main()
