# 3-Hour Sprint Plan v2 — Zoie Hackathon

**Inherits from:** `project-docs/sprint-plan-3hr.md` (v1)
**PRD source:** `project-docs/prd-zoie-v2.md`
**Clock starts now. Every minute counts.**

---

## Scope Reality

v2 full scope = ~15.5 person-days. **3 hours = ~6 person-hours with two engineers parallel.** Build only the v2 minimum demo path; every "nice to have" gets cut. Six cut decisions are made *up front* in this plan, not at minute 165 when panic strikes.

**Cuts baked in (per `prd-zoie-v2.md §Further Notes`):**

1. ✂ MedlinePlus RAG → hardcoded plain-language templates for the 2 lab values shown in Act 3
2. ✂ Real MEDGemma on Vertex → keep Gemini 2.5 Flash with medical system prompt (already in code); MEDGemma stays a slide label
3. ✂ Interactive appointment booking → static "Confirmed: Dr. Patel, Thu" panel
4. ✂ Dashboard to one panel → only `SymptomTrend` chart; skip multi-tab restructure
5. ✂ Ingestion types from 5 → 2: lab PDF + voice note
6. ✂ Cron proactive scheduler → hidden admin button `force_trigger` fires the Act 1 escalation on cue
7. ✂ `grounding/` LOINC/RxNorm/ICD-10 reference tables → inline a 10-row Python dict for the 2 demo lab codes + 1 demo medication; full tables become v1.1
8. ✂ `visit_sessions` + `visit_turns` schema → write the interpreter session as a normal `user_medical_records` row with `file_type='visit_transcript'`; full schema later
9. ✂ Real-time streaming WebSocket → push-to-talk submits discrete audio blobs to a POST endpoint; no streaming required
10. ✂ HyDE loop 5 → **2 iterations**. Architecture stays; loop count is a one-line constant. Still strictly better than v1's literal-query single-shot retrieval.
11. ✂ Real MEDGemma reranker → `FlashReranker` shim behind the `MedicalReranker` interface (Gemini 2.5 Flash with a medical-reranker prompt). Drop-in swap when Vertex MEDGemma ships post-hackathon.
12. ✂ Image-embedding ingestion (`embed_image`) — out for 3hr; images continue through existing extraction-only path.
13. ✂ Telegram voice-note inbound — `force_trigger` and demo check-ins use text. Voice-note ingestion is v1.1.

Anything that survives those cuts is in scope below. Anything not below is **explicitly out** for the 3 hours.

---

## Current State Assessment (v2-relative)

### Already Built from v1 (DO NOT REBUILD)
- [x] FastAPI app + DDD domains: `agent_registry`, `ingestion`, `telegram`, `orchestration`
- [x] LangGraph workflow: Router → Execution → Validator with conditional edges
- [x] Ingestion pipeline: Gemini 2.5 Flash (with medical system prompt) → chunking → 768d embeddings → pgvector insert
- [x] pgvector retrieval: user-scoped + general medical KB queries
- [x] Next.js frontend: chat UI, FileUploader, Timeline, MetricTrends, TracePanel
- [x] Telegram bot domain (services, bot, router) — scaffolded
- [x] DB schema + init script (users, medical_records, embeddings, general_kb)
- [x] Pulumi infra (Cloud SQL, GCS, Cloud Run)

### NEW in v2 — must build in 3 hours
- [ ] **Live interpreter MVP** — push-to-talk page + audio POST endpoint + 2-prompt Gemini cleanup → rolling transcript display (Act 2 hero)
- [ ] **HyDE retrieval pipeline** — `domains/retrieval/` with 2-iteration HyDE loop + `FlashReranker` + Gemini 2.5 Pro synthesis. Replaces `execution_node`'s direct pgvector call. (agent memory context layer)
- [ ] **Citation chip rendering** in chat responses + product-invariant system instruction in `execution_node` + citation-presence check in `validator_node` (the trust posture)
- [ ] **Inline grounding mini-table** — Python dict with LOINC for LDL + glucose, RxNorm for lisinopril; surfaces in lab explanations as cited values
- [ ] **Demo seed for Ravi Kumar** — patient row, 7 days of Indian-English check-ins, scripted biometric arc, one lab PDF with LDL=160, one Rx bottle pre-ingested
- [ ] **`force_trigger` admin button** on the dashboard → fires the Act 1 proactive ping via Telegram (text-only)
- [ ] **`SymptomTrend.tsx`** — single chart of headache severity from check-in history

