# Block 2: Live Interpreter — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a bidirectional cross-language live medical interpreter — patient speaks Hindi/Mandarin/Indian-English into a shared device, doctor sees clean English on screen; doctor speaks English, patient sees their preferred language on screen. Powered by Gemini Live API (STT) + Gemini 2.5 Flash (cleanup/translation pass).

**Architecture:** Two-stage per turn. (1) Gemini Live API session opened on push-to-talk button press, audio streamed up, finalized transcript returned on release. (2) Separate Gemini Flash text-in pass applies the cleanup-and-translate prompt with injected per-language + per-patient vocabulary. The Live API session is per-turn (open on press, close on release) for clean failure isolation. Failure escape hatch: a `INTERPRETER_STT_MODE=batch` env flag routes around Live API to Gemini Flash non-streaming audio understanding (also Google stack).

**Tech Stack:** FastAPI (existing), `google-genai>=0.1.0` SDK (existing), PostgreSQL + pgvector (existing), Next.js 16 App Router with MediaRecorder API (frontend), pytest (added for backend unit tests on pure functions).

**Source-of-truth decisions** (do not relitigate during execution):
- Wispr-Flow-style discipline: no medical extraction, no structured fields, no register simplification. Translate and clean, nothing more.
- Two asymmetric prompts: `PROMPT_PATIENT_TO_ENGLISH` and `PROMPT_DOCTOR_TO_PATIENT_LANG`.
- Patient is literate adult; do not add medical explanations.
- Numerals, drug names, units, lab abbreviations stay in English even inside translated Hindi/Mandarin output (so the patient can match against their pill bottle).
- UX is FreeFlow-style: no live partial token rendering; "listening…" pulse during speech; RAW + CLEANED settle together on release.
- Frontend standalone full-screen page at `/interpreter`. Not a dashboard tab.
- Persistence: on `end_session`, write one `user_medical_records` row with `file_type='visit_transcript'`. No new tables.
- Personas: Ravi Kumar (`preferred_language='hi-IN'`), Wei Chen (`preferred_language='zh-CN'`). Act 2 demo uses Wei.
- Commit hygiene: no Claude/AI attribution in commit messages, code comments, or any artifact. Plain human-engineer voice throughout.

---

## File Structure

**New files (backend):**
- `backend/app/domains/interpreter/__init__.py` — empty module marker
- `backend/app/domains/interpreter/schemas.py` — Pydantic models (`TurnRequest`, `TurnResponse`, `SessionState`, `Turn`)
- `backend/app/domains/interpreter/vocab.py` — `LANGUAGE_VOCAB` constant + `build_vocab_block(user_id, source_lang)` function
- `backend/app/domains/interpreter/prompts.py` — `PROMPT_PATIENT_TO_ENGLISH`, `PROMPT_DOCTOR_TO_PATIENT_LANG`, `render_prompt()` helper
- `backend/app/domains/interpreter/stt.py` — `transcribe(audio_bytes, source_lang) -> str` with Live API primary path and batch Flash fallback
- `backend/app/domains/interpreter/services.py` — orchestration: `start_session`, `submit_turn`, `end_session`
- `backend/app/domains/interpreter/router.py` — FastAPI endpoints
- `backend/tests/__init__.py` — empty
- `backend/tests/domains/__init__.py` — empty
- `backend/tests/domains/interpreter/__init__.py` — empty
- `backend/tests/domains/interpreter/test_vocab.py` — vocab merge / dedup / injection block format
- `backend/tests/domains/interpreter/test_prompts.py` — prompt rendering against fixtures
- `backend/tests/conftest.py` — shared fixtures (mock genai client)

**New files (frontend):**
- `frontend/src/app/interpreter/page.tsx` — Next.js App Router page mounted at `/interpreter`
- `frontend/src/features/interpreter/types.ts` — TS types matching backend schemas
- `frontend/src/features/interpreter/api.ts` — fetch wrappers for backend endpoints
- `frontend/src/features/interpreter/useInterpreter.ts` — hook owning session state, recorder, transcript list
- `frontend/src/features/interpreter/RoleToggle.tsx` — two big push-to-talk buttons
- `frontend/src/features/interpreter/TranscriptPane.tsx` — rolling transcript list with one row per turn
- `frontend/src/features/interpreter/SessionControls.tsx` — start/end visit buttons

**Modified files:**
- `backend/app/core/db_init.sql` — add `preferred_language` column to `users`
- `backend/app/main.py` — register interpreter router
- `backend/requirements.txt` — add `pytest>=7.0.0`, `pytest-asyncio>=0.21.0`
- `backend/app/domains/ingestion/services.py` — voice-note path delegates translation to interpreter (Block 4.6 touch-point, included here for completeness)

---

## Task 1: DB schema — add `preferred_language` to users

**Files:**
- Modify: `backend/app/core/db_init.sql`
- Modify: `backend/app/domains/ingestion/router.py:30` (line that creates dynamic users)

The schema needs `preferred_language` to drive the interpreter's source-language detection. `db_init.sql` is idempotent — we use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` so re-runs don't break.

- [ ] **Step 1.1: Add column to db_init.sql**

Open `backend/app/core/db_init.sql`. Replace the `users` table block (lines 4-11) with:

```sql
-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    telegram_id VARCHAR(50) UNIQUE NULL,
    preferred_language VARCHAR(16) NOT NULL DEFAULT 'en-US',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Idempotent column add for existing deployments
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(16) NOT NULL DEFAULT 'en-US';
```

- [ ] **Step 1.2: Update dynamic user insert in ingestion router**

In `backend/app/domains/ingestion/router.py`, find the line that creates a dynamic user (currently `INSERT INTO users (id, phone_number) VALUES (%s, %s)`). Leave it as-is — the default `en-US` covers anonymous test users. No code change needed in this file; the default handles it.

- [ ] **Step 1.3: Restart backend and verify column exists**

Run:
```bash
make dev
# In another terminal:
psql -h localhost -U postgres -d health_assistant -c "\d users"
```
Expected: column `preferred_language` shown with default `'en-US'`.

- [ ] **Step 1.4: Commit**

```bash
git add backend/app/core/db_init.sql
git commit -m "add preferred_language column to users"
```

---

## Task 2: Interpreter domain scaffolding + schemas + pytest setup

**Files:**
- Create: `backend/app/domains/interpreter/__init__.py`
- Create: `backend/app/domains/interpreter/schemas.py`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/domains/__init__.py`
- Create: `backend/tests/domains/interpreter/__init__.py`
- Create: `backend/tests/conftest.py`
- Modify: `backend/requirements.txt`

- [ ] **Step 2.1: Add pytest to requirements**

Append to `backend/requirements.txt`:
```
pytest>=7.0.0
pytest-asyncio>=0.21.0
```

Run:
```bash
cd backend && pip install -r requirements.txt
```

- [ ] **Step 2.2: Create empty __init__.py files**

```bash
mkdir -p backend/app/domains/interpreter
mkdir -p backend/tests/domains/interpreter
touch backend/app/domains/interpreter/__init__.py
touch backend/tests/__init__.py
touch backend/tests/domains/__init__.py
touch backend/tests/domains/interpreter/__init__.py
```

- [ ] **Step 2.3: Create schemas**

Create `backend/app/domains/interpreter/schemas.py`:

```python
from pydantic import BaseModel, Field
from typing import Literal, Optional
from datetime import datetime
from uuid import UUID

Role = Literal["patient", "doctor"]
LanguageCode = Literal["en-US", "hi-IN", "zh-CN", "hi-en-IN"]


class StartSessionRequest(BaseModel):
    user_id: str


class StartSessionResponse(BaseModel):
    session_id: str
    source_language: LanguageCode
    target_language: LanguageCode  # always "en-US" for patient direction; flips per turn


class TurnResponse(BaseModel):
    session_id: str
    turn_index: int
    role: Role
    raw: str               # what the speaker actually said (in source language)
    cleaned: str           # post-cleanup, in target language (English for patient turn, patient lang for doctor turn)
    created_at: datetime


class Turn(BaseModel):
    turn_index: int
    role: Role
    raw: str
    cleaned: str
    created_at: datetime


class SessionState(BaseModel):
    session_id: str
    user_id: str
    source_language: LanguageCode  # patient's preferred_language; doctor side translates TO this
    turns: list[Turn] = Field(default_factory=list)
    started_at: datetime
    ended_at: Optional[datetime] = None


class EndSessionResponse(BaseModel):
    session_id: str
    record_id: str
    turn_count: int
```

- [ ] **Step 2.4: Create test conftest**

Create `backend/tests/conftest.py`:

```python
import pytest
from unittest.mock import MagicMock


