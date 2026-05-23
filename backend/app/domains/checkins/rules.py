"""
Pure rule functions for the proactive check-in scheduler.

Deterministic, zero I/O — take plain dicts + config, return decisions. Side
effects (DB, Gemini, Telegram) live in services.py; the daemon loop lives
in scheduler.py. This split keeps the rule engine cheap to unit-test and
easy to iterate thresholds on.
"""
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional


@dataclass(frozen=True)
class BiometricThresholds:
    """Demo defaults. A signal fires when the AVERAGE over the last
    `window_days` exceeds (HR) or falls below (HRV, sleep_score) the cutoff."""
    resting_hr_avg_bpm: float = 70.0
    hrv_avg_ms: float = 35.0
    sleep_score_avg: float = 65.0
    window_days: int = 3


@dataclass(frozen=True)
class AnomalySignal:
    metric: str
    value: float
    threshold: float
    reason: str


def cadence_due(
    last_at: Optional[datetime],
    cadence_hours: int,
    now: datetime,
) -> bool:
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
    """Return the first matching anomaly (HR > HRV > sleep) or None.
    Requires at least `window_days` rows."""
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