### Cut, fake, or stub for the 3 hours (do these later)
- Full grounding domain (LOINC/RxNorm/ICD-10 tables, MedlinePlus RAG, `wrap_with_citations`)
- `visit_sessions` + `visit_turns` schema
- Streaming STT via WebSocket
- `checkins/` domain proper (rule eval, Gemini Flash message composer for non-demo paths)
- **Real MEDGemma on Vertex AI as reranker** — replaced by `FlashReranker` shim behind same `MedicalReranker` interface
- **HyDE 5-iteration loop** — runs at 2 iterations; loop count is a constant, full canonical loop ships post-hackathon
- **Image-embedding ingestion path** (`embed_image`) — Gemini multimodal embeddings for images, retrievable alongside text. v1.1.
- **Telegram voice-note inbound** — demo uses text check-ins; voice-note ingestion is v1.1
- 3 of 5 ingestion specialists (rx_bottle, scan_report, md_note get one-prompt extraction reusing existing path)
- Appointment booking interactivity
- Multi-user, dyad, clinician-facing surface — all per PRD scope

---

## Sprint Blocks

### Block 1: Foundation (0:00 — 0:20) 🔴 CRITICAL
**Goal:** Backend + frontend both running. DB live. v1 chat path verified as fallback.

| # | Task | Time | Owner |
|---|------|------|-------|
| 1.1 | `docker compose up db` (pgvector ready in seconds) | 3 min | Backend |
| 1.2 | Confirm env: `GEMINI_API_KEY`, `POSTGRES_*`, `TELEGRAM_BOT_TOKEN` | 2 min | Backend |
| 1.3 | `make install` if needed, then `make dev` | 5 min | Both |
| 1.4 | Smoke test: POST `/api/chat` with a dummy query returns a response | 5 min | Backend |
| 1.5 | Smoke test: frontend loads at :3000, chat tab visible | 5 min | Frontend |

**Checkpoint:** v1 still works. Anything we ship on top is additive — if v2 features fail on stage, the v1 chat demo is the safety net.

---

### Block 2: Live Interpreter MVP (0:20 — 1:30) 🔴 CRITICAL — HERO OF ACT 2
**Goal:** Two humans push-to-talk into a shared device, see cleaned bidirectional transcript on screen.

70 minutes. Two engineers in parallel — backend owns the audio endpoint + cleanup prompts, frontend owns the page.

| # | Task | Time | Owner |
|---|------|------|-------|
| 2.1 | Create `backend/app/domains/interpreter/` with `router.py`, `services.py`, `schemas.py` | 5 min | Backend |
| 2.2 | Implement `POST /api/interpreter/turn` accepting `multipart/form-data` (audio blob + `role` field `'patient'` or `'doctor'`) | 10 min | Backend |
| 2.3 | In `services.py`, define two prompt constants `PROMPT_PATIENT_TO_CLINICAL` and `PROMPT_DOCTOR_TO_SIMPLIFIED` (copy verbatim from PRD §Implementation Decisions / interpreter) | 5 min | Backend |
| 2.4 | Call `client.models.generate_content` with `model="gemini-2.5-flash"`, audio Part from bytes, the role-appropriate prompt, `response_mime_type="application/json"`, request schema `{ cleaned: str, extracted: dict }` | 15 min | Backend |
| 2.5 | Return `{ raw_transcript, cleaned, extracted, role, turn_index }` — raw_transcript can be Gemini's own STT output if available, else echo input filename | 5 min | Backend |
| 2.6 | Wire `interpreter` router into `app/main.py` | 2 min | Backend |
| 2.7 | Create `frontend/src/features/interpreter/InterpreterPage.tsx` mounted at `/interpreter` route | 10 min | Frontend |
| 2.8 | Build push-to-talk: two big buttons (PATIENT / DOCTOR), MediaRecorder API on mousedown/touchstart, stop+upload on mouseup/touchend | 10 min | Frontend |
| 2.9 | POST audio blob + role to `/api/interpreter/turn`, append response to a rolling transcript list in component state | 10 min | Frontend |
| 2.10 | Render each turn as a row: speaker label badge + 3 panels (RAW / CLEANED / EXTRACTED chips). Tailwind only, no charts. | 7 min | Frontend |
| 2.11 | Sanity test: speak into laptop mic as patient ("I am having loose motions since two days"), confirm cleaned text reads like "diarrhea, onset 2 days ago" or similar | 3 min | Both |

