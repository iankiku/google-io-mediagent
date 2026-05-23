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


def _bio(days_ago, resting_hr, hrv, sleep_score):
    return {
        "recorded_at": _now() - timedelta(days=days_ago),
        "resting_hr_bpm": resting_hr,
        "hrv_ms": hrv,
        "sleep_score": sleep_score,
    }


def test_anomaly_resting_hr_sustained_high():
    rows = [_bio(0, 74, 45, 71), _bio(1, 73, 47, 72), _bio(2, 72, 48, 73)]
    signal = evaluate_biometric_anomaly(rows, BiometricThresholds())
    assert signal is not None
    assert signal.metric == "resting_hr_bpm"
    assert "elevated" in signal.reason.lower()


def test_anomaly_none_when_in_range():
    rows = [_bio(0, 62, 60, 85), _bio(1, 63, 58, 84), _bio(2, 64, 59, 86)]
    assert evaluate_biometric_anomaly(rows, BiometricThresholds()) is None


def test_anomaly_low_hrv_sustained():
    rows = [_bio(0, 65, 28, 80), _bio(1, 65, 29, 80), _bio(2, 66, 27, 80)]
    signal = evaluate_biometric_anomaly(rows, BiometricThresholds())
    assert signal is not None
    assert signal.metric == "hrv_ms"


def test_anomaly_low_sleep_sustained():
    rows = [_bio(0, 65, 60, 55), _bio(1, 65, 60, 58), _bio(2, 65, 60, 56)]
    signal = evaluate_biometric_anomaly(rows, BiometricThresholds())
    assert signal is not None
    assert signal.metric == "sleep_score"


def test_anomaly_skipped_when_insufficient_data():
    assert evaluate_biometric_anomaly([_bio(0, 90, 25, 50)], BiometricThresholds()) is None


def test_anomaly_resting_hr_priority_over_hrv():
    rows = [_bio(0, 78, 28, 55), _bio(1, 77, 29, 56), _bio(2, 76, 27, 57)]
    signal = evaluate_biometric_anomaly(rows, BiometricThresholds())
    assert signal is not None
    assert signal.metric == "resting_hr_bpm"
