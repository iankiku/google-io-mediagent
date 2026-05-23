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
