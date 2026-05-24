import {
  Activity,
  AlertTriangle,
  ClipboardList,
  HeartPulse,
  Moon,
  Pill,
  ScanLine,
  Sparkles,
  Stethoscope,
  TestTube,
  Wind,
  Zap,
} from "lucide-react";
import type { PersonaTimeline } from "./types";

/**
 * Zhang Wei — 64yo Chinese-American, paroxysmal AFib (dx Mar 2026) on metoprolol
 * + apixaban. Background hyperlipidemia + Stage 1 HTN on amlodipine/atorvastatin.
 * Real assets in /public/seed/zhang/ (chest X-ray, three lab PDFs, Rx bottle).
 */
export const ZHANG: PersonaTimeline = {
  id: "zhang",
  displayName: "Zhang Wei",
  conditionTag: "Paroxysmal AFib · Hyperlipidemia",
  demographics: {
    ageSex: "64M",
    bmi: "26.4",
    languageTag: "ZH",
    specialty: "Cardiology",
    cardNumber: "02",
    presenting:
      "Paroxysmal AFib confirmed across ER conversion + 14-day Zio (1.4% burden). Apixaban started May 2026; here for anticoag follow-up.",
  },
  summary: {
    updated: "Updated today",
    headline: "Stroke prevention initiated; rhythm control stable.",
    body:
      "Paroxysmal AFib first confirmed in the March ER episode and again on the 14-day Zio patch in April (3 episodes, longest 18 min, 1.4% burden). Apple Watch flagged a fourth symptomatic run May 18. CHA₂DS₂-VASc is 1 (HTN only — age 64, hyperlipidemia is NOT a scoring component), HAS-BLED 0. Per 2023 ACC/AHA AFib guideline, anticoagulation is appropriate via shared decision-making in symptomatic paroxysmal AFib with documented substrate (moderate LAE) — Dr. Patel started apixaban 5mg BID. Pre-anticoag labs (PT/INR, renal, hepatic) all within range.\n\nMetoprolol succinate 50mg daily continues for rate control; resting HR averaging 64 BPM on home cuff. Echo from April shows preserved LVEF (55%), moderate left atrial enlargement (LA AP 4.5cm — moderate per ASE 2015), and trace-to-mild mitral regurgitation. The LA-driven cardiac silhouette explains the 'borderline cardiomegaly' on the companion chest film and reinforces aggressive BP control to <130/80.\n\nLipid control on atorvastatin 40mg: LDL 178 (Dec '25) → 102 at the Mar 18 recheck — 43% reduction, just shy of the ≥50% high-intensity target. LFTs normal. BP averaging 132/78 on amlodipine 5mg. STOP-BANG screen 4 → home sleep study pending given high OSA prevalence in paroxysmal AFib.",
    signals: [
      { label: "AFib burden", value: "1.4% (Zio)", tone: "amber" },
      { label: "Stroke prophylaxis", value: "Apixaban started", tone: "mint" },
      { label: "LV function", value: "EF 55% (normal)", tone: "mint" },
      { label: "OSA screen", value: "STOP-BANG 4", tone: "amber" },
    ],
  },
  entries: [
    /* ─────────────── PRIMARY: Cardiology follow-up + start apixaban (May 20, 2026) ─────────────── */
    {
      id: "cards-may20",
      tier: "primary",
      date: "MAY 20, 2026",
      title: "Cardiology Follow-up — Start Apixaban",
      description:
        "Dr. Aris Patel reviewed the May 18 Apple Watch AFib run (sustained 113 BPM, ~10 min) and the prior Zio results. Initiated apixaban 5mg BID for stroke prophylaxis. Continued metoprolol succinate 50mg daily. Pre-anticoag labs clean.",
      expandedDescription:
        "Office visit with Dr. Aris Patel (electrophysiology) — urgent add-on slot held given prior AFib history and the May 18 alert. Reviewed the Apple Watch event: sustained 113 BPM × 10 minutes with irregular rhythm. Combined with the April Zio data (3 paroxysmal episodes, longest 18 min, 1.4% burden) and the March ER conversion, this confirms recurrent symptomatic paroxysmal AFib.\n\n**Stroke-risk reassessment.** CHA₂DS₂-VASc = **1** (HTN only) — age 64 does not yet qualify for the 65–74 point; hyperlipidemia is not a CHA₂DS₂-VASc component. HAS-BLED = **0** (treated BP averages 132/78, no other risk factors). Per the 2023 ACC/AHA AFib focused update, rigid CHA₂DS₂-VASc thresholds have been de-emphasized in favor of shared decision-making, with anticoagulation reasonable in symptomatic recurrent paroxysmal AFib when substrate is present. Here that substrate is real: moderate LAE (LA 4.5cm), documented burden, recurrent symptomatic runs. Patient elected to initiate anticoagulation; bleed-risk profile is favorable.\n\n**Apixaban 5mg BID** started — full dose appropriate (no reduction criteria met: age <80, weight >60kg, Cr <1.5). Pre-anticoag labs reviewed: PT 12.6, INR 1.05, platelets 212, Hgb 13.8, Cr 1.08, eGFR 78. Discussed bleeding precautions, missed-dose protocol, and need for renal panel every 6 months. Metoprolol succinate 50mg daily continues for rate control (resting HR 64, at goal). Atorvastatin 40mg and amlodipine 5mg unchanged. Home sleep study still pending from April STOP-BANG screen.",
      icon: Pill,
      tone: "lilac-dark",
      badge: { label: "Anticoagulation Started", tone: "lilac" },
      aiTakeaway:
        "Anticoag started on substrate + symptoms (moderate LAE, recurrent symptomatic paroxysmal AFib), not on a CHA₂DS₂-VASc threshold — consistent with the 2023 ACC/AHA shared-decision framework. Watch closely for bleeding signs (bruising, dark stools, prolonged bleeds). Never skip doses without calling. Recheck renal panel + Hgb in 6 months.",
      attachedDocsLabel: "anticoag_baseline_may18.pdf",
      showViewPdf: true,
      hasClinicalNotes: true,
      labResults: [
        { name: "PT", value: "12.6", unit: "sec", refRange: "11.0 – 13.5", flag: "normal" },
        { name: "INR", value: "1.05", unit: "", refRange: "0.9 – 1.1", flag: "normal" },
        { name: "Platelets", value: "212", unit: "10³/µL", refRange: "150 – 400", flag: "normal" },
        { name: "Hemoglobin", value: "13.8", unit: "g/dL", refRange: "13.5 – 17.5", flag: "normal" },
        { name: "Creatinine", value: "1.08", unit: "mg/dL", refRange: "0.74 – 1.35", flag: "normal" },
        { name: "eGFR", value: "78", unit: "mL/min", refRange: "> 60", flag: "normal" },
      ],
      scans: [
        { name: "rx_apixaban.jpg", type: "image", src: "/seed/zhang/rx_apixaban.jpg" },
        { name: "anticoag_baseline_may18.pdf", type: "pdf" },
      ],
    },
    {
      id: "checkin-may22-bleed",
      tier: "sub",
      parentId: "cards-may20",
      source: "agent",
      date: "May 22, 2026",
      title: "Zoe day-2 apixaban bleed screen",
      description:
        "First post-start safety call: no bruising, no nose/gum bleeding, no dark stools, no headache. Tolerating. First refill reminder set for Jun 15. Reinforced no NSAIDs / aspirin / ginkgo. Daughter Mei (RN, lives in Oakland) on speakerphone.",
      icon: Sparkles,
      tone: "mint",
    },
    {
      id: "checkin-may21-teach",
      tier: "sub",
      parentId: "cards-may20",
      source: "agent",
      date: "May 21, 2026",
      title: "Zoe apixaban teach-back (Mandarin-friendly)",
      description:
        "Walked Zhang and daughter Mei through the daily routine: soft toothbrush, electric razor, no NSAIDs/aspirin/ginkgo/dong quai/ginseng (flagged given home use of traditional teas). Medical-alert card issued. Dental work deferred until coordinated with cardiology. Fall-prevention home walk-through scheduled.",
      icon: Pill,
      tone: "lilac",
    },
    {
      id: "alert-may18-afib",
      tier: "sub",
      parentId: "cards-may20",
      source: "agent",
      date: "May 18, 2026",
      title: "Apple Watch AFib alert — 113 BPM × 10 min",
      description:
        "Sustained irregular rhythm detected while inactive. Zoe triaged as concerning given prior AFib history; auto-paged Dr. Patel and scheduled May 20 appointment.",
      icon: AlertTriangle,
      tone: "coral",
      badge: { label: "Critical Alert", tone: "coral" },
    },
    {
      id: "self-may18-palp",
      tier: "sub",
      parentId: "cards-may20",
      source: "self",
      date: "May 18, 2026",
      title: "Palpitations + lightheaded (self-reported)",
      description:
        "Felt heart racing while watching TV. Sat down, felt fluttering for ~10 minutes then settled. Mild lightheadedness, no chest pain or shortness of breath.",
      icon: HeartPulse,
      tone: "coral",
    },
    {
      id: "checkin-may19",
      tier: "sub",
      parentId: "cards-may20",
      source: "agent",
      date: "May 19, 2026",
      title: "Zoe pre-visit ECG capture",
      description:
        "Coached Zhang through capturing 3 Apple Watch ECG strips for Dr. Patel: all read 'sinus rhythm' the morning after the event, consistent with paroxysmal pattern.",
      icon: Zap,
      tone: "lilac",
    },

    /* ─────────────── PRIMARY: Echo + Zio patch results (Apr 14, 2026) ─────────────── */
    {
      id: "echo-apr14",
      tier: "primary",
      date: "APR 14, 2026",
      title: "Echocardiogram + Zio Patch Results",
      description:
        "TTE: LVEF 55% (normal), moderate left atrial enlargement (LA AP 4.5cm), trace-to-mild MR. 14-day Zio: 3 paroxysmal AFib episodes (longest 18 min), total burden 1.4%. Companion chest film showed borderline cardiomegaly — LA-driven silhouette, no acute pulmonary process.",
      expandedDescription:
        "Transthoracic echocardiogram at SF General Cardiology: LVEF 55% (low-normal range 55–70), normal wall motion, mild concentric LV remodeling consistent with longstanding HTN. **Left atrial AP diameter 4.5cm — moderate LAE per ASE 2015 chamber quantification (normal <4.0, mild 4.0–4.4, moderate 4.5–4.9, severe ≥5.0).** This is the structural substrate for the AFib. Trace-to-mild mitral regurgitation, no thrombus in LA appendage. 14-day Zio patch (worn Mar 28 – Apr 11): 3 paroxysmal AFib runs, longest 18 minutes, total burden 1.4%. Symptom diary correlated 2 of 3 runs with palpitation entries. Companion CXR read 'borderline cardiomegaly, no acute pulmonary process' — silhouette enlargement driven by LA, not LV. Anticoagulation discussed and offered today; patient elected to defer pending further data, given asymptomatic interval and absence of stroke-risk factors beyond HTN. Decision documented as shared.",
      icon: ScanLine,
      tone: "lilac",
      badge: { label: "Diagnostic Workup", tone: "lilac" },
      aiTakeaway:
        "Echo confirms the AFib substrate: moderate LAE (4.5cm) + preserved EF. The 'borderline cardiomegaly' on CXR reflects atrial enlargement, not LV — consistent with longstanding HTN. 1.4% burden is low but recurrent and symptomatic — exactly the population where the 2023 ACC/AHA guideline favors shared-decision anticoag. Deferral here was reasonable given low CHA₂DS₂-VASc, but the May Apple Watch event correctly tipped the conversation.",
      attachedDocsLabel: "Echo_report_apr14.pdf",
      hasClinicalNotes: true,
      scans: [
        { name: "chest_xray_borderline_cardiomegaly.jpg", type: "image", src: "/seed/zhang/chest_xray_borderline_cardiomegaly.jpg" },
      ],
    },
    {
      id: "osa-apr16",
      tier: "sub",
      parentId: "echo-apr14",
      source: "agent",
      date: "Apr 16, 2026",
      title: "Zoe STOP-BANG screen + sleep study referral",
      description:
        "OSA prevalence ~50% in paroxysmal AFib; Zoe ran STOP-BANG. Score 4 (snoring per wife, age >50, HTN, male) — high risk. Home sleep apnea test (HSAT) referral placed via Dr. Patel.",
      icon: Moon,
      tone: "amber",
    },
    {
      id: "statin-recheck-mar18",
      tier: "sub",
      parentId: "echo-apr14",
      source: "clinical",
      date: "Mar 18, 2026",
      title: "3-month statin recheck — on-target",
      description:
        "Fasting lipid + LFT recheck (atorvastatin 40mg, started Dec 8). LDL 102 (from 178, 43% reduction — just shy of the ≥50% high-intensity target). ALT 34, AST 26 (normal). Continue current dose; consider ezetimibe add-on if next recheck still off-target.",
      icon: TestTube,
      tone: "mint",
    },
    {
      id: "self-apr07-palp",
      tier: "sub",
      parentId: "echo-apr14",
      source: "self",
      date: "Apr 07, 2026",
      title: "Palpitations during Zio wear (self-reported)",
      description:
        "Two episodes of fluttering, each ~15 min, while gardening. Pressed event button on Zio patch. No chest pain.",
      icon: HeartPulse,
      tone: "amber",
    },
    {
      id: "checkin-apr10",
      tier: "sub",
      parentId: "echo-apr14",
      source: "agent",
      date: "Apr 10, 2026",
      title: "Zoe AFib pattern explainer",
      description:
        "Walked through what paroxysmal AFib means vs. persistent. Explained why CHA₂DS₂-VASc determines anticoagulation. Reduced anxiety about every palpitation requiring ER.",
      icon: Sparkles,
      tone: "mint",
    },
    {
      id: "self-mar30-sleep",
      tier: "sub",
      parentId: "echo-apr14",
      source: "self",
      date: "Mar 30, 2026",
      title: "Poor sleep after starting metoprolol",
      description:
        "First week on metoprolol — felt fatigued in mornings, sleep more interrupted. Settled by week 2.",
      icon: Moon,
      tone: "amber",
    },

    /* ─────────────── PRIMARY: First ER AFib episode (Mar 02, 2026) ─────────────── */
    {
      id: "er-mar02",
      tier: "primary",
      date: "MAR 02, 2026",
      title: "ER Visit — First AFib Episode",
      description:
        "Presented to SF General ER at 21:40 with palpitations and lightheadedness. 12-lead ECG: atrial fibrillation, rate 142. Converted spontaneously to sinus rhythm at 23:15. Cardiac biomarkers negative. Discharged on metoprolol 25mg BID; cardiology referral.",
      expandedDescription:
        "Self-presented to SF General Emergency at 21:40 with 2 hours of sustained palpitations and mild lightheadedness. No chest pain, no syncope, no shortness of breath. Vitals: BP 156/92, HR 142 irregularly irregular, SpO₂ 97%, afebrile. 12-lead ECG: atrial fibrillation with rapid ventricular response, rate 142, no acute ischemia, no preexcitation. Cardiac biomarkers: hs-Troponin I 12 (negative), NT-proBNP 412 (mildly elevated — consistent with atrial stretch from AFib rather than ventricular dysfunction in this clinical context), D-Dimer negative. K 4.0 and Mg 1.9 within range. **Rate slowed with IV diltiazem 10mg; spontaneously converted to NSR at 23:15.** Discharged 02:30 on metoprolol tartrate 25mg BID with outpatient cardiology referral and Holter follow-up. CHA₂DS₂-VASc 1 (HTN only) at the time — anticoagulation deferred pending pattern confirmation, with shared-decision plan to revisit if burden or symptoms recur.",
      icon: AlertTriangle,
      tone: "coral",
      badge: { label: "First AFib Episode", tone: "coral" },
      aiTakeaway:
        "Index AFib event. Spontaneous conversion within 4 hours is typical of paroxysmal AFib. Deferring anticoagulation at first presentation is reasonable given the borderline CHA₂DS₂-VASc; the April Zio + May Apple Watch run together justified the switch.",
      attachedDocsLabel: "bnp_troponin_mar02.pdf",
      showViewPdf: true,
      hasClinicalNotes: true,
      labResults: [
        { name: "Troponin I (hs)", value: "12", unit: "ng/L", refRange: "< 14", flag: "normal" },
        { name: "NT-proBNP", value: "412", unit: "pg/mL", refRange: "< 125", flag: "high" },
        { name: "D-Dimer", value: "240", unit: "ng/mL", refRange: "< 500", flag: "normal" },
        { name: "Potassium", value: "4.0", unit: "mmol/L", refRange: "3.5 – 5.1", flag: "normal" },
        { name: "Magnesium", value: "1.9", unit: "mg/dL", refRange: "1.7 – 2.3", flag: "normal" },
        { name: "TSH", value: "1.8", unit: "uIU/mL", refRange: "0.40 – 4.50", flag: "normal" },
      ],
      scans: [
        { name: "bnp_troponin_mar02.pdf", type: "pdf" },
      ],
    },
    {
      id: "self-feb27-palpitations",
      tier: "sub",
      parentId: "er-mar02",
      source: "self",
      date: "Feb 27 – Mar 01, 2026",
      title: "Intermittent palpitations (self-reported, pre-ER)",
      description:
        "Three short episodes (~2-5 min each) of heart racing across the prior week. Initially attributed to caffeine. Did not seek care until the longer March 2 episode.",
      icon: HeartPulse,
      tone: "amber",
    },
    {
      id: "checkin-mar05",
      tier: "sub",
      parentId: "er-mar02",
      source: "agent",
      date: "Mar 05, 2026",
      title: "Zoe post-discharge education (daughter joined)",
      description:
        "Walked through AFib basics in Mandarin-friendly English with daughter Mei (RN, Oakland) on speakerphone: triggers to avoid (caffeine, alcohol, sleep deprivation), when to call 911 vs. log in app, and metoprolol expectations. Mei will pick up the script from Walgreens and check in nightly through week one.",
      icon: Sparkles,
      tone: "lilac",
    },
    {
      id: "medrec-mar09",
      tier: "sub",
      parentId: "er-mar02",
      source: "clinical",
      date: "Mar 09, 2026",
      title: "PCP med-rec call — metoprolol form switch",
      description:
        "Day-7 post-ER med reconciliation with Dr. Nguyen. Converted metoprolol tartrate 25mg BID → succinate 50mg daily (1:1 total daily dose, once-daily adherence, smoother 24h rate control). No bradycardia, no fatigue at this dose.",
      icon: Pill,
      tone: "mint",
    },

    /* ─────────────── PRIMARY: HTN + hyperlipidemia workup (Dec 08, 2025) ─────────────── */
    {
      id: "pcp-dec08",
      tier: "primary",
      date: "DEC 08, 2025",
      title: "PCP Visit — HTN + Hyperlipidemia Workup",
      description:
        "Dr. Mai Nguyen reviewed elevated BP at last two visits (avg 152/96) and fasting lipid panel: LDL 178, HDL 36, triglycerides 192. Started amlodipine 5mg daily + atorvastatin 40mg daily. ASCVD 10-yr risk 18.4% — clear statin indication.",
      expandedDescription:
        "Visit with Dr. Mai Nguyen at Chinatown Family Health. Three consecutive office BPs above 140/90 (148/94, 152/96, 156/98). Home cuff confirmed average 151/93 over 7 days. Fasting lipid panel: total cholesterol 246, LDL 178, HDL 36 (low for males), triglycerides 192, non-HDL 210, ratio 6.8. ASCVD pooled-cohort 10-year risk calculated at 18.4% — well above the 7.5% statin threshold. Family history: father had MI at 62. Plan: amlodipine 5mg daily (preferred over thiazide given Asian-population responsiveness), atorvastatin 40mg daily (high-intensity per 2018 ACC/AHA), DASH-style diet counseling, target BP < 130/80 and LDL reduction ≥ 50%. Recheck in 3 months.",
      icon: TestTube,
      tone: "amber",
      badge: { label: "Started Statin + CCB", tone: "amber" },
      aiTakeaway:
        "Baseline cardiovascular risk modification. High-intensity statin is correct given ASCVD risk > 7.5%. The HTN + LV remodeling now visible on April echo likely traces back to years of undertreated BP.",
      attachedDocsLabel: "lipid_panel_dec08.pdf",
      showViewPdf: true,
      labResults: [
        { name: "Total Cholesterol", value: "246", unit: "mg/dL", refRange: "< 200", flag: "high" },
        { name: "LDL Cholesterol", value: "178", unit: "mg/dL", refRange: "< 100", flag: "high" },
        { name: "HDL Cholesterol", value: "36", unit: "mg/dL", refRange: "> 40", flag: "low" },
        { name: "Triglycerides", value: "192", unit: "mg/dL", refRange: "< 150", flag: "high" },
        { name: "Non-HDL", value: "210", unit: "mg/dL", refRange: "< 130", flag: "high" },
      ],
      scans: [
        { name: "lipid_panel_dec08.pdf", type: "pdf" },
      ],
    },
    {
      id: "self-nov-bp",
      tier: "sub",
      parentId: "pcp-dec08",
      source: "self",
      date: "Nov 22 – Dec 06, 2025",
      title: "Home BP log (self-reported)",
      description:
        "14 days of home cuff readings, avg 151/93. Slightly higher in the mornings (~158/96). No headaches, no chest pain. Logged in Zoe daily.",
      icon: ClipboardList,
      tone: "amber",
    },
    {
      id: "checkin-dec15",
      tier: "sub",
      parentId: "pcp-dec08",
      source: "agent",
      date: "Dec 15, 2025",
      title: "Zoe statin side-effect screen",
      description:
        "One-week post-statin check: no muscle aches, no GI upset, no fatigue. Reminded about reporting muscle pain immediately and the 6-week LFT recheck.",
      icon: Pill,
      tone: "mint",
    },

    /* ─────────────── PRIMARY: Annual physical / baseline (Jul 11, 2025) ─────────────── */
    {
      id: "annual-jul11",
      tier: "primary",
      date: "JUL 11, 2025",
      title: "Annual Physical — Baseline",
      description:
        "Routine annual exam with Dr. Mai Nguyen. BP 144/90 (first time over threshold). Counseled on DASH diet + 150 min/week aerobic activity. Lipids deferred to fasting recheck. No medications started.",
      expandedDescription:
        "Annual wellness exam. Patient reports good baseline health, walks daily, no chest pain, no palpitations at this visit. Family history significant: father MI age 62, mother HTN. BMI 26.4. BP 144/90 on two repeats — first time at the hypertension threshold; advised lifestyle changes and home cuff purchase before considering medication. Random cholesterol 232 — ordered fasting lipid panel for follow-up. No medications. Counseled on DASH diet (lower sodium, more vegetables), 150 min/week moderate aerobic activity, and alcohol moderation (currently 2-3 drinks/week, advised to keep < 7/week).",
      icon: Stethoscope,
      tone: "mint",
      badge: { label: "Baseline Visit", tone: "lilac" },
      aiTakeaway:
        "First documented elevation of BP — lifestyle-first approach was reasonable, but in retrospect home-cuff monitoring should have been started immediately. By December the BP had drifted further, triggering pharmacotherapy.",
      hasClinicalNotes: true,
    },
    {
      id: "checkin-jul20",
      tier: "sub",
      parentId: "annual-jul11",
      source: "agent",
      date: "Jul 20, 2025",
      title: "Zoe baseline activity capture",
      description:
        "Established 2-week baseline: avg 7,400 steps/day, 3 walking sessions/week, resting HR 62, sleep 6.8h. Targets set: 8,500 steps, 4 walks, sleep 7.2h.",
      icon: Activity,
      tone: "mint",
    },
    {
      id: "self-aug05-family",
      tier: "sub",
      source: "self",
      date: "Aug 05, 2025",
      title: "Family history note added (self-reported)",
      description:
        "Cousin diagnosed with AFib at age 67 — added to family history. Zoe flagged for inclusion in future cardiology context.",
      icon: ClipboardList,
      tone: "lilac",
    },
    {
      id: "checkin-oct12",
      tier: "sub",
      source: "agent",
      date: "Oct 12, 2025",
      title: "Zoe sleep & alcohol nudge",
      description:
        "Sleep averaging 6.4h, weekend alcohol creeping to 4 drinks/night. Sent gentle reminder linking sleep + alcohol + future BP control.",
      icon: Wind,
      tone: "amber",
    },
  ],
};