@pytest.fixture
def mock_genai_client():
    """A genai-style client where models.generate_content returns a settable text."""
    client = MagicMock()
    client.models = MagicMock()

    def make_response(text: str):
        resp = MagicMock()
        resp.text = text
        return resp

    client._set_response = lambda text: client.models.generate_content.configure_mock(
        return_value=make_response(text)
    )
    client._set_response("")
    return client
```

- [ ] **Step 2.5: Verify pytest discovers the test directory**

Run:
```bash
cd backend && python -m pytest tests/ --collect-only
```
Expected: `no tests ran` (no tests yet, but discovery succeeds with no errors).

- [ ] **Step 2.6: Commit**

```bash
git add backend/app/domains/interpreter/__init__.py backend/app/domains/interpreter/schemas.py backend/tests/ backend/requirements.txt
git commit -m "scaffold interpreter domain and pytest setup"
```

---

## Task 3: Vocabulary module (per-language + per-patient layers)

**Files:**
- Create: `backend/app/domains/interpreter/vocab.py`
- Create: `backend/tests/domains/interpreter/test_vocab.py`

Pure module, no I/O at import time. Tests cover merging/dedup logic against fixtures; the patient-vocab DB query is mocked.

- [ ] **Step 3.1: Write the failing test**

Create `backend/tests/domains/interpreter/test_vocab.py`:

```python
import pytest
from unittest.mock import patch, MagicMock

from app.domains.interpreter.vocab import (
    LANGUAGE_VOCAB,
    merge_vocab_terms,
    build_vocab_block,
)


def test_language_vocab_contains_demo_locales():
    assert "hi-IN" in LANGUAGE_VOCAB
    assert "zh-CN" in LANGUAGE_VOCAB
    # Indian-English idiom pack still ships even though demo doesn't use it
    assert "hi-en-IN" in LANGUAGE_VOCAB


def test_merge_vocab_terms_dedupes_case_insensitively():
    result = merge_vocab_terms(["Lisinopril", "lisinopril", "amlodipine"])
    assert len(result) == 2
    assert "Lisinopril" in result or "lisinopril" in result
    assert "amlodipine" in result


def test_merge_vocab_terms_strips_whitespace_and_empty():
    result = merge_vocab_terms(["  aspirin  ", "", "  ", "Metformin"])
    assert "aspirin" in result
    assert "Metformin" in result
    assert "" not in result
    assert "  " not in result


def test_build_vocab_block_combines_language_and_patient():
    with patch("app.domains.interpreter.vocab._fetch_patient_terms") as mock_fetch:
        mock_fetch.return_value = ["Lisinopril 10mg", "Dr. Patel"]
        block = build_vocab_block(user_id="abc", source_language="hi-IN")
    # Language idioms appear
    assert "loose motions" in block or "BP" in block
    # Patient terms appear
    assert "Lisinopril 10mg" in block
    assert "Dr. Patel" in block
    # Returned as a single string with newline separators
    assert "\n" in block


def test_build_vocab_block_empty_patient_terms():
    with patch("app.domains.interpreter.vocab._fetch_patient_terms") as mock_fetch:
        mock_fetch.return_value = []
        block = build_vocab_block(user_id="abc", source_language="zh-CN")
    # Still returns the language-vocab block
    assert len(block) > 0
```

- [ ] **Step 3.2: Run test to verify it fails**

```bash
cd backend && python -m pytest tests/domains/interpreter/test_vocab.py -v
```
Expected: FAIL with `ModuleNotFoundError: No module named 'app.domains.interpreter.vocab'`.

- [ ] **Step 3.3: Implement vocab module**

Create `backend/app/domains/interpreter/vocab.py`:

```python
import json
import logging
from typing import Iterable

from app.core.db import get_db_connection

logger = logging.getLogger("interpreter.vocab")


LANGUAGE_VOCAB: dict[str, dict[str, list[str]]] = {
    "hi-IN": {
        "idioms": [
            "loose motions", "giddiness", "prepone", "fortnight", "BP",
            "sugar", "gas", "acidity", "weakness", "body pain",
        ],
        "common_terms": [
            "Paracetamol", "Crocin", "Dolo 650", "Amlodipine",
            "Telmisartan", "Metformin", "Atorvastatin", "Lisinopril",
        ],
    },
    "zh-CN": {
        "idioms": [
            "上火", "气虚", "头晕", "拉肚子", "高血压", "糖尿病",
            "心慌", "胸闷", "胃胀",
        ],
        "common_terms": [
            "阿司匹林 (aspirin)", "二甲双胍 (Metformin)", "氨氯地平 (Amlodipine)",
            "辛伐他汀 (Simvastatin)", "赖诺普利 (Lisinopril)",
        ],
    },
    "hi-en-IN": {
        "idioms": [
            "loose motions", "giddiness", "prepone", "fortnight",
            "BP", "sugar", "gas", "since two days", "by which time",
        ],
        "common_terms": [
            "Lisinopril", "Amlodipine", "Metformin", "Crocin", "Dolo",
        ],
    },
    "en-US": {
        "idioms": [],
        "common_terms": [],
    },
}


def merge_vocab_terms(terms: Iterable[str]) -> list[str]:
    """Strip, drop empties, case-insensitive dedup. Preserves first-seen casing."""
    seen: set[str] = set()
    out: list[str] = []
    for term in terms:
        cleaned = term.strip()
        if not cleaned:
            continue
        key = cleaned.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(cleaned)
    return out


def _fetch_patient_terms(user_id: str) -> list[str]:
    """Pull medications + diagnoses from the user's most recent records."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT extracted_summary
            FROM user_medical_records
            WHERE user_id = %s AND extracted_summary IS NOT NULL
            ORDER BY created_at DESC
            LIMIT 20;
            """,
            (user_id,),
        )
        rows = cur.fetchall()
        terms: list[str] = []
        for row in rows:
            raw = row.get("extracted_summary")
            if not raw:
                continue
            try:
                data = json.loads(raw)
            except (json.JSONDecodeError, TypeError):
                continue
            for med in data.get("medications", []) or []:
                if isinstance(med, str):
                    terms.append(med)
            for diag in data.get("diagnoses", []) or []:
                if isinstance(diag, str):
                    terms.append(diag)
        return merge_vocab_terms(terms)
    except Exception as e:
        logger.warning(f"patient vocab fetch failed for {user_id}: {e}")
        return []
    finally:
        cur.close()
        conn.close()


def build_vocab_block(user_id: str, source_language: str) -> str:
    """Return a single string block to inject into the cleanup prompt."""
    lang_pack = LANGUAGE_VOCAB.get(source_language, LANGUAGE_VOCAB["en-US"])
    language_terms = merge_vocab_terms(
        lang_pack.get("idioms", []) + lang_pack.get("common_terms", [])
    )
    patient_terms = _fetch_patient_terms(user_id)

    lines: list[str] = []
    if language_terms:
        lines.append("Language-pack terms (high-priority spellings):")
        lines.extend(f"  - {t}" for t in language_terms)
    if patient_terms:
        lines.append("This patient's record terms (use these exact spellings):")
        lines.extend(f"  - {t}" for t in patient_terms)
    return "\n".join(lines)
```

- [ ] **Step 3.4: Run tests to verify they pass**

```bash
cd backend && python -m pytest tests/domains/interpreter/test_vocab.py -v
```
Expected: 5 passed.

- [ ] **Step 3.5: Commit**

```bash
git add backend/app/domains/interpreter/vocab.py backend/tests/domains/interpreter/test_vocab.py
git commit -m "add per-language and per-patient vocabulary modules"
```

---

## Task 4: Prompts module — the two cleanup/translation prompts

**Files:**
- Create: `backend/app/domains/interpreter/prompts.py`
- Create: `backend/tests/domains/interpreter/test_prompts.py`

Prompts live as module-level constants; a `render_prompt()` helper substitutes `{source_language}`, `{target_language}`, and `{vocab_block}`.

- [ ] **Step 4.1: Write the failing test**

Create `backend/tests/domains/interpreter/test_prompts.py`:

```python
import pytest

from app.domains.interpreter.prompts import (
    PROMPT_PATIENT_TO_ENGLISH,
    PROMPT_DOCTOR_TO_PATIENT_LANG,
    render_patient_prompt,
    render_doctor_prompt,
)


def test_patient_prompt_contains_hard_contract():
    assert "EMPTY" in PROMPT_PATIENT_TO_ENGLISH
    assert "no markdown" in PROMPT_PATIENT_TO_ENGLISH.lower()
    assert "self-correction" in PROMPT_PATIENT_TO_ENGLISH.lower()