**Checkpoint:** One device, two roles, push-to-talk, cleaned transcript appears within ~1.5s. **If this works, Act 2 is in the bag.**

**Failure escape hatch:** If Gemini Flash audio input has latency or accent issues, fall back to (a) browser Web Speech API for STT then send TEXT to Gemini Flash for cleanup, or (b) pre-record the demo audio and use a "DEMO MODE" toggle that submits pre-canned audio blobs on button press. Time-box the diagnosis to 10 min before falling back.

---

### Block 3: Grounding + Retrieval Pipeline (1:30 — 2:20) 🔴 CRITICAL — TRUST + MEMORY LAYER
**Goal:** Agent memory context layer is live (HyDE loop + reranker + Pro synthesis), every medical claim shows a clickable citation chip, validator enforces citations.

50 minutes. Three parallel tracks: BE1 owns the retrieval pipeline + execution_node swap (critical path), BE2 owns grounding inline + ingestion lookups, FE owns the citation chip.

| # | Task | Time | Owner |
|---|------|------|-------|
| 3.0 | Create `backend/app/domains/retrieval/` with `services.py`, `schemas.py`. Define `MedicalReranker` ABC + `FlashReranker` impl + `MedGemmaReranker` stub (raises `NotImplementedError` with v1.1 Vertex deployment note) | 8 min | BE1 |
| 3.0b | Implement `retrieve(user_id, query, k_iterations=2, top_k=2)`: HyDE loop — each iteration calls Gemini 2.5 Flash to generate a hypothetical answer (conditioned on accumulated `contexts[]`), embed it, search pgvector (user records + general KB), dedup append. Reuse existing embedding + pgvector helpers from `agent_registry` | 12 min | BE1 |
| 3.0c | Implement `FlashReranker.rerank(query, contexts)` — one Gemini 2.5 Flash call with a medical reranker prompt + JSON schema `[{record_id, score, reason}]`, return top 2 sorted by score | 8 min | BE1 |
| 3.0d | Modify `execution_node` in `orchestration/graph.py`: replace direct pgvector call with `retrieval.retrieve(user_id, query)`. Swap synthesis model to `gemini-2.5-pro` for the final grounded answer. Top-2 contexts feed the existing `[Grounded Medical Context]` block | 7 min | BE1 |
| 3.1 | Add `INVARIANT_SYSTEM_INSTRUCTION` constant to `orchestration/graph.py` — no-uncited-medical-synthesis rule + boundary line, verbatim from PRD. Append to `execution_node` system instruction before the context block | 3 min | BE1 |
| 3.2 | In `validator_node`, regex check: medical keywords (`mg/dL`, `cholesterol`, `glucose`, `BP`, `HbA1c`) AND no citation token (`LOINC:`, `RxNorm:`, `MedlinePlus:`, `[doc:`, `ICD-10:`) → `validation_passed=false`, feedback "missing citation" | 7 min | BE1 |
| 3.4 | Create `backend/app/domains/grounding/inline.py` — Python dict for LDL, total cholesterol, fasting glucose, HbA1c, systolic BP, diastolic BP (LOINC + unit + ref range) + lisinopril (RxNorm + class + side effects) | 8 min | BE2 |
| 3.5 | In `ingestion/services.py` `process_medical_file_with_medgemma`: after Gemini returns `ClinicalSummary`, look up each `lab_metric.metric` and each `medication` against `grounding.inline`, append matched LOINC/RxNorm into the chunk text that gets embedded so citation tokens surface in retrieved context | 10 min | BE2 |
| 3.6 | Frontend: `components/ui/CitationChip.tsx` — small badge (e.g. `LOINC:13457-7`) that opens a `Dialog` with inline metadata on click. In `MessageBubble.tsx`, regex-detect citation tokens in agent responses and render as `<CitationChip />` | 15 min | FE |
| 3.7 | Smoke test: ask "what does my LDL value mean?" against Ravi's seed (post-Block 4 — defer if needed) → confirm a relevant context is retrieved by HyDE, reranked to top 2, and cited in the Pro-synthesized answer | 5 min | BE1 |

