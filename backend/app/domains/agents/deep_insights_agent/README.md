# deep_insights_agent

Personal health RAG: iterative HyDE retrieval over **pgvector**, Flash reranking, then a **grounded** answer from a Gemini Managed Agent.

This folder is the packaged entrypoint for the pipeline that also powers `POST /api/chat` via LangGraph (`domains/orchestration/graph.py`).

## What it does

1. **HyDE loop** (`domains/retrieval/services.py` — `retrieve()`): Gemini 2.5 Flash writes a hypothetical clinical snippet → embed → search `user_record_embeddings` + `general_medical_knowledge` → accumulate contexts (deduped).
2. **Rerank** (`FlashReranker`): score all candidates, keep top **2** (`MedGemmaReranker` is a v1.1 stub).
3. **Synthesize**: inject top contexts into the citation invariant system prompt → **Managed Agent** interaction → final answer string.

## Main files

| File | Role |
|------|------|
| `deep_insights_pipeline.py` | Full pipeline + shared helpers used by `/api/chat` |
| `agent.py` | `run_deep_insights_agent(query, user_id=...)` → formatted string |
| `.env.example` | `GEMINI_API_KEY`, Postgres, optional `DEEP_INSIGHTS_*` tuning |

## Prerequisites

- PostgreSQL with pgvector running (`docker compose up db -d` from repo root).
- `GEMINI_API_KEY` set (agent `.env` or repo root `.env`).
- Embeddings ingested for the target user when using `user_id` (see `domains/ingestion/` and `make seed`).

## Setup

From the backend venv (recommended — reuses app modules and DB drivers):

```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt
cd app/domains/agents/deep_insights_agent
cp .env.example .env
# Edit .env — at minimum GEMINI_API_KEY and POSTGRES_*
```

## Run directly

```bash
cd backend/app/domains/agents/deep_insights_agent
python deep_insights_pipeline.py
```

## Run the wrapper

```bash
python agent.py
```

## Call from Python

From repo root with backend on `PYTHONPATH` or from `backend/`:

```python
from app.domains.agents.deep_insights_agent.agent import run_deep_insights_agent

print(run_deep_insights_agent(
    "what does my LDL value mean?",
    user_id="00000000-0000-0000-0000-000000000001",  # optional; scopes pgvector
))
```

`run_deep_insights_agent(query)` returns a multiline string: HyDE hypotheticals, top grounded chunks, final answer, and pipeline logs.

Optional kwargs: `env_file`, `k_iterations`, `top_k`, `managed_agent_id`.

## Example queries

- `what does my LDL value mean?` (pass Ravi or seeded `user_id` for patient-specific hits)
- `summarize my recent lab trends`
- `is my blood pressure in a healthy range?`

## Notes

- Default HyDE iterations: **2** (`DEEP_INSIGHTS_K_ITERATIONS`). Set to `5` to match the product spec in `project-docs/prd-zoie-v2.md`.
- Reranker is **Gemini 2.5 Flash** (`FlashReranker`), not Vertex MedGemma yet.
- Not clinical decision support — same citation invariant as the main chat graph.
