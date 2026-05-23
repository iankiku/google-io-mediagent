# research_agent

This is the research agent inside `backend/app/domains/agents/research_agent`.

## What it is

A research agent that routes each query across 5 public medical data sources:
- RxNorm
- MedlinePlus
- DailyMed
- openFDA
- MeSH

Instead of querying every source every time, it:
1. asks Gemini which 2 public medical sources are most relevant
2. rewrites a short retrieval query for each source
3. retrieves only from those 2 sources
4. synthesizes the final answer

## Main files

- `medical_rag.py` — the full pipeline
- `agent.py` — simple callable wrapper around `medical_rag.py`
- `.env.example` — environment variable template
- `requirements.txt` — Python dependencies
- `docs/research-notes.md` — research notes on the chosen public sources

## Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Then put your Gemini key in `.env`:

```env
GEMINI_API_KEY=your_key_here
```

## Run directly

```bash
python medical_rag.py
```

Then type your query when prompted.

## Run the wrapper

```bash
python agent.py
```

## Call it from Python

From the repo root:

```python
from backend.app.domains.agents.research_agent.agent import run_research_agent

result = run_research_agent("what is diabetic nephropathy")
print(result)
```

`run_research_agent(query)` returns the full multiline string result of the pipeline.

## Example queries

- `type 2 diabetes on metformin with elevated a1c`
- `metformin warnings in adults`
- `what is diabetic nephropathy`
- `fda labeling for semaglutide`

## What the script returns / prints

- routing decision
- why each source was chosen
- the rewritten retrieval query for each source
- the final synthesized answer
- source-by-source retrieval status

## Notes

- Gemini is used twice: once for routing and once for final synthesis.
- Retrieval is selective by design: it does not hit all 5 sources on every query.
- This is a prototype, not a clinical decision-support system.
- openFDA should not be used by itself for medical-care decisions.