**BE1 critical path:** 3.0 → 3.0b → 3.0c → 3.0d → 3.1 → 3.2 → 3.7 ≈ 50 min sequential. BE2 (3.4 + 3.5 = 18 min) and FE (3.6 = 15 min) run fully in parallel.

**Checkpoint:** Ask the chat "what does my LDL value mean?" → HyDE generates a hypothetical, retrieves Ravi's lab + an inline-grounding chunk, reranker returns top 2, Pro synthesizes with `LOINC:13457-7` and `[doc:...]` clickable chips, plus the boundary line *"I'm not a doctor..."* visible.

**Failure escape hatches:**
- HyDE loop slow or noisy → drop to 1 iteration (one-line constant). Pipeline interface unchanged.
- `FlashReranker` produces nonsense → fall back to deterministic vector-similarity ranking (no LLM rerank). Comment that MEDGemma replaces this in v1.1.
- Pro synthesis adds too much latency → swap back to Flash for synthesis. Quality drop is real but structure still demonstrates.
- Validator regex causes loops → `needs_validation=False`, rely on prompt-layer invariant only.

---

### Block 4: Demo Surface (2:20 — 2:45) 🟡 IMPORTANT — ACT 1 + ACT 3 GLUE
**Goal:** Ravi Kumar exists with believable data. The proactive escalation button works. Lab upload still works. The dashboard shows one symptom trend chart.

25 minutes. BE + FE in parallel.

| # | Task | Time | Owner |
|---|------|------|-------|
| 4.1 | `backend/app/core/seed_demo.py`: insert user "Ravi Kumar" with `phone='+15551234567'`, `telegram_id='ravi_demo'`. Insert 7 daily check-in `user_medical_records` rows with `file_type='checkin'` and Indian-English text + headache severity 3, 4, 5, 6, 7, 5, 7 over 7 days. Insert one lab PDF record with `extracted_summary` containing LDL=160, fasting glucose=108. Insert one Rx record for lisinopril. Generate embeddings for all. Idempotent: skip if user exists. | 12 min | Backend |
| 4.2 | Run the seed once: `python -m app.core.seed_demo` | 2 min | Backend |
| 4.3 | `POST /api/checkins/force_trigger?user_id=...` — backend endpoint that (a) fetches the user's recent context, (b) calls Gemini 2.5 Flash with a "compose a Hindi-English check-in about elevated heart rate" prompt, (c) sends the result to the user's Telegram chat via the existing bot service. **Hidden** — no UI link, called from the admin button only. | 8 min | Backend |
| 4.4 | Frontend: small `[Demo: trigger proactive ping]` button on the dashboard, gated by `?demo=1` query param, calls `/api/checkins/force_trigger` | 5 min | Frontend |
| 4.5 | `frontend/src/features/dashboard/SymptomTrend.tsx` — fetch the user's check-in records, plot headache severity over time using recharts (already in deps). Click a point → list contributing check-ins. | 12 min | Frontend |

**Checkpoint:** Open dashboard with `?demo=1`. See Ravi's last 7 days of headache severity rising. Click demo button → patient's Telegram pings with a Hindi-English check-in. Forward a lab PDF to the bot → see it explained back with citation chips, powered end-to-end by the HyDE retrieval pipeline.

**Time pressure escape hatch:** If `force_trigger` Telegram send breaks, fall back to displaying the composed message in a frontend toast/alert — keeps the scripted Act 1 moment visible to the audience.

---

### Block 5: Rehearsal + Submission (2:45 — 3:00) 🔴 CRITICAL
**Goal:** Demo runs cleanly twice in a row. Submission is in.

