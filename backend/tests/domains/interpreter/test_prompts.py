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
