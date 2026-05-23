# scans_agent

Text-only scan/imaging agent for hackathon v1.

This agent answers from already-ingested scan-like patient records. It does **not** load raw image bytes in v1; ingestion has already converted images/PDFs into extracted text summaries, and this agent searches those embeddings.

## What it does

1. Embeds the user question once with the existing `generate_embedding()`.
2. Searches `user_record_embeddings`, joined to `user_medical_records`.
3. Filters to scan-like rows using existing metadata/text heuristics (`file_type`, `file_name`, extracted text).
4. Synthesizes an answer with a MedGemma-style system prompt and `gemini-3.5-flash`.

## Main files

- `agent.py` — exposes `run_scans_agent(query, user_id) -> str`
- `scans_pipeline.py` — text-only scoped retrieval + synthesis
- `../patient_record_text_rag.py` — shared one-shot pgvector helper

## Run

```bash
cd backend/app/domains/agents/scans_agent
cp .env.example .env
python agent.py
```

## Call from Python

```python
from app.domains.agents.scans_agent.agent import run_scans_agent

print(run_scans_agent("what does the scan impression say?", user_id="<uuid>"))
```

## Notes

- Requires `user_id`; scans are patient-record scoped.
- Does not search `general_medical_knowledge`.
- Current schema has no `record_category`, so the scan filter is heuristic and conservative.
- Future upgrade: load the original image/PDF from `file_path` and ask real MedGemma/vision model directly.
