# Zoie — PRD v2 (Hackathon Pivot)

**Status:** ready-for-agent
**Date:** 2026-05-23
**Supersedes:** `project-docs/hackathon-prd.md` (v1 framed health-literacy; v2 sharpens wedge + adds live interpreter, proactive check-ins, grounded synthesis rule)
**Codebase identifier:** `mediagent` (progressive rename to `zoie` deferred — not blocking)

---

## Problem Statement

**Whose problem, in their words:**

A non-English-speaking immigrant patient (default demo persona: Hindi-English / Indian English speaker) walks into a US doctor's appointment. They have weeks of symptoms they want to describe, a lab report from last month they half-understood, and a head full of phrases that don't map cleanly to American clinical English (*"I am having loose motions since two days, no fever, and giddiness when I stand"*). The doctor has 12 minutes and is hearing them through a register and idiom gap. The patient walks out with a plan they nodded through but can't fully explain to themselves on the drive home, and a lab interpretation that means nothing concrete to them.

Between visits, nobody is helping the patient track their condition, decide whether a new symptom is worth a call, or remember what changed last time. The patient's adult child — often the de facto care manager from another city — is also missing a coherent picture of what's going on.

**The cost:** misunderstood symptoms get coded wrong, lab values that should prompt action don't, chronic conditions drift, and the patient arrives at every visit starting from scratch.

## Solution

Zoie is the patient's **memory + interpretation layer**, accessed through Telegram (daily check-ins, document uploads, voice notes) and a web app (dashboard + live in-visit interpreter). It does three things:

1. **Before the visit** — proactively checks in with the patient in their register and language, logs symptoms via natural conversation, ingests any document they throw at it (lab PDFs, MD notes, Rx bottle photos, scan reports, voice notes), and generates a pre-visit one-pager grounded in their actual history.
2. **During the visit** — a single shared device runs a push-to-talk interpreter that normalizes the patient's Indian-English idioms into clean American clinical English on screen for the doctor, and renders the doctor's clinical English into simplified Hindi-English for the patient. Bidirectional, text-only, low-latency. Extracted structured fields from the visit transcript flow back into memory.
3. **After the visit** — when a lab result or physician note lands, MedGemma + Gemini extract structured findings, RAG over MedlinePlus/LOINC/RxNorm produces a plain-language explanation grounded in citable sources, and the patient gets it in their register on Telegram.

**Product invariant — the rule that makes Zoie defensible:**

> Every medical statement Zoie produces is either:
> (i) a value from the patient's records (cited to the source document), or
> (ii) a definition or explanation from a citable reference (LOINC entry, RxNorm row, MedlinePlus paragraph, ICD-10 code) shown with the citation visible to the user, or
> (iii) explicitly framed as a question to bring to the doctor, not a claim.
>
> No free-form medical synthesis without a citation. Ever.

**Mandatory boundary line** Zoie repeats whenever a response approaches advice:
> *"I'm not a doctor — I can help you understand and remember. Let's bring this to Dr. Patel on Thursday."*

## User Stories

**Wedge persona (primary, demoed):** Ravi Kumar — Indian-English-speaking US immigrant, 55, hypertension + recent GI symptoms, sees Dr. Patel for follow-up.

**Secondary persona (post-hackathon, not built in v1):** Priya, Ravi's adult daughter in another city, the de facto care manager. Multi-user/dyad is in vision, single-account in v1.

### Before the visit

1. As Ravi, I want Zoie to message me on Telegram each morning asking how I'm feeling, so I don't have to remember to log anything myself.
2. As Ravi, I want to reply with a voice note in messy Hindi-English (*"head was paining since yesterday, also some giddiness in morning"*) and have Zoie understand and log structured symptoms automatically.
3. As Ravi, I want to drop a photo of my lab report into the chat and get a plain-language explanation back within a minute, in language I actually understand.
4. As Ravi, I want Zoie to confirm what it extracted from my lab before saving it ("looks like your Comprehensive Metabolic Panel from May 15, two values flagged — does that look right?") so I can catch mistakes.
5. As Ravi, I want Zoie to notice when my resting heart rate has been elevated for several days and check in with me unprompted, in my register, so I don't dismiss something that matters.
6. As Ravi, I want Zoie to escalate from text to a voice call if I haven't responded to check-ins for two days while my biometrics are off, so a real human-feeling outreach happens when it matters.
7. As Ravi, I want a pre-visit summary I can pull up on my phone in the waiting room — chief complaint, last 7 days of symptoms, recent labs with reference ranges, current medications, what I'm hoping to get out of the visit — without doing any prep work myself.
8. As Ravi, I want every claim in that summary to point at the source document so I (and my doctor) can verify it.
9. As Ravi, I want to book my appointment from inside Zoie's web app without leaving for another tool.

