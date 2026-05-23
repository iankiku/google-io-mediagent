# 3-Hour Sprint Plan — MediAgent Hackathon
## What to build, in what order, to have a working demo

**Clock starts now. Every minute counts.**

---

## Current State Assessment

### Already Built (DO NOT REBUILD)
- [x] FastAPI app with CORS, domain routers, startup hooks
- [x] LangGraph workflow: Router → Execution → Validator with conditional edges
- [x] Ingestion pipeline: MedGemma parsing → chunking → Gemini embeddings → pgvector insert
- [x] pgvector retrieval: user-scoped + general medical KB queries
- [x] Next.js frontend: chat UI, file uploader, timeline, metric trends, trace panel
- [x] Telegram bot domain (services, bot, router)
- [x] DB schema + init script (users, medical_records, embeddings, general_kb)
- [x] Demo data: 3 lab reports showing HbA1c improvement arc

### What Needs to Work for Demo
- [ ] Backend starts without errors
- [ ] DB connection works (Postgres + pgvector extension)
- [ ] File upload → ingestion pipeline runs end-to-end
- [ ] Chat → LangGraph → dual RAG → response works end-to-end
- [ ] Frontend renders cleanly with all 3 tabs functional
- [ ] Telegram bot sends/receives (stretch goal)

---

## Sprint Blocks

### Block 1: Foundation (0:00 — 0:30) 🔴 CRITICAL
**Goal:** Backend and frontend both start. DB is live.

| # | Task | Time | Owner |
|---|------|------|-------|
| 1.1 | Start Postgres locally (or Docker), create `health_assistant` DB, enable `pgvector` extension | 10 min | Backend |
| 1.2 | Set env vars: `GEMINI_API_KEY`, `POSTGRES_*`, `TELEGRAM_BOT_TOKEN` (optional) | 5 min | Backend |
| 1.3 | `pip install -r requirements.txt` in venv, fix any import errors | 5 min | Backend |
| 1.4 | Run `uvicorn app.main:app --reload`, verify `GET /` returns OK | 5 min | Backend |
| 1.5 | `npm install && npm run dev` for frontend, verify it loads | 5 min | Frontend |

**Checkpoint:** Both servers running. Frontend shows demo patient with 3 records.

### Block 2: Ingestion Pipeline (0:30 — 1:15) 🔴 CRITICAL
**Goal:** Upload a real PDF → see it processed and appear in timeline.

| # | Task | Time | Owner |
|---|------|------|-------|
| 2.1 | Verify `/api/ingest/upload` endpoint accepts multipart file + user_id | 10 min | Backend |
| 2.2 | Test MedGemma extraction with a sample lab report image/PDF | 10 min | Backend |
| 2.3 | Verify embeddings are generated and inserted into pgvector | 10 min | Backend |
| 2.4 | Test frontend FileUploader component → hits upload endpoint | 10 min | Full-stack |
| 2.5 | Verify timeline updates after upload (fetch records endpoint) | 5 min | Full-stack |

**Checkpoint:** Upload a PDF from the web UI. It appears in the timeline with extracted summary.

### Block 3: Chat + RAG (1:15 — 2:00) 🔴 CRITICAL
**Goal:** Ask a health question → get a grounded answer from pgvector.

| # | Task | Time | Owner |
|---|------|------|-------|
| 3.1 | Verify `/api/chat` endpoint processes message through LangGraph | 10 min | Backend |
| 3.2 | Test dual RAG: user records + general KB retrieval with a real query | 10 min | Backend |
| 3.3 | Verify Antigravity Interactions API call works (or fallback to direct Gemini) | 10 min | Backend |
| 3.4 | Test full chat flow from frontend: type question → see grounded response | 10 min | Full-stack |
| 3.5 | Verify trace logs appear in Orchestrator Logs tab | 5 min | Frontend |

**Checkpoint:** Ask "How has my HbA1c changed?" → get answer referencing actual records.

### Block 4: Polish & Demo Prep (2:00 — 2:30) 🟡 IMPORTANT
**Goal:** Everything looks good for a live demo.

| # | Task | Time | Owner |
|---|------|------|-------|
| 4.1 | Seed general_medical_knowledge table with 5-10 chronic disease guideline chunks | 10 min | Backend |
| 4.2 | Verify MetricTrends tab renders charts correctly from parsed lab_metrics | 5 min | Frontend |
| 4.3 | Test 3 demo questions end-to-end, note any response quality issues | 10 min | Full-stack |
| 4.4 | Fix any UI glitches, loading states, error messages | 5 min | Frontend |

**Checkpoint:** Full demo flow runs smoothly 3 times in a row.

### Block 5: Docker + Cloud Deploy (2:30 — 2:50) 🟡 IMPORTANT
**Goal:** App is containerized and deployed to Google Cloud.

| # | Task | Time | Owner |
|---|------|------|-------|
| 5.1 | `docker-compose up` — verify full stack runs locally in containers | 5 min | Full-stack |
| 5.2 | `pulumi up` — deploy Cloud SQL, GCS, Cloud Run via Pulumi IaC | 10 min | Backend |
| 5.3 | Build & push Docker images to Artifact Registry | 5 min | Backend |

**Checkpoint:** App accessible via Cloud Run URL.

### Block 6: Submission (2:50 — 3:00) 🔴 CRITICAL
| # | Task | Time |
|---|------|------|
| 6.1 | Final git commit with all working code | 3 min |
| 6.2 | Update README.md with setup instructions + deployed URL | 5 min |
| 6.3 | Submit to hackathon platform | 2 min |

---

## Infrastructure Setup (Pulumi ESC)

```bash
# One-time setup
cd infra && npm install
pulumi env init <org>/mediagent/dev
pulumi env set <org>/mediagent/dev geminiApiKey <key> --secret
pulumi env set <org>/mediagent/dev postgresPassword <password> --secret
pulumi config env add mediagent/dev
pulumi up
```

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Postgres not available | `docker-compose up db` gives you pgvector in 10 seconds |
| MedGemma API errors | Gemini 2.5 Flash with medical system prompt is already the fallback |
| Antigravity API not accessible | Direct Gemini `generate_content` call (already in code as fallback path) |
| Cloud Run deploy fails | Demo locally via `docker-compose up` — still shows production-ready architecture |
| Frontend demo data sufficient | Demo data already hardcoded — works even without backend |
| GCS not configured | Storage module falls back to local filesystem automatically |

## Demo Script (3 minutes)

> "MediAgent is a personal health assistant that helps patients understand their medical records."

1. **[15s]** Show dashboard. "Maria has Type 2 Diabetes and uploads lab reports every few months."
2. **[30s]** Upload a new lab report PDF. "The system uses MedGemma to extract clinical findings, medications, and lab values — then generates embeddings stored in pgvector."
3. **[30s]** Show timeline updating. "Every document becomes a searchable, structured health record."
4. **[45s]** Chat: "How has my HbA1c changed?" → Show grounded response. "This answer is grounded in Maria's actual records via semantic search — not hallucinated."
5. **[30s]** Chat: "What blood pressure target should I aim for?" → Show general KB response. "We also query a general medical knowledge base for clinical guidelines."
6. **[15s]** Show Diagnostic Trends tab. "Parsed lab values are visualized over time — Maria can see her progress."
7. **[15s]** Show Orchestrator Logs. "Full transparency — every routing decision, retrieval step, and validation is logged."
8. **[15s]** (If Telegram works) Show bot receiving a photo. "Patients can also upload via Telegram — same pipeline."

**Close:** "MediAgent bridges the gap between complex medical data and patient understanding — powered by Gemini, MedGemma, pgvector, and LangGraph."
