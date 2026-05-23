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