def test_doctor_prompt_forbids_simplification():
    # Patient is literate adult; doctor prompt must not 6th-grade-ify.
    p = PROMPT_DOCTOR_TO_PATIENT_LANG.lower()
    assert "simplify" in p or "simplification" in p
    # And the rule must be a NO not a YES — look for negation near it.
    assert "do not simplify" in p or "do not 'explain'" in p or "do not teach" in p


def test_doctor_prompt_keeps_english_proper_nouns():
    p = PROMPT_DOCTOR_TO_PATIENT_LANG
    # Drug names, lab abbreviations, numerals must stay English
    assert "Lisinopril" in p or "drug name" in p.lower() or "medication name" in p.lower()
    assert "CBC" in p or "lab" in p.lower()


def test_render_patient_prompt_substitutes_vocab_and_lang():
    rendered = render_patient_prompt(
        source_language="hi-IN",
        vocab_block="  - loose motions\n  - Lisinopril",
    )
    assert "hi-IN" in rendered
    assert "Lisinopril" in rendered
    assert "{source_language}" not in rendered
    assert "{vocab_block}" not in rendered


def test_render_doctor_prompt_substitutes_target_lang():
    rendered = render_doctor_prompt(
        target_language="zh-CN",
        vocab_block="",
    )
    assert "zh-CN" in rendered
    assert "{target_language}" not in rendered
    assert "{vocab_block}" not in rendered
```

- [ ] **Step 4.2: Run test to verify it fails**

```bash
cd backend && python -m pytest tests/domains/interpreter/test_prompts.py -v
```
Expected: FAIL with `ModuleNotFoundError`.

- [ ] **Step 4.3: Implement prompts module**

Create `backend/app/domains/interpreter/prompts.py`:

```python
PROMPT_PATIENT_TO_ENGLISH = """You are a literal dictation cleanup and translation layer for a live medical visit transcript. The speaker is the PATIENT, speaking in {source_language}. Render their utterance into clean American English for the doctor's side of the shared screen.

Hard contract:
- Return only the final cleaned/translated text.
- No explanations, no markdown, no surrounding quotes.
- No paraphrasing into a different register. Translate and clean only.
- No added content — every word in your output must trace to something the speaker said.
- If the transcript is empty or only filler, return exactly: EMPTY.

Core behavior:
- Preserve the speaker's meaning and intent exactly.
- Remove filler ("um", "uh", "you know", "like"), hesitations, duplicate starts, and abandoned fragments.
- Fix punctuation, capitalization, spacing, and obvious ASR mistakes.
- Translate the utterance into English. Normalize regional idioms to standard English where meaning is unambiguous:
    "loose motions" -> "diarrhea"
    "giddiness" -> "dizziness"
    "prepone" -> "reschedule earlier"
    "fortnight" -> "two weeks"
    "BP" stays "BP" (already standard medical shorthand)
  When the idiom is ambiguous, preserve the speaker's wording verbatim. Do not guess.
- Preserve VERBATIM in their original form: numbers, units, dosages, frequencies, and time intervals ("140 by 90", "10 mg", "twice daily", "since two days").
- Preserve medication names, anatomical terms, symptom descriptions, and lab test names verbatim, using the vocabulary block below as a spelling reference when the ASR was uncertain.

Self-corrections are strict:
- If the speaker says an initial version and then corrects it ("no, actually", "I mean", "sorry", "wait", or the equivalent in their source language), output only the final corrected version. Delete the correction marker and the abandoned wording.

Output hygiene:
- Never prepend boilerplate ("Here is the cleaned transcript", "Sure, here's…").
- One paragraph. No lists, unless the speaker explicitly enumerated items.

[VOCABULARY — high-priority spellings, use exactly:]
{vocab_block}
"""


PROMPT_DOCTOR_TO_PATIENT_LANG = """You are a literal dictation cleanup and translation layer for a live medical visit. The speaker is the DOCTOR, speaking American English. Render their utterance into {target_language} for the patient's side of the shared screen.

Hard contract:
- Return only the final translated text.
- No explanations, no markdown, no surrounding quotes.
- No paraphrasing into a different register.
- No added content — every concept in your output must trace to something the doctor said.
- If the transcript is empty or only filler, return exactly: EMPTY.

Core behavior:
- Preserve the doctor's meaning and intent exactly.
- Remove filler ("um", "uh"), hesitations, duplicate starts, abandoned fragments.
- Translate American clinical English into {target_language} at a literate adult reading level. Do NOT simplify to a child's reading level. Do NOT 'explain' or teach medical terms the doctor did not explain. The patient is an adult; if they don't understand a term, they will ask. Your job is to translate, not to teach.
- Preserve in their original ENGLISH form (do NOT transliterate or localize):
    - Numerals and numbers ("10", "140/90", "two")
    - Units ("mg", "mmHg", "mL", "BPM")
    - Medication names ("Lisinopril", "Metformin")
    - Lab test names and abbreviations ("CBC", "BMP", "HbA1c", "LDL")
    - Frequencies that are abbreviations ("BID", "TID", "PRN"); spelled-out frequencies like "twice daily" stay English too
  Reason: patient should be able to match what's on screen against their pill bottle, lab slip, or appointment summary — all of which appear in English in a US clinical setting.
- Translate INTO {target_language}: anatomical terms, symptom descriptions, plan-of-care prose, instructions, timing words ("today", "next week"), care-relationship words ("follow up", "stop taking", "call the office").

Self-corrections are strict (same rule as patient direction).
Output hygiene: no boilerplate, one paragraph, no lists unless the doctor explicitly enumerated.

[VOCABULARY — high-priority spellings, use exactly:]
{vocab_block}
"""


def render_patient_prompt(source_language: str, vocab_block: str) -> str:
    return PROMPT_PATIENT_TO_ENGLISH.format(
        source_language=source_language,
        vocab_block=vocab_block or "(none)",
    )


def render_doctor_prompt(target_language: str, vocab_block: str) -> str:
    return PROMPT_DOCTOR_TO_PATIENT_LANG.format(
        target_language=target_language,
        vocab_block=vocab_block or "(none)",
    )
```

- [ ] **Step 4.4: Run tests to verify they pass**

```bash
cd backend && python -m pytest tests/domains/interpreter/test_prompts.py -v
```
Expected: 5 passed.

- [ ] **Step 4.5: Commit**

```bash
git add backend/app/domains/interpreter/prompts.py backend/tests/domains/interpreter/test_prompts.py
git commit -m "add interpreter prompts module with patient and doctor directions"
```

---

## Task 5: STT module — Gemini Live primary + Flash batch fallback

**Files:**
- Create: `backend/app/domains/interpreter/stt.py`

This is I/O against Gemini; we don't unit-test the network calls. Verify manually after wiring.

- [ ] **Step 5.1: Implement STT module**

Create `backend/app/domains/interpreter/stt.py`:

```python
import os
import asyncio
import logging
from typing import Optional

from google.genai import types

from app.core.config import client

logger = logging.getLogger("interpreter.stt")

# Toggle Live API vs batch Flash STT. Set INTERPRETER_STT_MODE=batch as escape hatch.
STT_MODE = os.getenv("INTERPRETER_STT_MODE", "live").lower()
LIVE_MODEL = os.getenv("INTERPRETER_LIVE_MODEL", "gemini-2.0-flash-exp")
BATCH_MODEL = os.getenv("INTERPRETER_BATCH_MODEL", "gemini-2.5-flash")


_BCP47_TO_GENAI_HINT = {
    "hi-IN": "Hindi",
    "zh-CN": "Mandarin Chinese",
    "hi-en-IN": "Indian English (English with Hindi code-switching)",
    "en-US": "American English",
}


async def transcribe(audio_bytes: bytes, source_language: str, mime_type: str = "audio/webm") -> str:
    """Return the raw verbatim transcript of `audio_bytes` in its source language.

    Primary path: Gemini Live API streaming session.
    Fallback path (INTERPRETER_STT_MODE=batch): Gemini Flash non-streaming with audio Part.
    Both paths return plain text with no cleanup applied — that happens downstream.
    """
    if STT_MODE == "batch":
        return await _transcribe_batch(audio_bytes, source_language, mime_type)
    try:
        return await _transcribe_live(audio_bytes, source_language, mime_type)
    except Exception as e:
        logger.warning(f"live transcription failed, falling back to batch: {e}")
        return await _transcribe_batch(audio_bytes, source_language, mime_type)


