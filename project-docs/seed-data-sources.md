# Seed Data Source Catalog — Zoie

**Purpose:** Free, immediately-downloadable medical data sources for enriching demo personas (Ravi, Wei, Maria) and the RAG corpus. All sources verified open-access; no DUA / no credentialing wait.

**Triage legend:**
- 🟢 = grab first (high signal, low effort, perfectly fits a persona)
- 🟡 = grab if time
- 🔵 = corpus tier (bulk volume for RAG depth, not for UI display)

---

## 1. Chest X-rays — paired image + radiology report

The single highest-value source for Ravi's `scan_report` + image slot. Reports are real radiologist text; images are PNGs.

### 🟢 Indiana University Chest X-rays (IU-XRay / Open-i)
- **Why:** 7,470 frontal/lateral chest X-rays paired with 3,955 radiology reports. Each report has Comparison / Indication / Findings / Impression sections. Many reports labeled "normal" — perfect for Ravi's "shortness of breath workup → normal CXR" arc.
- **Direct download:**
  - Images PNG: `https://openi.nlm.nih.gov/imgs/collections/NLMCXR_png.tgz`
  - XML reports: `https://openi.nlm.nih.gov/imgs/collections/NLMCXR_reports.tgz`
  - Mirror (Kaggle): https://www.kaggle.com/datasets/raddar/chest-xrays-indiana-university
- **License:** Public domain (NLM)
- **Size:** ~7GB images + ~25MB reports
- **Slot:** Ravi `scan_report` (text) + image attachment

### 🟡 NIH ChestX-ray14
- **Why:** 112,120 frontal X-rays from 30,805 patients with 14 disease labels. Way more than we need but useful for corpus volume. No paired reports.
- **Download:** https://www.kaggle.com/datasets/nih-chest-xrays/data or HuggingFace `alkzar90/NIH-Chest-X-ray-dataset`
- **Resized 224×224 variant:** https://www.kaggle.com/datasets/khanfashee/nih-chest-x-ray-14-224x224-resized (much smaller, fine for thumbnails)
- **License:** No restrictions (NIH Clinical Center)

### 🔵 RSNA Pneumonia Detection Challenge
- **Why:** 26,684 chest radiographs in DICOM, labeled Normal / Lung Opacity / Not Normal. Kaggle account required.
- **Download:** https://www.kaggle.com/competitions/rsna-pneumonia-detection-challenge
- **License:** Kaggle competition terms

---

## 2. Cancer imaging (Maria persona — breast cancer follow-up)

### 🟢 CBIS-DDSM (Curated Breast Imaging Subset)
- **Why:** 3,100+ mammographic studies from 1,566 patients, with pixel-level lesion annotations, ROI masks, **pathology-verified** benign/malignant labels. DICOM format. Perfect for Maria's mammogram + path correlation.
- **Download:** https://www.cancerimagingarchive.net/collection/cbis-ddsm/ (needs NBIA Data Retriever)
- **License:** TCIA terms (free, no DUA for this collection)
- **Size:** ~163GB full; can download a single subject (~50MB) for hero

### 🟡 TCIA Browse Collections (full catalog)
- **Why:** Open-access lung, brain, prostate, head/neck CT and MRI collections — any of these can fit a richer persona narrative later.
- **Browse:** https://www.cancerimagingarchive.net/browse-collections/
- **Download:** Same NBIA flow
- **License:** Most are Creative Commons / public domain

---

## 3. Pathology (Maria — biopsy slide)

### 🟢 PatchCamelyon (PCam)
- **Why:** 327,680 H&E lymph node patches (96×96 RGB), binary benign/metastatic labels, **CC0 license**. Lightweight, downloads in minutes.
- **Download:** https://github.com/basveeling/pcam (Google Drive links in README)
- **License:** CC0
- **Slot:** Maria's biopsy thumbnail in the timeline

### 🔵 TCGA Pathology Slides (bulk)
- **Why:** 30,000+ whole-slide images (SVS) across 33 cancer types. Multi-GB per slide; only grab if you need actual hi-res WSI for a wow moment.
- **Download:** `gs://gdc-tcga-phs000178-open/` (GCS public bucket, no auth)
- **License:** TCGA open-access