| # | Task | Time | Owner |
|---|------|------|-------|
| 5.1 | Full rehearsal #1: Act 1 (Telegram check-in + force_trigger + lab drop) → Act 2 (interpreter, 3 patient turns + 2 doctor turns) → Act 3 (dashboard symptom trend + lab citation chips + HyDE-grounded answer) | 5 min | All |
| 5.2 | Fix the worst breakage from rehearsal #1 | 4 min | All |
| 5.3 | Rehearsal #2 + final polish | 3 min | All |
| 5.4 | Git commit + push, submit on hackathon platform | 3 min | One |

**Checkpoint:** Submitted with a working demo path. If Block 5 reveals a fatal breakage, fall back to the v1 demo path — it still works because Block 1 verified it.

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Postgres not available | `docker compose up db` — pgvector in seconds (inherited from v1 plan) |
| Gemini Flash audio input slow or mangling Indian English | Web Speech API STT in browser → send text to Flash for cleanup; or DEMO MODE with pre-recorded audio blobs |
| Antigravity Interactions API not accessible | Direct `client.models.generate_content` is already the fallback path in `execution_node` |
| Interpreter page totally fails on stage | The Act 2 hero is gone, but Acts 1 + 3 still demo via the existing chat + Telegram flows |
| Telegram voice-note ingestion breaks | Demo uses text check-ins by design — voice-note ingestion is v1.1 (per cut #13) |
| Validator citation check causes infinite loops | `needs_validation=False` for the demo; rely on prompt-layer invariant only |
| **HyDE loop too slow (Flash × 2 + embed + search ≈ 3–4s before rerank)** | Loop count is a constant — drop 2 → 1, or skip HyDE entirely and use literal-query retrieval. Pipeline interface unchanged. |
| **Gemini 2.5 Pro synthesis adds latency on every chat turn** | Per-turn budget acceptable for Act 3 single answer; if it bites, swap synthesis back to Flash. Quality drop is real but structure still demonstrates. |
| **`FlashReranker` produces noisy top-2** | Fall back to deterministic vector-similarity ranking (no LLM rerank). Comment that MEDGemma replaces this in v1.1. |
| MEDGemma references in pitch don't match reality | MEDGemma is spec'd as the reranker behind the `MedicalReranker` interface; the `FlashReranker` shim is honest on stage — "Gemini Flash today, Vertex MEDGemma in v1.1 behind the same interface." |
| Cloud Run deploy fails | Demo locally via `docker compose up` — still shows production-ready architecture |
| Frontend demo data sufficient | Block 4.1 seeds Ravi explicitly; v1's hardcoded Maria demo data is the secondary fallback |
| GCS not configured | Storage falls back to local filesystem automatically (inherited from v1) |

---

## Demo Script (3 minutes)

> *"Zoie is a personal health interpreter and memory layer for immigrant families navigating US healthcare. Built around our user Ravi, a Hindi-English-speaking patient managing hypertension and recent symptoms."*

### Act 1 — Before the visit (60s)
1. **[10s]** Show Ravi's Telegram chat — Zoie messaged this morning in his register: *"Ravi-ji, good morning, how are you feeling today?"*
2. **[15s]** Ravi replies with a voice note in Indian English: *"Head was paining yesterday also today, some giddiness in morning."* Bot replies with a structured confirmation chip ("Logged: headache + orthostatic dizziness").
3. **[10s]** Cut to dashboard — open with `?demo=1`. Show 7-day headache severity trend rising. Resting heart rate scripted to be elevated for last 3 days.
4. **[10s]** Click the hidden `[Demo: trigger proactive ping]` button. Telegram lights up with a Zoie message: *"Ravi-ji, I noticed your heart rate has been higher these last few days and headache is continuing. Want me to set up an appointment with Dr. Patel?"*
5. **[15s]** Ravi drops a lab PDF into the chat. Bot replies: *"Looks like your lipid panel from May 15. LDL Cholesterol 160 mg/dL [LOINC:13457-7] — that's higher than the typical reference range of <100. Want me to explain, or save this for Thursday's appointment?"* — citation chip clickable.

### Act 2 — During the visit (90s)
6. **[10s]** Switch to `/interpreter` on the laptop. One shared device on a desk between two humans on stage (or two members of the team playing roles).
7. **[25s]** Three patient turns:
   - Press PATIENT, *"Doctor, I am having loose motions since two days, no fever, and giddiness when I stand up."* → screen renders: RAW transcript / CLEANED: "Diarrhea, onset 2 days ago, no fever, orthostatic dizziness" / EXTRACTED chips: `symptom: diarrhea | onset: 2d | associated: no fever, orthostatic dizziness`.
   - Press PATIENT, *"Also my BP, I checked at home, it was 140 by 90 since fortnight."* → CLEANED: "Self-reported home BP 140/90, sustained for two weeks" / EXTRACTED: `metric: systolic_bp=140 | diastolic_bp=90 | duration: 14d`.
   - Press PATIENT, *"I want to prepone the cardiology, can it be done?"* → CLEANED: "Patient requests to reschedule cardiology appointment earlier." / EXTRACTED: `request: reschedule | specialty: cardiology`.
8. **[25s]** Two doctor turns:
   - Press DOCTOR, *"Let's get a CBC and a BMP today, hold the lisinopril for 48 hours, and follow up in one week."* → CLEANED for patient: *"Doctor wants two standard blood tests today — one checks your blood cells, one checks your kidneys and salts. Stop your BP medicine (lisinopril) for two days. Come back in one week."* / EXTRACTED: `tests_ordered: CBC, BMP | medications_paused: lisinopril (48h) | followup: 1 week`.
   - Press DOCTOR, *"And drink more water — at least two liters a day until the diarrhea stops."* → CLEANED for patient: *"Drink more water, at least two big bottles a day, until your loose motions stop."*
9. **[10s]** End-of-visit click → all turns persist to Ravi's record as `file_type='visit_transcript'`. Show the new row appearing in the Timeline tab.

### Act 3 — After the visit (30s)
10. **[15s]** Cut to Ravi's Telegram a few hours later. Forward a lab result. Bot replies in plain Hindi-English: *"Your blood cell test came back normal. The salt test shows your potassium is a little low (3.2 mmol/L) — Dr. Patel asked us to watch this. Source: [doc:lab_may23.pdf]. This might be worth mentioning at your follow-up next week — should I add it to your visit list?"*
11. **[10s]** Show dashboard SymptomTrend again — same 7-day chart, now with today's check-in added.
12. **[5s]** Close on the boundary line: *"I'm not a doctor — I can help you understand and remember. Let's bring this to Dr. Patel on Thursday."*

### Close (10s)
> *"Zoie is the memory and interpreter layer between immigrant families and US healthcare. Every claim is cited. Every advice-shaped sentence routes back to the doctor. Powered by Gemini 2.5 Flash, Antigravity managed agents, pgvector, LangGraph, and a product invariant that makes AI in medicine defensible."*

---

## What This Plan Deliberately Doesn't Cover

Per `prd-zoie-v2.md §Out of Scope` — restated here so nobody adds them at minute 90:

- No gbrain integration
- No graph DB
- No Multi-user / dyad / shared household
- No clinician-facing surface or magic-link summaries
- No telehealth / Twilio / real telephony
- No WhatsApp
- No real Apple Health ingestion (scripted on stage)
- No MedlinePlus RAG scrape
- No TTS in the interpreter (text-only both directions)
- No streaming WebSocket interpreter (push-to-talk POST endpoint only)
- No `visit_sessions` / `visit_turns` schema migration (reuse existing tables)
- No 5-type ingestion router (only 2 of 5: lab PDF + voice note)
- No interactive appointment booking (static confirmation panel only)
- No multi-tab dashboard restructure (`SymptomTrend` added; rest of v1 dashboard untouched)
- No `checkins/` rule engine (only `force_trigger` admin endpoint)
- No real MEDGemma on Vertex (`FlashReranker` shim behind `MedicalReranker` interface)
- No HyDE 5-iteration canonical loop (runs at 2 iterations for the sprint)
- No image-embedding ingestion path (`embed_image` is v1.1)
- No Telegram voice-note inbound (text-only demo path)

If a teammate proposes building one of these mid-sprint, point them at this list.
