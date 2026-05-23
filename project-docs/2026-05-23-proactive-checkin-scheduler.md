# Proactive Check-in Scheduler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a background trigger loop that proactively sends Telegram check-ins to users on two signals — a per-user cadence (default every 24h) and a biometric-anomaly rule engine — reusing the existing `force_trigger` compose-and-send path.

**Architecture:** A daemon thread starts with FastAPI and calls `tick()` every N seconds. Each tick iterates users with a `telegram_id`, evaluates two pure rule modules (`cadence_due`, `evaluate_biometric_anomaly`) against rows pulled from `user_biometrics`, and for each fired signal calls a shared `send_proactive_ping(user_id, signal_reason)` that composes via Gemini Flash and writes a `user_alerts` row + bumps `users.last_checkin_at`. The existing `POST /api/checkins/force_trigger` endpoint is refactored to call the same `send_proactive_ping`, so the demo button and the scheduler share one codepath. A new `POST /api/checkins/tick` endpoint manually fires one tick — used for tests and the live demo.

**Tech Stack:** Python `threading.Thread` + `time.sleep` (matches the existing Telegram poller pattern; no new deps), `psycopg2` (existing DB layer), `google.genai` Gemini Flash (existing), `pyTelegramBotAPI` (existing). Unit tests via `pytest` + `unittest.mock`.

---

## Pre-flight Notes

- **Merge conflict in `backend/app/main.py`** — the file currently contains unresolved conflict markers (`<<<<<<< HEAD` / `>>>>>>> origin/main`). Task 0 resolves this before adding the new startup hook.
- **Existing test convention** (see `backend/tests/conftest.py` and `tests/domains/interpreter/`) — pure modules get fully-mocked unit tests; live-LLM integration tests are gated on `GEMINI_API_KEY`. This plan follows that split.
- **English-only messaging** is a hard constraint (memory note `feedback_english_default_outside_voice`). The existing `PROACTIVE_PROMPT` in `checkins/router.py` already enforces this — we reuse it verbatim.
- **No new dependency** — APScheduler / Celery would be overkill. A daemon thread mirrors `domains/telegram/router.py:25-34`.

---

## File Structure

**Modify:**
- `backend/app/core/db_init.sql` — append two columns to `users` (`last_checkin_at`, `checkin_cadence_hours`)
- `backend/app/domains/checkins/router.py` — refactor `force_trigger` to delegate to the new services module; add `POST /api/checkins/tick`
- `backend/app/main.py` — resolve merge conflict; call `start_checkin_scheduler()` in `on_startup`

**Create:**
- `backend/app/domains/checkins/rules.py` — pure functions: `cadence_due(...)`, `evaluate_biometric_anomaly(...)`, `AnomalySignal` dataclass. Zero side effects, zero DB access.
- `backend/app/domains/checkins/services.py` — `fetch_eligible_users()`, `fetch_recent_biometrics()`, `compose_proactive_message()`, `send_proactive_ping()`, `record_checkin_sent()`, `recent_alert_exists()`. All DB + Gemini + Telegram side effects live here.
- `backend/app/domains/checkins/scheduler.py` — `tick()` (one pass over all users), `start_checkin_scheduler()` (daemon thread launcher).
- `backend/tests/domains/checkins/__init__.py` (empty)
- `backend/tests/domains/checkins/test_rules.py` — unit tests for pure rule functions
- `backend/tests/domains/checkins/test_services.py` — DB + Gemini + bot mocked
- `backend/tests/domains/checkins/test_scheduler.py` — tick() against mocked services

**Responsibility split rationale:** `rules.py` is the brain (deterministic, easy to test, no I/O). `services.py` is the limbs (DB + LLM + Telegram, easy to mock at the boundary). `scheduler.py` is the heart (timer + dispatch, calls into services). `router.py` exposes HTTP. This keeps the existing `router.py` clean and makes the rule engine isolated enough to iterate on thresholds without touching anything else.

---

## Task 0: Resolve `main.py` merge conflict

**Files:**
- Modify: `backend/app/main.py:1-53`

- [ ] **Step 1: Inspect the conflict markers**

Run: `grep -n "<<<<<<\|>>>>>>\|======" backend/app/main.py`
Expected output (line numbers):
```
8:<<<<<<< HEAD
10:=======
12:>>>>>>> origin/main
37:<<<<<<< HEAD
40:=======
41:>>>>>>> origin/main
```

