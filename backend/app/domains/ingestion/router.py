import os
import uuid
import json
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import List
from datetime import datetime
from app.core.db import get_db_connection
from app.core.storage import upload_file
from app.domains.ingestion.schemas import IngestionUploadResponse, IngestionStatusResponse
from app.domains.ingestion.services import ingest_medical_record

router = APIRouter(prefix="/api/ingest", tags=["Ingestion"])

@router.post("/upload", response_model=IngestionUploadResponse)
async def upload_medical_file(
    user_id: str = Form(...),
    file: UploadFile = File(...)
):
    """
    Uploads a medical file (PDF, text, image) for a user, passes it to the ingestion service,
    and returns the record ID.
    """
    # Check user
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT id FROM users WHERE id = %s;", (user_id,))
        user = cur.fetchone()
        if not user:
            # Register user
            cur.execute("INSERT INTO users (id, phone_number) VALUES (%s, %s);", (user_id, f"+1000000000_{uuid.uuid4().hex[:6]}"))
            conn.commit()
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database user check failed: {str(e)}")
    finally:
        cur.close()
        conn.close()

    file_id = str(uuid.uuid4())
    ext = os.path.splitext(file.filename)[1]
    safe_filename = f"{file_id}{ext}"

    try:
        file_bytes = await file.read()
        file_save_path = upload_file(file_bytes, safe_filename, file.content_type)
        record_id = ingest_medical_record(
            user_id=user_id,
            file_name=file.filename,
            file_bytes=file_bytes,
            file_type=file.content_type,
            file_save_path=file_save_path
        )

        return IngestionUploadResponse(
            success=True,
            message="Medical record uploaded and indexed successfully.",
            record_id=record_id,
            file_name=file.filename
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to ingest medical document: {str(e)}")

@router.get("/records/{user_id}", response_model=List[IngestionStatusResponse])
def get_user_records(user_id: str):
    """
    Retrieves all indexed medical records metadata for a specific user.
    """
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT id as record_id, user_id, file_name, file_type, extracted_summary, created_at 
            FROM user_medical_records 
            WHERE user_id = %s 
            ORDER BY created_at DESC;
            """,
            (user_id,)
        )
        records = cur.fetchall()
        
        results = []
        for r in records:
            summary_str = r.get("extracted_summary")
            summary_content = ""
            if summary_str:
                try:
                    summary_obj = json.loads(summary_str)
                    summary_content = summary_obj.get("summary", "")
                except Exception:
                    summary_content = summary_str
                    
            results.append(IngestionStatusResponse(
                record_id=str(r["record_id"]),
                user_id=str(r["user_id"]),
                file_name=r["file_name"],
                file_type=r["file_type"],
                status="completed",
                extracted_summary=summary_content,
                created_at=r["created_at"]
            ))
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database query failed: {str(e)}")
    finally:
        cur.close()
        conn.close()

@router.get("/users")
def get_all_users():
    """
    Retrieves all registered users from the database.
    """
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT id, phone_number, telegram_id, created_at FROM users ORDER BY created_at DESC;")
        users = cur.fetchall()
        return [{"id": str(u["id"]), "phone_number": u["phone_number"], "telegram_id": u["telegram_id"], "created_at": u["created_at"]} for u in users]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch users: {str(e)}")
    finally:
        cur.close()
        conn.close()
