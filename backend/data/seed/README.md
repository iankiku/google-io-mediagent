# Seed data inventory

Downloaded 2026-05-23. Total ~212MB. All sources verified open-access; licenses noted per file.

## chest_xray/ (37MB)

- `ecgen-radiology/*.xml` — **3,956 IU-XRay radiology reports** from the Indiana University Chest X-ray Collection (Open-i / NLM). Each XML has COMPARISON / INDICATION / FINDINGS / IMPRESSION sections plus parentImage references. License: CC-BY-NC-ND.
- `ravi_chest_xray_report.xml` — Report #1008, hand-picked: "Indication: abdominal pain and vomiting / Impression: No acute cardiopulmonary abnormality." Perfect fit for Ravi's GI workup.
- `ravi_alt_cxr_normal_tb_workup.xml` — Report #1, alt option: TB workup, normal impression.
- `maria_breast_post_mastectomy.xml` — Report #1002: "Status post left mastectomy. Heart size normal." Fits Maria.
- `ravi_chest_xray_normal.png` (4MB) — Wikimedia normal adult chest radiograph (CC license). The image companion since IU-XRay PNG URLs require a 7GB bulk tarball.
- `chest_xray_alt.jpg` — Wikimedia alt chest X-ray.
- `iu_xray_reports.tgz` — original archive (kept for reproducibility).

## synthea/ (162MB) — RAG corpus tier

Pulled from the **Synthea Coherent Data Set** on AWS Open Data (`s3://synthea-open-data/coherent/unzipped/csv/`). License: open / unrestricted (synthetic data).

- `patients.csv` (1MB) — **3,540 synthetic patients** with demographics, addresses, race/ethnicity. Far more than the 50-patient corpus tier needs; subset in `seed_demo.py`.
- `conditions.csv` (4.3MB), `medications.csv` (20MB+), `encounters.csv` (84MB), `procedures.csv`, `imaging_studies.csv`, `immunizations.csv`, `allergies.csv`, `careplans.csv`, `organizations.csv` — longitudinal records joined by patient ID.
- **Skipped:** the 233MB `observations.csv` (lab values + vital signs) and the 8.8GB full zip. Add either if you need more depth.

## ecg/ (7.1MB)

PhysioNet **PTB-XL** ECG dataset, CC-BY 4.0.

- `ptbxl_database.csv` (1.9MB) — metadata for all 21,799 records (demographics, SCP-ECG diagnostic codes, signal quality).
- `scp_statements.csv` — diagnostic-code lookup.
- `records/00017_lr.{dat,hea}`, `00152_lr.{dat,hea}`, `00282_lr.{dat,hea}` — **3 AFib 12-lead ECGs** (WFDB format, 100 Hz, 10 sec). Directly relevant to Ravi's Act 1 AFib alert.
- Full 1.7GB dataset available at https://physionet.org/content/ptb-xl/1.0.3/ if needed.

## pathology/ (4MB) — Maria's biopsy

CC0/CC-licensed Wikimedia Commons histopathology slides.

- `Histopathology_of_basal-like_breast_cancer.jpg` (2.4MB)
- `Lobular_carcinoma_in_situ.jpg` (735KB)
- `Micrograph_of_ductal_carcinoma_with_marked_nuclear_pleomorphism_and_increased_mitotic_rate.jpg` (226KB)

PatchCamelyon was the original plan, but its 800MB Google Drive download requires interactive confirmation; Wikimedia is lighter and persona-fits Maria directly.

## mammogram/ (2.1MB) — Maria's mammogram

Wikimedia Commons.

- `maria_mammogram_normal.jpg` (74KB) — standard screening mammogram.
- `maria_mammogram_abnormal.jpg` (1.3MB) — mammogram showing abnormal findings.

CBIS-DDSM (real DICOM, 3,100 studies with pathology-verified labels) was the original target but requires installing the NBIA Java Data Retriever. **Ping if you want this** — I can guide the install.

## derm/ (272KB)

ISIC Archive dermoscopic images, CC-0 license.

- `ISIC_0000000.jpg` through `ISIC_0000004.jpg` — 5 individual lesion photos pulled via direct S3 URLs (no auth required).
- Full HAM10000 (2.6GB) available at https://isic-archive.s3.amazonaws.com/challenges/2018/ISIC2018_Task3_Training_Input.zip if needed.

## rx_bottle/ (524KB)

- `unsplash_prescription_bottle.jpg` — Unsplash License (free commercial use, no attribution). Generic blank-label bottle to composite Ravi's lisinopril label on top.

## soap_notes/ (12KB)

MTSamples (free-for-educational-use medical transcription samples).

- `htn_progress_note.txt` — Hypertension Progress Note. Fits Ravi.
- `refractory_htn_followup.txt` — Refractory Hypertension Followup. Also fits Ravi.
- `gen_med_progress_note.txt` — General medicine note (fever, dehydration). Fits the GI part of Ravi's arc.

## lab_pdf/ (~10KB)

Hand-built via `generate_lab_pdfs.py` (ReportLab). Three persona-matched reports with clinic letterhead, demographics block, results table with H/L flags, and electronically-signed footer.

- `ravi_lipid_panel_2026-04-18.pdf` — Bayview Family Medicine, Dr. Sarah Jenkins, **LDL=160 (H), Total Chol=228 (H), HDL=38 (L), Triglycerides=152 (H)**. Act 3 hero.
- `ravi_cmp_2026-04-18.pdf` — same draw, **fasting glucose=108 (H)**, 14 other normal panels.
- `maria_cbc_2026-05-10.pdf` — Sutter Oncology, Dr. David Ramirez (hematopath), shows post-chemo pattern: **WBC=3.1 (L), Hgb=11.2 (L), ANC=1.4 (L)**.

To regenerate or add a new lab:

```bash
backend/venv/bin/python backend/data/seed/lab_pdf/generate_lab_pdfs.py
```

---

## What needed user help (none did — all open-access)

Originally flagged as potentially needing manual auth/install:
- ~~CBIS-DDSM (NBIA Java tool)~~ — substituted Wikimedia mammograms.
- ~~PatchCamelyon (Google Drive confirm)~~ — substituted Wikimedia pathology.
- ~~NIH ChestX-ray14 (Kaggle account)~~ — skipped; IU-XRay reports + Wikimedia images cover the slot.

If you want any of these in their original form, ping and I'll walk through the install.