- [ ] **Step 2: Resolve conflict — keep the HEAD side (this branch's enhanced router exports)**

Replace lines 8-12 with:
```python
from app.domains.checkins.router import router as checkins_router, read_router, debug_router
```

Replace lines 37-41 with:
```python
app.include_router(read_router)
app.include_router(debug_router)
```

- [ ] **Step 3: Verify clean import**

Run: `cd backend && venv/bin/python -c "from app.main import app; print(app.title)"`
Expected: `Health Assistant Orchestrator` (no SyntaxError, no conflict markers)

- [ ] **Step 4: Commit**

```bash
git add backend/app/main.py
git commit -m "resolve main.py merge conflict, keep block-2 router exports"
```

---

## Task 1: Database schema — add `last_checkin_at` + `checkin_cadence_hours`

**Files:**
- Modify: `backend/app/core/db_init.sql` (append at the end of the `users` block)

- [ ] **Step 1: Add idempotent column adds after the existing `preferred_language` block (around line 13)**

Append after the existing `ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_language ...` statement:

```sql
-- Scheduler state: when did we last send a proactive ping, and how often should we?
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS last_checkin_at TIMESTAMP WITH TIME ZONE NULL;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS checkin_cadence_hours INT NOT NULL DEFAULT 24;
```

- [ ] **Step 2: Reload schema against the running DB**

Run: `cd backend && venv/bin/python -c "from app.core.db import initialize_database; initialize_database()"`
Expected: no error, log line `Database initialized successfully.`

- [ ] **Step 3: Verify the columns exist**

Run:
```bash
docker compose exec -T db psql -U postgres -d health_assistant -c "\d users" | grep -E "last_checkin_at|checkin_cadence_hours"
```
Expected output (both lines present):
```
 last_checkin_at       | timestamp with time zone |
 checkin_cadence_hours | integer                  | not null default 24
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/core/db_init.sql
git commit -m "add last_checkin_at + checkin_cadence_hours to users"
```

---

## Task 2: Rules module — pure functions for cadence + anomaly detection

**Files:**
- Create: `backend/app/domains/checkins/rules.py`
- Create: `backend/tests/domains/checkins/__init__.py` (empty file)
- Create: `backend/tests/domains/checkins/test_rules.py`

- [ ] **Step 1: Write the failing tests first**

Create `backend/tests/domains/checkins/__init__.py` as an empty file (one blank line is fine).

Create `backend/tests/domains/checkins/test_rules.py`:

```python
from datetime import datetime, timedelta, timezone

from app.domains.checkins.rules import (
    cadence_due,
    evaluate_biometric_anomaly,
    AnomalySignal,
    BiometricThresholds,
)


def _now():
    return datetime(2026, 5, 23, 12, 0, tzinfo=timezone.utc)


def test_cadence_due_when_never_sent():
    assert cadence_due(last_at=None, cadence_hours=24, now=_now()) is True


def test_cadence_due_when_old_enough():
    last = _now() - timedelta(hours=25)
    assert cadence_due(last_at=last, cadence_hours=24, now=_now()) is True


def test_cadence_not_due_when_recent():
    last = _now() - timedelta(hours=2)
    assert cadence_due(last_at=last, cadence_hours=24, now=_now()) is False


def test_cadence_exact_boundary_is_due():
    last = _now() - timedelta(hours=24)
    assert cadence_due(last_at=last, cadence_hours=24, now=_now()) is True


def _bio(days_ago: int, resting_hr: float, hrv: float, sleep_score: int):
    return {
        "recorded_at": _now() - timedelta(days=days_ago),
        "resting_hr_bpm": resting_hr,
        "hrv_ms": hrv,
        "sleep_score": sleep_score,
    }


def test_anomaly_resting_hr_sustained_high():
    thresholds = BiometricThresholds()
    rows = [
        _bio(0, 74, 45, 71),
        _bio(1, 73, 47, 72),
        _bio(2, 72, 48, 73),
    ]
    signal = evaluate_biometric_anomaly(rows, thresholds)
    assert signal is not None
    assert signal.metric == "resting_hr_bpm"
    assert "elevated" in signal.reason.lower()


def test_anomaly_none_when_in_range():
    thresholds = BiometricThresholds()
    rows = [
        _bio(0, 62, 60, 85),
        _bio(1, 63, 58, 84),
        _bio(2, 64, 59, 86),
    ]
    assert evaluate_biometric_anomaly(rows, thresholds) is None


def test_anomaly_low_hrv_sustained():
    thresholds = BiometricThresholds()
    rows = [
        _bio(0, 65, 28, 80),
        _bio(1, 65, 29, 80),
        _bio(2, 66, 27, 80),
    ]
    signal = evaluate_biometric_anomaly(rows, thresholds)
    assert signal is not None
    assert signal.metric == "hrv_ms"


def test_anomaly_low_sleep_sustained():
    thresholds = BiometricThresholds()
    rows = [
        _bio(0, 65, 60, 55),
        _bio(1, 65, 60, 58),
        _bio(2, 65, 60, 56),
    ]
    signal = evaluate_biometric_anomaly(rows, thresholds)
    assert signal is not None
    assert signal.metric == "sleep_score"


def test_anomaly_skipped_when_insufficient_data():
    thresholds = BiometricThresholds()
    # Only one day — can't establish a trend.
    assert evaluate_biometric_anomaly([_bio(0, 90, 25, 50)], thresholds) is None


def test_anomaly_resting_hr_priority_over_hrv():
    # If multiple metrics breach, resting_hr wins (most actionable for AFib demo).
    thresholds = BiometricThresholds()
    rows = [
        _bio(0, 78, 28, 55),
        _bio(1, 77, 29, 56),
        _bio(2, 76, 27, 57),
    ]
    signal = evaluate_biometric_anomaly(rows, thresholds)
    assert signal is not None
    assert signal.metric == "resting_hr_bpm"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && venv/bin/pytest tests/domains/checkins/test_rules.py -v`
Expected: `ModuleNotFoundError: No module named 'app.domains.checkins.rules'` (or ImportError on the names)

- [ ] **Step 3: Implement `rules.py`**

Create `backend/app/domains/checkins/rules.py`:

```python
"""
Pure rule functions for the proactive check-in scheduler.

These functions are deterministic and have zero I/O — they take plain dicts
and config and return decisions. All DB/Gemini/Telegram side effects live
in services.py; all timing lives in scheduler.py. This split keeps the rule
engine cheap to unit-test and easy to iterate thresholds on.
"""
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional


@dataclass(frozen=True)
class BiometricThresholds:
    """Demo defaults — production would per-user calibrate. Threshold semantics:

    A signal fires when the AVERAGE of the last `window_days` exceeds (HR) or
    falls below (HRV, sleep_score) the cutoff. Averages, not single-day spikes,
    keep us from paging on one bad night.
    """
    resting_hr_avg_bpm: float = 70.0
    hrv_avg_ms: float = 35.0
    sleep_score_avg: float = 65.0
    window_days: int = 3


@dataclass(frozen=True)
class AnomalySignal:
    metric: str           # 'resting_hr_bpm' | 'hrv_ms' | 'sleep_score'
    value: float          # observed average over the window
    threshold: float      # the threshold that was breached
    reason: str           # short English phrase for the LLM prompt


def cadence_due(
    last_at: Optional[datetime],
    cadence_hours: int,
    now: datetime,
) -> bool:
    """True if it's been at least `cadence_hours` since the last ping (or never)."""
    if last_at is None:
        return True
    return (now - last_at) >= timedelta(hours=cadence_hours)


def _avg(rows: list, key: str) -> Optional[float]:
    vals = [r[key] for r in rows if r.get(key) is not None]
    if not vals:
        return None
    return sum(vals) / len(vals)


def evaluate_biometric_anomaly(
    rows: list,
    thresholds: BiometricThresholds,
) -> Optional[AnomalySignal]:
    """Return the first matching anomaly (priority: HR > HRV > sleep) or None.

    `rows` is expected sorted newest-first; the function takes the leading
    `window_days` rows and averages each metric. Requires at least
    `window_days` rows — fewer means we don't have enough signal to act.
    """
    window = rows[: thresholds.window_days]
    if len(window) < thresholds.window_days:
        return None

    hr_avg = _avg(window, "resting_hr_bpm")
    if hr_avg is not None and hr_avg >= thresholds.resting_hr_avg_bpm:
        return AnomalySignal(
            metric="resting_hr_bpm",
            value=hr_avg,
            threshold=thresholds.resting_hr_avg_bpm,
            reason=(
                f"Resting heart rate has been elevated for the past "
                f"{thresholds.window_days} days (avg {hr_avg:.0f} bpm, "
                f"threshold {thresholds.resting_hr_avg_bpm:.0f})."
            ),
        )

    hrv_avg = _avg(window, "hrv_ms")
    if hrv_avg is not None and hrv_avg <= thresholds.hrv_avg_ms:
        return AnomalySignal(
            metric="hrv_ms",
            value=hrv_avg,
            threshold=thresholds.hrv_avg_ms,
            reason=(
                f"Heart rate variability has dropped over the past "
                f"{thresholds.window_days} days (avg {hrv_avg:.0f} ms, "
                f"threshold {thresholds.hrv_avg_ms:.0f})."
            ),
        )

    sleep_avg = _avg(window, "sleep_score")
    if sleep_avg is not None and sleep_avg <= thresholds.sleep_score_avg:
        return AnomalySignal(
            metric="sleep_score",
            value=sleep_avg,
            threshold=thresholds.sleep_score_avg,
            reason=(
                f"Sleep quality has been low for the past "
                f"{thresholds.window_days} days (avg score {sleep_avg:.0f}/100)."
            ),
        )

    return None
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && venv/bin/pytest tests/domains/checkins/test_rules.py -v`
Expected: all 9 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/domains/checkins/rules.py backend/tests/domains/checkins/__init__.py backend/tests/domains/checkins/test_rules.py
git commit -m "add checkin rules module with cadence + biometric anomaly logic"
```

---

## Task 3: Services module — extract compose + send + DB helpers

**Files:**
- Create: `backend/app/domains/checkins/services.py`
- Create: `backend/tests/domains/checkins/test_services.py`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/domains/checkins/test_services.py`:

```python
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest

from app.domains.checkins import services
from app.domains.checkins.rules import AnomalySignal


def _now():
    return datetime(2026, 5, 23, 12, 0, tzinfo=timezone.utc)


def _user_row(telegram_id="tg_ravi", last_at=None, cadence=24):
    return {
        "id": "user-uuid-1",
        "phone_number": "+15551234567",
        "telegram_id": telegram_id,
        "last_checkin_at": last_at,
        "checkin_cadence_hours": cadence,
    }


@patch("app.domains.checkins.services.get_db_connection")
def test_fetch_eligible_users_filters_no_telegram_id(mock_conn):
    cur = MagicMock()
    cur.fetchall.return_value = [_user_row(telegram_id="abc")]
    mock_conn.return_value.cursor.return_value = cur
    out = services.fetch_eligible_users()
    assert len(out) == 1
    # Query must filter on telegram_id IS NOT NULL
    sql = cur.execute.call_args[0][0]
    assert "telegram_id IS NOT NULL" in sql


@patch("app.domains.checkins.services.get_db_connection")
def test_fetch_recent_biometrics_orders_newest_first(mock_conn):
    cur = MagicMock()
    cur.fetchall.return_value = [
        {"recorded_at": _now(), "resting_hr_bpm": 70, "hrv_ms": 40, "sleep_score": 70}
    ]
    mock_conn.return_value.cursor.return_value = cur
    out = services.fetch_recent_biometrics("user-uuid-1", days=5)
    sql = cur.execute.call_args[0][0]
    assert "ORDER BY recorded_at DESC" in sql
    assert out == cur.fetchall.return_value


@patch("app.domains.checkins.services.client")
def test_compose_proactive_message_passes_reason_to_prompt(mock_client):
    fake_resp = MagicMock()
    fake_resp.text = "Hi Ravi — your HR has been elevated. Want me to set up a visit?"
    mock_client.models.generate_content.return_value = fake_resp

    out = services.compose_proactive_message(
        context_summary="Recent biometrics: ...",
        signal_reason="Resting heart rate has been elevated.",
    )
    assert "Ravi" in out
    # The composed prompt the LLM saw must include the signal reason.
    contents = mock_client.models.generate_content.call_args.kwargs["contents"]
    assert "Resting heart rate has been elevated" in contents


@patch("app.domains.checkins.services.client")
def test_compose_proactive_message_fallback_on_llm_error(mock_client):
    mock_client.models.generate_content.side_effect = RuntimeError("boom")
    out = services.compose_proactive_message(
        context_summary="x", signal_reason="y"
    )
    assert out  # non-empty fallback string
    assert "appointment" in out.lower() or "doctor" in out.lower()


@patch("app.domains.checkins.services.bot")
@patch("app.domains.checkins.services.get_db_connection")
def test_send_proactive_ping_sends_and_records(mock_conn, mock_bot):
    cur = MagicMock()
    cur.fetchone.return_value = {"id": "alert-uuid-1"}
    mock_conn.return_value.cursor.return_value = cur
    mock_bot.send_message.return_value = None

    result = services.send_proactive_ping(
        user={"id": "user-uuid-1", "telegram_id": "tg_ravi"},
        message="Hi Ravi",
        signal_kind="cadence",
        signal_reason="24h cadence",
    )

    mock_bot.send_message.assert_called_once_with(chat_id="tg_ravi", text="Hi Ravi")
    assert result["telegram_sent"] is True
    assert result["alert_id"] == "alert-uuid-1"
    # Must have INSERTed an alert AND UPDATEd last_checkin_at.
    sql_calls = [c.args[0] for c in cur.execute.call_args_list]
    assert any("INSERT INTO user_alerts" in s for s in sql_calls)
    assert any("UPDATE users" in s and "last_checkin_at" in s for s in sql_calls)


@patch("app.domains.checkins.services.bot", None)
def test_send_proactive_ping_no_bot_returns_error():
    result = services.send_proactive_ping(
        user={"id": "u", "telegram_id": "tg"},
        message="hi",
        signal_kind="cadence",
        signal_reason="r",
    )
    assert result["telegram_sent"] is False
    assert "bot" in (result.get("telegram_error") or "").lower()


@patch("app.domains.checkins.services.get_db_connection")
def test_recent_alert_exists_true_when_row_present(mock_conn):
    cur = MagicMock()
    cur.fetchone.return_value = {"id": "x"}
    mock_conn.return_value.cursor.return_value = cur
    assert services.recent_alert_exists("user-uuid-1", "resting_hr_bpm", 12) is True


@patch("app.domains.checkins.services.get_db_connection")
def test_recent_alert_exists_false_when_none(mock_conn):
    cur = MagicMock()
    cur.fetchone.return_value = None
    mock_conn.return_value.cursor.return_value = cur
    assert services.recent_alert_exists("user-uuid-1", "resting_hr_bpm", 12) is False
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && venv/bin/pytest tests/domains/checkins/test_services.py -v`
Expected: `ModuleNotFoundError` or `ImportError` (services module / names don't exist yet)

- [ ] **Step 3: Implement `services.py`**

Create `backend/app/domains/checkins/services.py`:

```python
"""
Side-effect layer for proactive check-ins.

All DB queries, Gemini calls, and Telegram sends live here. Pure rule
logic stays in rules.py; the daemon loop lives in scheduler.py. The HTTP
router and the scheduler both call into this module so there is exactly
one compose-and-send code path.
"""
import json
import logging
from datetime import datetime, timezone
from typing import Optional

from google.genai import types

from app.core.config import client
from app.core.db import get_db_connection
from app.domains.telegram.bot import bot

logger = logging.getLogger("health_assistant.checkins.services")


PROACTIVE_PROMPT = """
You are Zoie, a warm and concise health companion messaging the patient on
Telegram. Your job in this turn: compose ONE short proactive check-in message.

Voice and constraints:
- Plain conversational American English. No honorifics, no code-switching,
  no ethnic register markers, no transliterated words from other languages.
- 2-3 sentences MAXIMUM.
- Warm but professional — care without being saccharine.
- End with a soft question, not a directive.
- No medical advice, no diagnosis — Zoie is a memory and interpreter layer,
  not a doctor.
- Plain text only, no markdown.
- Refer to the recipient by first name only if the context provides one;
  otherwise no name at all.

Why you are reaching out right now:
{signal_reason}

Recent context to weave in (do not repeat verbatim, summarize naturally):
{context_summary}
"""


FALLBACK_MESSAGE = (
    "Hi — just checking in. Your recent metrics looked a bit off, and I wanted "
    "to see how you're feeling. Would it help if I set up an appointment with "
    "your doctor?"
)


# ---------------------------------------------------------------------------
# DB readers
# ---------------------------------------------------------------------------

def fetch_eligible_users() -> list[dict]:
    """All users with a telegram_id — the scheduler iterates over these."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT id, phone_number, telegram_id, last_checkin_at,
                   checkin_cadence_hours
            FROM users
            WHERE telegram_id IS NOT NULL;
            """
        )
        return [dict(r) for r in cur.fetchall() or []]
    finally:
        cur.close()
        conn.close()


def fetch_recent_biometrics(user_id: str, days: int = 5) -> list[dict]:
    """Newest-first rows for the rules module to average over."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT recorded_at, resting_hr_bpm, hrv_ms, sleep_score
            FROM user_biometrics
            WHERE user_id = %s
            ORDER BY recorded_at DESC
            LIMIT %s;
            """,
            (user_id, days),
        )
        return [dict(r) for r in cur.fetchall() or []]
    finally:
        cur.close()
        conn.close()


def recent_alert_exists(user_id: str, alert_type: str, within_hours: int) -> bool:
    """De-dupe guard: have we already fired this alert_type recently?"""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT id FROM user_alerts
            WHERE user_id = %s
              AND alert_type = %s
              AND created_at > (CURRENT_TIMESTAMP - (%s || ' hours')::INTERVAL)
            LIMIT 1;
            """,
            (user_id, alert_type, str(within_hours)),
        )
        return cur.fetchone() is not None
    finally:
        cur.close()
        conn.close()


def build_context_summary(user_id: str) -> str:
    """Pulls the last 3 days of biometrics + last 2 self-report check-ins."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT recorded_at, resting_hr_bpm, hrv_ms, sleep_score
            FROM user_biometrics
            WHERE user_id = %s
            ORDER BY recorded_at DESC
            LIMIT 3;
            """,
            (user_id,),
        )
        bios = cur.fetchall() or []

        cur.execute(
            """
            SELECT extracted_summary
            FROM user_medical_records
            WHERE user_id = %s AND file_type = 'checkin'
            ORDER BY created_at DESC
            LIMIT 2;
            """,
            (user_id,),
        )
        checkins = cur.fetchall() or []
    finally:
        cur.close()
        conn.close()

    parts = []
    if bios:
        bio_lines = [
            f"- {b['recorded_at'].date().isoformat()}: resting HR {b['resting_hr_bpm']} bpm, "
            f"HRV {b['hrv_ms']} ms, sleep {b['sleep_score']}/100"
            for b in bios
        ]
        parts.append("Recent biometrics:\n" + "\n".join(bio_lines))
    if checkins:
        parts.append(
            "Recent self-reports: "
            + "; ".join((c["extracted_summary"] or "")[:200] for c in checkins)
        )
    return "\n\n".join(parts) if parts else "No recent context available."


# ---------------------------------------------------------------------------
# LLM compose
# ---------------------------------------------------------------------------

def compose_proactive_message(context_summary: str, signal_reason: str) -> str:
    prompt = PROACTIVE_PROMPT.format(
        signal_reason=signal_reason,
        context_summary=context_summary,
    )
    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(temperature=0.7),
        )
        text = (response.text or "").strip()
        return text or FALLBACK_MESSAGE
    except Exception as e:
        logger.error("Gemini compose failed: %s", e)
        return FALLBACK_MESSAGE


# ---------------------------------------------------------------------------
# Send + record
# ---------------------------------------------------------------------------

def send_proactive_ping(
    user: dict,
    message: str,
    signal_kind: str,           # 'cadence' | 'anomaly'
    signal_reason: str,
    alert_type: Optional[str] = None,
    metric_data: Optional[dict] = None,
) -> dict:
    """Send the Telegram message, record an alert row, bump last_checkin_at.

    Idempotency: this function is NOT idempotent on its own — callers (scheduler
    or router) decide whether to fire. It always writes an alert row when called.
    """
    telegram_sent = False
    telegram_error: Optional[str] = None
    if bot and user.get("telegram_id"):
        try:
            bot.send_message(chat_id=user["telegram_id"], text=message)
            telegram_sent = True
        except Exception as e:
            telegram_error = str(e)
            logger.error("Telegram send failed: %s", e)
    else:
        telegram_error = "Telegram bot unavailable or user has no telegram_id"

    alert_id = _record_alert(
        user_id=user["id"],
        alert_type=alert_type or f"proactive_{signal_kind}",
        title=f"Proactive {signal_kind} check-in",
        body=signal_reason,
        metric_data=metric_data or {},
    )

    if telegram_sent:
        _bump_last_checkin_at(user["id"])

    return {
        "user_id": user["id"],
        "composed_message": message,
        "signal_kind": signal_kind,
        "signal_reason": signal_reason,
        "telegram_sent": telegram_sent,
        "telegram_error": telegram_error,
        "alert_id": alert_id,
    }


def _record_alert(
    user_id: str,
    alert_type: str,
    title: str,
    body: str,
    metric_data: dict,
) -> Optional[str]:
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            INSERT INTO user_alerts
                (user_id, alert_type, severity, status, title, body, metric_data, triggered_at)
            VALUES (%s, %s, 'warning', 'active', %s, %s, %s::jsonb, CURRENT_TIMESTAMP)
            RETURNING id;
            """,
            (user_id, alert_type, title, body, json.dumps(metric_data)),
        )
        row = cur.fetchone()
        conn.commit()
        return str(row["id"]) if row else None
    except Exception as e:
        conn.rollback()
        logger.error("Alert insert failed: %s", e)
        return None
    finally:
        cur.close()
        conn.close()


def _bump_last_checkin_at(user_id: str) -> None:
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "UPDATE users SET last_checkin_at = CURRENT_TIMESTAMP WHERE id = %s;",
            (user_id,),
        )
        conn.commit()
    except Exception as e:
        conn.rollback()
        logger.error("last_checkin_at bump failed: %s", e)
    finally:
        cur.close()
        conn.close()
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && venv/bin/pytest tests/domains/checkins/test_services.py -v`
Expected: all 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/domains/checkins/services.py backend/tests/domains/checkins/test_services.py
git commit -m "add checkin services module — DB + Gemini + Telegram side-effect layer"
```

---

## Task 4: Scheduler `tick()` — one pass over all users

**Files:**
- Create: `backend/app/domains/checkins/scheduler.py`
- Create: `backend/tests/domains/checkins/test_scheduler.py`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/domains/checkins/test_scheduler.py`:

```python
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

from app.domains.checkins import scheduler
from app.domains.checkins.rules import AnomalySignal, BiometricThresholds


def _now():
    return datetime(2026, 5, 23, 12, 0, tzinfo=timezone.utc)


def _user(uid="u1", tg="tg1", last_at=None, cadence=24):
    return {
        "id": uid,
        "phone_number": "+1",
        "telegram_id": tg,
        "last_checkin_at": last_at,
        "checkin_cadence_hours": cadence,
    }


@patch("app.domains.checkins.scheduler.services")
def test_tick_skips_when_cadence_not_due_and_no_anomaly(mock_svc):
    mock_svc.fetch_eligible_users.return_value = [
        _user(last_at=_now() - timedelta(hours=2))
    ]
    mock_svc.fetch_recent_biometrics.return_value = [
        {"recorded_at": _now(), "resting_hr_bpm": 62, "hrv_ms": 55, "sleep_score": 85},
        {"recorded_at": _now() - timedelta(days=1), "resting_hr_bpm": 63, "hrv_ms": 56, "sleep_score": 84},
        {"recorded_at": _now() - timedelta(days=2), "resting_hr_bpm": 64, "hrv_ms": 57, "sleep_score": 86},
    ]
    result = scheduler.tick(now=_now())
    mock_svc.send_proactive_ping.assert_not_called()
    assert result["sent"] == 0
    assert result["evaluated"] == 1


@patch("app.domains.checkins.scheduler.services")
def test_tick_fires_cadence_when_due(mock_svc):
    mock_svc.fetch_eligible_users.return_value = [
        _user(last_at=_now() - timedelta(hours=30))
    ]
    mock_svc.fetch_recent_biometrics.return_value = [
        {"recorded_at": _now(), "resting_hr_bpm": 62, "hrv_ms": 55, "sleep_score": 85},
        {"recorded_at": _now() - timedelta(days=1), "resting_hr_bpm": 63, "hrv_ms": 56, "sleep_score": 84},
        {"recorded_at": _now() - timedelta(days=2), "resting_hr_bpm": 64, "hrv_ms": 57, "sleep_score": 86},
    ]
    mock_svc.build_context_summary.return_value = "ctx"
    mock_svc.compose_proactive_message.return_value = "hi"
    mock_svc.send_proactive_ping.return_value = {"telegram_sent": True}

    result = scheduler.tick(now=_now())
    mock_svc.send_proactive_ping.assert_called_once()
    call_kwargs = mock_svc.send_proactive_ping.call_args.kwargs
    assert call_kwargs["signal_kind"] == "cadence"
    assert result["sent"] == 1


@patch("app.domains.checkins.scheduler.services")
def test_tick_fires_anomaly_when_breach(mock_svc):
    # Cadence not due, but biometrics breach resting_hr threshold.
    mock_svc.fetch_eligible_users.return_value = [
        _user(last_at=_now() - timedelta(hours=2))
    ]
    mock_svc.fetch_recent_biometrics.return_value = [
        {"recorded_at": _now(), "resting_hr_bpm": 74, "hrv_ms": 45, "sleep_score": 70},
        {"recorded_at": _now() - timedelta(days=1), "resting_hr_bpm": 73, "hrv_ms": 47, "sleep_score": 72},
        {"recorded_at": _now() - timedelta(days=2), "resting_hr_bpm": 72, "hrv_ms": 48, "sleep_score": 73},
    ]
    mock_svc.recent_alert_exists.return_value = False
    mock_svc.build_context_summary.return_value = "ctx"
    mock_svc.compose_proactive_message.return_value = "hi"
    mock_svc.send_proactive_ping.return_value = {"telegram_sent": True}

    result = scheduler.tick(now=_now())
    mock_svc.send_proactive_ping.assert_called_once()
    call_kwargs = mock_svc.send_proactive_ping.call_args.kwargs
    assert call_kwargs["signal_kind"] == "anomaly"
    assert "resting_hr_bpm" in call_kwargs["alert_type"]
    assert result["sent"] == 1


@patch("app.domains.checkins.scheduler.services")
def test_tick_suppresses_duplicate_anomaly_within_window(mock_svc):
    mock_svc.fetch_eligible_users.return_value = [
        _user(last_at=_now() - timedelta(hours=2))
    ]
    mock_svc.fetch_recent_biometrics.return_value = [
        {"recorded_at": _now(), "resting_hr_bpm": 74, "hrv_ms": 45, "sleep_score": 70},
        {"recorded_at": _now() - timedelta(days=1), "resting_hr_bpm": 73, "hrv_ms": 47, "sleep_score": 72},
        {"recorded_at": _now() - timedelta(days=2), "resting_hr_bpm": 72, "hrv_ms": 48, "sleep_score": 73},
    ]
    mock_svc.recent_alert_exists.return_value = True  # already fired recently
    result = scheduler.tick(now=_now())
    mock_svc.send_proactive_ping.assert_not_called()
    assert result["sent"] == 0


@patch("app.domains.checkins.scheduler.services")
def test_tick_anomaly_takes_precedence_over_cadence(mock_svc):
    # Cadence IS due AND anomaly fires — we send anomaly only (one ping per tick).
    mock_svc.fetch_eligible_users.return_value = [
        _user(last_at=_now() - timedelta(hours=30))
    ]
    mock_svc.fetch_recent_biometrics.return_value = [
        {"recorded_at": _now(), "resting_hr_bpm": 74, "hrv_ms": 45, "sleep_score": 70},
        {"recorded_at": _now() - timedelta(days=1), "resting_hr_bpm": 73, "hrv_ms": 47, "sleep_score": 72},
        {"recorded_at": _now() - timedelta(days=2), "resting_hr_bpm": 72, "hrv_ms": 48, "sleep_score": 73},
    ]
    mock_svc.recent_alert_exists.return_value = False
    mock_svc.build_context_summary.return_value = "ctx"
    mock_svc.compose_proactive_message.return_value = "hi"
    mock_svc.send_proactive_ping.return_value = {"telegram_sent": True}

    scheduler.tick(now=_now())
    assert mock_svc.send_proactive_ping.call_count == 1
    assert mock_svc.send_proactive_ping.call_args.kwargs["signal_kind"] == "anomaly"


@patch("app.domains.checkins.scheduler.services")
def test_tick_continues_on_per_user_failure(mock_svc):
    # User A blows up, user B should still be evaluated.
    user_a = _user(uid="a", last_at=_now() - timedelta(hours=30))
    user_b = _user(uid="b", last_at=_now() - timedelta(hours=30))
    mock_svc.fetch_eligible_users.return_value = [user_a, user_b]

    def biometrics_side_effect(uid, days=5):
        if uid == "a":
            raise RuntimeError("db blip")
        return [
            {"recorded_at": _now(), "resting_hr_bpm": 62, "hrv_ms": 55, "sleep_score": 85},
            {"recorded_at": _now() - timedelta(days=1), "resting_hr_bpm": 63, "hrv_ms": 56, "sleep_score": 84},
            {"recorded_at": _now() - timedelta(days=2), "resting_hr_bpm": 64, "hrv_ms": 57, "sleep_score": 86},
        ]
    mock_svc.fetch_recent_biometrics.side_effect = biometrics_side_effect
    mock_svc.build_context_summary.return_value = "ctx"
    mock_svc.compose_proactive_message.return_value = "hi"
    mock_svc.send_proactive_ping.return_value = {"telegram_sent": True}

    result = scheduler.tick(now=_now())
    assert result["errors"] == 1
    assert result["evaluated"] == 2
    # User B's cadence path still fired.
    assert mock_svc.send_proactive_ping.call_count == 1
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && venv/bin/pytest tests/domains/checkins/test_scheduler.py -v`
Expected: `ModuleNotFoundError: No module named 'app.domains.checkins.scheduler'`

- [ ] **Step 3: Implement `scheduler.py`**

Create `backend/app/domains/checkins/scheduler.py`:

```python
"""
Scheduler tick + daemon loop for proactive Telegram check-ins.

`tick()` is one pass: pull eligible users, evaluate cadence + anomaly rules,
dispatch to services.send_proactive_ping. The daemon thread calls tick() on
a fixed interval. Both the daemon and the HTTP `POST /api/checkins/tick`
endpoint share this same function — the endpoint is the manual fire button.

Anomaly takes precedence over cadence in a single tick (one ping per user
per tick) to avoid stacking notifications.
"""
import os
import time
import logging
import threading
from datetime import datetime, timezone
from typing import Optional

from app.domains.checkins import services
from app.domains.checkins.rules import (
    BiometricThresholds,
    cadence_due,
    evaluate_biometric_anomaly,
)

logger = logging.getLogger("health_assistant.checkins.scheduler")

# How long between ticks. 300s default — short enough for the live demo.
TICK_INTERVAL_SECONDS = int(os.getenv("CHECKIN_TICK_INTERVAL_SECONDS", "300"))

# Don't re-fire the same anomaly type within this many hours.
ANOMALY_REPEAT_GUARD_HOURS = int(os.getenv("CHECKIN_ANOMALY_REPEAT_HOURS", "12"))

# Master kill switch. Default off in test envs (pytest sets PYTEST_CURRENT_TEST).
SCHEDULER_ENABLED = os.getenv("CHECKIN_SCHEDULER_ENABLED", "true").lower() == "true"

_thread: Optional[threading.Thread] = None
_thresholds = BiometricThresholds()


def tick(now: Optional[datetime] = None) -> dict:
    """One scheduler pass. Returns counters for logging + the test endpoint."""
    now = now or datetime.now(timezone.utc)
    sent = 0
    errors = 0
    users = services.fetch_eligible_users()
    for user in users:
        try:
            decision = _evaluate_user(user, now)
            if decision is None:
                continue
            signal_kind, signal_reason, alert_type, metric_data = decision
            context = services.build_context_summary(user["id"])
            message = services.compose_proactive_message(
                context_summary=context,
                signal_reason=signal_reason,
            )
            result = services.send_proactive_ping(
                user=user,
                message=message,
                signal_kind=signal_kind,
                signal_reason=signal_reason,
                alert_type=alert_type,
                metric_data=metric_data,
            )
            if result.get("telegram_sent"):
                sent += 1
        except Exception as e:
            errors += 1
            logger.exception("tick failed for user %s: %s", user.get("id"), e)

    logger.info(
        "tick complete: evaluated=%d sent=%d errors=%d", len(users), sent, errors
    )
    return {"evaluated": len(users), "sent": sent, "errors": errors}


def _evaluate_user(user: dict, now: datetime):
    """Return (signal_kind, reason, alert_type, metric_data) or None."""
    biometrics = services.fetch_recent_biometrics(user["id"], days=5)

    # Anomaly takes precedence — most actionable signal.
    anomaly = evaluate_biometric_anomaly(biometrics, _thresholds)
    if anomaly is not None:
        alert_type = f"anomaly_{anomaly.metric}"
        if services.recent_alert_exists(
            user["id"], alert_type, within_hours=ANOMALY_REPEAT_GUARD_HOURS
        ):
            logger.info(
                "suppressing duplicate anomaly %s for user %s", alert_type, user["id"]
            )
            return None
        return (
            "anomaly",
            anomaly.reason,
            alert_type,
            {
                "metric": anomaly.metric,
                "value": anomaly.value,
                "threshold": anomaly.threshold,
            },
        )

    # Cadence path — last_checkin_at vs configured interval.
    if cadence_due(
        last_at=user.get("last_checkin_at"),
        cadence_hours=user.get("checkin_cadence_hours") or 24,
        now=now,
    ):
        return (
            "cadence",
            "Routine check-in to see how the patient is feeling today.",
            "proactive_cadence",
            {},
        )

    return None


def _run_loop() -> None:
    logger.info(
        "checkin scheduler started; interval=%ds", TICK_INTERVAL_SECONDS
    )
    while True:
        try:
            tick()
        except Exception as e:
            logger.exception("scheduler tick crashed: %s", e)
        time.sleep(TICK_INTERVAL_SECONDS)


def start_checkin_scheduler() -> None:
    """Idempotent launcher — call once from FastAPI startup."""
    global _thread
    if not SCHEDULER_ENABLED:
        logger.info("checkin scheduler disabled via CHECKIN_SCHEDULER_ENABLED")
        return
    if _thread is not None and _thread.is_alive():
        logger.info("checkin scheduler already running")
        return
    _thread = threading.Thread(target=_run_loop, daemon=True, name="checkin-scheduler")
    _thread.start()
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && venv/bin/pytest tests/domains/checkins/test_scheduler.py -v`
Expected: all 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/domains/checkins/scheduler.py backend/tests/domains/checkins/test_scheduler.py
git commit -m "add checkin scheduler tick + daemon thread"
```

---

## Task 5: Wire `tick` HTTP endpoint + refactor `force_trigger` to share path

**Files:**
- Modify: `backend/app/domains/checkins/router.py`

- [ ] **Step 1: Read the current `force_trigger` to know exactly what to replace**

Run: `grep -n "force_trigger\|_compose_proactive_message\|_activate_afib_alert" backend/app/domains/checkins/router.py`
Expected output (lines exist):
```
120:def _compose_proactive_message(user_id: str) -> str:
140:def _activate_afib_alert(user_id: str) -> Optional[str]:
165:@router.post("/force_trigger")
166:def force_trigger(user_id: str = Query(..., description="UUID of the demo user")) -> dict:
```

- [ ] **Step 2: Replace the local `_compose_proactive_message` body to use the new services module + add `/tick` endpoint**

Edit `backend/app/domains/checkins/router.py`. Replace the existing local prompt block (lines ~34-55 — the `PROACTIVE_PROMPT` constant) with an import-time delegation, and replace the body of `force_trigger` to use `services.send_proactive_ping`. Also add a new `/tick` route.

Apply these edits:

Replace the block:
```python
from app.core.config import client
from app.core.db import get_db_connection
from app.domains.telegram.bot import bot
```

with:
```python
from app.core.config import client
from app.core.db import get_db_connection
from app.domains.telegram.bot import bot
from app.domains.checkins import services, scheduler
```

Then add this route at the end of the `router` block (right after the existing `force_trigger` definition, before the `# Read endpoints` separator comment around line 200):

```python
@router.post("/tick")
def manual_tick() -> dict:
    """
    Manually fire one scheduler tick. Used for tests and live demos where we
    don't want to wait CHECKIN_TICK_INTERVAL_SECONDS for the daemon. Safe to
    call repeatedly — the scheduler's own de-dupe logic gates re-sends.
    """
    return scheduler.tick()
```

- [ ] **Step 3: Refactor `force_trigger` to call shared services**

Replace the body of `def force_trigger(...)` (lines ~166-197) with:

```python
@router.post("/force_trigger")
def force_trigger(user_id: str = Query(..., description="UUID of the demo user")) -> dict:
    """
    Demo escalation: composes + sends a proactive check-in via Telegram and
    flips the dormant AFib alert to active. Shares the compose-and-send path
    with the scheduler so behavior matches in both the manual and automatic
    flows.
    """
    user = _fetch_user(user_id)
    context = services.build_context_summary(user_id)
    # Demo button hardcodes the AFib narrative — scheduler uses dynamic reasons.
    reason = (
        "Heart rate has been elevated for several days and the headache "
        "trend is continuing."
    )
    message = services.compose_proactive_message(
        context_summary=context, signal_reason=reason
    )
    send_result = services.send_proactive_ping(
        user=user,
        message=message,
        signal_kind="cadence",
        signal_reason=reason,
        alert_type="proactive_demo",
    )
    activated_alert_id = _activate_afib_alert(user_id)
    return {
        "ok": True,
        "user_id": user_id,
        "composed_message": message,
        "telegram_sent": send_result["telegram_sent"],
        "telegram_error": send_result.get("telegram_error"),
        "activated_alert_id": activated_alert_id,
    }
```

Then delete the now-dead local helper `_compose_proactive_message` (the old function in the file) — it's been replaced by `services.compose_proactive_message` + `services.build_context_summary`. Keep `_fetch_user` and `_activate_afib_alert` — they're still used.

- [ ] **Step 4: Smoke-import the module**

Run: `cd backend && venv/bin/python -c "from app.domains.checkins.router import router; print([r.path for r in router.routes])"`
Expected output (contains both endpoints):
```
['/api/checkins/force_trigger', '/api/checkins/tick']
```

- [ ] **Step 5: Re-run the existing test suites to confirm nothing regressed**

Run: `cd backend && venv/bin/pytest tests/domains/checkins/ -v`
Expected: all tests from Tasks 2, 3, 4 still PASS (23 total)

- [ ] **Step 6: Commit**

```bash
git add backend/app/domains/checkins/router.py
git commit -m "share compose-and-send between force_trigger and scheduler; add /tick endpoint"
```

---

## Task 6: Wire scheduler into FastAPI startup

**Files:**
- Modify: `backend/app/main.py` (the `on_startup` handler)

- [ ] **Step 1: Add the import**

In `backend/app/main.py`, add this import next to the existing `start_bot_polling` import:

```python
from app.domains.checkins.scheduler import start_checkin_scheduler
```

- [ ] **Step 2: Call it in `on_startup`**

Replace the existing `on_startup` body:

```python
@app.on_event("startup")
def on_startup():
    # Init DB
    initialize_database()
    # Start Bot
    start_bot_polling()
```

with:

```python
@app.on_event("startup")
def on_startup():
    initialize_database()
    start_bot_polling()
    start_checkin_scheduler()
```

- [ ] **Step 3: Start the server briefly and check the log line**

Run (in one shell):
```bash
cd backend && CHECKIN_TICK_INTERVAL_SECONDS=600 venv/bin/uvicorn app.main:app --port 8001 &
sleep 3
curl -sf http://localhost:8001/ && echo
kill %1
```
Expected: `{"status":"ok","service":"Health Assistant Orchestrator API (pgvector + DDD)"}` and in the uvicorn log a line like `checkin scheduler started; interval=600s`.

- [ ] **Step 4: Commit**

```bash
git add backend/app/main.py
git commit -m "start checkin scheduler on FastAPI startup"
```

---

## Task 7: End-to-end manual verification against the live Telegram bot

**Files:**
- None (verification only)

- [ ] **Step 1: Ensure the stack is up + Ravi is seeded**

Run:
```bash
docker compose up -d db
cd backend && venv/bin/python -m app.core.seed_demo
```
Expected: log line `Seeded user Ravi Kumar ...` (or `User already seeded` if re-running).

- [ ] **Step 2: Bind Ravi's `telegram_id` to your real Telegram chat**

In Telegram, send `/start` to your bot, share contact when prompted with phone `+15551234567`. Verify:
```bash
docker compose exec -T db psql -U postgres -d health_assistant -c "SELECT id, phone_number, telegram_id, last_checkin_at FROM users WHERE phone_number = '+15551234567';"
```
Expected: `telegram_id` is populated with your real Telegram numeric ID, `last_checkin_at` is NULL.

- [ ] **Step 3: Start the backend with a short tick interval**

Run: `cd backend && CHECKIN_TICK_INTERVAL_SECONDS=60 CHECKIN_ANOMALY_REPEAT_HOURS=1 venv/bin/uvicorn app.main:app --port 8000`

- [ ] **Step 4: Fire one tick via the HTTP endpoint**

In a second shell:
```bash
curl -X POST http://localhost:8000/api/checkins/tick | jq
```
Expected output (anomaly path should fire because the seeded biometrics breach the resting-HR threshold):
```json
{ "evaluated": 1, "sent": 1, "errors": 0 }
```
And: a real Telegram message arrives in your chat, ~2-3 sentences, plain English, ending in a question.

- [ ] **Step 5: Verify the alert + last_checkin_at landed**

Run:
```bash
docker compose exec -T db psql -U postgres -d health_assistant -c "SELECT alert_type, status, body, triggered_at FROM user_alerts WHERE alert_type LIKE 'anomaly_%' ORDER BY triggered_at DESC LIMIT 1;"
docker compose exec -T db psql -U postgres -d health_assistant -c "SELECT last_checkin_at FROM users WHERE phone_number='+15551234567';"
```
Expected: one `anomaly_resting_hr_bpm` row with status=`active`; `last_checkin_at` is now recent (within seconds of when you fired the tick).

- [ ] **Step 6: Fire the tick again and verify the de-dupe**

Run: `curl -X POST http://localhost:8000/api/checkins/tick | jq`
Expected: `{ "evaluated": 1, "sent": 0, "errors": 0 }` — no second Telegram message, the suppression log line appears in uvicorn output.

- [ ] **Step 7: Lower the anomaly guard, wipe biometrics to "healthy," confirm the cadence path**

In `db` shell:
```sql
DELETE FROM user_biometrics WHERE user_id = (SELECT id FROM users WHERE phone_number='+15551234567');
INSERT INTO user_biometrics (user_id, recorded_at, resting_hr_bpm, hrv_ms, sleep_score, source)
SELECT id, NOW() - INTERVAL '1 day' * g, 62, 55, 85, 'manual'
FROM users, generate_series(0,2) g WHERE phone_number='+15551234567';
UPDATE users SET last_checkin_at = NOW() - INTERVAL '30 hours' WHERE phone_number='+15551234567';
```

Then:
```bash
curl -X POST http://localhost:8000/api/checkins/tick | jq
```
Expected: `{ "evaluated": 1, "sent": 1, "errors": 0 }`, a Telegram message arrives, and on inspection the new `user_alerts` row has `alert_type='proactive_cadence'`.

- [ ] **Step 8: Document the verification result**

Write a 5-line note in the PR description: which test step caught what, the actual message text the LLM produced, and any LLM-output edge cases observed (e.g., did Gemini try to insert markdown? Did it stay in English?). No code change.

- [ ] **Step 9: Commit verification doc (if anything was added) and close**

```bash
git status
# If only docs changed:
git add project-docs/
git commit -m "document proactive scheduler end-to-end verification"
```

---

## Self-Review

**Spec coverage:**
- ✅ Periodic job — Task 4 + 6 (daemon thread on startup)
- ✅ Reads `user_biometrics` + thresholds — `services.fetch_recent_biometrics` + `rules.evaluate_biometric_anomaly`
- ✅ Calls same compose-and-send code — Task 5 refactors `force_trigger` and the new `tick` to share `services.send_proactive_ping`
- ✅ Cadence — `cadence_due` + `users.last_checkin_at` + `users.checkin_cadence_hours`
- ✅ Abnormality — three thresholds (HR, HRV, sleep), 3-day rolling average, de-dupe via `recent_alert_exists`

**Placeholder scan:** No TBDs, no "add error handling," no "similar to Task N." All code blocks are complete.

**Type / name consistency:**
- `AnomalySignal` fields (metric, value, threshold, reason) consistent across rules.py + tests
- `BiometricThresholds` field names (`resting_hr_avg_bpm`, `hrv_avg_ms`, `sleep_score_avg`, `window_days`) consistent
- `services.send_proactive_ping` signature (`user, message, signal_kind, signal_reason, alert_type, metric_data`) matches every call site in router.py + scheduler.py + tests
- `services.fetch_recent_biometrics(user_id, days=5)` signature matches scheduler call
- `tick(now=None)` signature matches both the HTTP `/tick` endpoint and the daemon loop call

---

## Execution Handoff

**Plan complete and saved to `project-docs/2026-05-23-proactive-checkin-scheduler.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
