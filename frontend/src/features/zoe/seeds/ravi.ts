import {
  Activity,
  AlertTriangle,
  Apple,
  ClipboardList,
  Droplets,
  Footprints,
  HeartPulse,
  Moon,
  Pill,
  ScanLine,
  Sparkles,
  Stethoscope,
  TestTube,
  Utensils,
} from "lucide-react";
import type { PersonaTimeline } from "./types";

/**
 * Ravi Kumar — 58yo Indian-American, Type 2 Diabetes (dx Aug 2025) + Stage 1 HTN.
 * Five primary clinical events + dense self / agent sub-events. Real assets in
 * /public/seed/ravi/ (chest X-ray, foot dermoscopy, three lab PDFs, Rx bottle).
 */
export const RAVI: PersonaTimeline = {
  id: "ravi",
  displayName: "Ravi Kumar",
  conditionTag: "Type 2 Diabetes · HTN",
  demographics: {
    ageSex: "58M",
    bmi: "27.2",
    languageTag: "HI",
    specialty: "Endocrinology",
    cardNumber: "01",
    presenting:
      "Newly-diagnosed Type 2 diabetes with persistent fasting hyperglycemia + LDL 160. Returning for endocrinology titration and statin discussion.",
  },
  summary: {
    updated: "Updated today",
    headline: "Glycemic control improving; statin and orthostatics flagged.",
    body:
      "HbA1c trended from 7.8% (Feb 2026) to 7.2% on metformin 1000mg BID + lifestyle — meaningful but still above the ADA <7.0% target. Empagliflozin 10mg added at today's visit; expect the bulk of further A1c benefit over the next 3 months. Urine ACR 22 mg/g and eGFR 82 — no microalbuminuria, no kidney involvement.\n\nLipid panel from April shows LDL 160 and triglycerides 152 despite lifestyle changes. Atorvastatin 20mg started today — long-overdue per ADA Standards (any T2DM age 40–75 gets at least moderate-intensity statin regardless of LDL).\n\nBP on lisinopril 10mg averages 128/82 at home (just shy of the <130/80 ADA target). Self-reported headache and morning giddiness over the past 7 days are concerning for orthostatic hypotension on lisinopril + new SGLT2i; orthostatic BPs captured at today's visit (sit 128/82 → stand 108/70, HR Δ +14 BPM) — Dr. Patel held lisinopril dose at 10mg and reinforced SGLT2i sick-day rules (hold for vomiting / poor PO, euglycemic DKA risk).",
    signals: [
      { label: "HbA1c trend", value: "7.8 → 7.2 %", tone: "mint" },
      { label: "Lipid panel", value: "LDL 160 → statin started", tone: "amber" },
      { label: "Foot exam", value: "Mild neuropathy", tone: "amber" },
      { label: "Blood pressure", value: "128/82 (orthostatic +)", tone: "amber" },
    ],
  },
  entries: [
    /* ─────────────── PRIMARY: Endo follow-up (May 18, 2026) ─────────────── */
    {
      id: "endo-may18",
      tier: "primary",
      date: "MAY 18, 2026",
      title: "Endocrinology Follow-up — Dr. Anjali Patel",
      description:
        "Quarterly diabetes review. HbA1c down from 7.8% to 7.2% on metformin + lifestyle. Empagliflozin 10mg and atorvastatin 20mg started today. Orthostatic BPs flagged abnormal — lisinopril dose held at 10mg.",
      expandedDescription:
        "Quarterly diabetes review at Bayview Endocrinology. HbA1c 7.2% (down from 7.8% in February) on metformin 1000mg BID + lifestyle alone — a meaningful but incomplete response. Fasting glucose 132 mg/dL today, home readings averaging 128 mg/dL. Urine ACR 22 mg/g and eGFR 82 — no microalbuminuria. Dr. Patel reviewed Ravi's two-week home glucose log: post-prandial spikes after evening meals, mornings stable. Plan: (1) **start empagliflozin 10mg daily** for added glycemic benefit + cardiorenal protection; SGLT2i sick-day rules reviewed (hold for vomiting/poor PO; euglycemic DKA risk). (2) **Start atorvastatin 20mg daily** — overdue per ADA: any T2DM age 40–75 gets at least moderate-intensity statin regardless of baseline LDL. (3) Orthostatic vitals captured given the headache + morning giddiness self-reports: sitting 128/82 → standing 108/70, HR Δ +14 BPM — abnormal drop. Lisinopril held at 10mg (not uptitrated as planned) pending recheck on the new SGLT2i. (4) GLP-1 RA (semaglutide) discussed as future option if A1c stalls or weight loss desired; SGLT2i chosen first given normotensive home BP and cost.",
      icon: HeartPulse,
      tone: "lilac-dark",
      badge: { label: "Specialist Visit", tone: "lilac" },
      aiTakeaway:
        "Two important wins today: statin finally on board (overdue at LDL 160 + DM) and SGLT2i added for combined glycemic + renal protection. Orthostatic hypotension is the new short-term risk — go slow, hydrate well, call if dizzy on standing. Recheck A1c + lipids in 12 weeks; orthostatics + UACR sooner.",
      attachedDocsLabel: "HbA1c_May15.pdf",
      showViewPdf: true,
      hasClinicalNotes: true,
      labResults: [
        { name: "HbA1c", value: "7.2", unit: "%", refRange: "< 5.7", flag: "high" },
        { name: "Fasting Glucose", value: "132", unit: "mg/dL", refRange: "70 – 99", flag: "high" },
        { name: "Est. Avg Glucose", value: "160", unit: "mg/dL", refRange: "< 117", flag: "high" },
        { name: "Urine ACR", value: "22", unit: "mg/g", refRange: "< 30", flag: "normal" },
      ],
      scans: [
        { name: "hba1c_may15.pdf", type: "pdf" },
      ],
    },
    {
      id: "checkin-may17",
      tier: "sub",
      parentId: "endo-may18",
      source: "agent",
      date: "May 17, 2026",
      title: "Zoe pre-visit prep — orthostatic check coached",
      description:
        "Compiled 14-day glucose log + headache pattern + home BP averages. Given the 'giddiness on standing' pattern on a lisinopril patient, coached Ravi through a home orthostatic series the morning before the visit: sit 130/84 → stand 110/70, HR Δ +13. Flagged for Dr. Patel.",
      icon: Sparkles,
      tone: "lilac",
    },
    {
      id: "self-may15-headache",
      tier: "sub",
      parentId: "endo-may18",
      source: "self",
      date: "May 11 – May 17, 2026",
      title: "Headache + giddiness on standing (self-reported)",
      description:
        "Seven days of evening headache (severity climbing 3 → 7/10) and lightheadedness when getting up from the chair or out of bed. Paracetamol partially effective. Sleep averaging 6.5h. Heart 'beating fast' for short periods. Wife Priya noticed he steadies himself on furniture more often.",
      icon: AlertTriangle,
      tone: "coral",
      badge: { label: "Self-Reported · Orthostatic?", tone: "coral" },
    },
    {
      id: "checkin-may14",
      tier: "sub",
      parentId: "endo-may18",
      source: "agent",
      date: "May 14, 2026",
      title: "Zoe medication adherence ping",
      description:
        "Metformin: 13/14 doses confirmed. Empagliflozin: 14/14. Reminded to take evening metformin with the largest meal to reduce GI side effects.",
      icon: Pill,
      tone: "mint",
    },
    {
      id: "self-may12-glucose",
      tier: "sub",
      parentId: "endo-may18",
      source: "self",
      date: "May 12, 2026",
      title: "Morning glucose 152 — above target",
      description:
        "Self-reading 152 mg/dL fasting; ate late dinner of biryani and dal previous night. Logged with photo of meal.",
      icon: Droplets,
      tone: "amber",
      attachments: [{ name: "Glucose_Log_May12.png", type: "img" }],
    },

    /* ─────────────── PRIMARY: Annual labs (Apr 18, 2026) ─────────────── */
    {
      id: "labs-apr18",
      tier: "primary",
      date: "APR 18, 2026",
      title: "Annual Labs — Bayview Family Medicine",
      description:
        "Comprehensive Metabolic Panel + Lipid Panel ordered by Dr. Sarah Jenkins. Glucose 108 (borderline → diabetic on confirmation), LDL 160 high, triglycerides 152 high. Otherwise renal/liver markers normal.",
      expandedDescription:
        "Routine annual draw. CMP shows fasting glucose 108 mg/dL — second consecutive elevated reading, formally confirming continued diabetes. Renal panel clean: creatinine 1.02, eGFR 82. Liver enzymes within range. Lipid panel is the standout concern: LDL 160 mg/dL (high), total cholesterol 228, triglycerides 152, HDL 38 (low for males). Cholesterol/HDL ratio 6.0. Dr. Jenkins forwarded results to endocrinology and flagged for statin discussion.",
      icon: TestTube,
      tone: "lilac",
      badge: { label: "Lipid Panel Off-Target", tone: "coral" },
      aiTakeaway:
        "Glucose pattern confirms diabetes trajectory. LDL 160 + low HDL is the bigger conversation — likely statin at next endo visit. Renal markers reassuring.",
      attachedDocsLabel: "lipid_panel_apr18.pdf",
      showViewPdf: true,
      labResults: [
        { name: "Glucose (fasting)", value: "108", unit: "mg/dL", refRange: "70 – 99", flag: "high" },
        { name: "Total Cholesterol", value: "228", unit: "mg/dL", refRange: "< 200", flag: "high" },
        { name: "LDL Cholesterol", value: "160", unit: "mg/dL", refRange: "< 100", flag: "high" },
        { name: "HDL Cholesterol", value: "38", unit: "mg/dL", refRange: "> 40", flag: "low" },
        { name: "Triglycerides", value: "152", unit: "mg/dL", refRange: "< 150", flag: "high" },
        { name: "Creatinine", value: "1.02", unit: "mg/dL", refRange: "0.74 – 1.35", flag: "normal" },
        { name: "eGFR", value: "82", unit: "mL/min", refRange: "> 60", flag: "normal" },
        { name: "ALT", value: "32", unit: "U/L", refRange: "7 – 56", flag: "normal" },
      ],
      scans: [
        { name: "lipid_panel_apr18.pdf", type: "pdf" },
        { name: "cmp_apr18.pdf", type: "pdf" },
      ],
    },
    {
      id: "self-apr15-foot",
      tier: "sub",
      parentId: "labs-apr18",
      source: "self",
      date: "Apr 15, 2026",
      title: "Foot photo — same callus, no progression",
      description:
        "Re-photographed the same hard patch on the left big toe IP joint that podiatry documented Feb 3. No change in size or color, no bleeding, no pain. Logged for the next podiatry visit; Zoe annotated 'lesion stable since Feb 3 baseline'.",
      icon: Footprints,
      tone: "amber",
      attachments: [{ name: "Foot_Left_Toe.jpg", type: "img" }],
    },
    {
      id: "checkin-apr10",
      tier: "sub",
      parentId: "labs-apr18",
      source: "agent",
      date: "Apr 10, 2026",
      title: "Zoe nutrition check-in",
      description:
        "Reviewed 7-day diet log. Carb load skewing toward evening (avg 95g dinner vs 45g lunch). Suggested rebalancing to flatten post-prandial spikes.",
      icon: Utensils,
      tone: "mint",
    },

    /* ─────────────── PRIMARY: Podiatry / foot screen (Feb 3, 2026) ─────────────── */
    {
      id: "podiatry-feb03",
      tier: "primary",
      date: "FEB 03, 2026",
      title: "Diabetic Foot Screening — Dr. Wei-Lin Chen",
      description:
        "Annual diabetic foot exam. Monofilament testing showed mild reduced sensation on plantar surface of both feet. Pulses intact. Small callus on left big toe; advised daily moisturization and shoe-fit review.",
      expandedDescription:
        "Annual diabetic foot screen at Bayview Podiatry. 10-g Semmes-Weinstein monofilament (10-site protocol): 8 of 10 plantar sites correctly identified on the left foot, 9 of 10 on the right — reduced sensation consistent with mild distal symmetric polyneuropathy. Dorsalis pedis and posterior tibial pulses 2+ bilaterally. Small (8mm) callus on left hallux IP joint; no ulceration. Photographic documentation taken. Dr. Chen counseled on daily foot inspection, moisturizer, and avoiding barefoot walking. Annual follow-up recommended; sooner if new lesion or color change.",
      icon: Stethoscope,
      tone: "amber",
      badge: { label: "Mild Neuropathy", tone: "amber" },
      aiTakeaway:
        "First objective sign of diabetic neuropathy. Not yet clinically actionable beyond foot-care education, but worth tracking with annual screens and watching for ulceration risk.",
      attachedImagesLabel: "Foot_exam_photos.jpg",
      hasClinicalNotes: true,
      scans: [
        { name: "foot_lesion_left_toe.jpg", type: "image", src: "/seed/ravi/foot_lesion_left_toe.jpg" },
      ],
    },
    {
      id: "self-jan28-tingling",
      tier: "sub",
      parentId: "podiatry-feb03",
      source: "self",
      date: "Jan 28 – Feb 02, 2026",
      title: "Tingling in feet (self-reported)",
      description:
        "Intermittent pins-and-needles in both feet, worse in evenings. No pain, no swelling. Flagged for the podiatry visit.",
      icon: Footprints,
      tone: "amber",
    },
    {
      id: "checkin-jan20",
      tier: "sub",
      parentId: "podiatry-feb03",
      source: "agent",
      date: "Jan 20, 2026",
      title: "Zoe glycemic summary — Q4 2025",
      description:
        "90-day glucose average 142 mg/dL (down from 168 at diagnosis). Sleep avg 7.1h. Exercise minutes increased 18% vs prior quarter.",
      icon: Sparkles,
      tone: "mint",
    },

    /* ─────────────── PRIMARY: ER chest X-ray / GI workup (Nov 22, 2025) ─────────────── */
    {
      id: "er-nov22",
      tier: "primary",
      date: "NOV 22, 2025",
      title: "ER Visit — Abdominal Pain & Vomiting",
      description:
        "Presented to SF General ER with 36 hours of vomiting, abdominal cramping, and giddiness. Workup including chest X-ray and BMP unremarkable. Diagnosed as viral gastroenteritis. IV fluids, discharged same evening.",
      expandedDescription:
        "Self-presented to SF General Emergency at 14:20 with 36 hours of nausea, non-bloody vomiting (~6 episodes), diffuse cramping, and giddiness on standing. Triaged as moderate. Workup: BMP normal (K 3.8, BUN 18), CBC unremarkable, lipase normal, urinalysis showed mild ketones consistent with dehydration. Chest X-ray ordered to rule out lower-lobe pneumonia given epigastric tenderness — read normal, no acute cardiopulmonary process. Received 2L NS, ondansetron 4mg IV, and observed for 4 hours. Tolerated PO trial. Discharged home with diagnosis of viral gastroenteritis; instructed to follow up with PCP if symptoms recur or fever > 101.",
      icon: ScanLine,
      tone: "coral",
      badge: { label: "ER Visit · Resolved", tone: "coral" },
      aiTakeaway:
        "Likely viral, but reminder that vomiting + dehydration in a diabetic warrants closer monitoring of glucose and metformin dosing during illness. Hold metformin during acute dehydration is the standard rule.",
      attachedImagesLabel: "chest_xray_normal.png",
      hasClinicalNotes: true,
      scans: [
        { name: "chest_xray_normal.png", type: "image", src: "/seed/ravi/chest_xray_normal.png" },
      ],
    },
    {
      id: "self-nov21-loose",
      tier: "sub",
      parentId: "er-nov22",
      source: "self",
      date: "Nov 20 – Nov 21, 2025",
      title: "Vomiting + loose motions onset (self-reported)",
      description:
        "Started feeling unwell after takeout dinner. Vomited 6 times overnight. Also loose motions. No fever. Skipped metformin morning dose because not eating.",
      icon: AlertTriangle,
      tone: "coral",
    },
    {
      id: "checkin-nov23-tcm",
      tier: "sub",
      parentId: "er-nov22",
      source: "agent",
      date: "Nov 23, 2025",
      title: "Zoe 48-hour transitional-care call",
      description:
        "Day-1-post-discharge TCM call: tolerating sips + crackers, vomiting stopped overnight, no fever. Reviewed sick-day rules: hold metformin until eating normally 24h, push fluids, log temperature every 6h. Glucometer reading 142 (no insulin needed). Wife Priya on speakerphone — confirmed plan.",
      icon: Sparkles,
      tone: "mint",
    },
    {
      id: "checkin-nov25",
      tier: "sub",
      parentId: "er-nov22",
      source: "agent",
      date: "Nov 25, 2025",
      title: "Zoe post-ER follow-up",
      description:
        "Symptoms resolved by day 3. Resumed metformin once eating normally. Reminded about sick-day rules: hold metformin if vomiting, check ketones, hydrate aggressively.",
      icon: Sparkles,
      tone: "mint",
    },

    /* ─────────────── PRIMARY: Initial T2DM diagnosis (Aug 15, 2025) ─────────────── */
    {
      id: "diagnosis-aug15",
      tier: "primary",
      date: "AUG 15, 2025",
      title: "Type 2 Diabetes Diagnosis — Dr. Sarah Jenkins",
      description:
        "Confirmed Type 2 Diabetes Mellitus on second elevated A1c (7.6%). Stage 1 hypertension also noted (148/92). Started metformin 500mg BID titrating to 1000mg BID; lisinopril 10mg daily. Lifestyle counseling and follow-up in 3 months.",
      expandedDescription:
        "Patient presented for evaluation of three months of polyuria, polydipsia, and 6-lb unintentional weight loss. Random glucose 232 mg/dL in clinic. Confirmatory HbA1c 7.6%, fasting glucose 162 — meets criteria for Type 2 DM. Blood pressure 148/92 on two repeat readings — Stage 1 hypertension. No family history of T1DM; mother had T2DM dx in her 60s. Plan: metformin 500mg BID for 1 week then 1000mg BID, lisinopril 10mg daily, comprehensive lifestyle counseling (carb portions, daily walking, weight goal -10 lb), home BP cuff, glucometer, and referral to endocrinology. Follow-up labs and visit in 3 months.",
      icon: AlertTriangle,
      tone: "lilac-dark",
      badge: { label: "Diagnosis", tone: "coral" },
      aiTakeaway:
        "Origin point of the diabetes timeline. Initial A1c 7.6% is moderate-range — early intervention with metformin + lifestyle is the right wedge. Goal: A1c < 7.0% by month 12.",
      attachedImagesLabel: "rx_metformin.jpg",
      hasClinicalNotes: true,
      scans: [
        { name: "rx_metformin.jpg", type: "image", src: "/seed/ravi/rx_metformin.jpg" },
      ],
    },
    {
      id: "self-aug12-symptoms",
      tier: "sub",
      parentId: "diagnosis-aug15",
      source: "self",
      date: "May – Aug 2025",
      title: "Polyuria + thirst (self-reported, pre-diagnosis)",
      description:
        "Three months of waking 3× nightly to urinate, constant thirst, ~6 lb weight loss without trying. Initially attributed to summer heat.",
      icon: Droplets,
      tone: "amber",
    },
    {
      id: "checkin-aug18",
      tier: "sub",
      parentId: "diagnosis-aug15",
      source: "agent",
      date: "Aug 18, 2025",
      title: "Zoe onboarding — diabetes education (wife joined)",
      description:
        "Walked through how metformin works, expected GI side effects, sick-day rules, and what to do for hypoglycemia. Wife Priya joined the call; will manage evening-meal carb portions and refill reminders. Sent simplified handout in Hindi-English.",
      icon: Apple,
      tone: "lilac",
    },
    {
      id: "baseline-aug20",
      tier: "sub",
      parentId: "diagnosis-aug15",
      source: "clinical",
      date: "Aug 20, 2025",
      title: "Baseline diabetes screens ordered",
      description:
        "Per ADA Standards at diagnosis: baseline fasting lipid panel, urine albumin/creatinine ratio, and referral to Bayview Optometry for dilated retinal exam. Pneumococcal (PPSV23) added — diabetic indication. Annual flu vaccine scheduled for October.",
      icon: ClipboardList,
      tone: "lilac",
    },
    {
      id: "retinal-oct08",
      tier: "sub",
      parentId: "diagnosis-aug15",
      source: "clinical",
      date: "Oct 08, 2025",
      title: "Dilated retinal exam — no retinopathy",
      description:
        "Annual diabetic eye exam at Bayview Optometry, Dr. R. Kapoor OD. Fundus exam OU: no microaneurysms, no hemorrhages, no exudates. Optic disc + macula normal. Repeat in 12 months.",
      icon: Stethoscope,
      tone: "mint",
    },
    {
      id: "self-sep05-gi",
      tier: "sub",
      parentId: "diagnosis-aug15",
      source: "self",
      date: "Sep 05, 2025",
      title: "Metformin GI side effects (self-reported)",
      description:
        "Loose motions and bloating after morning dose for first week of titration. Tolerated better when taken with food. Resolved by day 10.",
      icon: ClipboardList,
      tone: "amber",
    },
    {
      id: "checkin-aug25",
      tier: "sub",
      source: "agent",
      date: "Aug 25, 2025",
      title: "Zoe weekly sleep + activity baseline",
      description:
        "Baseline week post-diagnosis: sleep 7.4h avg, steps 6,800/day, resting HR 68 BPM, HRV 52ms. Targets set for incremental improvement.",
      icon: Moon,
      tone: "mint",
    },
    {
      id: "checkin-aug12-blood",
      tier: "sub",
      source: "agent",
      date: "Aug 12, 2025",
      title: "Zoe activity nudge",
      description:
        "Apple Watch detected 2 days of < 4,000 steps. Suggested a 20-minute evening walk to help glucose control. Confirmed walked Aug 13 + 14.",
      icon: Activity,
      tone: "mint",
    },
  ],
};