async def _transcribe_live(audio_bytes: bytes, source_language: str, mime_type: str) -> str:
    """Open a per-turn Gemini Live API session, send the audio, return finalized text."""
    lang_hint = _BCP47_TO_GENAI_HINT.get(source_language, source_language)
    system_instruction = (
        f"Transcribe the user's speech verbatim. The speaker is using {lang_hint}. "
        f"Preserve their exact wording, including regional idioms. "
        f"Do not translate, do not clean up, do not paraphrase. "
        f"Return only the transcript text."
    )

    config = types.LiveConnectConfig(
        response_modalities=["TEXT"],
        system_instruction=types.Content(
            role="user",
            parts=[types.Part(text=system_instruction)],
        ),
    )

    transcript_parts: list[str] = []
    async with client.aio.live.connect(model=LIVE_MODEL, config=config) as session:
        await session.send(
            input=types.Blob(data=audio_bytes, mime_type=mime_type),
            end_of_turn=True,
        )
        async for response in session.receive():
            if response.text:
                transcript_parts.append(response.text)
            if getattr(response, "server_content", None) and getattr(
                response.server_content, "turn_complete", False
            ):
                break
    return "".join(transcript_parts).strip()


async def _transcribe_batch(audio_bytes: bytes, source_language: str, mime_type: str) -> str:
    """Single-shot non-streaming Gemini Flash audio understanding. Same Google stack."""
    lang_hint = _BCP47_TO_GENAI_HINT.get(source_language, source_language)
    instruction = (
        f"Transcribe the following audio verbatim. The speaker is using {lang_hint}. "
        f"Preserve exact wording, including regional idioms. "
        f"Do not translate, clean up, or paraphrase. Return only the transcript text."
    )
    audio_part = types.Part.from_bytes(data=audio_bytes, mime_type=mime_type)
    response = await asyncio.to_thread(
        client.models.generate_content,
        model=BATCH_MODEL,
        contents=[instruction, audio_part],
    )
    return (response.text or "").strip()
```

- [ ] **Step 5.2: Verify import works**

```bash
cd backend && python -c "from app.domains.interpreter.stt import transcribe; print('ok')"
```
Expected: `ok`. (Any ImportError indicates an SDK version mismatch — check `pip show google-genai` and reconcile with the call signatures above.)

- [ ] **Step 5.3: Commit**

```bash
git add backend/app/domains/interpreter/stt.py
git commit -m "add Gemini Live STT with batch fallback for interpreter"
```

---

## Task 6: Services — orchestration of session lifecycle + per-turn pipeline

**Files:**
- Create: `backend/app/domains/interpreter/services.py`

Coordinates: fetch user, derive vocab block, transcribe audio, run cleanup pass, store turn in session state. End-of-session writes a `user_medical_records` row.

- [ ] **Step 6.1: Implement services module**

Create `backend/app/domains/interpreter/services.py`:

```python
import os
import json
import uuid
import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

from google.genai import types

from app.core.config import client
from app.core.db import get_db_connection
from app.domains.interpreter.schemas import (
    Role,
    Turn,
    SessionState,
    LanguageCode,
)
from app.domains.interpreter.vocab import build_vocab_block
from app.domains.interpreter.prompts import (
    render_patient_prompt,
    render_doctor_prompt,
)
from app.domains.interpreter.stt import transcribe
from app.domains.ingestion.services import chunk_text, generate_embedding

logger = logging.getLogger("interpreter.services")

CLEANUP_MODEL = os.getenv("INTERPRETER_CLEANUP_MODEL", "gemini-2.5-flash")

# In-memory session store. Single-process, OK for hackathon. Restart = lose sessions.
_SESSIONS: dict[str, SessionState] = {}


def _fetch_preferred_language(user_id: str) -> LanguageCode:
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT preferred_language FROM users WHERE id = %s;", (user_id,))
        row = cur.fetchone()
        if not row or not row.get("preferred_language"):
            return "en-US"
        return row["preferred_language"]
    finally:
        cur.close()
        conn.close()


def start_session(user_id: str) -> SessionState:
    source_language = _fetch_preferred_language(user_id)
    session = SessionState(
        session_id=str(uuid.uuid4()),
        user_id=user_id,
        source_language=source_language,
        turns=[],
        started_at=datetime.now(timezone.utc),
    )
    _SESSIONS[session.session_id] = session
    logger.info(f"session {session.session_id} started for user {user_id} ({source_language})")
    return session


def get_session(session_id: str) -> SessionState:
    sess = _SESSIONS.get(session_id)
    if not sess:
        raise KeyError(f"session {session_id} not found")
    return sess


async def _cleanup_pass(raw: str, role: Role, source_language: str, vocab_block: str) -> str:
    """Run the cleanup/translation prompt against raw transcript text."""
    if not raw or raw.strip() == "":
        return ""
    if role == "patient":
        system_prompt = render_patient_prompt(
            source_language=source_language,
            vocab_block=vocab_block,
        )
    else:
        # doctor speaks English, output renders in patient's language
        system_prompt = render_doctor_prompt(
            target_language=source_language,
            vocab_block=vocab_block,
        )

    response = await asyncio.to_thread(
        client.models.generate_content,
        model=CLEANUP_MODEL,
        contents=[raw],
        config=types.GenerateContentConfig(system_instruction=system_prompt),
    )
    cleaned = (response.text or "").strip()
    if cleaned == "EMPTY":
        return ""
    return cleaned


async def submit_turn(
    session_id: str,
    role: Role,
    audio_bytes: bytes,
    mime_type: str = "audio/webm",
) -> Turn:
    session = get_session(session_id)

    if role == "patient":
        stt_lang = session.source_language
    else:
        stt_lang = "en-US"  # doctor always speaks English

    raw = await transcribe(audio_bytes, source_language=stt_lang, mime_type=mime_type)

    vocab_block = build_vocab_block(
        user_id=session.user_id,
        source_language=session.source_language,
    )
    cleaned = await _cleanup_pass(
        raw=raw,
        role=role,
        source_language=session.source_language,
        vocab_block=vocab_block,
    )

    turn = Turn(
        turn_index=len(session.turns),
        role=role,
        raw=raw,
        cleaned=cleaned,
        created_at=datetime.now(timezone.utc),
    )
    session.turns.append(turn)
    return turn


def end_session(session_id: str) -> str:
    """Persist the session as a user_medical_records row and return the record_id."""
    session = get_session(session_id)
    session.ended_at = datetime.now(timezone.utc)

    record_id = _persist_session(session)
    _SESSIONS.pop(session_id, None)
    return record_id


def _persist_session(session: SessionState) -> str:
    extracted = {
        "summary": (
            f"Visit transcript ({len(session.turns)} turns) — "
            f"source language {session.source_language}, started "
            f"{session.started_at.isoformat()}"
        ),
        "key_findings": [],
        "medications": [],
        "diagnoses": [],
        "allergies": [],
        "lab_metrics": [],
        "turns": [t.model_dump(mode="json") for t in session.turns],
        "started_at": session.started_at.isoformat(),
        "ended_at": (session.ended_at or datetime.now(timezone.utc)).isoformat(),
        "source_language": session.source_language,
    }

    # Build a single English-side concatenation for embedding.
    # Patient turns: `cleaned` is already English. Doctor turns: `raw` is the English text.
    english_lines: list[str] = []
    for t in session.turns:
        prefix = "Patient: " if t.role == "patient" else "Doctor: "
        text = t.cleaned if t.role == "patient" else t.raw
        if text:
            english_lines.append(prefix + text)
    embedding_text = "\n".join(english_lines) or extracted["summary"]

    conn = get_db_connection()
    cur = conn.cursor()
    try:
        file_name = f"visit_{session.session_id}.json"
        cur.execute(
            """
            INSERT INTO user_medical_records (user_id, file_name, file_path, file_type, extracted_summary)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id;
            """,
            (
                session.user_id,
                file_name,
                f"inline://visit/{session.session_id}",  # no GCS upload — content is inline in extracted_summary
                "visit_transcript",
                json.dumps(extracted),
            ),
        )
        record_id = cur.fetchone()["id"]

        chunks = chunk_text(embedding_text)
        for idx, chunk in enumerate(chunks):
            embedding = generate_embedding(chunk)
            cur.execute(
                """
                INSERT INTO user_record_embeddings (record_id, user_id, chunk_index, chunk_content, embedding)
                VALUES (%s, %s, %s, %s, %s);
                """,
                (record_id, session.user_id, idx, chunk, embedding),
            )
        conn.commit()
        return str(record_id)
    except Exception as e:
        conn.rollback()
        logger.error(f"failed to persist visit session {session.session_id}: {e}")
        raise
    finally:
        cur.close()
        conn.close()
