from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Sequence


@dataclass
class RecordFilter:
    name: str
    description: str
    sql_condition: str
    params: tuple[Any, ...] = ()


@dataclass
class PatientRecordContext:
    record_id: str
    file_name: str
    file_type: str
    chunk_content: str
    distance: float


@dataclass
class SimpleRecordRagResult:
    query: str
    user_id: str
    filter_name: str
    contexts: list[PatientRecordContext]
    final_answer: str
    model_name: str
    logs: list[str]


SCAN_RECORD_FILTER = RecordFilter(
    name="scans",
    description=(
        "Imaging-style records only. Because the current schema has no record_category column, "
        "this uses file_type/file_name/text heuristics and excludes check-ins and Rx bottles."
    ),
    sql_condition="""
        (
            lower(umr.file_type) IN (
                'image/jpeg', 'image/jpg', 'image/png', 'jpeg', 'jpg', 'png',
                'scan', 'scan_report', 'radiology', 'xray', 'x-ray', 'mri', 'ct', 'ultrasound'
            )
            OR lower(umr.file_name) LIKE ANY(%s)
            OR lower(ure.chunk_content) LIKE ANY(%s)
        )
        AND lower(umr.file_type) NOT IN ('checkin', 'rx_bottle')
        AND lower(umr.file_name) NOT LIKE ANY(%s)
    """,
    params=(
        [
            "%scan%",
            "%xray%",
            "%x-ray%",
            "%mri%",
            "%ct%",
            "%ultrasound%",
            "%radiology%",
        ],
        [
            "%scan%",
            "%x-ray%",
            "%xray%",
            "%mri%",
            "%ct scan%",
            "%ultrasound%",
            "%radiology%",
            "%impression:%",
        ],
        ["%rx%", "%prescription%", "%lisinopril%", "%bottle%"],
    ),
)


REPORT_RECORD_FILTER = RecordFilter(
    name="reports",
    description=(
        "Lab PDFs and doctor/physician notes. This deliberately excludes check-ins, Rx bottles, "
        "and image-only rows unless their metadata/text explicitly marks them as doctor notes."
    ),
    sql_condition="""
        (
            lower(umr.file_type) IN (
                'application/pdf', 'pdf', 'text/plain', 'txt',
                'physician_note', 'doctor_note', 'md_note', 'lab_report', 'report'
            )
            OR lower(umr.file_name) LIKE ANY(%s)
            OR lower(ure.chunk_content) LIKE ANY(%s)
        )
        AND lower(umr.file_type) NOT IN ('checkin', 'rx_bottle')
        AND lower(umr.file_name) NOT LIKE ANY(%s)
    """,
    params=(
        [
            "%lab%",
            "%report%",
            "%panel%",
            "%doctor%",
            "%physician%",
            "%note%",
            "%.pdf",
        ],
        [
            "%lab values:%",
            "%loinc:%",
            "%doctor note%",
            "%physician note%",
            "%medical record:%",
        ],
        ["%rx%", "%prescription%", "%bottle%"],
    ),
)


def retrieve_patient_record_contexts(
    user_id: str,
    query: str,
    record_filter: RecordFilter,
    *,
    limit: int = 5,
) -> list[PatientRecordContext]:
    """
    One-shot text retrieval over already-ingested patient records.

    This intentionally does not touch the general medical KB. The scans/reports agents
    should stay scoped to the patient-specific record class they are responsible for.
    """
    from app.core.db import get_db_connection
    from app.domains.ingestion.services import generate_embedding

    query_vector = generate_embedding(query)
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute(
            f"""
            SELECT
                ure.record_id::text AS record_id,
                umr.file_name,
                umr.file_type,
                ure.chunk_content,
                (ure.embedding <=> %s::vector) AS distance
            FROM user_record_embeddings ure
            JOIN user_medical_records umr ON umr.id = ure.record_id
            WHERE ure.user_id = %s::uuid
              AND ({record_filter.sql_condition})
            ORDER BY distance ASC
            LIMIT %s;
            """,
            (query_vector, user_id, *record_filter.params, limit),
        )
        rows = cur.fetchall()
        return [
            PatientRecordContext(
                record_id=str(row["record_id"]),
                file_name=row["file_name"],
                file_type=row["file_type"],
                chunk_content=row["chunk_content"],
                distance=float(row["distance"]),
            )
            for row in rows
        ]
    finally:
        cur.close()
        conn.close()


def build_context_block(contexts: Sequence[PatientRecordContext]) -> str:
    if not contexts:
        return "No matching patient records were retrieved."

    return "\n\n".join(
        [
            (
                f"[doc:{context.record_id}] {context.file_name} "
                f"({context.file_type}, distance={context.distance:.4f})\n"
                f"{context.chunk_content}"
            )
            for context in contexts
        ]
    )


def synthesize_from_patient_records(
    *,
    query: str,
    contexts: Sequence[PatientRecordContext],
    model_name: str,
    system_instruction: str,
) -> str:
    context_block = build_context_block(contexts)
    prompt = f"""
Patient question:
{query}

Retrieved patient records:
{context_block}

Answer the question using only the retrieved patient records above. Cite patient-specific
claims with [doc:<record_id>]. If there are no matching records, say that this agent did
not find relevant records in its scoped data and suggest which document type to upload.
""".strip()

    from google.genai import types

    from app.core.config import client

    response = client.models.generate_content(
        model=model_name,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=system_instruction,
            temperature=0.2,
        ),
    )
    return getattr(response, "text", None) or str(response)


def format_simple_record_rag_result(result: SimpleRecordRagResult) -> str:
    lines: list[str] = []

    lines.append(f"=== {result.filter_name.title()} Retrieval ===")
    if result.contexts:
        for context in result.contexts:
            lines.append(
                f"- [doc:{context.record_id}] {context.file_name} "
                f"({context.file_type}, distance={context.distance:.4f})"
            )
    else:
        lines.append("No matching records found for this scoped agent.")

    lines.append("")
    lines.append("=== Final Answer ===")
    lines.append(result.final_answer)

    lines.append("")
    lines.append("=== Pipeline Logs ===")
    for log_line in result.logs:
        lines.append(log_line)

    return "\n".join(lines)
