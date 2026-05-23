# 3-Hour Sprint Plan v2 — Zoie Hackathon

**Inherits from:** `project-docs/sprint-plan-3hr.md` (v1)
**PRD source:** `project-docs/prd-zoie-v2.md`
**Clock starts now. Every minute counts.**

---

## v2.1 — Design Draft Reconciliation (applied)

Designer drafts at `~/Downloads/stitch_zoie_ai_health_companion/` (11 screens) changed scope. Locked decisions:

- **Persona:** keep Ravi Kumar narrative; adopt designer's Apple-Watch data shape on top
- **Voice surface:** *one* `/talk` orb screen, **two modes**, **Gemini Live API streaming**, **Wispr-style cleanup discipline (no EXTRACTED panel, no structured fields, no register simplification)**. Visit mode does **bidirectional cross-language translation**: `PROMPT_PATIENT_TO_ENGLISH` (source language → English for doctor) and `PROMPT_DOCTOR_TO_PATIENT_LANG` (English → patient's `preferred_language`). Drug names / dosages / numerals preserved verbatim in English on both sides. Replaces v2.0's symmetric two-button push-to-talk UI. Per `[[project-interpreter-wispr-scope]]` + `[[project-google-stack-only]]` + `[[reference_freeflow_architecture]]`.
- **Act 1 escalation:** fires *both* in-app (Vitals & Alerts AFib card) and Telegram, not Telegram-only
- **Dashboard:** multi-tab restructure is back — `Talk / Insights / Medical Timeline / Settings(stub)` per designer IA (reverses v2.0 cut #4)
- **Biometric data:** new `user_biometrics` table; 7 days of HRV / resting HR / sleep / steps / respiratory / skin-temp seeded for Ravi, with scripted HR spike to 113 BPM on demo day
- **Health Status Summary:** hardcoded paragraph in seed (no live LLM call), surfaces atop Medical Timeline
- **Settings page:** static stub only (Profile name + connections toggles disabled) — visual fidelity, no logic

Block-level impact: Block 2 expands to **90 min** (Gemini Live API session + bidirectional prompts + two-layer vocab + Wispr fallback path + cleanup tests). Block 4 grows +12min (biometric seed + Vitals/Insights cards), reclaimed by trimming Settings to a stub + skipping post-hackathon items. Overall sprint: Block 2 runs 0:20→1:50, Block 3 shifts to 1:50→2:35, Block 4 (Tier 1 only) compresses to 2:35→2:55, Block 5 (rehearsal) drops to 5 min — *single rehearsal only* before submission. Real risk.

---

## Scope Reality

v2 full scope = ~15.5 person-days. **3 hours = ~6 person-hours with two engineers parallel.** Build only the v2 minimum demo path; every "nice to have" gets cut. Six cut decisions are made *up front* in this plan, not at minute 165 when panic strikes.

**Cuts baked in (per `prd-zoie-v2.md §Further Notes`):**

1. ✂ MedlinePlus RAG → hardcoded plain-language templates for the 2 lab values shown in Act 3
2. ✂ Real MEDGemma on Vertex → keep Gemini 2.5 Flash with medical system prompt (already in code); MEDGemma stays a slide label
3. ✂ Interactive appointment booking → static "Confirmed: Dr. Patel, Thu" panel
4. ~~✂ Dashboard to one panel → only `SymptomTrend` chart; skip multi-tab restructure~~ — **reversed by v2.1.** Designer drew the IA: `Talk / Insights / Medical Timeline / Settings(stub)`. SymptomTrend joins sibling biometric cards on Insights.
5. ✂ Ingestion types from 5 → 2: lab PDF + voice note
6. ✂ Cron proactive scheduler → hidden admin button `force_trigger` fires the Act 1 escalation on cue
7. ✂ `grounding/` LOINC/RxNorm/ICD-10 reference tables → inline a 10-row Python dict for the 2 demo lab codes + 1 demo medication; full tables become v1.1
8. ✂ `visit_sessions` + `visit_turns` schema → write the interpreter session as a normal `user_medical_records` row with `file_type='visit_transcript'`; full schema later
9. ~~✂ Real-time streaming WebSocket → push-to-talk submits discrete audio blobs to a POST endpoint; no streaming required~~ — **reversed by Wispr-scope + Google-stack memos.** Block 2 now uses **Gemini Live API** for streaming audio. Hold-to-record UX renders FreeFlow-style "wait and settle" (no partials; RAW + CLEANED settle together on release). Fallback (still Google-stack): Gemini Flash non-streaming audio understanding.
10. ✂ HyDE iteration loop entirely. v1 ships `k_iterations=1` (literal-query path through the same `retrieve()` interface). Architecture and pitch hold; the 2-iter+ variant lands in v1.1 with a tuned diversity prompt and eval harness.
11. ✂ Real MEDGemma reranker → `FlashReranker` shim behind the `MedicalReranker` interface (Gemini 2.5 Flash with a medical-reranker prompt). Drop-in swap via `get_reranker()` factory + `RERANKER` env var when Vertex MEDGemma ships post-hackathon.
12. ✂ Image-embedding ingestion (`embed_image` + separate `user_image_embeddings` table) — out for 3hr; images continue through existing extraction-only path. Cross-modal retrieval (text query → image hit) requires a unified multimodal embedding model and is v1.2.
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
- [ ] **One-orb `/talk` MVP, two modes, Gemini Live API streaming, Wispr-style cleanup discipline.** Designer's glowing-orb page with a `Self check-in | Clinic visit` mode pill. In Visit mode a Patient↔Doctor role chip appears under the orb. **Visit mode = bidirectional cross-language translation:** `PROMPT_PATIENT_TO_ENGLISH` (source lang → English) and `PROMPT_DOCTOR_TO_PATIENT_LANG` (English → patient's `preferred_language`). Both share FreeFlow-derived hard-contract / disfluency / EMPTY-sentinel discipline. **Output shape: `{ cleaned: str }` only — no EXTRACTED structured fields.** Cleaned transcripts persist as `user_medical_records` rows with `file_type='visit_transcript'`.
- [ ] **HyDE retrieval pipeline** — `domains/retrieval/` with HyDE loop + `FlashReranker` + Gemini 2.5 Pro synthesis. Replaces `execution_node`'s direct pgvector call. (agent memory context layer)
- [ ] **Citation chip rendering** in chat responses + product-invariant system instruction in `execution_node` + citation-presence check in `validator_node` (the trust posture)
- [ ] **Inline grounding mini-table** — Python dict with LOINC for LDL + glucose, RxNorm for lisinopril; surfaces in lab explanations as cited values
- [ ] **Demo seed for Ravi Kumar (expanded)** — patient row, 7 days of Indian-English check-ins, 7 days of biometric snapshots (HRV / resting HR / peak HR with demo-day spike to 113 BPM / sleep / steps / respiratory / skin temp), one lab PDF with LDL=160, one Rx bottle for lisinopril, one AFib alert row, one hardcoded AI Health Status Summary row
- [ ] **`user_biometrics` schema** — new table (one row per day, columns per metric); added to `db_init.sql`. Charts query directly; retrieval still uses `user_record_embeddings` for narrative content
- [ ] **`force_trigger` admin endpoint** — fires Act 1 proactive ping via Telegram *and* writes an `alert` row that surfaces as the AFib card on `/vitals`
- [ ] **`/insights` page** — designer-spec'd cards: SymptomTrend, HRV trend, Resting HR, Sleep, Steps. Recharts.
- [ ] **`/vitals` page (Vitals & Alerts)** — AFib alert card (renders when `alert` row exists) + Cardiovascular Resilience / Autonomic Recovery / Basal Variations cards
- [ ] **`/medical-timeline` page** — designer-spec'd timeline with AI Health Status Summary card at top, then lab/Rx/check-in entries in reverse-chronological list
- [ ] **`/settings` stub page** — static layout matching designer; no live logic

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

### Block 2: Live Interpreter MVP — Gemini Live API + Wispr-Style Cleanup (0:20 — 1:50) 🔴 CRITICAL — HERO OF ACT 2

**Goal:** Two humans share one laptop during a clinic visit. Patient speaks in their source language (`hi-en-IN` Indian English / `hi-IN` Hindi / `zh-CN` Mandarin), Zoie streams audio via **Gemini Live API**, applies a FreeFlow-derived Wispr-cleanup prompt, and renders **translated English** on screen for the doctor. Doctor speaks American English; same orb, role chip flipped, output is **translated into the patient's `preferred_language`** with drug names / dosages / numerals preserved verbatim in English. Zoie does **not** simplify clinical register, does **not** extract structured medical fields, and does **not** synthesize medical claims (citation invariant doesn't apply here — we're transcribing humans).

90 minutes. Two engineers in parallel — backend owns the Live API session manager + bidirectional cleanup prompts + vocab injection, frontend owns the orb + wait-and-settle UX.

| # | Task | Time | Owner |
|---|------|------|-------|
| 2.1 | Create `backend/app/domains/talk/` with `router.py`, `services.py`, `prompts.py`, `vocab.py`, `schemas.py`. Add `users.preferred_language` migration touch (already present from v2.1) | 5 min | Backend |
| 2.2 | `prompts.py` — define `PROMPT_PATIENT_TO_ENGLISH(source_language, vocab_block)` and `PROMPT_DOCTOR_TO_PATIENT_LANG(target_language, vocab_block)`. Both port FreeFlow's `PostProcessingService.swift:32-92` hard-contract: cleanup-only output, no markdown, `EMPTY` sentinel for filler-only input, self-correction collapsing, **preserve drug names / dosages / numerals / lab abbreviations VERBATIM in English**, return `cleaned` text only. See `[[project-interpreter-wispr-scope]]` | 12 min | Backend |
| 2.3 | `vocab.py` — two layers. (a) `LANGUAGE_VOCAB` hardcoded Python dict keyed by `hi-en-IN \| hi-IN \| zh-CN \| en-US`, each value = list of idiom + phrasing pairs. (b) `build_patient_vocab(user_id)` queries `user_medical_records` for current medications, diagnoses, PCP name from existing extracted_summary JSON. Composes a single `vocab_block` string injected into the prompt as "high-priority terms — use these spellings exactly" (port from FreeFlow `PostProcessingService.swift:357-362,582-599`) | 10 min | Backend |
| 2.4 | `services.py` — Gemini Live API session manager. One `LiveSession` per turn: opens streaming session with `gemini-2.5-flash-live` (or current Live model), accumulates audio chunks, on session close gets finalized transcript, then runs Gemini 2.5 Flash cleanup pass with role-appropriate prompt + composed vocab block. Returns `{ cleaned: str, raw_transcript: str, role, turn_index }` — `cleaned` only is required, raw is convenience for the FreeFlow-style RAW pane. **No EXTRACTED field.** | 18 min | Backend |
| 2.5 | `router.py` — WebSocket endpoint `WS /api/talk/stream` for the Live API session (audio in → final transcript out). REST companion `POST /api/talk/finalize` accepts already-finalized text + `{mode, role, source_language, target_language}` for the Flash cleanup pass alone (fallback path when Live API streaming fails). Wire both in `main.py`. Self-checkin mode is a special case: `role='patient'`, `source_language=user.preferred_language`, `target_language='en-US'`, cleaned text persists as `user_medical_records` row `file_type='checkin'` | 12 min | Backend |
| 2.6 | Fallback path: if Live API session fails to open within 2s, frontend falls back to MediaRecorder → POST audio blob to `/api/talk/finalize_audio` (REST, Gemini 2.5 Flash non-streaming audio understanding). Backend route mirrors 2.4's cleanup pipeline. Both paths land at the same `cleaned` shape. (Both Google-stack per `[[project-google-stack-only]]`.) | 8 min | Backend |
| 2.7 | Wispr-cleanup sanity tests (`backend/tests/test_talk_cleanup.py`): (a) filler-only input → `EMPTY` sentinel respected (b) drug name "lisinopril 10mg" survives verbatim through both directions (c) Indian English idiom "loose motions" translates to "diarrhea" in patient→English path (d) Hindi sentence with embedded English numeral "140 by 90" preserves "140/90" verbatim. Mock the Live API + Flash client | 10 min | Backend |
| 2.8 | Frontend `/talk` route: designer's glowing orb (`a_minimalist_glowing_pulsating_fluid_3d_sphere`) centered, header mode pill `Self check-in \| Clinic visit`, in Visit mode a Patient↔Doctor role chip beneath. Patient/Doctor role determines `source_language`/`target_language` send-side. | 12 min | Frontend |
| 2.9 | FreeFlow-style **wait-and-settle** UX: hold orb to record, RAW panel shows "listening…" pulse during recording (NO partials rendered), on release RAW + CLEANED settle together once Live API returns finalized transcript + Flash cleanup completes. Single state transition per turn. Reference: FreeFlow `RealtimeTranscriptionService.swift:50` captures partials but `AppState.swift:2438-2446` consciously doesn't render them | 10 min | Frontend |
| 2.10 | TranscriptPane: each turn = speaker badge + RAW (source-language text) + CLEANED (translated text). **No EXTRACTED chips.** Tailwind only. Persist `cleaned` to backend at session end. | 8 min | Frontend |
| 2.11 | End-to-end sanity test: Self check-in mode in `hi-en-IN`, hold orb, say "Head was paining since morning, BP feels little high" → CLEANED reads "Headache since morning, blood pressure feels slightly elevated" with no EXTRACTED. Then flip to Visit mode, Patient role: "Doctor, I am having loose motions since two days" → CLEANED reads "Doctor, I have had diarrhea for two days." Drug names round-trip on Doctor side: "Take lisinopril 10mg once daily" → in `hi-IN` patient view, "lisinopril 10mg" stays in English. | 5 min | Both |

**Checkpoint:** Live API streaming works end-to-end on the laptop. Hold orb → "listening…" pulse → release → RAW + CLEANED settle together within ~2-4s. Vocab block populated from Ravi's seeded meds (`lisinopril`) + diagnoses. Drug names preserve verbatim across translation. **No EXTRACTED panel visible anywhere.**

**Failure escape hatches (all Google-stack):**
1. Gemini Live API session fails → frontend falls back to MediaRecorder + REST `/api/talk/finalize_audio` (Flash non-streaming audio understanding). UX absorbs the change — slightly longer wait, no functional difference.
2. Flash cleanup adds latency → drop the per-patient vocab layer first (keep language-pack only). Cleanup quality dips but turn latency drops.
3. Live API model not yet GA in our region → ship the REST fallback as primary; demo says "streaming-capable, REST today, Live API in v1.1" — honest framing.
4. If `EMPTY` sentinel logic gets fragile → just render whatever Flash returns; the cost is occasional "..." renders, not demo-breaking.

**Demo-script implication:** Old "loose motions → diarrhea" wow moment is preserved (idiom normalization is in-scope within source language) AND we now lean on the bilingual translation itself as the demo's tech beat — *Hindi spoken on patient side → English on doctor side, on stage, in real time*. See updated Act 2 below.

---

### Block 3: Grounding + Retrieval Pipeline (1:30 — 2:20) 🔴 CRITICAL — TRUST + MEMORY LAYER
**Goal:** Agent memory context layer is live (HyDE loop + reranker + Pro synthesis), every medical claim shows a clickable citation chip, validator enforces citations.

50 minutes. Three parallel tracks: BE1 owns the retrieval pipeline + execution_node swap (critical path), BE2 owns grounding inline + ingestion lookups, FE owns the citation chip.

| # | Task | Time | Owner |
|---|------|------|-------|
| 3.0 | Create `backend/app/domains/retrieval/` with `services.py`, `schemas.py`. Define `MedicalReranker` ABC + `FlashReranker` impl + `MedGemmaReranker` stub (raises `NotImplementedError` with v1.1 Vertex note) + `get_reranker()` factory reading `RERANKER` env var (default `flash`) | 8 min | BE1 |
| 3.0b | Implement `retrieve(user_id, query, k_iterations=1, top_k=2)`: literal-query path — embed query → pgvector dual-search (user records + general KB in parallel via `asyncio.gather`) → dedup → return contexts. HyDE loop scaffolding present (conditional on `k_iterations>1`) but defaults to 1 for v1 | 5 min | BE1 |
| 3.0c | Implement `FlashReranker.rerank(query, contexts)` — one Gemini 2.5 Flash call with a medical reranker prompt + JSON schema `[{record_id, score, reason}]`, return top 2 sorted by score | 8 min | BE1 |
| 3.0d | Modify `execution_node` in `orchestration/graph.py`: replace direct pgvector call with `retrieval.retrieve(user_id, query)`. Cap validator retries to 1: first attempt uses `gemini-2.5-pro`, retry path falls back to `gemini-2.5-flash` with a stricter "you must cite" instruction. Top-2 contexts feed the existing `[Grounded Medical Context]` block | 8 min | BE1 |
| 3.0e | **Re-smoke** Block 1.4 chat against Pro-backed `execution_node` — POST a dummy query, verify response shape + latency budget (<5s). Catches model auth / format regressions before Block 4 | 3 min | BE1 |
| 3.0f | **Retrieval fixture tests** (`backend/tests/test_retrieval.py`): (a) `FlashReranker.rerank()` returns top-2 when Flash output is valid JSON, gracefully falls back to vector-similarity when JSON is malformed, (b) `retrieve()` returns empty `final_top_k` (not raise) when pgvector returns 0 hits, (c) dedup across the dual-search collapses identical record_ids. Mock the Gemini client | 8 min | BE1 |
| 3.1 | Add `INVARIANT_SYSTEM_INSTRUCTION` constant to `orchestration/graph.py` — no-uncited-medical-synthesis rule + boundary line, verbatim from PRD. Append to `execution_node` system instruction before the context block | 3 min | BE1 |
| 3.2 | In `validator_node`, value-pattern regex check: `\b\d+(\.\d+)?\s*(mg\/dL\|mmol\/L\|mmHg\|bpm\|%)\b` matched in response AND no citation token (`LOINC:`, `RxNorm:`, `MedlinePlus:`, `[doc:`, `ICD-10:`) → `validation_passed=false`, feedback "missing citation." Quantitative-only trigger avoids false positives on bare keyword mentions | 5 min | BE1 |
| 3.4 | Create `backend/app/domains/grounding/inline.py` — Python dict for LDL, total cholesterol, fasting glucose, HbA1c, systolic BP, diastolic BP (LOINC + unit + ref range) + lisinopril (RxNorm + class + side effects) | 8 min | BE2 |
| 3.5 | In `ingestion/services.py` `process_medical_file_with_medgemma`: after Gemini returns `ClinicalSummary`, look up each `lab_metric.metric` and each `medication` against `grounding.inline`, append matched LOINC/RxNorm into the chunk text that gets embedded so citation tokens surface in retrieved context | 10 min | BE2 |
| 3.6 | Frontend: `components/ui/CitationChip.tsx` — small badge (e.g. `LOINC:13457-7`) that opens a `Dialog` with inline metadata on click. In `MessageBubble.tsx`, regex-detect citation tokens in agent responses and render as `<CitationChip />` | 15 min | FE |
| 3.7 | End-to-end smoke (post-Block 4): ask "what does my LDL value mean?" against Ravi's seed → confirm retrieve→rerank→Pro path returns cited answer with clickable chip | 5 min | BE1 |

**BE1 critical path:** 3.0 → 3.0b → 3.0c → 3.0d → 3.0e → 3.0f → 3.1 → 3.2 → 3.7 ≈ 53 min sequential. BE2 (3.4 + 3.5 = 18 min) and FE (3.6 = 15 min) run fully in parallel.

**Checkpoint:** Ask the chat "what does my LDL value mean?" → retrieval returns Ravi's lab + an inline-grounding chunk, FlashReranker picks top 2, Pro synthesizes the answer with `LOINC:13457-7` and `[doc:...]` clickable chips, boundary line *"I'm not a doctor..."* visible. Re-smoke (3.0e) confirms baseline before Block 4. Three retrieval fixture tests (3.0f) green.

**Failure escape hatches:**
- `FlashReranker` produces nonsense → 3.0f covers this with a graceful fallback to vector-similarity ranking. No code change needed at demo time.
- Pro synthesis adds too much latency → swap to Flash on first attempt too (one constant change in 3.0d). Quality drop is real but structure still demonstrates.
- Validator regex causes loops → cap is already 1 (per 3.0d); set `needs_validation=False` if even one retry is too noisy.
- Pgvector dual-search slow → drop general-KB search; user-records-only is the demo's critical path.

---

### Block 4: Demo Surface (2:20 — 2:45) 🟡 IMPORTANT — ACT 1 + ACT 3 GLUE
**Goal:** Ravi Kumar exists with believable data. The proactive escalation surfaces in the AFib alert card + Telegram. The four-page app shell (Talk / Insights / Medical Timeline / Settings) renders designer-spec'd content.

25 minutes wall-clock, but FE teammate's Block-4 work starts overlapping from ~1:30 once Block 2 UI lands (`/talk` done). BE seed + endpoints serial ≈ 39 min, fits in the 25-min window if 4.1 starts at 2:00 from spare BE cycles during Block 3.

**Priority tiers** (ship in order; stop where time runs out):

- **Tier 1 (must ship, ≈40 min total):** 4.0 schema, 4.1 seed (just user + check-ins + biometrics + AFib alert + lab + Rx), 4.3 force_trigger, 4.4 demo button, 4.6 Vitals page with alert card, 4.9 app shell with left nav
- **Tier 2 (ship if Tier 1 done):** 4.5 Insights cards (SymptomTrend + HRV + Resting HR + Sleep), 4.7 Medical Timeline, 4.10 convenience endpoints
- **Tier 3 (only if running ahead):** 4.5 remaining biometric cards (steps, respiratory, skin temp), 4.8 Settings stub, Health Status Summary card

| # | Task | Time | Owner |
|---|------|------|-------|
| 4.0 | **Schema migration:** add `user_biometrics` table to `db_init.sql` (cols: id, user_id, recorded_at, source, hrv_ms, resting_hr_bpm, peak_hr_bpm, steps, sleep_score, sleep_hours, respiratory_rate, skin_temp_delta_f, notes). Index `(user_id, recorded_at DESC)`. Idempotent `CREATE TABLE IF NOT EXISTS`. | 3 min | Backend |
| 4.1 | `backend/app/core/seed_demo.py` (idempotent — `ON CONFLICT DO NOTHING`): (a) user Ravi Kumar `phone='+15551234567'`, `telegram_id='ravi_demo'`, `preferred_language='en-IN'`; (b) 7 daily check-in `user_medical_records` rows `file_type='checkin'` with Indian-English text + headache severity 3,4,5,6,7,5,7; (c) 7 daily `user_biometrics` rows — HRV 52→47ms drift, resting HR 68→74 bpm, **demo-day peak HR 113 bpm**, sleep score 82→71, steps 8800→6200, respiratory 14→16, skin temp delta -0.2°F today; (d) 1 lab PDF record `file_type='lab_pdf'` with `extracted_summary` JSON containing LDL=160, fasting glucose=108, total cholesterol=228 (Dr. Sarah Jenkins, Comprehensive Metabolic Panel); (e) 1 Rx record `file_type='rx_bottle'` for lisinopril 10mg daily; (f) 1 hardcoded AI Health Status Summary row `file_type='health_summary'` (paragraph atop Medical Timeline); (g) 1 dormant AFib alert row `file_type='alert'` with `status='inactive'` (force_trigger flips to `active`). Embed all text-bearing rows via existing `chunk_text` + `generate_embedding`. | 18 min | Backend |
| 4.2 | Run the seed once: `python -m app.core.seed_demo` | 2 min | Backend |
| 4.3 | `POST /api/checkins/force_trigger?user_id=...` — backend endpoint that (a) fetches the user's recent biometric + check-in context, (b) calls Gemini 2.5 Flash with a **plain-English proactive-ping prompt** (per `feedback_english_default_outside_voice` — messaging layer is English-only; voice interpreter is the only multilingual surface), (c) sends the result to the user's Telegram chat via the existing bot service, (d) **updates the dormant AFib alert row to `status='active'`** so the Vitals page card appears. **Hidden** — no UI link, called from the admin button only. | 10 min | Backend |
| 4.4 | Frontend: small `[Demo: trigger proactive ping]` button on the dashboard, gated by `?demo=1` query param, calls `/api/checkins/force_trigger` | 5 min | Frontend |
| 4.5 | `frontend/src/features/insights/InsightsPage.tsx` — `/insights` route. Cards per designer's `vitals_device_insights_zoie_ai` IA: SymptomTrend (headache severity), HRV trend, Resting HR, Sleep score, Daily steps. All fetch `/api/biometrics?user_id=...` + check-in records. Recharts. | 18 min | Frontend |
| 4.6 | `frontend/src/features/vitals/VitalsPage.tsx` — `/vitals` route. Polls `/api/alerts?user_id=...&status=active`. When alert row exists, renders designer's red `Irregular Rhythm / Heart Rate Spike Detected` card with peak BPM + duration + "Call Clinic / Share Telemetry" CTAs (CTAs static). Below: Cardiovascular Resilience / Autonomic Recovery / Basal Variations cards from biometrics. | 12 min | Frontend |
| 4.7 | `frontend/src/features/timeline/MedicalTimelinePage.tsx` — `/medical-timeline` route. AI Health Status Summary card at top, then reverse-chron list of `user_medical_records` (lab/Rx/check-in entries) per designer's `medical_timeline_with_ai_summary_zoie_ai`. | 8 min | Frontend |
| 4.8 | `frontend/src/features/settings/SettingsPage.tsx` — static stub matching designer (`settings_zoie_ai_health_companion`). No live logic — name = "Ravi Kumar", all toggles disabled. | 5 min | Frontend |
| 4.9 | App shell: left nav with Talk / Insights / Medical Timeline / Settings, "Z Zoie / Health Companion" header. Mount at app root, route children accordingly. | 6 min | Frontend |
| 4.10 | Backend convenience endpoints: `GET /api/biometrics?user_id=` (returns recent rows ordered desc), `GET /api/alerts?user_id=&status=` (filter by status), `GET /api/records?user_id=&limit=` (for timeline). Thin queries, no logic. | 6 min | Backend |

**Checkpoint:** App opens to Talk page (orb). Left nav shows 4 routes. `/insights` renders SymptomTrend showing 3,4,5,6,7,5,7 rising trend + biometric cards. `/vitals` shows nothing scary (alert dormant). Hit `?demo=1` button → Telegram pings Ravi in **plain English** *and* `/vitals` lights up with the red AFib card. `/medical-timeline` shows lab PDF + Rx + recent check-ins. End-to-end: Ravi's Telegram → text/PDF → HyDE → cited English reply with chip.

**Time pressure escape hatches (in order):**
1. If frontend overrun: drop Tier 3 (Settings, Steps card, Respiratory card)
2. If still overrun: drop Tier 2 (Medical Timeline → reuse existing v1 Timeline component; Insights → just SymptomTrend)
3. If force_trigger Telegram send breaks: display composed message in a toast/alert; AFib card still appears (independent code path)
4. If `/vitals` not done: keep the AFib moment purely in Telegram per v2.0 plan

---

### Block 5: Rehearsal + Submission (2:45 — 3:00) 🔴 CRITICAL
**Goal:** Demo runs cleanly twice in a row. Submission is in.

| # | Task | Time | Owner |
|---|------|------|-------|
| 5.0 | If demo'ing from Cloud Run: set `min-instances=1` on the backend service (Pulumi config or `gcloud run services update`). Prevents Pro cold-start on first Act-3 chat. Revert after demo. | 2 min | One |
| 5.1 | Full rehearsal #1: Act 1 (Telegram check-in + force_trigger + lab drop) → Act 2 (interpreter, 3 patient turns + 2 doctor turns) → Act 3 (dashboard symptom trend + lab citation chips + Pro-grounded answer) | 5 min | All |
| 5.2 | Fix the worst breakage from rehearsal #1 | 3 min | All |
| 5.3 | Rehearsal #2 + final polish | 2 min | All |
| 5.4 | Git commit + push, submit on hackathon platform | 3 min | One |

**Checkpoint:** Submitted with a working demo path. If Block 5 reveals a fatal breakage, fall back to the v1 demo path — it still works because Block 1 verified it.

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Postgres not available | `docker compose up db` — pgvector in seconds (inherited from v1 plan) |
| Gemini Live API session unreliable or mangling source-language audio | Fallback path is the REST `/api/talk/finalize_audio` route (Gemini 2.5 Flash non-streaming audio understanding) — both Google-stack per `[[project-google-stack-only]]`. Never fall back to a non-Google STT. |
| Antigravity Interactions API not accessible | Direct `client.models.generate_content` is already the fallback path in `execution_node` |
| `/talk` orb page totally fails on stage | Act 2 hero is gone, but Acts 1 + 3 still demo via the existing chat + Telegram flows. Self check-in mode falls back to text input on the same page. |
| `/vitals` AFib card doesn't render | force_trigger still pings Telegram independently. Demo absorbs the missing visual; pitch line "and the same alert hits the app dashboard" gets dropped. |
| Telegram voice-note ingestion breaks | Demo uses text check-ins by design — voice-note ingestion is v1.1 (per cut #13) |
| Validator citation check causes infinite loops | `needs_validation=False` for the demo; rely on prompt-layer invariant only |
| **End-to-end chat latency on Pro path (~3–5s happy path with literal retrieval)** | Pre-warm via Block 5.0 (`min-instances=1`). If still bites, swap synthesis to Flash on first attempt — one constant change in `execution_node`. |
| **Pro cold-start on Cloud Run (first call after idle scale-down ~3s)** | Block 5.0 sets `min-instances=1` for demo window. Or pre-warm in Block 5.1 with a dummy chat 30s before stage. |
| **`FlashReranker` returns invalid JSON or noisy top-2** | Task 3.0f covers the JSON-failure path with a graceful fallback to vector-similarity ranking. No demo-time action needed. |
| MEDGemma references in pitch don't match reality | MEDGemma is spec'd as the reranker behind the `MedicalReranker` interface; the `FlashReranker` shim is honest on stage — "Gemini Flash today, Vertex MEDGemma in v1.1 behind the same interface, swap via `RERANKER` env var." |
| Cloud Run deploy fails | Demo locally via `docker compose up` — still shows production-ready architecture |
| Frontend demo data sufficient | Block 4.1 seeds Ravi explicitly; v1's hardcoded Maria demo data is the secondary fallback |
| GCS not configured | Storage falls back to local filesystem automatically (inherited from v1) |

---

## Demo Script (3 minutes)

> *"Zoie is a personal health interpreter and memory layer for immigrant families navigating US healthcare. Built around our user Ravi, a Hindi-English-speaking patient managing hypertension and recent symptoms."*

### Act 1 — Before the visit (60s)
1. **[10s]** Show Ravi's Telegram chat — Zoie's morning check-in: *"Good morning, Ravi — how are you feeling today?"* (English; per the English-default policy outside the voice surface.)
2. **[15s]** Ravi replies with a voice note in Indian English: *"Head was paining yesterday also today, some giddiness in morning."* Bot replies with a structured confirmation chip ("Logged: headache + orthostatic dizziness").
3. **[10s]** Cut to `/insights` — open with `?demo=1`. Show 7-day headache severity trend rising + HRV narrowing + resting HR elevated last 3 days.
4. **[10s]** Click the hidden `[Demo: trigger proactive ping]` button. **Two things happen simultaneously:** (a) Telegram lights up with a Zoie message in plain English: *"Hi Ravi — your resting heart rate has been higher than usual for the past few days, and the headache trend is continuing. Would it help if I set up an appointment with Dr. Patel?"* (b) `/vitals` flips to show the red AFib alert card: *"Irregular Rhythm Detected — 113 BPM sustained for 10 minutes, patterns consistent with AFib."*
5. **[15s]** Ravi drops a lab PDF into the chat. Bot replies: *"Looks like your lipid panel from May 15. LDL Cholesterol 160 mg/dL [LOINC:13457-7] — that's higher than the typical reference range of <100. Want me to explain, or save this for Thursday's appointment?"* — citation chip clickable.

### Act 2 — During the visit (90s)
6. **[10s]** Switch to `/talk` on the laptop. Toggle the header pill from **Self check-in** to **Clinic visit**. The orb glows; a Patient↔Doctor role chip appears beneath it. Ravi's `preferred_language` is `hi-en-IN`, so Doctor-side cleanup will translate *into* Indian English. One shared device on the desk between two humans on stage. *Tech beat: this is Gemini Live API streaming — not POST blob.*
7. **[25s]** Three patient turns (role chip = **Patient**, hold the orb):
   - *"Doctor, I am having loose motions since two days, no fever, and giddiness when I stand up."* → RAW (Indian English): verbatim. CLEANED (English for doctor): *"Doctor, I have had diarrhea for two days, no fever, and dizziness when I stand up."*
   - *"Also my BP, I checked at home, it was 140 by 90 since fortnight."* → CLEANED: *"Also, my blood pressure — I checked at home — was 140/90 for the last two weeks."* (Numerals 140/90 preserved verbatim.)
   - *"I want to prepone the cardiology, can it be done?"* → CLEANED: *"I would like to move the cardiology appointment earlier — is that possible?"*
8. **[25s]** Two doctor turns (flip role chip to **Doctor**, hold the orb — output now translates *to* Indian English for Ravi):
   - *"Let's get a CBC and a BMP today, hold the lisinopril for 48 hours, and follow up in one week."* → CLEANED (Indian English, for Ravi's panel): *"We will do a CBC and BMP blood test today. Stop the lisinopril 10mg for 48 hours. Come back in one week for follow-up."* (Drug name `lisinopril` + dose `10mg` + acronyms `CBC` / `BMP` stay verbatim in English so Ravi can match the lab slip / pill bottle.)
   - *"And drink more water — at least two liters a day until the diarrhea stops."* → CLEANED: *"Also, drink more water — at least 2 liters per day — until the diarrhea stops."* (Numerals + units preserved.)
9. **[10s]** End-of-visit click → all turns persist to Ravi's record as `file_type='visit_transcript'`. Show the new row appearing in the Timeline tab.

### Act 3 — After the visit (30s)
10. **[15s]** Cut to Ravi's Telegram a few hours later. Forward a lab result. Bot replies in plain English: *"Your blood cell test came back normal. The salt test shows your potassium is a little low (3.2 mmol/L) — Dr. Patel asked us to keep an eye on this. Source: [doc:lab_may23.pdf]. Worth mentioning at your follow-up next week — should I add it to your visit list?"*
11. **[10s]** Back to `/insights` — same 7-day SymptomTrend chart, now with today's check-in added. Beside it the HRV trend card still shows the narrowing pattern that triggered the alert.
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
