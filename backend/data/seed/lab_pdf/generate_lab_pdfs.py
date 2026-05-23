"""
Generate realistic lab-report PDFs for Zoie demo personas.

Output files (in the same directory):
  - ravi_lipid_panel_2026-04-18.pdf  — Ravi's lipid panel, LDL=160 (Act 3 hero)
  - ravi_cmp_2026-04-18.pdf           — Comprehensive Metabolic Panel
  - maria_cbc_2026-05-10.pdf         — Maria's post-chemo CBC follow-up

Run with:
  ../../../venv/bin/python generate_lab_pdfs.py
"""

from datetime import date
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable,
)

OUT_DIR = Path(__file__).parent


def build_styles():
    ss = getSampleStyleSheet()
    return {
        "title": ParagraphStyle("title", parent=ss["Title"], fontSize=16,
                                textColor=colors.HexColor("#0b3b66"), alignment=0),
        "clinic": ParagraphStyle("clinic", parent=ss["Normal"], fontSize=9,
                                 textColor=colors.HexColor("#555555")),
        "section": ParagraphStyle("section", parent=ss["Heading3"], fontSize=11,
                                  textColor=colors.HexColor("#0b3b66"),
                                  spaceBefore=10, spaceAfter=4),
        "label": ParagraphStyle("label", parent=ss["Normal"], fontSize=9,
                                textColor=colors.HexColor("#666666")),
        "value": ParagraphStyle("value", parent=ss["Normal"], fontSize=10),
        "footer": ParagraphStyle("footer", parent=ss["Normal"], fontSize=7,
                                 textColor=colors.HexColor("#888888")),
    }


def letterhead(styles, clinic_name, clinic_addr, accession, report_date):
    """Top header — clinic name + accession + dates."""
    left = [
        Paragraph(f"<b>{clinic_name}</b>", styles["title"]),
        Paragraph(clinic_addr, styles["clinic"]),
    ]
    right = [
        Paragraph(f"<b>Accession:</b> {accession}", styles["label"]),
        Paragraph(f"<b>Report Date:</b> {report_date}", styles["label"]),
        Paragraph("<b>Status:</b> Final", styles["label"]),
    ]
    t = Table([[left, right]], colWidths=[4.0 * inch, 2.5 * inch])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("RIGHTPADDING", (1, 0), (1, 0), 0),
    ]))
    return t


def patient_block(styles, patient):
    """Patient demographics."""
    rows = [
        ["Patient:", patient["name"], "DOB:", patient["dob"]],
        ["Patient ID:", patient["mrn"], "Sex:", patient["sex"]],
        ["Ordered by:", patient["ordering_md"], "Collected:", patient["collected"]],
    ]
    t = Table(rows, colWidths=[1.0 * inch, 2.4 * inch, 0.9 * inch, 2.1 * inch])
    t.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#666666")),
        ("TEXTCOLOR", (2, 0), (2, -1), colors.HexColor("#666666")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    return t


def results_table(styles, panel_name, rows):
    """rows = [(test, result, unit, ref_range, flag), ...]   flag in {'', 'H', 'L', 'HH', 'LL'}"""
    header = ["Test", "Result", "Units", "Reference Range", "Flag"]
    data = [header]
    for test, val, unit, ref, flag in rows:
        data.append([test, val, unit, ref, flag])

    t = Table(data, colWidths=[2.3 * inch, 0.9 * inch, 0.8 * inch, 1.6 * inch, 0.5 * inch],
              repeatRows=1)
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0b3b66")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (1, 0), (-1, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f4f7fb")]),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("LINEBELOW", (0, 0), (-1, 0), 0.5, colors.HexColor("#0b3b66")),
    ]
    # Bold + red the flagged rows
    for i, (_, _, _, _, flag) in enumerate(rows, start=1):
        if flag:
            style.append(("TEXTCOLOR", (4, i), (4, i), colors.HexColor("#c0392b")))
            style.append(("FONTNAME", (4, i), (4, i), "Helvetica-Bold"))
            style.append(("FONTNAME", (1, i), (1, i), "Helvetica-Bold"))
    t.setStyle(TableStyle(style))
    return t


def footer_block(styles, signer):
    return [
        Spacer(1, 0.2 * inch),
        HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cccccc")),
        Spacer(1, 0.08 * inch),
        Paragraph(
            f"Electronically signed by {signer}. This report contains protected health "
            "information and is intended solely for the named patient and ordering provider. "
            "Reference ranges shown are for adult patients; clinical correlation is required.",
            styles["footer"],
        ),
    ]


def build_pdf(filename, *, patient, clinic, accession, report_date, panels, signer):
    """Generic builder. panels = list of (panel_name, [(test, val, unit, ref, flag), ...])"""
    doc = SimpleDocTemplate(
        str(OUT_DIR / filename),
        pagesize=LETTER,
        leftMargin=0.6 * inch, rightMargin=0.6 * inch,
        topMargin=0.5 * inch, bottomMargin=0.5 * inch,
        title=f"{panels[0][0]} - {patient['name']}",
    )
    styles = build_styles()
    flow = []

    flow.append(letterhead(styles, clinic["name"], clinic["address"], accession, report_date))
    flow.append(Spacer(1, 0.15 * inch))
    flow.append(HRFlowable(width="100%", thickness=1.0, color=colors.HexColor("#0b3b66")))
    flow.append(Spacer(1, 0.1 * inch))
    flow.append(patient_block(styles, patient))
    flow.append(Spacer(1, 0.15 * inch))

    for panel_name, rows in panels:
        flow.append(Paragraph(panel_name, styles["section"]))
        flow.append(results_table(styles, panel_name, rows))
        flow.append(Spacer(1, 0.12 * inch))

    flow.extend(footer_block(styles, signer))
    doc.build(flow)