---

## 4. Dermatology (optional `derm_photo` file type, or Ravi's mole check)

### 🟢 ISIC Archive / HAM10000
- **Why:** 10,015+ dermoscopic images of pigmented skin lesions with diagnoses. CC-0 licensed. Easy bulk download.
- **Download:** https://challenge.isic-archive.com/data/ or https://isic-archive.com/
- **HAM10000 dedicated:** https://challenge.isic-archive.com/landing/2018/ (~3GB)
- **License:** CC-0

---

## 5. EKG / ECG (Ravi's cardiology baseline)

### 🟢 PhysioNet PTB-XL
- **Why:** 21,801 clinical 12-lead ECGs from 18,869 patients (10 seconds each), annotated by cardiologists with 71 diagnostic statements. Includes plenty of healthy + AFib examples — directly relevant to Ravi's Act 1 AFib alert.
- **Download:** https://physionet.org/content/ptb-xl/ (~1.7GB)
- **Companion features:** https://physionet.org/content/ptb-xl-plus/1.0.1/
- **License:** Open (Creative Commons)
- **Format:** WFDB; render to image with `wfdb-python` or matplotlib

---

## 6. Clinical text — SOAP notes, H&P, visit notes

### 🟢 MTSamples
- **Why:** Free public sample SOAP / chart / progress notes spanning all specialties (cardiology, endo, GI, derm — easy to match Ravi's hypertension+GI arc). Real transcriptionist work, well-formatted.
- **Browse:** https://www.mtsamples.com/site/pages/sample.asp?Type=91-SOAP+%2F+Chart+%2F+Progress+Notes
- **Example fits Ravi:** "Gen Med Progress Note" — https://www.mtsamples.com/site/pages/sample.asp?Type=91-SOAP+%2F+Chart+%2F+Progress+Notes&Sample=1512-Gen+Med+Progress+Note
- **License:** Free for educational use; we're not redistributing, just ingesting → fine
- **Slot:** Ravi + Maria `md_note`

### 🟡 HuggingFace `dischargesum/radiology` + `dischargesum/discharge_target`
- **Why:** 378k radiology report→summary pairs + 50k discharge summaries, derived from MIMIC-III.
- **Download:** `https://huggingface.co/datasets/dischargesum/radiology` / `https://huggingface.co/datasets/dischargesum/discharge_target`
- **License:** Verify per dataset; MIMIC-derived may carry residual DUA — check before redistributing. For local ingestion only, low risk.
- **Slot:** Corpus tier

### 🔵 EpistasisLab/ClinicalDataSources
- **Why:** ~1,500 de-identified i2b2 challenge notes available *without* DUA on GitHub (the rare exception).
- **Browse:** https://github.com/EpistasisLab/ClinicalDataSources
- **Slot:** Corpus

---

## 7. Synthetic patient corpus (bulk RAG depth)

### 🟢 Synthea
- **Why:** Generates fully fake but clinically realistic longitudinal patients in FHIR R4 / C-CDA / CSV. 1,000+ sample patients pre-generated and zipped; or run locally for any volume. Best single source for the 50-patient corpus tier.
- **Pre-generated downloads:** https://synthea.mitre.org/downloads
- **Source / regenerate locally:** https://github.com/synthetichealth/synthea
- **License:** Apache 2.0 (data is unrestricted — no privacy concerns)
- **Slot:** Bulk corpus, multi-`file_type` (the generator emits encounters, conditions, meds, labs, observations)

### 🟡 Harvard Dataverse — 10,000 Synthetic Medicare Patients
- **Why:** Synthea-generated, pre-bundled, FHIR R4.
- **Download:** https://dataverse.harvard.edu/dataset.xhtml?persistentId=doi:10.7910/DVN/QDXLWR

---

## 8. Lab reports / PDFs (Act 3 hero)

No good open dataset of *actual* lab-report PDFs exists. Two pragmatic paths:

### 🟢 Path A — Hand-build PDFs matching Ravi/Maria
- Use LibreOffice Writer or HTML→PDF (e.g. WeasyPrint) with a realistic clinic header. Inject the exact LOINC values the seed expects (Ravi LDL=160, fasting glucose=108, total cholesterol=228).
- ~15 minutes per PDF, total visual control.

### 🟡 Path B — Reference PDFs as templates
- UWLAX "Common Laboratory Tests": https://www.uwlax.edu/globalassets/offices-services/student-health-center/common-laboratory-tests-explained-002.pdf
- PRMC "Direct Access Lab Tests": https://prmc.org/wp-content/uploads/2023/09/direct-access-lab-tests.pdf
- Use these to mimic real header/footer/disclaimer formatting in Path A.

### 🔵 Path C — Walk-In Lab / Request A Test sample reports
- Marketing-grade samples linked from product pages on https://www.walkinlab.com and https://requestatest.com. Useful for visual references; redistribution unclear.

---

## 9. Rx bottle photos (Ravi's lisinopril)

Mixed picture. No CC0 dataset of *real-pharmacy-label* photos with patient + drug + Sig data — privacy reasons.

### 🟢 Unsplash / Pexels — generic pharmacy bottles
- **Why:** Free for commercial use, no attribution, hundreds of images of pill bottles with blank/generic labels. We composite Ravi's actual label on top in 5 minutes (Figma / Photoshop) and we're done.
- **Unsplash prescription bottles:** https://unsplash.com/s/photos/prescription-bottle
- **Pexels medicine bottles:** https://www.pexels.com/search/medicine%20bottle/
- **License:** Unsplash License / Pexels License (commercial OK, no attribution required)

### 🟡 NLM RxIMAGE (C3PI)
- **Why:** ~5,000 real prescription-pill macro photographs from NIH. Pills only (not bottles with labels), but real and free. Discontinued 2018, frozen but downloadable.
- **API:** https://rximage.nlm.nih.gov/api/rximage/1/rxnav (JSON/XML)
- **Bulk:** NLM Data Distribution page (linked from C3PI catalog)
- **License:** Public domain

### 🔵 Adobe Stock / iStock prescription label
- **Why:** Premium, lots of variety with actual mocked-up labels. Costs money; skip for v1.

---

## 10. Hero medical photography (CC0 from Wikimedia)

### 🟡 Mikael Häggström CC0 medical images
- **Why:** A Swedish American pathologist who CC0-licenses all his radiology + pathology contributions on Wikimedia Commons. Patient-consented for radiology; clean pathology images.
- **Browse:** https://commons.wikimedia.org/wiki/User:Mikael_H%C3%A4ggstr%C3%B6m
- **License:** CC0
- **Slot:** Any hero modality where you want one specific visual

---

## Recommended first download wave (≈45 min)

If you only grab a handful today, in priority order:

1. **IU-XRay PNGs + reports** — 2 single tarballs, gives Ravi a real chest X-ray with real radiologist text (~5 min download)
2. **PTB-XL ECG sample** — grab 5–10 records (~10MB), render to PNG with matplotlib (~10 min)
3. **CBIS-DDSM single subject** — one Maria mammogram + path (~10 min once NBIA Data Retriever is installed)
4. **PatchCamelyon train.h5** — pathology thumbnail for Maria's biopsy (~5 min)
5. **HAM10000 sample** — 10 derm photos (~3 min)
6. **MTSamples — manually copy 3 SOAP notes** matching Ravi/Maria (~10 min)
7. **Synthea pre-generated 1k patients** — single zip, becomes the bulk corpus (~5 min)
8. **Unsplash Rx bottle photo** — pick 2, composite Ravi's lisinopril label on top later (~2 min)

Skip until needed: NIH ChestX-ray14 full set, TCGA pathology, RSNA pneumonia, HuggingFace MIMIC-derived dumps.

---

## Open question

Where do these files land on disk? Two options:

- `backend/data/seed/` (committed to repo if small) — for hero files <50MB total
- GCS bucket (`gs://zoie-seed/`) — for anything larger, pulled by `seed_demo.py` at run time

Recommend: hero files into `backend/data/seed/` (gitignored except a manifest), Synthea corpus into GCS.
