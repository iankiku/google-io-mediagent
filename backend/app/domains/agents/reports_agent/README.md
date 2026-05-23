# reports_agent

Text-only lab-report and doctor-note agent for hackathon v1.

This agent performs a simple one-shot vector search over patient records only. It is intentionally narrower than `deep_insights_agent`: no HyDE loop, no general medical KB, and no check-in/prescription/scan evidence.

## What it does

1. Embeds the user question once with the existing `generate_embedding()`.
2. Searches `user_record_embeddings`, joined to `user_medical_records`.
3. Filters to lab PDFs and doctor/physician-note style rows using current metadata/text (`file_type`, `file_name`, extracted text).
4. Synthesizes a cited explanation with `gemini-3.5-flash`.

## Main files

- `agent.py` — exposes `run_reports_agent(query, user_id) -> str`
- `reports_pipeline.py` — simple scoped retrieval + synthesis
- `../patient_record_text_rag.py` — shared one-shot pgvector helper

## Run

```bash
cd backend/app/domains/agents/reports_agent
cp .env.example .env
python agent.py
```

## Call from Python

```python
from app.domains.agents.reports_agent.agent import run_reports_agent

print(run_reports_agent("explain my LDL result", user_id="<uuid>"))
```

## Notes

- Requires `user_id`; reports are patient-record scoped.
- Does not search `general_medical_knowledge`.
- Current schema has no `record_category`, so the report filter is heuristic and conservative.
- Future upgrade: add a real `record_category` column during ingestion (`report`, `scan`, `rx_bottle`, etc.) and replace heuristics with exact filters.
