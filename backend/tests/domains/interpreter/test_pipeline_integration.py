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