### During the visit

10. As Ravi, I want one shared device on the doctor's desk to do live interpretation, so I don't have to remember every detail myself or rely on broken phone translation.
11. As Ravi, I want to tap a button labeled "patient" before I speak, so the device knows it's my turn and uses the right cleanup prompt.
12. As Ravi, I want my Indian-English phrasing (*"loose motions since two days"*) to appear on the doctor's side of the screen as clinical English (*"diarrhea, onset 2 days ago"*) within a second, with my raw transcript also visible so nothing is hidden or paraphrased away.
13. As the doctor, I want to tap "doctor" and speak normal clinical English and have it appear on the patient's side of the screen as simplified Hindi-English at a 6th-grade reading level ("a standard blood test that checks your blood cells, and another that checks how much water your body has — sounds okay?"), so my patient actually understands the plan.
14. As Ravi, I want every patient utterance to surface its structured EXTRACTED fields below the cleaned line (`symptom: diarrhea | onset: 2d ago | associated: no fever, orthostatic dizziness`) so the doctor can scan symptom claims fast.
15. As Ravi, I want the EXTRACTED fields and the cleaned transcript saved to my record automatically after the visit, so memory grows without me doing anything.
16. As Ravi, I want the interpreter to keep working even if one mic glitches — I want one device, one toggle, no setup theater.

### After the visit

17. As Ravi, I want to forward or photograph any post-visit lab result, physician note, scan report, or prescription bottle to Zoie via Telegram and have it ingested into my record.
18. As Ravi, I want plain-language explanations of lab findings that quote my actual values, reference the LOINC normal range, and link to MedlinePlus so I can read more if I want.
19. As Ravi, I want medication mentions to map to RxNorm so Zoie can flag if a new med belongs to a class I've reacted badly to before.
20. As Ravi, I want Zoie's interpretation of any lab or note to point at a source document I can open, so I never have to take a synthesized claim on faith.
21. As Ravi, I want a follow-up check-in scheduled automatically after a visit so the loop closes ("you started medication Y on Thursday — checking in: any nausea?").

### Dashboard / web app

22. As Ravi, I want a single dashboard that shows my biometric trends (heart rate, BP), my recent symptom log, my current medications, and a timeline of every document Zoie has on me.
23. As Ravi, I want to click any value on the dashboard and see the source document or check-in that produced it.
24. As Ravi, I want a "live interpreter" tab that I can open in the waiting room as a single big push-to-talk surface, no setup, no menus.

### Trust + posture

25. As Ravi, I want Zoie to refuse to give me free-form medical advice; instead I want it to frame anything advice-shaped as "a question to bring to your doctor."
26. As Ravi, I want every citation chip to be one tap from the underlying source — LOINC row, MedlinePlus paragraph, RxNorm entry, or my own document.
27. As Ravi, I want Zoie to speak to me at a reading level that doesn't condescend but also doesn't lose me — familiar idioms when natural, not dumbed-down American children's-book English.

## Implementation Decisions

### Product naming

- **Product name in copy + on-screen labels:** Zoie. Codebase identifier `mediagent` stays for v2 to avoid rename churn; progressive rename is non-blocking and can happen post-hackathon.

### Demo wedge + scope

- **Primary persona:** Hindi-English-speaking US immigrant. Demo persona on stage: Ravi Kumar, 55, hypertension + recent GI symptoms.
- **Language pair:** Indian English ↔ American English (register/idiom normalization, NOT cross-language translation). Patient is literate in English; the gap is register, idiom, and code-switching, not vocabulary.
- **In-person visit only** for v1. No telehealth, no telephony, no Twilio.
- **Single-account model.** Adult-child-of-immigrant dyad stays a pitch story in v1, becomes a built feature post-hackathon.
- **No clinician-facing surface.** The pre-visit one-pager is something the patient pulls up on their phone in the waiting room. No magic links, no doctor portal, no fax. Post-hackathon.

