LOINC_ENTRIES = {
    "13457-7": {"name": "LDL Cholesterol", "units": "mg/dL", "reference_range": "<100", "description": "Low-density lipoprotein cholesterol"},
    "2093-3": {"name": "Total Cholesterol", "units": "mg/dL", "reference_range": "<200", "description": "Total cholesterol"},
    "1558-6": {"name": "Fasting Glucose", "units": "mg/dL", "reference_range": "70-100", "description": "Fasting blood glucose"},
    "4548-4": {"name": "HbA1c", "units": "%", "reference_range": "<5.7", "description": "Hemoglobin A1c"},
    "8480-6": {"name": "Systolic BP", "units": "mmHg", "reference_range": "<120", "description": "Systolic blood pressure"},
    "8462-4": {"name": "Diastolic BP", "units": "mmHg", "reference_range": "<80", "description": "Diastolic blood pressure"},
    "6298-4": {"name": "Potassium", "units": "mmol/L", "reference_range": "3.5-5.0", "description": "Serum potassium"},
    "2160-0": {"name": "Creatinine", "units": "mg/dL", "reference_range": "0.7-1.3", "description": "Serum creatinine"},
}

RXNORM_ENTRIES = {
    "lisinopril": {"rxcui": "29046", "name": "Lisinopril", "drug_class": "ACE inhibitor", "common_side_effects": "dry cough, dizziness, headache, hyperkalemia"},
    "metformin": {"rxcui": "6809", "name": "Metformin", "drug_class": "Biguanide", "common_side_effects": "nausea, diarrhea, stomach pain, lactic acidosis (rare)"},
    "amlodipine": {"rxcui": "17767", "name": "Amlodipine", "drug_class": "Calcium channel blocker", "common_side_effects": "peripheral edema, dizziness, flushing"},
}


def lookup_loinc(code_or_name: str) -> dict | None:
    # Try exact code match first
    if code_or_name in LOINC_ENTRIES:
        return {"code": code_or_name, **LOINC_ENTRIES[code_or_name]}
    # Try name match (case-insensitive)
    for code, entry in LOINC_ENTRIES.items():
        if code_or_name.lower() in entry["name"].lower():
            return {"code": code, **entry}
    return None


def lookup_rxnorm(medication_name: str) -> dict | None:
    key = medication_name.lower().strip()
    if key in RXNORM_ENTRIES:
        return RXNORM_ENTRIES[key]
    for name, entry in RXNORM_ENTRIES.items():
        if key in name or name in key:
            return entry
    return None