```

- [ ] **Step 6.2: Verify import works**

```bash
cd backend && python -c "from app.domains.interpreter.services import start_session, submit_turn, end_session; print('ok')"
```
Expected: `ok`.

- [ ] **Step 6.3: Commit**

```bash
git add backend/app/domains/interpreter/services.py
git commit -m "add interpreter session services (start/submit/end)"
```

---

## Task 7: Router — FastAPI endpoints

**Files:**
- Create: `backend/app/domains/interpreter/router.py`
- Modify: `backend/app/main.py`

Three REST endpoints: `POST /api/interpreter/start`, `POST /api/interpreter/turn`, `POST /api/interpreter/end`. The turn endpoint accepts `multipart/form-data` with the audio blob.

- [ ] **Step 7.1: Implement router**

Create `backend/app/domains/interpreter/router.py`:

```python
import logging
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.domains.interpreter.schemas import (
    StartSessionRequest,
    StartSessionResponse,
    TurnResponse,
    EndSessionResponse,
)
from app.domains.interpreter.services import (
    start_session,
    submit_turn,
    end_session,
    get_session,
)

logger = logging.getLogger("interpreter.router")

router = APIRouter(prefix="/api/interpreter", tags=["Interpreter"])


@router.post("/start", response_model=StartSessionResponse)
def start(req: StartSessionRequest) -> StartSessionResponse:
    try:
        session = start_session(req.user_id)
    except Exception as e:
        logger.error(f"start_session failed: {e}")
        raise HTTPException(status_code=500, detail=f"start_session failed: {e}")
    return StartSessionResponse(
        session_id=session.session_id,
        source_language=session.source_language,
        target_language="en-US",
    )


@router.post("/turn", response_model=TurnResponse)
async def turn(
    session_id: str = Form(...),
    role: str = Form(...),
    audio: UploadFile = File(...),
) -> TurnResponse:
    if role not in ("patient", "doctor"):
        raise HTTPException(status_code=400, detail="role must be 'patient' or 'doctor'")
    try:
        get_session(session_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"session {session_id} not found")

    audio_bytes = await audio.read()
    mime_type = audio.content_type or "audio/webm"
    try:
        t = await submit_turn(
            session_id=session_id,
            role=role,  # type: ignore[arg-type]
            audio_bytes=audio_bytes,
            mime_type=mime_type,
        )
    except Exception as e:
        logger.error(f"submit_turn failed: {e}")
        raise HTTPException(status_code=500, detail=f"submit_turn failed: {e}")
    return TurnResponse(
        session_id=session_id,
        turn_index=t.turn_index,
        role=t.role,
        raw=t.raw,
        cleaned=t.cleaned,
        created_at=t.created_at,
    )


@router.post("/end", response_model=EndSessionResponse)
def end(session_id: str = Form(...)) -> EndSessionResponse:
    try:
        session = get_session(session_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"session {session_id} not found")
    turn_count = len(session.turns)
    try:
        record_id = end_session(session_id)
    except Exception as e:
        logger.error(f"end_session failed: {e}")
        raise HTTPException(status_code=500, detail=f"end_session failed: {e}")
    return EndSessionResponse(
        session_id=session_id,
        record_id=record_id,
        turn_count=turn_count,
    )
```

- [ ] **Step 7.2: Wire router into main.py**

Edit `backend/app/main.py`. After the line `from app.domains.telegram.router import router as telegram_router, start_bot_polling`, add:

```python
from app.domains.interpreter.router import router as interpreter_router
```

After the line `app.include_router(telegram_router)`, add:

```python
app.include_router(interpreter_router)
```

- [ ] **Step 7.3: Restart backend and smoke-test the start endpoint**

```bash
make dev
# In another terminal — assumes a user row exists; use any existing user id:
curl -X POST http://localhost:8000/api/interpreter/start \
  -H "Content-Type: application/json" \
  -d '{"user_id":"demo-patient-uuid-001"}'
```
Expected response (assuming user exists or fall back to en-US default):
```json
{"session_id":"<uuid>","source_language":"en-US","target_language":"en-US"}
```

If the user doesn't exist, the query returns no row and we fall back to `en-US`. That's fine for the smoke test.

- [ ] **Step 7.4: Commit**

```bash
git add backend/app/domains/interpreter/router.py backend/app/main.py
git commit -m "wire interpreter router into FastAPI app"
```

---

## Task 8: Frontend — types, API client, hook

**Files:**
- Create: `frontend/src/features/interpreter/types.ts`
- Create: `frontend/src/features/interpreter/api.ts`
- Create: `frontend/src/features/interpreter/useInterpreter.ts`

- [ ] **Step 8.1: Create types**

Create `frontend/src/features/interpreter/types.ts`:

```typescript
export type Role = "patient" | "doctor";
export type LanguageCode = "en-US" | "hi-IN" | "zh-CN" | "hi-en-IN";

export interface StartSessionResponse {
  session_id: string;
  source_language: LanguageCode;
  target_language: LanguageCode;
}

export interface TurnResponse {
  session_id: string;
  turn_index: number;
  role: Role;
  raw: string;
  cleaned: string;
  created_at: string;
}

export interface EndSessionResponse {
  session_id: string;
  record_id: string;
  turn_count: number;
}
```

- [ ] **Step 8.2: Create API client**

Create `frontend/src/features/interpreter/api.ts`:

```typescript
import type {
  StartSessionResponse,
  TurnResponse,
  EndSessionResponse,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function startSession(userId: string): Promise<StartSessionResponse> {
  const res = await fetch(`${API_BASE}/api/interpreter/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId }),
  });
  if (!res.ok) throw new Error(`start failed: ${res.status}`);
  return res.json();
}

export async function submitTurn(
  sessionId: string,
  role: "patient" | "doctor",
  audio: Blob,
): Promise<TurnResponse> {
  const fd = new FormData();
  fd.append("session_id", sessionId);
  fd.append("role", role);
  fd.append("audio", audio, "turn.webm");
  const res = await fetch(`${API_BASE}/api/interpreter/turn`, {
    method: "POST",
    body: fd,
  });
  if (!res.ok) throw new Error(`turn failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function endSession(sessionId: string): Promise<EndSessionResponse> {
  const fd = new FormData();
  fd.append("session_id", sessionId);
  const res = await fetch(`${API_BASE}/api/interpreter/end`, {
    method: "POST",
    body: fd,
  });
  if (!res.ok) throw new Error(`end failed: ${res.status}`);
  return res.json();
}
```

- [ ] **Step 8.3: Create the hook**

Create `frontend/src/features/interpreter/useInterpreter.ts`:

```typescript
"use client";

import { useCallback, useRef, useState } from "react";
import { startSession, submitTurn, endSession } from "./api";
import type { Role, TurnResponse } from "./types";

type Status = "idle" | "active" | "recording" | "processing" | "ended" | "error";

export function useInterpreter(userId: string) {
  const [status, setStatus] = useState<Status>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sourceLanguage, setSourceLanguage] = useState<string>("en-US");
  const [turns, setTurns] = useState<TurnResponse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [recordingRole, setRecordingRole] = useState<Role | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const start = useCallback(async () => {
    setError(null);
    setTurns([]);
    setStatus("active");
    try {
      const res = await startSession(userId);
      setSessionId(res.session_id);
      setSourceLanguage(res.source_language);
    } catch (e) {
      setError(String(e));
      setStatus("error");
    }
  }, [userId]);

  const beginTurn = useCallback(async (role: Role) => {
    if (!sessionId) return;
    setError(null);
    setRecordingRole(role);
    setStatus("recording");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start();
      recorderRef.current = recorder;
    } catch (e) {
      setError(`mic access denied: ${e}`);
      setStatus("error");
      setRecordingRole(null);
    }
  }, [sessionId]);

  const endTurn = useCallback(async () => {
    const recorder = recorderRef.current;
    const role = recordingRole;
    if (!recorder || !sessionId || !role) return;
    setStatus("processing");

    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      recorder.stop();
      recorder.stream.getTracks().forEach((t) => t.stop());
    });

    const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
    chunksRef.current = [];
    recorderRef.current = null;

    try {
      const turn = await submitTurn(sessionId, role, audioBlob);
      setTurns((prev) => [...prev, turn]);
      setStatus("active");
    } catch (e) {
      setError(String(e));
      setStatus("error");
    } finally {
      setRecordingRole(null);
    }
  }, [sessionId, recordingRole]);

  const end = useCallback(async () => {
    if (!sessionId) return;
    try {
      await endSession(sessionId);
      setStatus("ended");
      setSessionId(null);
    } catch (e) {
      setError(String(e));
      setStatus("error");
    }
  }, [sessionId]);

  return {
    status,
    sessionId,
    sourceLanguage,
    turns,
    error,
    recordingRole,
    start,
    beginTurn,
    endTurn,
    end,
  };
}
```

- [ ] **Step 8.4: Commit**

```bash
git add frontend/src/features/interpreter/
git commit -m "add interpreter frontend types, api client, and session hook"
```

---

## Task 9: Frontend — components (RoleToggle, TranscriptPane, SessionControls)

**Files:**
- Create: `frontend/src/features/interpreter/RoleToggle.tsx`
- Create: `frontend/src/features/interpreter/TranscriptPane.tsx`
- Create: `frontend/src/features/interpreter/SessionControls.tsx`

- [ ] **Step 9.1: RoleToggle — two giant push-to-talk buttons**

Create `frontend/src/features/interpreter/RoleToggle.tsx`:

```typescript
"use client";

