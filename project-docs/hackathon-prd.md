# MediAgent — Hackathon PRD
## Google I/O 2026 Hackathon Submission

**Deadline:** 3 hours from now (2026-05-23)
**Team:** Team Nebula

---

## 1. Problem Statement

Patients receive complex medical documents — lab reports, physician notes, diagnostic images — but lack the tools to understand them. Medical jargon creates a barrier between patients and their own health data. Caregivers managing records for elderly relatives face the same gap multiplied.

**The cost:** Patients miss warning signs in their own lab results, fail to track chronic condition trends, and arrive at appointments unable to ask informed questions.

## 2. Solution: MediAgent

A personal health assistant that ingests medical records (PDFs, images, physician notes), translates them into plain language using MedGemma and Gemini, and provides an interactive RAG-powered consultation grounded in the patient's own data.

### Core Differentiators

| Feature | Why It Matters |
|---------|---------------|
| **MedGemma clinical extraction** | Purpose-built medical VLM — not a generic OCR pipeline |
| **Dual RAG (personal + general KB)** | Answers grounded in YOUR records + medical guidelines |
| **Multi-channel access** | Telegram bot for quick uploads, web dashboard for deep analysis |
| **Trend visualization** | See HbA1c, blood pressure, glucose over time — not just individual reports |
| **LangGraph orchestration** | Router → Executor → Validator loop ensures response quality |

## 3. User Personas (Hackathon Scope)

### Persona A: Maria — Chronic Patient (Type 2 Diabetes + Hypertension)
- Uploads lab reports every 3 months
- Wants to know: "Is my HbA1c getting better?" / "What does this number mean?"
- Interacts via Telegram (quick photo uploads) and Web App (trend tracking)

### Persona B: David — Caregiver for Elderly Parent
- Batch-uploads discharge summaries and doctor notes
- Wants to know: "What medications is my mother on?" / "What changed since the last visit?"
- Uses Web App dashboard

## 4. Demo Flow (What Judges See)

### Scene 1: Upload & Ingest (60 seconds)
1. Open web dashboard → drag-and-drop a lab report PDF
2. System processes via MedGemma → extracts structured clinical summary
3. Timeline updates with the new record, showing extracted findings

### Scene 2: Chat Consultation (90 seconds)
1. Ask: "How has my HbA1c changed over the last 6 months?"
2. System queries pgvector (user-scoped) → retrieves 3 lab reports
3. Response shows the trend: 6.2% → 5.8% → 5.5% with plain-language explanation
4. Ask: "What are the guidelines for my blood pressure?"
5. System queries general medical KB → returns AHA guidelines grounded response

### Scene 3: Metric Trends (30 seconds)
1. Switch to "Diagnostic Trends" tab
2. Show HbA1c and Blood Pressure charts tracking improvement over time
3. Highlight how the system automatically parsed these values from uploaded PDFs

### Scene 4: Telegram Integration (30 seconds)
1. Show Telegram bot receiving a photo of a prescription
2. Bot responds with extracted medications and dosages
3. Web dashboard updates in real-time

### Scene 5: Orchestrator Transparency (30 seconds)
1. Switch to "Orchestrator Logs" tab
2. Show the LangGraph trace: Router decisions, RAG retrieval, validation status
3. Demonstrate the system is explainable, not a black box

## 5. Technical Architecture (Hackathon Build)

```
User Input (Web/Telegram)
    │
    ▼
┌─────────────────────┐
│  Ingestion Agent     │
│  ├─ File Classifier  │
│  ├─ MedGemma (VLM)   │ ← Medical image/note parsing
│  ├─ Text Chunker     │
│  └─ Gemini Embeddings│ ← text-embedding-004
└─────────┬───────────┘
          ▼
┌─────────────────────┐
│  PostgreSQL          │
│  ├─ pgvector         │ ← user_record_embeddings (768d, HNSW)
│  ├─ User Records     │ ← metadata + extracted summaries
│  └─ General Med KB   │ ← chronic disease guidelines
└─────────┬───────────┘
          ▼
┌─────────────────────┐
│  LangGraph Workflow  │
│  ├─ Router Node      │ ← Gemini determines tools + instructions
│  ├─ Execution Node   │ ← Dual RAG retrieval + Antigravity agent
│  └─ Validator Node   │ ← Quality check loop (max 3 iterations)
└─────────┬───────────┘
          ▼
    Response to User
```

### Key Google AI Stack
- **Gemini 2.5 Flash** — backbone LLM for routing, execution, validation
- **MedGemma** — medical image/note clinical extraction
- **Gemini text-embedding-004** — 768d embeddings for vector search
- **Antigravity Runtime** — managed agent execution with custom AGENTS.md and skills
- **Google Interactions API** — agent invocation with inline environment config

### Infrastructure Stack
- **Google Cloud Storage (GCS)** — medical file uploads (replaces S3)
- **Cloud SQL PostgreSQL + pgvector** — vector embeddings + metadata (single DB, dual tables)
- **Cloud Run** — containerized backend (FastAPI) and frontend (Next.js)
- **Artifact Registry** — Docker image storage
- **Pulumi + ESC** — Infrastructure as Code with centralized secrets management

## 6. Hackathon Judging Alignment

| Criteria | How We Score |
|----------|-------------|
| **Innovation** | MedGemma + dual RAG for personal health — novel combination |
| **Technical Depth** | LangGraph orchestration, pgvector, Antigravity managed agents, Pulumi IaC |
| **Impact** | Directly addresses health literacy gap for 88M+ US adults |
| **Google AI Usage** | Gemini (Flash + Embeddings), MedGemma, Antigravity, Interactions API, GCS, Cloud Run, Cloud SQL |
| **Completeness** | Working E2E: upload → ingest → embed → query → respond → visualize |
| **Production Readiness** | Dockerized, IaC-deployed, secrets managed via Pulumi ESC |

## 7. What's NOT in Hackathon Scope

- HIPAA compliance (encryption at rest, PII redaction) — post-hackathon
- Voice call channel (Twilio/LiveKit) — post-hackathon
- Real MedGemma model deployment (using Gemini 2.5 Flash with medical system prompt as proxy)
- User authentication / JWT sessions — demo uses direct user selection
- Graph database integration — pgvector only for hackathon
