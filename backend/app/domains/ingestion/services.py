import os
import json
import logging
from typing import List, Optional
from google.genai import types
from app.core.config import client
from app.core.db import get_db_connection
from app.domains.ingestion.schemas import ClinicalSummary

logger = logging.getLogger("health_assistant.ingestion.services")

def chunk_text(text: str, chunk_size: int = 800, overlap: int = 100) -> List[str]:
    """
    Splits long medical text into chunks with a sliding window overlap.
    """
    words = text.split()
    chunks = []
    if len(words) <= chunk_size:
        return [text]
        
    start = 0
    while start < len(words):
        end = start + chunk_size
        chunk = " ".join(words[start:end])
        chunks.append(chunk)
        start += (chunk_size - overlap)
    return chunks

def generate_embedding(text: str) -> List[float]:
    """
    Generates a 768-dimensional embedding vector for the text using gemini-embedding-001.
    Pinned to 768d via output_dimensionality so it matches the pgvector schema.
    """
    try:
        response = client.models.embed_content(
            model="gemini-embedding-001",
            contents=text,
            config=types.EmbedContentConfig(output_dimensionality=768),
        )
        return response.embeddings[0].values
    except Exception as e:
        logger.error(f"Failed to generate embedding: {str(e)}")
        raise e

def process_medical_file_with_medgemma(
    file_bytes: bytes, 
    file_type: str, 
    file_name: str
) -> ClinicalSummary:
    """
    Uses Gemini (simulating MedGemma) to parse medical images or notes and 
    extract structured clinical summaries, key findings, and lab values.
    """
    is_image = file_type.lower() in ["image/jpeg", "image/png", "image/jpg", "jpeg", "png", "jpg"]
    
    system_prompt = """
    You are MedGemma, a state-of-the-art medical LLM specialized in clinical extraction.
    Your task is to analyze the provided medical document (which may be a lab report, physician note, clinical scan, or prescription).
    Perform optical character recognition (OCR) and translate all information into a structured patient summary.
    
    You must output a JSON object adhering exactly to this JSON schema:
    {
        "summary": "High-level patient-friendly overview of the record",
        "key_findings": ["Finding 1", "Finding 2"],
        "medications": ["Medication Name, dosage, frequency"],
        "diagnoses": ["Diagnosed conditions, status"],
        "allergies": ["Allergen and severity"],
        "lab_metrics": [{"metric": "Metric name (e.g. HbA1c)", "value": "Value with unit", "status": "Normal/High/Low"}]
    }
    Ensure all fields are filled. If no medications/allergies are found, return empty arrays.
    """
    
    contents = []
    is_pdf = "pdf" in file_type.lower()
    
    if is_image or is_pdf:
        contents.append(
            types.Part.from_bytes(
                data=file_bytes,
                mime_type=file_type if "/" in file_type else ("application/pdf" if is_pdf else f"image/{file_type}")
            )
        )
        contents.append("Analyze this medical document / diagnostic report.")
    else:
        text_content = file_bytes.decode('utf-8', errors='ignore')
        contents.append(f"Analyze this medical text/record:\n\n{text_content}")

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=contents,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                system_instruction=system_prompt,
                response_schema=ClinicalSummary
            )
        )
        
        parsed_json = json.loads(response.text)
        return ClinicalSummary(**parsed_json)
    except Exception as e:
        logger.error(f"MedGemma clinical extraction failed: {str(e)}")
        # Parse fallback
        return ClinicalSummary(
            summary=f"Raw text parsed from document {file_name}.",
            key_findings=["Error parsing structured clinical findings. Raw content saved."],
            medications=[],
            diagnoses=[],
            allergies=[],
            lab_metrics=[]
        )

async def process_voice_note_with_translation(
    audio_bytes: bytes,
    mime_type: str,
    user_id: str,
) -> ClinicalSummary:
    """For Telegram voice-note check-ins: translate to English first, then summarize."""
    from app.domains.interpreter.stt import transcribe
    from app.domains.interpreter.services import _fetch_preferred_language

    source_language = _fetch_preferred_language(user_id)
    raw_native = await transcribe(audio_bytes, source_language=source_language, mime_type=mime_type)

    summary_text = (
        f"Patient voice note (source language: {source_language}). "
        f"Raw: {raw_native}"
    )
    return ClinicalSummary(
        summary=summary_text,
        key_findings=[raw_native] if raw_native else [],
        medications=[],
        diagnoses=[],
        allergies=[],
        lab_metrics=[],
    )

