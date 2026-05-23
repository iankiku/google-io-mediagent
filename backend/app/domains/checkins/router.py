"""
Checkins domain — hidden admin endpoint that fires the Act 1 proactive ping.

`force_trigger` is the demo's panic button: one click composes a plain-English
proactive check-in via Gemini Flash, sends it to the user's Telegram chat, and
flips the dormant AFib alert row to `active` so the `/vitals` page lights up.

Language policy: English-only on the messaging layer. The voice interpreter
(`/talk`) is the ONLY multilingual surface — see memory note
`feedback_english_default_outside_voice`. `users.preferred_language` is a
voice-interpreter hint, NOT consulted here.

No UI link — frontend gates the call behind `?demo=1`.
"""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import HTMLResponse
from google.genai import types

from app.core.config import client
from app.core.db import get_db_connection
from app.domains.telegram.bot import bot

logger = logging.getLogger("health_assistant.checkins.router")

router = APIRouter(prefix="/api/checkins", tags=["checkins"])
read_router = APIRouter(prefix="/api", tags=["read"])
debug_router = APIRouter(prefix="/debug", tags=["debug"])


PROACTIVE_PROMPT = """
You are Zoie, a warm and concise health companion messaging the patient on
Telegram. Your job in this turn: compose ONE short proactive check-in message
acknowledging that their heart rate has been elevated for several days and the
headache trend is continuing, then gently offer to set up an appointment with
their doctor.

Voice and constraints:
- Plain conversational American English. No honorifics, no code-switching, no
  ethnic register markers, no transliterated words from other languages.
- 2-3 sentences MAXIMUM.
- Warm but professional — care without being saccharine.
- End with a soft question, not a directive.
- No medical advice, no diagnosis — Zoie is a memory and interpreter layer,
  not a doctor.
- Plain text only, no markdown.
- Refer to the recipient by first name only if the context provides one;
  otherwise no name at all.

The recent context to weave in:
{context_summary}
"""


def _fetch_user(user_id: str) -> dict:
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT id, phone_number, telegram_id, preferred_language FROM users WHERE id = %s;",
            (user_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail=f"User {user_id} not found")
        return dict(row)
    finally:
        cur.close()
        conn.close()


def _build_context_summary(user_id: str) -> str:
    """Pulls the last 3 days of biometrics + last 2 check-ins for the prompt."""
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
            SELECT extracted_summary, created_at
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
        parts.append("Recent self-reports: " + "; ".join(c["extracted_summary"][:200] for c in checkins))
    return "\n\n".join(parts) if parts else "No recent context available."


def _compose_proactive_message(user_id: str) -> str:
    context = _build_context_summary(user_id)
    prompt = PROACTIVE_PROMPT.format(context_summary=context)
    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(temperature=0.7),
        )
        return (response.text or "").strip()
    except Exception as e:
        logger.error("Gemini compose failed: %s", e)
        # Fallback message so the demo never breaks on a network blip.
        return (
            "Hi Ravi — your resting heart rate has been higher than usual for the "
            "past few days, and the headache trend is continuing. Would it help if "
            "I set up an appointment with Dr. Patel?"
        )


def _activate_afib_alert(user_id: str) -> Optional[str]:
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            UPDATE user_alerts
            SET status = 'active', triggered_at = CURRENT_TIMESTAMP
            WHERE user_id = %s AND alert_type = 'afib' AND status = 'dormant'
            RETURNING id;
            """,
            (user_id,),
        )
        row = cur.fetchone()
        conn.commit()
        return str(row["id"]) if row else None
    except Exception as e:
        conn.rollback()
        logger.error("Alert activation failed: %s", e)
        return None
    finally:
        cur.close()
        conn.close()


@router.post("/force_trigger")
def force_trigger(user_id: str = Query(..., description="UUID of the demo user")) -> dict:
    """
    Demo escalation: composes + sends a plain-English proactive check-in via
    Telegram and flips the dormant AFib alert to active. Idempotent on alert
    activation — re-clicking after the alert is already `active` returns
    `activated_alert_id: null` but the API still sends a fresh Telegram message.
    """
    user = _fetch_user(user_id)
    message = _compose_proactive_message(user_id)

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

    activated_alert_id = _activate_afib_alert(user_id)

    return {
        "ok": True,
        "user_id": user_id,
        "composed_message": message,
        "telegram_sent": telegram_sent,
        "telegram_error": telegram_error,
        "activated_alert_id": activated_alert_id,
    }


# ---------------------------------------------------------------------------
# Read endpoints — thin convenience queries for the demo surface (Block 4.10).
# ---------------------------------------------------------------------------


@read_router.get("/biometrics")
def list_biometrics(
    user_id: str = Query(...),
    limit: int = Query(30, ge=1, le=365),
) -> dict:
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT id, recorded_at, source, hrv_ms, resting_hr_bpm, peak_hr_bpm,
                   steps, sleep_score, sleep_hours, respiratory_rate, skin_temp_delta_f, notes
            FROM user_biometrics
            WHERE user_id = %s
            ORDER BY recorded_at DESC
            LIMIT %s;
            """,
            (user_id, limit),
        )
        rows = cur.fetchall() or []
        return {"user_id": user_id, "count": len(rows), "biometrics": [dict(r) for r in rows]}
    finally:
        cur.close()
        conn.close()