def main():
    # ============================================================
    # Ravi Kumar — Lipid Panel (Act 3 hero — LDL=160)
    # ============================================================
    ravi = {
        "name": "Kumar, Ravi",
        "dob": "1970-09-14",
        "mrn": "Z-001-RAV",
        "sex": "Male",
        "ordering_md": "Patel, Anjali MD",
        "collected": "2026-04-18 08:24",
    }
    bayview = {
        "name": "Bayview Family Medicine Lab",
        "address": "2840 Geary Blvd, Suite 401 · San Francisco, CA 94118 · CLIA 05D2169888",
    }

    build_pdf(
        "ravi_lipid_panel_2026-04-18.pdf",
        patient=ravi, clinic=bayview,
        accession="LP-26041801773",
        report_date="2026-04-18",
        panels=[
            ("Lipid Panel", [
                ("Total Cholesterol",       "228",  "mg/dL", "< 200",      "H"),
                ("HDL Cholesterol",         "38",   "mg/dL", "> 40 (male)", "L"),
                ("LDL Cholesterol (calc.)", "160",  "mg/dL", "< 100",      "H"),
                ("Triglycerides",           "152",  "mg/dL", "< 150",      "H"),
                ("Non-HDL Cholesterol",     "190",  "mg/dL", "< 130",      "H"),
                ("Cholesterol/HDL Ratio",   "6.0",  "",      "< 5.0",      "H"),
            ]),
        ],
        signer="Jenkins, Sarah MD · Pathologist, Bayview Lab",
    )

    # ============================================================
    # Ravi Kumar — CMP (same draw)
    # ============================================================
    build_pdf(
        "ravi_cmp_2026-04-18.pdf",
        patient=ravi, clinic=bayview,
        accession="CMP-26041801773",
        report_date="2026-04-18",
        panels=[
            ("Comprehensive Metabolic Panel", [
                ("Glucose (fasting)",       "108", "mg/dL",  "70 - 99",     "H"),
                ("BUN",                     "16",  "mg/dL",  "7 - 20",      ""),
                ("Creatinine",              "1.02","mg/dL",  "0.74 - 1.35", ""),
                ("eGFR",                    "82",  "mL/min", "> 60",        ""),
                ("Sodium",                  "139", "mmol/L", "136 - 145",   ""),
                ("Potassium",               "4.3", "mmol/L", "3.5 - 5.1",   ""),
                ("Chloride",                "102", "mmol/L", "98 - 107",    ""),
                ("Bicarbonate (CO2)",       "25",  "mmol/L", "22 - 29",     ""),
                ("Calcium",                 "9.4", "mg/dL",  "8.6 - 10.2",  ""),
                ("Total Protein",           "7.0", "g/dL",   "6.4 - 8.3",   ""),
                ("Albumin",                 "4.2", "g/dL",   "3.5 - 5.0",   ""),
                ("Total Bilirubin",         "0.7", "mg/dL",  "0.2 - 1.2",   ""),
                ("Alkaline Phosphatase",    "78",  "U/L",    "44 - 121",    ""),
                ("AST",                     "26",  "U/L",    "10 - 35",     ""),
                ("ALT",                     "32",  "U/L",    "7 - 56",      ""),
            ]),
        ],
        signer="Jenkins, Sarah MD · Pathologist, Bayview Lab",
    )

    # ============================================================
    # Maria Reyes — CBC follow-up post-chemo (mild neutropenia)
    # ============================================================
    maria = {
        "name": "Reyes, Maria",
        "dob": "1963-11-22",
        "mrn": "Z-002-MAR",
        "sex": "Female",
        "ordering_md": "Chen, Wei-Ling MD (Oncology)",
        "collected": "2026-05-10 09:11",
    }
    sutter_onc = {
        "name": "Sutter Oncology Associates — Lab Services",
        "address": "1100 Van Ness Ave · San Francisco, CA 94109 · CLIA 05D2034122",
    }

    build_pdf(
        "maria_cbc_2026-05-10.pdf",
        patient=maria, clinic=sutter_onc,
        accession="CBC-26051000412",
        report_date="2026-05-10",
        panels=[
            ("Complete Blood Count with Differential", [
                ("WBC",                  "3.1",  "10^3/uL", "4.0 - 11.0",  "L"),
                ("RBC",                  "3.8",  "10^6/uL", "4.0 - 5.4",   "L"),
                ("Hemoglobin",           "11.2", "g/dL",    "12.0 - 16.0", "L"),
                ("Hematocrit",           "33.4", "%",       "36 - 46",     "L"),
                ("MCV",                  "88",   "fL",      "80 - 100",    ""),
                ("MCH",                  "29.5", "pg",      "27 - 33",     ""),
                ("MCHC",                 "33.5", "g/dL",    "32 - 36",     ""),
                ("RDW",                  "13.8", "%",       "11.5 - 14.5", ""),
                ("Platelets",            "168",  "10^3/uL", "150 - 400",   ""),
                ("Neutrophils (abs.)",   "1.4",  "10^3/uL", "1.8 - 7.7",   "L"),
                ("Lymphocytes (abs.)",   "1.2",  "10^3/uL", "1.0 - 4.8",   ""),
                ("Monocytes (abs.)",     "0.4",  "10^3/uL", "0.2 - 1.0",   ""),
                ("Eosinophils (abs.)",   "0.1",  "10^3/uL", "0.0 - 0.5",   ""),
                ("Basophils (abs.)",     "0.0",  "10^3/uL", "0.0 - 0.2",   ""),
            ]),
        ],
        signer="Ramirez, David MD · Hematopathologist, Sutter Oncology",
    )

    print("Generated:")
    for p in sorted(OUT_DIR.glob("*.pdf")):
        print(f"  {p.name}  ({p.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