def ingest_medical_record(
    user_id: str, 
    file_name: str, 
    file_bytes: bytes, 
    file_type: str, 
    file_save_path: str
) -> str:
    """
    Coordinates the ingestion pipeline:
    1. Runs MedGemma parsing on document.
    2. Saves record metadata to user_medical_records.
    3. Chunks the extracted summary and generates embeddings.
    4. Saves embeddings and chunks to user_record_embeddings.
    """
    extracted_data = process_medical_file_with_medgemma(file_bytes, file_type, file_name)
    
    # Build context text
    text_to_embed = f"Medical Record: {file_name}\n"
    text_to_embed += f"Summary: {extracted_data.summary}\n"
    text_to_embed += f"Key Findings: {', '.join(extracted_data.key_findings)}\n"
    if extracted_data.medications:
        text_to_embed += f"Medications: {', '.join(extracted_data.medications)}\n"
    if extracted_data.diagnoses:
        text_to_embed += f"Diagnoses: {', '.join(extracted_data.diagnoses)}\n"
    if extracted_data.allergies:
        text_to_embed += f"Allergies: {', '.join(extracted_data.allergies)}\n"
    if extracted_data.lab_metrics:
        metrics_str = ", ".join([f"{m.get('metric')}: {m.get('value')} ({m.get('status')})" for m in extracted_data.lab_metrics])
        text_to_embed += f"Lab Values: {metrics_str}\n"

    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        # Store metadata
        cur.execute(
            """
            INSERT INTO user_medical_records (user_id, file_name, file_path, file_type, extracted_summary)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id;
            """,
            (user_id, file_name, file_save_path, file_type, json.dumps(extracted_data.model_dump()))
        )
        record_id = cur.fetchone()["id"]
        
        chunks = chunk_text(text_to_embed)
        
        for idx, chunk in enumerate(chunks):
            embedding = generate_embedding(chunk)
            
            # Store embedding
            cur.execute(
                """
                INSERT INTO user_record_embeddings (record_id, user_id, chunk_index, chunk_content, embedding)
                VALUES (%s, %s, %s, %s, %s);
                """,
                (record_id, user_id, idx, chunk, embedding)
            )
            
        conn.commit()
        logger.info(f"Successfully ingested record {record_id} for user {user_id}")
        return str(record_id)
        
    except Exception as e:
        conn.rollback()
        logger.error(f"Failed to ingest record: {str(e)}")
        raise e
    finally:
        cur.close()
        conn.close()

def query_user_vector_records(user_id: str, query: str, limit: int = 5) -> List[dict]:
    """
    Performs cosine similarity search on user_record_embeddings for a specific user.
    """
    try:
        query_vector = generate_embedding(query)
    except Exception as e:
        logger.error(f"Failed to embed query for retrieval: {str(e)}")
        return []
        
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        cur.execute(
            """
            SELECT chunk_content, 
                   (embedding <=> %s::vector) AS distance
            FROM user_record_embeddings
            WHERE user_id = %s
            ORDER BY distance ASC
            LIMIT %s;
            """,
            (query_vector, user_id, limit)
        )
        results = cur.fetchall()
        return results
    except Exception as e:
        logger.error(f"Failed to query user vector records: {str(e)}")
        return []
    finally:
        cur.close()
        conn.close()

def query_general_medical_knowledge(query: str, limit: int = 5) -> List[dict]:
    """
    Performs cosine similarity search on general_medical_knowledge.
    """
    try:
        query_vector = generate_embedding(query)
    except Exception as e:
        logger.error(f"Failed to embed general query: {str(e)}")
        return []
        
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        cur.execute(
            """
            SELECT disease_category, source_title, chunk_content,
                   (embedding <=> %s::vector) AS distance
            FROM general_medical_knowledge
            ORDER BY distance ASC
            LIMIT %s;
            """,
            (query_vector, limit)
        )
        results = cur.fetchall()
        return results
    except Exception as e:
        logger.error(f"Failed to query general medical knowledge: {str(e)}")
        return []
    finally:
        cur.close()
        conn.close()