@read_router.get("/alerts")
def list_alerts(
    user_id: str = Query(...),
    status: Optional[str] = Query(None, description="Filter by status (dormant/active/acknowledged)"),
) -> dict:
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        if status:
            cur.execute(
                """
                SELECT id, alert_type, severity, status, title, body, metric_data,
                       triggered_at, acknowledged_at, created_at
                FROM user_alerts
                WHERE user_id = %s AND status = %s
                ORDER BY created_at DESC;
                """,
                (user_id, status),
            )
        else:
            cur.execute(
                """
                SELECT id, alert_type, severity, status, title, body, metric_data,
                       triggered_at, acknowledged_at, created_at
                FROM user_alerts
                WHERE user_id = %s
                ORDER BY created_at DESC;
                """,
                (user_id,),
            )
        rows = cur.fetchall() or []
        return {"user_id": user_id, "count": len(rows), "alerts": [dict(r) for r in rows]}
    finally:
        cur.close()
        conn.close()


@read_router.get("/records")
def list_records(
    user_id: str = Query(...),
    file_type: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=500),
) -> dict:
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        if file_type:
            cur.execute(
                """
                SELECT id, file_name, file_path, file_type, extracted_summary, created_at
                FROM user_medical_records
                WHERE user_id = %s AND file_type = %s
                ORDER BY created_at DESC
                LIMIT %s;
                """,
                (user_id, file_type, limit),
            )
        else:
            cur.execute(
                """
                SELECT id, file_name, file_path, file_type, extracted_summary, created_at
                FROM user_medical_records
                WHERE user_id = %s
                ORDER BY created_at DESC
                LIMIT %s;
                """,
                (user_id, limit),
            )
        rows = cur.fetchall() or []
        return {"user_id": user_id, "count": len(rows), "records": [dict(r) for r in rows]}
    finally:
        cur.close()
        conn.close()


# ---------------------------------------------------------------------------
# Debug surface — visual dump of Ravi's seeded data.
# Open http://localhost:8000/debug/ravi
# ---------------------------------------------------------------------------