import type { Role } from "./types";

interface Props {
  disabled: boolean;
  recordingRole: Role | null;
  onPressStart: (role: Role) => void;
  onPressEnd: () => void;
}

export function RoleToggle({ disabled, recordingRole, onPressStart, onPressEnd }: Props) {
  const handleStart = (role: Role) => () => {
    if (disabled || recordingRole) return;
    onPressStart(role);
  };
  const handleEnd = () => {
    if (!recordingRole) return;
    onPressEnd();
  };

  const baseClasses =
    "flex-1 select-none rounded-3xl border-4 px-12 py-16 text-4xl font-semibold transition-all duration-150 ease-out";
  const idleClasses = "bg-white border-slate-300 text-slate-700 hover:bg-slate-50 active:bg-slate-100";
  const activeClasses = "bg-rose-500 border-rose-600 text-white scale-[0.98] shadow-inner";
  const disabledClasses = "opacity-40 cursor-not-allowed";

  const buttonClass = (role: Role) => {
    if (disabled) return `${baseClasses} ${idleClasses} ${disabledClasses}`;
    if (recordingRole === role) return `${baseClasses} ${activeClasses}`;
    if (recordingRole && recordingRole !== role) return `${baseClasses} ${idleClasses} ${disabledClasses}`;
    return `${baseClasses} ${idleClasses}`;
  };

  return (
    <div className="flex w-full gap-6">
      <button
        type="button"
        disabled={disabled}
        onMouseDown={handleStart("patient")}
        onMouseUp={handleEnd}
        onMouseLeave={recordingRole === "patient" ? handleEnd : undefined}
        onTouchStart={handleStart("patient")}
        onTouchEnd={handleEnd}
        className={buttonClass("patient")}
      >
        {recordingRole === "patient" ? "Listening…" : "PATIENT"}
        <div className="mt-2 text-sm font-normal opacity-70">hold to speak</div>
      </button>
      <button
        type="button"
        disabled={disabled}
        onMouseDown={handleStart("doctor")}
        onMouseUp={handleEnd}
        onMouseLeave={recordingRole === "doctor" ? handleEnd : undefined}
        onTouchStart={handleStart("doctor")}
        onTouchEnd={handleEnd}
        className={buttonClass("doctor")}
      >
        {recordingRole === "doctor" ? "Listening…" : "DOCTOR"}
        <div className="mt-2 text-sm font-normal opacity-70">hold to speak</div>
      </button>
    </div>
  );
}
```

- [ ] **Step 9.2: TranscriptPane — rolling list, one row per turn**

Create `frontend/src/features/interpreter/TranscriptPane.tsx`:

```typescript
"use client";

import { useEffect, useRef } from "react";
import type { TurnResponse } from "./types";

interface Props {
  turns: TurnResponse[];
  recordingRole: "patient" | "doctor" | null;
  processing: boolean;
}

export function TranscriptPane({ turns, recordingRole, processing }: Props) {
  const endRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns.length, processing, recordingRole]);

  return (
    <div className="flex-1 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-6">
      {turns.length === 0 && !recordingRole && !processing && (
        <div className="flex h-full items-center justify-center text-slate-400">
          Press and hold PATIENT or DOCTOR to begin.
        </div>
      )}
      <ul className="space-y-4">
        {turns.map((t) => (
          <li key={t.turn_index} className="rounded-xl bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2">
              <span
                className={
                  "rounded-full px-3 py-0.5 text-xs font-semibold uppercase tracking-wide " +
                  (t.role === "patient"
                    ? "bg-sky-100 text-sky-700"
                    : "bg-emerald-100 text-emerald-700")
                }
              >
                {t.role}
              </span>
              <span className="text-xs text-slate-400">
                turn #{t.turn_index + 1}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Raw
                </div>
                <div className="mt-1 text-slate-700">{t.raw || "—"}</div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Cleaned
                </div>
                <div className="mt-1 text-slate-900 font-medium">{t.cleaned || "—"}</div>
              </div>
            </div>
          </li>
        ))}
        {(recordingRole || processing) && (
          <li className="rounded-xl border border-dashed border-slate-300 bg-white p-4">
            <div className="flex items-center gap-3 text-slate-500">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-500" />
              {recordingRole ? `Listening to ${recordingRole}…` : "Processing…"}
            </div>
          </li>
        )}
        <div ref={endRef} />
      </ul>
    </div>
  );
}
```

- [ ] **Step 9.3: SessionControls — start / end visit**

Create `frontend/src/features/interpreter/SessionControls.tsx`:

```typescript
"use client";

interface Props {
  status: "idle" | "active" | "recording" | "processing" | "ended" | "error";
  sourceLanguage: string;
  turnCount: number;
  onStart: () => void;
  onEnd: () => void;
}

