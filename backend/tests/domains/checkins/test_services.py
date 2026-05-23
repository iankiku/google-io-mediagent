from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

from app.domains.checkins import services


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
    contents = mock_client.models.generate_content.call_args.kwargs["contents"]
    assert "Resting heart rate has been elevated" in contents


@patch("app.domains.checkins.services.client")
def test_compose_proactive_message_fallback_on_llm_error(mock_client):
    mock_client.models.generate_content.side_effect = RuntimeError("boom")
    out = services.compose_proactive_message(context_summary="x", signal_reason="y")
    assert out
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
    sql_calls = [c.args[0] for c in cur.execute.call_args_list]
    assert any("INSERT INTO user_alerts" in s for s in sql_calls)
    assert any("UPDATE users" in s and "last_checkin_at" in s for s in sql_calls)


@patch("app.domains.checkins.services.bot", None)
@patch("app.domains.checkins.services.get_db_connection")
def test_send_proactive_ping_no_bot_returns_error(mock_conn):
    cur = MagicMock()
    cur.fetchone.return_value = {"id": "alert-uuid-2"}
    mock_conn.return_value.cursor.return_value = cur
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