_DEBUG_HTML = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Ravi — seed debug</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Inter", sans-serif; margin: 0; padding: 24px 32px;
         background: #fcf8fb; color: #1b1b1d; line-height: 1.45; }
  header { padding: 16px 0 24px; border-bottom: 1px solid #e2e8f0; margin-bottom: 24px; }
  h1 { margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.01em; }
  h1 small { font-weight: 400; color: #64748b; font-size: 14px; margin-left: 12px; }
  h2 { font-size: 18px; font-weight: 600; margin: 32px 0 12px; }
  .grid { display: grid; gap: 16px; }
  .grid-3 { grid-template-columns: repeat(3, 1fr); }
  .grid-4 { grid-template-columns: repeat(4, 1fr); }
  .card { background: white; border-radius: 16px; padding: 20px 24px;
          box-shadow: 0 4px 20px rgba(36, 30, 63, 0.04); }
  .card h3 { margin: 0 0 8px; font-size: 13px; font-weight: 600;
             text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; }
  .card .v { font-size: 24px; font-weight: 700; }
  .card .v small { font-size: 13px; color: #64748b; margin-left: 4px; }
  .delta { font-size: 12px; color: #475569; margin-top: 4px; }
  .alert-card { background: #ffdad6; border: 1px solid #ba1a1a; color: #93000a; }
  .alert-card.dormant { background: #f0edef; border: 1px solid #cbd5e1; color: #64748b; }
  .alert-card h3 { color: inherit; }
  .alert-card .title { font-size: 18px; font-weight: 700; margin: 4px 0 8px; }
  .alert-card .body { font-size: 14px; }
  .badge { display: inline-block; padding: 2px 10px; border-radius: 999px;
           font-size: 11px; font-weight: 600; background: #e5e2e4; color: #303032;
           text-transform: uppercase; letter-spacing: 0.04em; }
  .badge.active { background: #ba1a1a; color: white; }
  .badge.dormant { background: #94a3b8; color: white; }
  .record { background: white; border-radius: 12px; padding: 16px 20px; margin-bottom: 10px;
            box-shadow: 0 2px 12px rgba(36, 30, 63, 0.03); }
  .record .when { font-size: 12px; color: #64748b; }
  .record .type { display: inline-block; padding: 2px 8px; border-radius: 4px;
                   background: #e0e7ff; color: #3730a3; font-size: 11px; font-weight: 600;
                   margin-right: 8px; text-transform: uppercase; }
  .record pre { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 12px;
                 background: #f8fafc; padding: 10px; border-radius: 6px; overflow-x: auto;
                 max-height: 200px; }
  .summary-text { font-size: 14px; color: #46464d; line-height: 1.6;
                  background: white; padding: 24px; border-radius: 16px;
                  box-shadow: 0 4px 20px rgba(36, 30, 63, 0.04); }
  .empty { color: #94a3b8; font-style: italic; }
  button { padding: 10px 20px; background: #1b1b1d; color: white;
           border: 0; border-radius: 8px; font-size: 13px; font-weight: 600;
           cursor: pointer; }
  button:hover { background: #303032; }
  .trigger-row { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
  #trigger-status { font-size: 13px; color: #64748b; }
</style>
</head>
<body>
<header>
  <h1>Ravi Kumar <small>seed debug — raw view of pgvector state</small></h1>
</header>

<div class="trigger-row">
  <button onclick="fireTrigger()">▶ Fire force_trigger</button>
  <span id="trigger-status">click to send Telegram ping + activate AFib alert</span>
</div>

<h2>AI Health Status Summary</h2>
<div id="summary" class="summary-text"><span class="empty">loading…</span></div>

<h2>Latest Biometrics <span id="bio-date" style="font-size: 13px; color: #64748b; font-weight: 400;"></span></h2>
<div id="bio-grid" class="grid grid-4"></div>

<h2>Alerts</h2>
<div id="alerts" class="grid"></div>

<h2>Records timeline</h2>
<div id="records"></div>

<script>
const RAVI_ID = "RAVI_USER_ID_PLACEHOLDER";

async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return await r.json();
}

function fmtDate(s) { try { return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); } catch { return s; } }
function fmtTime(s) { try { return new Date(s).toLocaleString(); } catch { return s; } }

async function loadAll() {
  try {
    const [bio, alerts, records] = await Promise.all([
      fetchJSON(`/api/biometrics?user_id=${RAVI_ID}&limit=7`),
      fetchJSON(`/api/alerts?user_id=${RAVI_ID}`),
      fetchJSON(`/api/records?user_id=${RAVI_ID}&limit=20`),
    ]);
    renderBiometrics(bio.biometrics);
    renderAlerts(alerts.alerts);
    renderRecords(records.records);
  } catch (e) {
    document.body.insertAdjacentHTML('afterbegin',
      `<div style="background:#ffdad6;padding:12px 16px;border-radius:8px;margin-bottom:16px;">Load error: ${e.message}</div>`);
  }
}

function renderBiometrics(rows) {
  if (!rows || rows.length === 0) { document.getElementById('bio-grid').innerHTML = '<div class="empty">no biometrics</div>'; return; }
  const today = rows[0];
  const week_ago = rows[rows.length - 1] || today;
  document.getElementById('bio-date').textContent = `as of ${fmtDate(today.recorded_at)}`;
  const card = (label, value, unit, delta) => `
    <div class="card">
      <h3>${label}</h3>
      <div class="v">${value}<small>${unit || ''}</small></div>
      ${delta ? `<div class="delta">${delta}</div>` : ''}
    </div>`;
  const trend = (a, b) => {
    const diff = (a - b).toFixed(1);
    const arrow = diff > 0 ? '▲' : (diff < 0 ? '▼' : '·');
    return `${arrow} ${Math.abs(diff)} vs 7d ago`;
  };
  document.getElementById('bio-grid').innerHTML = [
    card('Resting HR', today.resting_hr_bpm, ' bpm', trend(today.resting_hr_bpm, week_ago.resting_hr_bpm)),
    card('HRV', today.hrv_ms, ' ms', trend(today.hrv_ms, week_ago.hrv_ms)),
    card('Sleep score', today.sleep_score, ' /100', trend(today.sleep_score, week_ago.sleep_score)),
    card('Steps', today.steps?.toLocaleString(), '', trend(today.steps, week_ago.steps)),
    card('Sleep hours', today.sleep_hours, ' h'),
    card('Respiratory', today.respiratory_rate, ' br/min'),
    card('Skin temp Δ', today.skin_temp_delta_f, ' °F'),
    card('Peak HR (today)', today.peak_hr_bpm, ' bpm'),
  ].join('');
}

function renderAlerts(rows) {
  if (!rows || rows.length === 0) { document.getElementById('alerts').innerHTML = '<div class="empty">no alerts</div>'; return; }
  document.getElementById('alerts').innerHTML = rows.map(a => {
    const dormant = a.status === 'dormant';
    const m = a.metric_data || {};
    return `
      <div class="card alert-card ${dormant ? 'dormant' : ''}">
        <span class="badge ${dormant ? 'dormant' : 'active'}">${a.status}</span>
        <div class="title">${a.title}</div>
        <div class="body">${a.body}</div>
        ${m.peak_bpm ? `<div class="delta">peak ${m.peak_bpm} bpm · ${m.duration_minutes} min · on-call: ${m.cardiologist_on_call || ''}</div>` : ''}
        ${a.triggered_at ? `<div class="delta">triggered ${fmtTime(a.triggered_at)}</div>` : ''}
      </div>`;
  }).join('');
}

function renderRecords(rows) {
  if (!rows || rows.length === 0) { document.getElementById('records').innerHTML = '<div class="empty">no records</div>'; return; }
  let summaryRendered = false;
  document.getElementById('records').innerHTML = rows.map(r => {
    let parsed = {};
    try { parsed = JSON.parse(r.extracted_summary || '{}'); } catch {}
    if (r.file_type === 'health_summary' && !summaryRendered) {
      summaryRendered = true;
      document.getElementById('summary').textContent = parsed.summary || r.extracted_summary || '';
      return '';
    }
    const headline = parsed.summary || parsed.text || r.file_name;
    return `
      <div class="record">
        <span class="type">${r.file_type}</span>
        <span class="when">${fmtTime(r.created_at)}</span>
        <div style="margin-top:8px;">${headline}</div>
      </div>`;
  }).join('');
}

async function fireTrigger() {
  document.getElementById('trigger-status').textContent = 'firing…';
  try {
    const r = await fetch(`/api/checkins/force_trigger?user_id=${RAVI_ID}`, { method: 'POST' });
    const j = await r.json();
    document.getElementById('trigger-status').innerHTML =
      `telegram=${j.telegram_sent ? '✅' : '❌'} ` +
      `alert=${j.activated_alert_id ? '✅ activated' : 'noop'} ` +
      `msg: <em style="color:#46464d">"${(j.composed_message||'').slice(0,80)}…"</em>`;
    loadAll();
  } catch (e) {
    document.getElementById('trigger-status').textContent = 'error: ' + e.message;
  }
}

loadAll();
</script>
</body>
</html>
"""


def _ravi_user_id() -> Optional[str]:
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT id FROM users WHERE phone_number = '+15551234567';")
        row = cur.fetchone()
        return str(row["id"]) if row else None
    finally:
        cur.close()
        conn.close()


@debug_router.get("/ravi", response_class=HTMLResponse)
def debug_ravi() -> HTMLResponse:
    user_id = _ravi_user_id()
    if not user_id:
        return HTMLResponse(
            "<h1>Ravi not seeded</h1><p>Run <code>python -m app.core.seed_demo</code> first.</p>",
            status_code=404,
        )
    return HTMLResponse(_DEBUG_HTML.replace("RAVI_USER_ID_PLACEHOLDER", user_id))
