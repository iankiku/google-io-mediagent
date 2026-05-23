from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class IngestionStatusResponse(BaseModel):
    record_id: str
    user_id: str
    file_name: str
    file_type: str
    status: str  # 'processing', 'completed', 'failed'
    extracted_summary: Optional[str] = None
    created_at: datetime

class IngestionUploadResponse(BaseModel):
    success: bool
    message: str
    record_id: str
    file_name: str

class ClinicalEntity(BaseModel):
    name: str
    category: str  # e.g., 'Medication', 'Diagnosis', 'Allergy', 'Lab Value'
    details: Optional[str] = None

class ClinicalSummary(BaseModel):
    summary: str
    key_findings: List[str]
    medications: List[str]
    diagnoses: List[str]
    allergies: List[str]
    lab_metrics: Optional[List[dict]] = None  # List of parsed metric-value pairs