### Demo storyboard (3 acts, ~3 minutes)

- **Act 1 "Before":** Telegram check-in (Hindi-English voice note in → structured symptom logged), document drop (lab PDF → MedGemma extraction → plain-language reply with citation chips), proactive escalation (scripted trigger from a hidden admin button — biometric anomaly fires a Telegram ping in Ravi's register).
- **Act 2 "During":** Web app `/interpreter` page open on a shared device on the desk. Push-to-talk toggle. Two humans seated. Patient speaks Indian English → screen shows raw transcript + clean clinical English + EXTRACTED fields. Doctor speaks American clinical English → screen shows raw + simplified Hindi-English for patient.
- **Act 3 "After":** Lab/note dropped to Telegram → plain-language breakdown grounded in MedlinePlus + LOINC, citation chips visible. Auto-scheduled follow-up check-in shown.

### Architecture posture (relative to what's already built)

The repo already has FastAPI + LangGraph + Antigravity managed agents + Next.js + Postgres/pgvector with dual RAG (user records + general KB) and a `process_medical_file_with_medgemma` pipeline. **Zoie v2 extends this scaffold, does not replace it.** Specifically:

- **Keep** the LangGraph router→execution→validator workflow, the pgvector dual-RAG retrieval, the Antigravity Interactions API path, the ingestion pipeline, the existing frontend feature folders.
- **Do not adopt gbrain** in v1 — the existing pgvector schema covers the same memory-layer responsibility, and gbrain's TS-only nature would force a sidecar MCP process for marginal benefit during a hackathon. Revisit post-hackathon if multi-source federation becomes a need.
- **Cut from scope** for v1: graph DB, multi-user/dyad, doctor-facing surface, real telephony, real Apple Health ingestion (scripted on stage), pill identification, insurance/EOB, image-level radiology interpretation, magic-link doctor delivery.

### Modules to add or modify

#### NEW: `backend/app/domains/interpreter/`

Deep module. The live-visit interpreter pipeline. Has its own router, services, schemas.

- **Interface (kept small and testable):**
  - `start_session(user_id) -> session_id` — opens a streaming session, returns identifier
  - `submit_turn(session_id, role: 'patient' | 'doctor', audio_chunk_or_text) -> CleanedTurn` — streams a turn through STT + LLM cleanup, returns cleaned + EXTRACTED structured fields
  - `end_session(session_id) -> VisitRecord` — finalizes the session, writes turns + EXTRACTED to `user_medical_records` + `user_record_embeddings` as a `visit` record type
- **STT:** Gemini 2.5 Flash native audio understanding (streaming). Fallback: Deepgram nova-3 if Gemini audio latency or accent handling proves insufficient during integration; behind a config flag, do not hard-code.
- **Two cleanup prompts** (in `services.py` as constants):
  - **Patient→Clinical:** *"You are a medical scribe. Normalize this Indian English patient utterance into concise American clinical English. Preserve every value, timeframe, and qualifier. Add nothing not said. Output two fields: `clinical` (one to three sentences) and `extracted` (a JSON object with detected `symptom`, `onset`, `severity`, `associated`, `medications_mentioned`)."*
  - **Doctor→Simplified:** *"You are explaining the doctor's words to a Hindi-English-speaking patient at a 6th-grade reading level using familiar register. Use Indian English idioms where natural. Add nothing the doctor did not say. Output: `simplified` (one to three sentences) and `extracted` (JSON with `plan_items`, `medications_prescribed`, `tests_ordered`, `followup`)."*
- **Speaker routing:** push-to-talk toggle on the frontend, sent as `role` parameter on every `submit_turn` call. No diarization, no language-detection routing.
- **No TTS.** Output is rendered to the frontend, never spoken.
- **WebSocket** endpoint for the streaming transcript; REST fallback for non-streaming demo.

#### NEW: `frontend/src/features/interpreter/`

- `InterpreterPage.tsx` — full-screen page mounted at `/interpreter`
- `RoleToggle.tsx` — large two-state push-to-talk control (PATIENT / DOCTOR)
- `TranscriptPane.tsx` — rolling transcript row component, four content areas per turn: speaker label, RAW transcript, CLEANED (clinical if patient, simplified if doctor), EXTRACTED fields chips
- `SessionControls.tsx` — start / end visit, end-of-visit writes to memory

#### NEW: `backend/app/domains/grounding/`

Deep module. Holds every citable medical fact. The product invariant runs through here.

- **Interface:**
  - `lookup_loinc(code_or_test_name) -> LoincEntry | None` — returns name, units, reference range, links
  - `lookup_rxnorm(medication_name) -> RxnormEntry | None` — returns canonical name, class, common side effects (curated subset)
  - `lookup_icd10(code_or_condition) -> Icd10Entry | None`
  - `search_medlineplus(query, topk=3) -> list[PassageWithCitation]` — pgvector RAG over scraped MedlinePlus articles
  - `wrap_with_citations(statement, source_refs) -> CitedStatement` — pure formatter, also enforces the invariant: a statement without any source ref raises `UncitedMedicalClaimError`
- **Data loading:** one-time SQL seed at startup. LOINC + RxNorm + ICD-10 ship as Postgres tables (LOINC subset of common outpatient labs, RxNorm subset of common chronic-disease meds, ICD-10 chapter headings). MedlinePlus scrape into the existing `general_medical_knowledge` table with `disease_category='medlineplus'` and `source_title=<article URL>`.
- **Validator-node integration:** the LangGraph validator (`graph.py`) gains a citation-presence check — any agent response containing identifiable medical claims must have at least one citation token in its output, otherwise validation fails and the loop retries with a stricter system instruction.

#### NEW: `backend/app/domains/retrieval/`

Deep module. Iterative HyDE retrieval + MEDGemma reranker — the agent memory context layer. Every grounded answer flows through here. Replaces the v1 single-shot pgvector query that `execution_node` does today.

- **Interface (kept small and testable):**
  - `retrieve(user_id, query, k_iterations=5, top_k=2) -> RetrievalResult` — returns `{contexts, hypothetical_answers, final_top_k}`. `k_iterations=1` short-circuits the loop to a literal-query path (v1 default).
  - `embed_query(text) -> list[float]` — Gemini text embedding (`gemini-embedding-001`, 768d), passthrough
  - `embed_image(bytes, mime_type) -> list[float]` — `multimodalembedding@001` on Vertex (1408d). **Different vector space from text.** Stored in a separate `user_image_embeddings` table queried by `embed_image()` of the query (e.g. patient sends a photo, search image space). Text queries do not search image space, and vice versa, until v1.2 brings a single multimodal embedding model that unifies both.
  - `MedicalReranker.rerank(query, contexts) -> list[ScoredContext]` — ABC with two implementations: `MedGemmaReranker` (Vertex, v1.1) and `FlashReranker` (Gemini 2.5 Flash with a medical-reranker prompt, used in v1)
  - `get_reranker() -> MedicalReranker` — factory reading `RERANKER` env var (`flash` | `medgemma`, default `flash`). Centralizes the swap point; nothing else in the codebase instantiates rerankers directly.

- **Pipeline (canonical 5-iteration HyDE):**
  1. User query enters via `retrieve()`.
  2. **Iteration loop ×5:** Gemini 2.5 Flash generates a *hypothetical answer* to the query, conditioned on **prior hypotheticals + a diversity instruction** ("write a different angle than the prior hypotheticals; do not see the retrieved corpus") → embed → pgvector search across `user_record_embeddings` + `general_medical_knowledge_embeddings` (parallel via `asyncio.gather`) → append top-N results to `contexts[]`, deduped by record id. Conditioning on prior hypotheticals (not on accumulated contexts) prevents iterations from collapsing into corpus regurgitation.
  3. **Rerank:** `MedicalReranker.rerank(query, contexts)` scores every accumulated context against the **original** user query, returns top 2.
  4. **Synthesis:** Gemini 2.5 Pro generates the final answer using only the top 2 contexts as grounded source. Output flows through the grounding citation invariant.

- **Why HyDE:** patient queries (*"is my cholesterol bad?"*) have weak vocabulary overlap with the source corpora (*"low-density lipoprotein"*). Generating a hypothetical answer pulls clinical vocabulary into the search vector, dramatically improving recall.
- **Why iterate:** each loop broadens coverage without losing focus — later hypotheticals see earlier hypotheticals and a diversity instruction, so each call probes a different angle of the question rather than re-mining the corpus.
- **Why MEDGemma rerank:** the loop produces 25+ candidates; medical-fine-tuned reranking prevents irrelevant matches from leaking into synthesis. Generic similarity scoring is not enough at the scale of accumulated candidates.
- **Why Gemini 2.5 Pro for synthesis:** the final answer is the highest-stakes step (citation discipline, register, grounding fidelity) → Pro tier. Flash stays in the iteration loop where speed matters and individual calls are cheap.

- **Ingestion integration (modifies `domains/ingestion/`):** image files (`image/jpeg`, `image/png`, `image/heic`) call `retrieval.embed_image()` alongside the existing MedGemma extraction path. Image embeddings land in a separate `user_image_embeddings` pgvector table (1408d, `multimodalembedding@001`); text chunks continue to land in the existing 768d `user_record_embeddings` table. Cross-modal retrieval (text query → image hit) requires a unified multimodal embedding model and is deferred to v1.2.

- **LangGraph integration:** `execution_node` replaces its direct pgvector call with `retrieval.retrieve(user_id, query)`. The top 2 contexts become the `[Grounded Medical Context]` block in the existing system instruction. The validator's citation-invariant check continues to enforce that synthesized output cites those contexts (record ids surface as `[doc:<record_id>]` tokens). Validator-retry cap is 1 — Pro runs on first attempt only; retry path uses Flash with a stricter "you must cite" instruction to avoid latency compounding.

- **MEDGemma deployment posture:** see §"Open dependencies" for the canonical statement.

#### NEW: `backend/app/domains/checkins/`

- **Interface:**
  - `evaluate_triggers(user_id) -> list[CheckinTrigger]` — runs every N minutes via cron / startup task; evaluates **B (care-plan)** rules and **C (signal-driven)** rules against the user's facts + biometric stream
  - `compose_message(trigger, user_context) -> ComposedCheckin` — Gemini 2.5 Flash composes the actual outbound message in the patient's register and language, using the trigger as context
  - `send(composed) -> SendResult` — delegates to Telegram domain
  - `force_trigger(user_id, trigger_name)` — admin endpoint behind a hidden route; used to fire the Act 1 proactive moment on demo stage
- **B rules (care-plan):** condition-templated, e.g. *"patient has hypertension → ask about BP morning/evening on M/W/F"*, *"patient started medication X in last 14 days → ask about side effects daily."*
- **C rules (signal-driven):** simple boolean evaluators against fact trajectory, e.g. *"`days_since_last_checkin > 2` AND `active_condition`"*, *"`hr_7d_avg / hr_30d_avg > 1.10`"*. **Demo trigger is `force_trigger` from the admin endpoint** — no need for real-time biometrics on stage.
- **D rules (LLM-decided):** deferred to post-hackathon. Too unpredictable for stage.

#### MODIFY: `backend/app/domains/ingestion/services.py`

- Extend `ClinicalSummary` schema to include structured codes:
  - `loinc_codes: list[str]` on each lab metric
  - `rxnorm_ids: list[str]` on each medication
  - `icd10_codes: list[str]` on each diagnosis
- After MedGemma extraction, call `grounding.lookup_loinc` / `lookup_rxnorm` / `lookup_icd10` to attach canonical codes and reference ranges as `metadata` on the record before embedding.
- Add a router step in `process_medical_file_with_medgemma`: first-pass Gemini Flash classification into `{lab, md_note, rx_bottle, scan_report, voice_note, text}`; route to type-specific extraction prompt rather than one mega-prompt.

#### MODIFY: `backend/app/domains/telegram/bot.py`

- After ingestion, reply with structured confirmation + inline action buttons:
  - `[ Explain ]` — triggers plain-language RAG response
  - `[ Save & remind me ]` — schedules a follow-up check-in via `checkins.services`
  - `[ Something's wrong ]` — opens a correction sub-flow
- On daily check-in inbound (voice note or text), call ingestion's `voice_note` route to extract structured symptom claims into `user_medical_records` with `file_type='checkin'`.

#### MODIFY: `backend/app/domains/orchestration/graph.py`

- Extend `execution_node`'s system instruction with:
  - The product invariant (no uncited medical synthesis)
  - The boundary line for advice-shaped output
  - The register guidance (Hindi-English idioms where natural for patient-bound responses)
- Extend `validator_node` to enforce the citation invariant — fail validation if response contains medical claims with no citation tokens. Citation token format kept simple for the validator: any of `LOINC:…`, `RxNorm:…`, `ICD-10:…`, `MedlinePlus:…`, or `[doc:<record_id>]`.

#### MODIFY: `frontend/src/features/dashboard/`

- Keep existing `MetricTrends.tsx`, `Timeline.tsx`, `FileUploader.tsx`.
- Add `SymptomTrend.tsx` — a single chart showing daily-check-in-derived severity over the last 7–30 days (the demo's headache trajectory). Click → list of contributing check-ins.
- Add citation chip rendering primitive (`CitationChip.tsx`) usable everywhere claims appear. Tap → opens a side drawer with the source.

#### NEW: `backend/app/core/seed_demo.py`

- Seeds the demo patient Ravi Kumar:
  - User row with phone + Telegram ID
  - 30 days of daily check-ins, some plain text, some `voice_note` transcripts in Indian English idioms
  - Scripted biometric stream (resting HR daily values trending up in the last 7 days)
  - One lab PDF in GCS + `user_medical_records` row + embeddings, with LDL=160 flagged
  - One Rx bottle photo + `user_medical_records` row
  - One MD note from a prior visit
  - One `general_medical_knowledge` MedlinePlus seed for cholesterol / hypertension topics relevant to Act 3

### EXTRACTED structured shape

Single source of truth: Pydantic models in `backend/app/domains/interpreter/schemas.py`. The JSON schema description fed to the cleanup prompts is generated at runtime via `Model.model_json_schema()` — the prompt never hard-codes field names. The frontend renderer imports a generated TypeScript type from the same models (`datamodel-code-generator` or a hand-mirrored interface kept thin enough to drift-check during code review).

```python
# interpreter/schemas.py — canonical
class PatientExtracted(BaseModel):
    symptom: str | None = None
    onset: str | None = None
    severity: int | None = None  # 0-10 if surfaced
    associated: list[str] = []
    medications_mentioned: list[str] = []

class DoctorExtracted(BaseModel):
    plan_items: list[str] = []
    medications_prescribed: list[str] = []
    tests_ordered: list[str] = []
    followup: str | None = None
```

Example values for review reference only (do not hardcode anywhere else):

```jsonc
// Patient turn EXTRACTED
{ "symptom": "diarrhea", "onset": "2d ago", "severity": null,
  "associated": ["no fever", "orthostatic dizziness"], "medications_mentioned": [] }

// Doctor turn EXTRACTED
{ "plan_items": ["check hydration"], "medications_prescribed": [],
  "tests_ordered": ["CBC"], "followup": null }
```

### Schema additions (additive, non-breaking)

- `user_medical_records.file_type` — add allowed values `'checkin'`, `'visit_transcript'`, `'rx_bottle'`, `'md_note'`, `'scan_report'`, `'voice_note'` (existing column is `VARCHAR(50)`, no migration needed).
- New table `visit_sessions` — one row per interpreter session, columns `id`, `user_id`, `started_at`, `ended_at`, `record_id` (FK to `user_medical_records` where the session's final transcript writes).
- New table `visit_turns` — `id`, `session_id`, `turn_index`, `role`, `raw`, `cleaned`, `extracted_json`, `created_at`. Power the post-visit summary and the writeback to embeddings.
- New tables `loinc_entries`, `rxnorm_entries`, `icd10_entries` — flat reference tables seeded at startup. Public-domain / free data only.

### Out-of-loop product invariant enforcement

The no-uncited-medical-synthesis rule is enforced in **two layers**:

1. **Prompt layer** — every prompt that can produce medical content carries the invariant as system instruction.
2. **Validator-node layer** — citation-token presence check on each generated response. Failure routes back to execution with a stricter "you must cite" reminder. Trigger pattern is **quantitative-only** to avoid false positives — the regex matches `\b\d+(\.\d+)?\s*(mg\/dL|mmol\/L|mmHg|bpm|%)\b`; a numeric value with a clinical unit must be accompanied by at least one citation token (`LOINC:…` | `RxNorm:…` | `ICD-10:…` | `MedlinePlus:…` | `[doc:<record_id>]`). Bare medical-keyword mentions ("we're not testing your cholesterol today") do not trip the check.
3. **Validator retry cap** — retries are capped at 1. First attempt runs against Gemini 2.5 Pro; the retry runs against Gemini 2.5 Flash with a stricter "you must cite" system instruction. Prevents the latency compound that would otherwise stack 2× Pro calls plus retrieval per user turn.

Belt-and-suspenders by design — the prompt layer prevents most violations, the validator catches the rest before the user sees them.

## Testing Decisions

A good test here checks externally observable behavior — the cleaned text returned for a given utterance, the extracted JSON shape, the citation presence in a generated response — not the internals of which prompt template ran or which model was called. Tests should pin behavior at module interfaces, not at LLM token level.

The prior-art in this repo is light (no existing test suite); we'll establish the discipline with these tests rather than retrofitting.

**Modules worth testing in isolation (the deep ones):**

- **`grounding.wrap_with_citations` and `grounding.lookup_*`** — pure functions over loaded reference tables. Snapshot tests on representative inputs: an LOINC code returns the right reference range; a statement without any source ref raises `UncitedMedicalClaimError`; MedlinePlus search for "cholesterol" returns at least one passage with a `source_title` URL.
- **`interpreter` cleanup prompts** — fixture-based snapshot tests against a small curated set of Indian English utterances (*"loose motions since two days"*, *"giddiness when standing"*, *"BP is 140 by 90 since fortnight"*, *"prepone the appointment"*) and clinical English doctor turns (*"let's get a CBC and BMP"*, *"start lisinopril 10mg daily"*). Pin the EXTRACTED JSON shape; allow the cleaned text to be approximate (substring assertion on key tokens like "diarrhea", "orthostatic", "complete blood count", "blood pressure medication").
- **`checkins.evaluate_triggers`** — pure rule evaluation against fact-snapshot fixtures. Test each trigger rule fires or doesn't given a fact bundle, independently of cron timing.
- **`ingestion` classifier router** — given a file fixture, returns the right type. Mock the Gemini call to return canned classifications; assert the right specialist path runs.
- **LangGraph validator citation enforcement** — given an agent response with no citation tokens but medical-claim content, validator returns `failed`; given the same content with citation tokens, returns `passed`.

**Out of scope for tests:**

- The LangGraph router node's exact tool selection (LLM-driven, not deterministic enough to pin).
- Live Gemini API calls (mock the client in all tests; integration test runs separately on demand).
- The frontend visual layout. Manual demo rehearsal is sufficient for the hackathon timeline.

**Where to put them:** `backend/tests/` (new directory), pytest. Frontend: skip unit tests for v2; rely on manual rehearsal of the demo flow at least 3 times before stage.

## Out of Scope

Explicitly deferred to post-hackathon. Do not let these sneak back in via scope creep:

- **Multi-user / dyad** — shared household, role-based access, separate caregiver persona with different register. v1.1.
- **Clinician-facing surface** — magic-link pre-visit summary delivery, doctor portal, EHR/FHIR integration. v2.
- **Real telehealth** — Zoom/Doxy.me overlay, real telephony, Twilio/LiveKit. v2.
- **Real Apple Health / wearable ingestion** — scripted biometric data on stage. Real ingestion is post-hackathon.
- **WhatsApp distribution** — Telegram-only for v1. WhatsApp Business API requires BSP onboarding, deferred.
- **gbrain integration** — pgvector schema covers the same surface; gbrain's TS-only nature would force a sidecar MCP process. Revisit if multi-source federation becomes a real need.
- **Graph DB for medical entities** — pgvector + JSON metadata + structured codes (LOINC/RxNorm/ICD-10) covers the demo needs.
- **Pill identification from loose-pill photos**, insurance card / EOB ingestion, multi-page handwritten note OCR, image-level radiology interpretation.
- **LLM-decided proactive triggers (D rules)** — only B (care-plan templates) and C (simple signal rules) in v1.
- **TTS in the interpreter** — text-only output, both directions. Saves latency + brittle audio synthesis from the demo's critical path.
- **Codebase rename `mediagent` → `zoie`** — copy-level naming is Zoie; identifier-level rename is post-hackathon cleanup.

## Further Notes

### Why the existing v1 PRD doesn't disappear

`project-docs/hackathon-prd.md` (v1) is preserved as historical record. It documents the scaffolding that already shipped: FastAPI domains, LangGraph workflow, dual-RAG retrieval, Next.js features, Pulumi infra. v2 layers product positioning + the live interpreter + grounding hard rule + proactive check-ins on top — it does not replace the existing architecture document. If you're picking up this PRD cold, read v1 first to understand what's already built, then read this for what to add.

### Why the wedge isn't translation

A reviewer might ask "why not just do Spanish/Mandarin translation?" The answer is in the wedge: Indian-English speakers are typically literate in English, often highly educated, but speak in a register and idiom set that gets misheard or dismissed by US clinicians. They don't need a translator — they need a **register normalizer**. The product surface is the same (push-to-talk, screen-only, bidirectional), the LLM prompts are different, and the demo gap is more subtle but more defensible (no one else is building register normalization; everyone's building translators).

### Hackathon scope-cut order if time runs short

Cuts listed in least-painful-first order. Each removes work without breaking the pitch story:

1. Drop MedlinePlus RAG scrape. Hardcode plain-language templates for the 2–3 lab values that appear in Act 3. Keeps the citation chip, drops the scrape work.
2. Drop MEDGemma; use Gemini 2.5 Flash with the existing medical system prompt for everything. The repo already does this — keep it that way; "MEDGemma" stays a pitch-deck label.
3. Drop appointment booking as interactive — static "confirmed" screen with a hardcoded provider name.
4. Drop dashboard to one panel — the symptom severity trend chart only. No multi-tab dashboard.
5. Cut ingestion types from 5 to 2: lab PDF + voice note. Act 3 needs lab; Act 1 needs voice. Skip rx-bottle, md-note, scan-report ingestion paths if needed.
6. Drop the cron-driven proactive scheduler; expose a hidden admin button on the dashboard that calls `checkins.force_trigger` to fire the Act 1 escalation at the exact moment you want it on stage. The rule engine itself can ship later.
7. Drop HyDE iteration loop entirely; v1 ships `k_iterations=1` which short-circuits to a literal-query path through the same `retrieve()` interface. The `MedicalReranker` + Pro synthesis layers stay live, so the architecture (and stage pitch) holds. The 2-iteration variant ships in v1.1 once the diversity prompt is tuned with an eval harness.
8. Drop the image-embedding ingestion path (`embed_image` + the separate `user_image_embeddings` table). Images continue to flow through MedGemma OCR + structured extraction into the text-embedding path only; image-as-query retrieval is post-hackathon (v1.1).

### Open dependencies surfaced during synthesis

- **MEDGemma Vertex deployment** is spec'd as the reranker inside `domains/retrieval/`, never the primary extractor — extraction (`process_medical_file_with_medgemma`) stays Gemini 2.5 Flash with a medical system prompt. For v1 the reranker is `FlashReranker` (Gemini 2.5 Flash with a medical-reranker prompt) behind the `MedicalReranker` ABC. v1.1 swaps in `MedGemmaReranker` against Vertex AI without caller changes (selector lives in `retrieval.get_reranker()`, reads env var `RERANKER`). This is the canonical statement; `domains/retrieval/` and `domains/grounding/` defer to this paragraph.
- **LOINC + RxNorm + ICD-10 reference data** has to be downloaded once and committed as a SQL seed under `backend/app/core/db_init.sql` or a separate seeds folder. Both are free / public-domain (LOINC from Regenstrief, RxNorm from NLM, ICD-10-CM from CMS). Curate to a subset of ~200 lab tests + ~100 chronic-disease meds + chapter-level ICD-10 to keep load fast.
- **Gemini 2.5 Flash streaming audio** is the interpreter's STT path. If latency or Indian-English handling fails integration testing, fall back to Deepgram nova-3 behind a config flag — do not hard-code Deepgram.
- **No issue tracker is currently wired to this repo.** This PRD is published to `project-docs/prd-zoie-v2.md`. When the tracker is configured (Linear, GitHub Issues, or Notion), create an issue mirroring this PRD and apply the `ready-for-agent` label.