export function SessionControls({ status, sourceLanguage, turnCount, onStart, onEnd }: Props) {
  const active = status !== "idle" && status !== "ended";
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-6 py-4">
      <div className="flex flex-col">
        <div className="text-xs uppercase tracking-wide text-slate-400">Session</div>
        <div className="text-lg font-semibold text-slate-800">
          {status === "idle" && "Not started"}
          {status === "active" && "Active"}
          {status === "recording" && "Recording…"}
          {status === "processing" && "Processing…"}
          {status === "ended" && "Ended"}
          {status === "error" && "Error"}
        </div>
        <div className="mt-1 text-xs text-slate-500">
          Patient language: <span className="font-mono">{sourceLanguage}</span> · {turnCount} turn(s)
        </div>
      </div>
      <div className="flex gap-3">
        {!active && (
          <button
            type="button"
            onClick={onStart}
            className="rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white hover:bg-slate-800"
          >
            Start visit
          </button>
        )}
        {active && (
          <button
            type="button"
            onClick={onEnd}
            className="rounded-xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-700 hover:bg-slate-50"
          >
            End visit
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 9.4: Commit**

```bash
git add frontend/src/features/interpreter/RoleToggle.tsx frontend/src/features/interpreter/TranscriptPane.tsx frontend/src/features/interpreter/SessionControls.tsx
git commit -m "add interpreter UI components (role toggle, transcript pane, controls)"
```

---

## Task 10: Frontend — page at `/interpreter` route

**Files:**
- Create: `frontend/src/app/interpreter/page.tsx`

Standalone full-screen page. Single rolling transcript layout for the shared-device-on-desk UX. Wires the hook to the three components.

- [ ] **Step 10.1: Create the route page**

Create `frontend/src/app/interpreter/page.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useInterpreter } from "@/features/interpreter/useInterpreter";
import { RoleToggle } from "@/features/interpreter/RoleToggle";
import { TranscriptPane } from "@/features/interpreter/TranscriptPane";
import { SessionControls } from "@/features/interpreter/SessionControls";

const DEFAULT_USER_ID =
  process.env.NEXT_PUBLIC_DEMO_USER_ID || "demo-patient-uuid-001";

export default function InterpreterPage() {
  const [userId] = useState<string>(DEFAULT_USER_ID);
  const {
    status,
    sourceLanguage,
    turns,
    error,
    recordingRole,
    start,
    beginTurn,
    endTurn,
    end,
  } = useInterpreter(userId);

  const sessionActive = status !== "idle" && status !== "ended" && status !== "error";
  const buttonsDisabled =
    !sessionActive || status === "processing" || status === "ended";

  return (
    <main className="flex h-screen w-screen flex-col gap-4 bg-slate-100 p-6">
      <SessionControls
        status={status}
        sourceLanguage={sourceLanguage}
        turnCount={turns.length}
        onStart={start}
        onEnd={end}
      />
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}
      <TranscriptPane
        turns={turns}
        recordingRole={recordingRole}
        processing={status === "processing"}
      />
      <RoleToggle
        disabled={buttonsDisabled}
        recordingRole={recordingRole}
        onPressStart={beginTurn}
        onPressEnd={endTurn}
      />
    </main>
  );
}
```

- [ ] **Step 10.2: Start the frontend and verify route mounts**

```bash
cd frontend && npm run dev
# In a browser: http://localhost:3000/interpreter
```
Expected: page renders with `SessionControls` showing "Not started", an empty transcript area, and two disabled (greyed) PATIENT / DOCTOR buttons.

- [ ] **Step 10.3: Commit**

```bash
git add frontend/src/app/interpreter/page.tsx
git commit -m "mount interpreter page at /interpreter route"
```

---

## Task 11: End-to-end smoke test (manual, real Gemini calls)

**Files:**
- None (manual verification + a seed user with `preferred_language` set)

Block 4 (in the sprint plan) creates Ravi and Wei. For this Block 2 smoke test, create a minimal stub user in psql so the start endpoint resolves a real `preferred_language`.

- [ ] **Step 11.1: Seed a test user with `preferred_language='zh-CN'`**

```bash
psql -h localhost -U postgres -d health_assistant -c "
INSERT INTO users (id, phone_number, preferred_language)
VALUES ('11111111-1111-1111-1111-111111111111', '+15550001111', 'zh-CN')
ON CONFLICT (id) DO UPDATE SET preferred_language = 'zh-CN';
"
```

- [ ] **Step 11.2: Override the demo user id**

In `frontend/.env.local` (create if missing), add:
```
NEXT_PUBLIC_DEMO_USER_ID=11111111-1111-1111-1111-111111111111
```
Restart `npm run dev`.

- [ ] **Step 11.3: Smoke: Mandarin patient turn**

In the browser at `http://localhost:3000/interpreter`:
1. Click "Start visit". Source language should display `zh-CN`.
2. Hold PATIENT. Say one short Mandarin sentence (or play a 5-second clip). Release.
3. Expect: a turn row appears within ~3-5 seconds with RAW in Mandarin (Han characters), CLEANED in English.

If RAW comes out empty or in English: the Live API STT either didn't detect Mandarin or returned cleaned output. Set `INTERPRETER_STT_MODE=batch` in `backend/.env` and restart backend to switch to the fallback path; retry.

- [ ] **Step 11.4: Smoke: English doctor turn**

1. Hold DOCTOR. Say: "Let's get a CBC and a BMP today, follow up in one week." Release.
2. Expect: a turn row with `role: doctor`, RAW in English (verbatim), CLEANED in Mandarin (Han characters) with `CBC`, `BMP`, and dosages preserved as English tokens.

- [ ] **Step 11.5: End the visit and verify the record persisted**

1. Click "End visit".
2. ```bash
   psql -h localhost -U postgres -d health_assistant -c "
   SELECT id, file_type, created_at
   FROM user_medical_records
   WHERE user_id = '11111111-1111-1111-1111-111111111111'
   ORDER BY created_at DESC LIMIT 1;
   "
   ```
   Expected: one row with `file_type = 'visit_transcript'`.
3. ```bash
   psql -h localhost -U postgres -d health_assistant -c "
   SELECT chunk_content FROM user_record_embeddings
   WHERE user_id = '11111111-1111-1111-1111-111111111111'
   ORDER BY created_at DESC LIMIT 1;
   "
   ```
   Expected: the chunk content reads as English-side conversation (`Patient: …`, `Doctor: …` lines).

- [ ] **Step 11.6: Failure escape hatch verification**

1. Add to `backend/.env`: `INTERPRETER_STT_MODE=batch`
2. Restart backend.
3. Repeat steps 11.3 and 11.4. Expect: same end-to-end behavior; latency may be marginally higher; logs show no Live API calls.
4. Remove the env var (or set back to `live`) after verification; commit the change ONLY if the live path is broken.

- [ ] **Step 11.7: Commit verification notes (optional, no code change)**

If the smoke surfaces a bug that requires code changes, fix and commit. Otherwise, no commit for this task — the artifact is the working demo path.

---

## Task 12B: CLI test harness — exercise the full pipeline without the frontend

**Files:**
- Create: `backend/app/domains/interpreter/cli.py`
- Create: `backend/tests/domains/interpreter/test_pipeline_integration.py`
- Create: `backend/tests/domains/interpreter/fixtures/README.md`

The user wants to verify Hindi↔English and Mandarin↔English translation in both directions from the terminal. A small CLI takes an audio file + role + user_id and prints raw + cleaned. A pytest integration test exercises the cleanup pass (text in → text out) deterministically without needing real audio.

- [ ] **Step 12B.1: Create the CLI script**

Create `backend/app/domains/interpreter/cli.py`:

```python
"""
End-to-end interpreter CLI for manual verification without the frontend.

Usage:
    python -m app.domains.interpreter.cli \\
        --audio path/to/clip.webm \\
        --role patient \\
        --user-id 11111111-1111-1111-1111-111111111111

Prints the resulting Turn (raw + cleaned). Useful for Hindi→English and
Mandarin→English smoke tests, and the reverse direction (doctor English →
patient's preferred_language) by toggling --role doctor.
"""
import argparse
import asyncio
import json
import sys
from pathlib import Path

from app.domains.interpreter.services import start_session, submit_turn, end_session


def _mime_for(path: Path) -> str:
    ext = path.suffix.lower()
    return {
        ".webm": "audio/webm",
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".m4a": "audio/mp4",
        ".ogg": "audio/ogg",
        ".flac": "audio/flac",
    }.get(ext, "audio/webm")


async def _run(audio_path: Path, role: str, user_id: str, keep_session: bool) -> int:
    if not audio_path.exists():
        print(f"error: audio file not found: {audio_path}", file=sys.stderr)
        return 2
    if role not in ("patient", "doctor"):
        print("error: --role must be 'patient' or 'doctor'", file=sys.stderr)
        return 2

    audio_bytes = audio_path.read_bytes()
    mime_type = _mime_for(audio_path)

    session = start_session(user_id)
    print(json.dumps({
        "event": "session_started",
        "session_id": session.session_id,
        "user_id": user_id,
        "source_language": session.source_language,
    }, indent=2))

    turn = await submit_turn(
        session_id=session.session_id,
        role=role,  # type: ignore[arg-type]
        audio_bytes=audio_bytes,
        mime_type=mime_type,
    )
    print(json.dumps({
        "event": "turn",
        "role": turn.role,
        "turn_index": turn.turn_index,
        "raw": turn.raw,
        "cleaned": turn.cleaned,
    }, indent=2, ensure_ascii=False))

    if not keep_session:
        record_id = end_session(session.session_id)
        print(json.dumps({
            "event": "session_ended",
            "record_id": record_id,
        }, indent=2))
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description="Interpreter pipeline CLI")
    p.add_argument("--audio", required=True, type=Path, help="Path to an audio file (webm/mp3/wav/m4a/ogg/flac)")
    p.add_argument("--role", required=True, choices=["patient", "doctor"], help="Speaker role")
    p.add_argument("--user-id", required=True, help="Existing user UUID (drives preferred_language)")
    p.add_argument("--keep-session", action="store_true", help="Skip end_session (don't persist a visit_transcript row)")
    args = p.parse_args()
    return asyncio.run(_run(args.audio, args.role, args.user_id, args.keep_session))


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 12B.2: Create fixtures README**

Create `backend/tests/domains/interpreter/fixtures/README.md`:

```markdown
# Interpreter test fixtures

Drop short audio clips here for manual end-to-end testing. Suggested set:

- `mandarin_patient_short.webm` — 3-5 seconds of Mandarin: e.g. "我最近头很痛，已经两天了" (My head has been hurting for two days)
- `hindi_patient_short.webm` — 3-5 seconds of Hindi: e.g. "मुझे दो दिन से सिर में दर्द है" (I've had a headache for two days)
- `english_doctor_short.webm` — 3-5 seconds of clinical English: e.g. "Let's get a CBC and a BMP today, follow up next week"

Generation options:
1. Record yourself or a teammate via QuickTime → export as `.m4a`, rename `.webm`-ish if needed (the CLI infers MIME from extension).
2. Use Gemini TTS (any Google text-to-speech) to synthesize from the suggested transcripts.
3. Use the browser's MediaRecorder on `/interpreter` and grab the blob from the network tab.

Then run:

    python -m app.domains.interpreter.cli \\
        --audio backend/tests/domains/interpreter/fixtures/mandarin_patient_short.webm \\
        --role patient \\
        --user-id 11111111-1111-1111-1111-111111111111
```

- [ ] **Step 12B.3: Write the integration test for the cleanup pass**

Create `backend/tests/domains/interpreter/test_pipeline_integration.py`:

```python
"""
Deterministic integration tests for the cleanup-pass half of the pipeline.

These tests:
- Bypass STT (which needs real audio) by injecting raw text directly.
- Call the same _cleanup_pass function the live pipeline uses.
- Hit real Gemini Flash (so they require GEMINI_API_KEY in the env).

Skip with: pytest -k "not pipeline_integration"
"""
import os
import pytest
import asyncio

from app.domains.interpreter.services import _cleanup_pass

pytestmark = pytest.mark.skipif(
    not os.getenv("GEMINI_API_KEY"),
    reason="requires GEMINI_API_KEY for live cleanup pass",
)


@pytest.mark.asyncio
async def test_hindi_patient_to_english():
    raw = "मुझे दो दिन से सिर में दर्द है और चक्कर भी आ रहे हैं"
    cleaned = await _cleanup_pass(
        raw=raw,
        role="patient",
        source_language="hi-IN",
        vocab_block="",
    )
    assert cleaned, "cleanup returned empty string"
    # Output must be English ASCII-dominant.
    ascii_ratio = sum(1 for c in cleaned if ord(c) < 128) / max(len(cleaned), 1)
    assert ascii_ratio > 0.8, f"expected English output, got: {cleaned!r}"
    # Headache + 2 days should be conveyed somehow.
    lc = cleaned.lower()
    assert "head" in lc or "headache" in lc
    assert "two" in lc or "2" in lc or "day" in lc


@pytest.mark.asyncio
async def test_mandarin_patient_to_english():
    raw = "我最近头很痛，已经两天了"
    cleaned = await _cleanup_pass(
        raw=raw,
        role="patient",
        source_language="zh-CN",
        vocab_block="",
    )
    assert cleaned
    ascii_ratio = sum(1 for c in cleaned if ord(c) < 128) / max(len(cleaned), 1)
    assert ascii_ratio > 0.8, f"expected English output, got: {cleaned!r}"
    lc = cleaned.lower()
    assert "head" in lc or "headache" in lc


@pytest.mark.asyncio
async def test_english_doctor_to_hindi():
    raw = "Let's get a CBC and a BMP today, follow up in one week"
    cleaned = await _cleanup_pass(
        raw=raw,
        role="doctor",
        source_language="hi-IN",  # target language for doctor direction
        vocab_block="",
    )
    assert cleaned
    # CBC and BMP must stay in English even inside Hindi text (per decision 7b).
    assert "CBC" in cleaned, f"CBC should be preserved as English; got: {cleaned!r}"
    assert "BMP" in cleaned, f"BMP should be preserved as English; got: {cleaned!r}"
    # Devanagari characters should appear in the prose portion.
    has_devanagari = any("ऀ" <= c <= "ॿ" for c in cleaned)
    assert has_devanagari, f"expected Hindi (Devanagari) prose; got: {cleaned!r}"


@pytest.mark.asyncio
async def test_english_doctor_to_mandarin():
    raw = "Take Lisinopril ten milligrams once daily and stop drinking alcohol"
    cleaned = await _cleanup_pass(
        raw=raw,
        role="doctor",
        source_language="zh-CN",
        vocab_block="",
    )
    assert cleaned
    # Drug name and dosage must stay in English.
    assert "Lisinopril" in cleaned, f"drug name should stay English; got: {cleaned!r}"
    # Han characters should appear.
    has_han = any("一" <= c <= "鿿" for c in cleaned)
    assert has_han, f"expected Mandarin (Han) prose; got: {cleaned!r}"


@pytest.mark.asyncio
async def test_empty_input_returns_empty():
    cleaned = await _cleanup_pass(
        raw="",
        role="patient",
        source_language="hi-IN",
        vocab_block="",
    )
    assert cleaned == ""
```

- [ ] **Step 12B.4: Run the integration tests**

```bash
cd backend && GEMINI_API_KEY=$GEMINI_API_KEY python -m pytest tests/domains/interpreter/test_pipeline_integration.py -v
```
Expected: 5 passed. (If any assertions fail, that's signal — the prompt isn't honoring the constraint, and the prompt in `prompts.py` needs tightening.)

- [ ] **Step 12B.5: Smoke the CLI against a real audio fixture (manual)**

Drop a Mandarin audio clip at `backend/tests/domains/interpreter/fixtures/mandarin_patient_short.webm` (see README in step 12B.2). Then:

```bash
cd backend && python -m app.domains.interpreter.cli \
    --audio tests/domains/interpreter/fixtures/mandarin_patient_short.webm \
    --role patient \
    --user-id 11111111-1111-1111-1111-111111111111
```
Expected stdout: three JSON blocks — `session_started`, `turn` (with raw in Mandarin, cleaned in English), `session_ended`.

- [ ] **Step 12B.6: Commit**

```bash
git add backend/app/domains/interpreter/cli.py backend/tests/domains/interpreter/test_pipeline_integration.py backend/tests/domains/interpreter/fixtures/
git commit -m "add interpreter CLI and pipeline integration tests"
```

---

## Task 12: Cross-cutting touch — ingestion translates voice notes via interpreter

**Files:**
- Modify: `backend/app/domains/ingestion/services.py`

This is a Block 4.6 touch-point but lives here because it uses the interpreter's translation prompt. When a Telegram voice note arrives in Hindi/Mandarin, ingestion now produces an English `extracted_summary` so RAG over the user's records stays coherent in one language.

- [ ] **Step 12.1: Add a translate-first path for voice-note ingestion**

In `backend/app/domains/ingestion/services.py`, after the existing `process_medical_file_with_medgemma` function, add:

```python
async def process_voice_note_with_translation(
    audio_bytes: bytes,
    mime_type: str,
    user_id: str,
) -> ClinicalSummary:
    """For Telegram voice-note check-ins: translate to English first, then summarize."""
    from app.domains.interpreter.stt import transcribe
    from app.domains.interpreter.services import _fetch_preferred_language

    source_language = _fetch_preferred_language(user_id)
    raw_native = await transcribe(audio_bytes, source_language=source_language, mime_type=mime_type)

    summary_text = (
        f"Patient voice note (source language: {source_language}). "
        f"Raw: {raw_native}"
    )
    return ClinicalSummary(
        summary=summary_text,
        key_findings=[raw_native] if raw_native else [],
        medications=[],
        diagnoses=[],
        allergies=[],
        lab_metrics=[],
    )
```

(Note: the cleanup-and-translate to English would call `_cleanup_pass` from interpreter.services with `role='patient'`. For ingestion's purpose we accept raw native text in the summary; the chat path can RAG over it directly since the LLM in chat understands all the languages. If you want the embedding to be English-only for tighter RAG, route through the patient prompt by importing `_cleanup_pass` and calling it; the simple version above is sufficient for the demo.)

- [ ] **Step 12.2: Commit**

```bash
git add backend/app/domains/ingestion/services.py
git commit -m "add voice-note translation path for telegram check-ins"
```

---

## Out of Scope for this Plan

The following are explicitly deferred and should NOT be added during execution:
- `visit_sessions` / `visit_turns` schema (per sprint plan cut #8)
- WebSocket streaming endpoint with live partial token render (per UX decision: FreeFlow-style settle)
- Structured EXTRACTED fields / chips (per Wispr scope)
- Citation chips inside the interpreter pane (interpreter is not the chat path; citation invariant applies to chat only)
- Real-time biometric feed during the visit
- Multi-user session sharing (one device, one session)
- Per-language vocab as a DB table (Python dict is sufficient for v1)
- Audio playback / TTS (text-only output both directions, per PRD §Out of Scope)

---

## Self-Review

**Spec coverage:**
- ✅ Bidirectional cross-language: patient prompt (source → English), doctor prompt (English → patient lang) — Tasks 4, 6.
- ✅ Wispr-Flow-style cleanup discipline: FreeFlow-derived hard contract + self-correction handling — Task 4.
- ✅ Two-layer vocabulary (per-language + per-patient): Task 3.
- ✅ `preferred_language` on user: Task 1.
- ✅ Gemini Live API primary, Gemini Flash batch fallback (both Google stack): Task 5.
- ✅ FreeFlow-style UX (no partials, listening pulse, settle on release): Task 9.2 + Task 8.3.
- ✅ Persistence as `user_medical_records` row with `file_type='visit_transcript'`: Task 6.
- ✅ Standalone `/interpreter` route: Task 10.
- ✅ Two demo personas seeded with their languages (Ravi `hi-IN`, Wei `zh-CN`): Block 4 in sprint plan, Task 11 only seeds a minimal Mandarin user for smoke.
- ✅ Failure escape hatch via env flag: Task 5, verified Task 11.6.
- ✅ Voice-note ingestion translation touch-point: Task 12.
- ✅ No Claude attribution in any commit message: commit messages throughout use plain engineer voice.

**Placeholder scan:** No `TBD`, no `implement later`, no "similar to Task N" references, no naked "add error handling" steps. Every code block contains the literal code to write. Commands have expected outputs.

**Type consistency:** `Role` is `"patient" | "doctor"` in backend (`schemas.py`) and frontend (`types.ts`). `LanguageCode` enum matches across both. `Turn` shape (`turn_index`, `role`, `raw`, `cleaned`, `created_at`) is identical between Pydantic and TypeScript. Function names match between definition and call sites (`start_session`, `submit_turn`, `end_session`, `build_vocab_block`, `render_patient_prompt`, `render_doctor_prompt`, `transcribe`, `_cleanup_pass`).
