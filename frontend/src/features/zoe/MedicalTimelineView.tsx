"use client";

import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  Briefcase,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  FileText,
  Heart,
  History,
  Info,
  ListChecks,
  MessageCircle,
  Moon,
  Paperclip,
  ScrollText,
  Sparkles,
  Stethoscope,
  Target,
  TestTube,
  Thermometer,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AskContext } from "./AskZoePopup";
import {
  TimelineEntryDetail,
  type DetailSection,
  type EntryTone,
  type LabResult,
  type ScanItem,
} from "./TimelineEntryDetail";

interface MedicalTimelineViewProps {
  onImportData: () => void;
  onAskAbout: (ctx: AskContext) => void;
}

type EntryTier = "primary" | "sub";
type EntrySource = "self" | "agent" | "clinical";

interface TimelineEntry {
  id: string;
  tier: EntryTier;
  source?: EntrySource;
  date: string;
  title: string;
  description: string;
  expandedDescription?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: EntryTone;
  badge?: { label: string; tone: EntryTone };
  attachments?: { name: string; type: "pdf" | "img" }[];
  aiTakeaway?: string;
  attachedDocsLabel?: string;
  attachedImagesLabel?: string;
  showViewPdf?: boolean;
  collapsible?: boolean;
  hasClinicalNotes?: boolean;
  /** Sub-tier entries are nested under the closest preceding primary entry. */
  parentId?: string;
  labResults?: LabResult[];
  scans?: ScanItem[];
  sections?: DetailSection[];
}

const HEALTH_SUMMARY = {
  updated: "Updated today",
  headline: "Stable baseline. Eczema follow-up pending.",
  body:
    "Your recent clinical data indicates a stable baseline with consistent metabolic performance. Your latest blood work from October shows all primary markers are within optimal ranges, reflecting good systemic health.\n\nWhile the dermatology consultation was routine, continue to monitor the eczema as prescribed. The self-reported migraine in August appears to be an isolated event linked to lifestyle stressors rather than a chronic pattern. Overall, your health trajectory remains positive and well-managed.",
  signals: [
    { label: "Metabolic panel", value: "Within range", tone: "mint" as EntryTone },
    { label: "Dermatology", value: "Monitor eczema", tone: "amber" as EntryTone },
    { label: "Migraine pattern", value: "Isolated event", tone: "lilac" as EntryTone },
  ],
};

const ENTRIES: TimelineEntry[] = [
  {
    id: "cmp",
    tier: "primary",
    date: "OCT 24, 2023",
    title: "Comprehensive Metabolic Panel",
    description:
      "Annual blood work, ordered by Dr. Sarah Jenkins. 14-panel chemistry profile drawn fasting, 8:42am.",
    icon: TestTube,
    tone: "lilac",
    badge: { label: "Within Normal Thresholds", tone: "mint" },
    aiTakeaway:
      "No markers outside normal range. Glucose levels are stable compared to previous year.",
    attachedDocsLabel: "CMP_Results_Oct23.pdf",
    showViewPdf: true,
    labResults: [
      { name: "Glucose", value: "92", unit: "mg/dL", refRange: "70 – 99", flag: "normal" },
      { name: "Calcium", value: "9.4", unit: "mg/dL", refRange: "8.6 – 10.3", flag: "normal" },
      { name: "Sodium", value: "140", unit: "mmol/L", refRange: "136 – 145", flag: "normal" },
      { name: "Potassium", value: "4.2", unit: "mmol/L", refRange: "3.5 – 5.1", flag: "normal" },
      { name: "Chloride", value: "102", unit: "mmol/L", refRange: "98 – 107", flag: "normal" },
      { name: "CO2 (Bicarbonate)", value: "25", unit: "mmol/L", refRange: "22 – 29", flag: "normal" },
      { name: "BUN", value: "14", unit: "mg/dL", refRange: "7 – 20", flag: "normal" },
      { name: "Creatinine", value: "0.9", unit: "mg/dL", refRange: "0.6 – 1.2", flag: "normal" },
      { name: "eGFR", value: ">90", unit: "mL/min/1.73m²", refRange: "≥ 60", flag: "normal" },
      { name: "Albumin", value: "4.4", unit: "g/dL", refRange: "3.5 – 5.0", flag: "normal" },
      { name: "Total Protein", value: "7.2", unit: "g/dL", refRange: "6.0 – 8.3", flag: "normal" },
      { name: "Total Bilirubin", value: "0.7", unit: "mg/dL", refRange: "0.1 – 1.2", flag: "normal" },
      { name: "Alkaline Phosphatase", value: "78", unit: "U/L", refRange: "44 – 147", flag: "normal" },
      { name: "ALT", value: "22", unit: "U/L", refRange: "7 – 56", flag: "normal" },
      { name: "AST", value: "24", unit: "U/L", refRange: "10 – 40", flag: "normal" },
    ],
    sections: [
      {
        id: "order-context",
        title: "Order Context",
        icon: ScrollText,
        tone: "lilac",
        summary: "Annual screening, ordered by Dr. Jenkins (PCP). Fasting draw.",
        body:
          "Ordered as part of your annual physical on Oct 21. Drawn fasting at 8:42am on Oct 24 at Quest Labs (San Francisco — Sutter St).\n\nLab panel: 14-analyte comprehensive metabolic profile (glucose, electrolytes, kidney + liver markers, with calculated eGFR reported alongside creatinine).",
      },
      {
        id: "overall-impression",
        title: "Overall Impression",
        icon: ClipboardCheck,
        tone: "mint",
        summary: "All 14 analytes within reference range. No flags.",
        body:
          "Dr. Jenkins reviewed the panel on Oct 25 and signed off as normal. No analytes flagged high or low. eGFR >90 confirms preserved renal filtration. The panel reflects stable metabolic, renal, and hepatic function compared to your prior CMP from Oct 2022.",
        defaultOpen: true,
      },
      {
        id: "findings",
        title: "Findings (14 analytes)",
        icon: TestTube,
        tone: "lilac",
        summary:
          "Glucose 92, eGFR >90, Albumin 4.4, ALT 22 — full panel inside.",
        labRows: [
          { name: "Glucose", value: "92", unit: "mg/dL", refRange: "70 – 99", flag: "normal" },
          { name: "Calcium", value: "9.4", unit: "mg/dL", refRange: "8.6 – 10.3", flag: "normal" },
          { name: "Sodium", value: "140", unit: "mmol/L", refRange: "136 – 145", flag: "normal" },
          { name: "Potassium", value: "4.2", unit: "mmol/L", refRange: "3.5 – 5.1", flag: "normal" },
          { name: "Chloride", value: "102", unit: "mmol/L", refRange: "98 – 107", flag: "normal" },
          { name: "CO2 (Bicarbonate)", value: "25", unit: "mmol/L", refRange: "22 – 29", flag: "normal" },
          { name: "BUN", value: "14", unit: "mg/dL", refRange: "7 – 20", flag: "normal" },
          { name: "Creatinine", value: "0.9", unit: "mg/dL", refRange: "0.6 – 1.2", flag: "normal" },
          { name: "eGFR", value: ">90", unit: "mL/min/1.73m²", refRange: "≥ 60", flag: "normal" },
          { name: "Albumin", value: "4.4", unit: "g/dL", refRange: "3.5 – 5.0", flag: "normal" },
          { name: "Total Protein", value: "7.2", unit: "g/dL", refRange: "6.0 – 8.3", flag: "normal" },
          { name: "Total Bilirubin", value: "0.7", unit: "mg/dL", refRange: "0.1 – 1.2", flag: "normal" },
          { name: "Alkaline Phosphatase", value: "78", unit: "U/L", refRange: "44 – 147", flag: "normal" },
          { name: "ALT", value: "22", unit: "U/L", refRange: "7 – 56", flag: "normal" },
          { name: "AST", value: "24", unit: "U/L", refRange: "10 – 40", flag: "normal" },
        ],
      },
      {
        id: "out-of-range",
        title: "Out-of-Range Markers",
        icon: AlertTriangle,
        tone: "mint",
        summary: "None. Every analyte is within its reference window.",
        body:
          "Zero analytes flagged. All values sit comfortably within their reference windows; no marker requires repeat testing or interval monitoring.",
      },
      {
        id: "trends",
        title: "Year-over-Year Trends",
        icon: TrendingUp,
        tone: "lilac",
        summary:
          "Glucose, creatinine, and liver markers stable vs Oct 2022.",
        bullets: [
          "Glucose: 95 (Oct 2022) → 92 (Oct 2023). Stable; both mid-range.",
          "Creatinine: 0.9 → 0.9. Stable renal filtration (eGFR >90 both years).",
          "ALT: 26 → 22, AST: 27 → 24. Within assay variability — no meaningful change.",
          "Electrolytes (Na/K/Cl/CO2): unchanged within ±1 unit. No trend.",
        ],
      },
      {
        id: "recommendations",
        title: "Doctor's Recommendations",
        icon: Sparkles,
        tone: "lilac",
        summary:
          "Within normal limits. Pair with HbA1c + lipid panel at next annual.",
        items: [
          "CMP within normal limits — no acute follow-up needed.",
          "At next annual: pair CMP with HbA1c (diabetes screen, last value not on file) and a fasting lipid panel for a full cardiometabolic baseline.",
          "Maintain hydration (~2L/day) — keeps the BUN/creatinine ratio stable; current ratio of 15.6 is normal but consistent hydration before draws makes trends easier to interpret.",
          "No medication changes indicated. Re-test sooner only if new symptoms emerge (persistent fatigue, polyuria, right-upper-quadrant pain, edema).",
        ],
        defaultOpen: true,
      },
      {
        id: "follow-up",
        title: "Follow-up",
        icon: Calendar,
        tone: "mint",
        summary: "No clinical follow-up required. Re-test in 12 months.",
      },
    ],
  },
  {
    id: "checkin-oct18",
    tier: "sub",
    parentId: "cmp",
    source: "agent",
    date: "Oct 18, 2023",
    title: "Zoe weekly check-in",
    description:
      "Sleep stable at 7.2h avg, no symptoms reported. HRV trending up. No follow-up needed.",
    icon: Sparkles,
    tone: "lilac",
  },
  {
    id: "symptom-knee",
    tier: "sub",
    parentId: "cmp",
    source: "self",
    date: "Oct 10 – Oct 12, 2023",
    title: "Joint pain (self-reported)",
    description:
      "Mild aching in right knee after morning runs. Applied ice. Resolved without intervention.",
    icon: ClipboardList,
    tone: "amber",
    attachments: [{ name: "Run_Log.txt", type: "pdf" }],
  },
  {
    id: "checkin-oct03",
    tier: "sub",
    parentId: "cmp",
    source: "agent",
    date: "Oct 03, 2023",
    title: "Zoe weekly check-in",
    description:
      "Knee pain resolved per your reports. Running cadence back to baseline. Flagged for follow-up at next visit if recurs.",
    icon: Sparkles,
    tone: "lilac",
  },
  {
    id: "checkin-sep22",
    tier: "sub",
    parentId: "cmp",
    source: "agent",
    date: "Sep 22, 2023",
    title: "Zoe medication adherence check",
    description:
      "Eczema cream application: 6/7 days confirmed. Reminder pinged on the missed evening.",
    icon: Activity,
    tone: "mint",
  },
  {
    id: "derm",
    tier: "primary",
    date: "SEP 15, 2023",
    title: "Dermatology Consultation",
    description:
      "Routine 30-min skin check with Dr. Peterson (UCSF Dermatology). Mole mapping + targeted exam for left-elbow rash flagged by patient.",
    icon: Stethoscope,
    tone: "lilac-dark",
    badge: { label: "Specialist Visit", tone: "lilac" },
    aiTakeaway:
      "Eczema is common and localized. Monitoring required if redness spreads or itching increases.",
    attachedImagesLabel: "Skin_Map_Elbow.jpg",
    hasClinicalNotes: true,
    scans: [
      { name: "Skin_Map_Elbow.jpg", type: "image" },
      { name: "Dermascope_Mole_L7.jpg", type: "image" },
    ],
    sections: [
      {
        id: "chart-review",
        title: "Chart Reviewed at Visit",
        icon: ClipboardList,
        tone: "lilac",
        summary:
          "Allergies: NKDA. Meds: sumatriptan 50mg PRN. Vitals: BP 118/74, HR 68.",
        bullets: [
          "Allergies: NKDA (no known drug allergies).",
          "Current medications: sumatriptan 50mg PO PRN (migraine).",
          "Vitals: BP 118/74 mmHg, HR 68 bpm, Temp 98.4°F.",
          "Atopic history at visit: childhood eczema (resolved), seasonal allergic rhinitis. No personal asthma. Family history not on file at this visit.",
        ],
      },
      {
        id: "hpi",
        title: "History of Present Illness",
        icon: History,
        tone: "lilac",
        summary:
          "3-week history of itchy, scaly patch on left elbow. No systemic symptoms.",
        body:
          "Patient reports a persistent itchy, scaly patch on the inner left elbow for approximately 3 weeks. Onset coincided with seasonal weather change. Mild-to-moderate itching, no burning, no spread to other sites. No fevers, no joint involvement, no new exposures (no new soaps, detergents, or jewelry).",
        defaultOpen: true,
      },
      {
        id: "symptoms",
        title: "Reported Symptoms",
        icon: Thermometer,
        tone: "amber",
        summary:
          "Itchy, dry, scaly skin on left elbow. Worse in evenings; no oozing.",
        bullets: [
          "Itching: mild-to-moderate, worse in evenings.",
          "Dryness and fine scale, ~2cm × 3cm patch.",
          "No oozing, weeping, or bleeding.",
          "No fever, joint pain, or systemic symptoms.",
        ],
      },
      {
        id: "exam",
        title: "Physical Examination",
        icon: Heart,
        tone: "lilac",
        summary:
          "Erythematous, scaly plaque with excoriations on left antecubital fossa. No nail/scalp involvement.",
        body:
          "Full-body skin survey performed under dermatoscope.\n\n• Left antecubital fossa: ~2.5 × 3 cm ill-defined erythematous plaque with fine scale and linear excoriations. No vesicles, no exudate, no lichenification.\n• Mole mapping: 14 nevi catalogued, all benign-appearing. One mole (L7, left upper back) photographed via dermatoscope for baseline; symmetric, well-bordered, uniform color.\n• Nails, scalp, palms, soles: unremarkable.",
      },
      {
        id: "assessment",
        title: "Assessment",
        icon: ClipboardCheck,
        tone: "lilac-dark",
        summary:
          "Mild atopic dermatitis (eczema), flexural distribution. Benign nevi otherwise.",
        body:
          "Working diagnosis: localized atopic dermatitis (mild), flexural distribution, likely xerosis- and seasonal-triggered, consistent with the patient's childhood eczema and allergic rhinitis history. Differential includes irritant/contact dermatitis and nummular eczema; family atopy history to be reviewed at follow-up. No features of psoriasis, tinea, or scabies. Mole mapping unremarkable; mole L7 to be monitored at 12-month intervals.",
      },
      {
        id: "plan",
        title: "Plan",
        icon: Target,
        tone: "mint",
        summary:
          "Topical hydrocortisone 1% twice daily (BID) up to 14 days + soak-and-seal emollient routine.",
        items: [
          "Apply hydrocortisone 1% cream to the affected area twice daily for up to 14 days; stop sooner once clear.",
          "Apply a thick emollient (CeraVe Cream or Vanicream) within 3 minutes of bathing while skin is still damp (\"soak and seal\"), and reapply at least once more daily.",
          "Take short, lukewarm (not hot) showers with a gentle non-soap cleanser; pat dry rather than rub.",
          "Stop hydrocortisone after 14 days even if not fully resolved, and contact clinic — prolonged use on flexural thin skin risks atrophy and striae.",
        ],
      },
      {
        id: "follow-up",
        title: "Follow-up",
        icon: Calendar,
        tone: "lilac",
        summary:
          "Mole-mapping recheck in 12 months. Sooner if eczema worsens or new lesions appear.",
        body:
          "Routine 12-month follow-up scheduled for September 2024 for repeat mole mapping. Patient to contact clinic sooner if: eczema patch spreads, develops oozing/crusting, or fails to improve after 2 weeks of hydrocortisone.",
      },
      {
        id: "recommendations",
        title: "Preventive Guidance",
        icon: Sparkles,
        tone: "lilac",
        summary:
          "Daily SPF, monthly self-checks of mole L7, avoid known eczema triggers.",
        items: [
          "Apply broad-spectrum SPF 30+ daily, especially to face, neck, and any sun-exposed nevi.",
          "Avoid known eczema triggers: long hot showers, harsh soaps, fragrance, wool fabrics on bare skin.",
          "Self-check mole L7 (left upper back) monthly against the baseline dermatoscope photo; clinician re-photograph at the 12-month visit, or sooner if asymmetry, border change, color change, diameter >6mm, or evolution is noted.",
        ],
        defaultOpen: true,
      },
    ],
  },
  {
    id: "checkin-sep08",
    tier: "sub",
    parentId: "derm",
    source: "agent",
    date: "Sep 08, 2023",
    title: "Zoe post-visit follow-up",
    description:
      "Checked in on derm consult plan. Eczema application started day 1. No new symptoms.",
    icon: Sparkles,
    tone: "lilac",
  },
  {
    id: "symptom-sleep",
    tier: "sub",
    parentId: "derm",
    source: "self",
    date: "Aug 22 – Aug 23, 2023",
    title: "Sleep disruption (self-reported)",
    description:
      "Two nights of insomnia after long work day. No accompanying symptoms. Resolved by Aug 24.",
    icon: Moon,
    tone: "amber",
  },
  {
    id: "checkin-aug12",
    tier: "sub",
    parentId: "derm",
    source: "agent",
    date: "Aug 12, 2023",
    title: "Zoe migraine follow-up",
    description:
      "10 days post-migraine: no recurrence. Sleep + stress markers normalized. No further action required.",
    icon: Sparkles,
    tone: "lilac",
  },
  {
    id: "migraine",
    tier: "sub",
    parentId: "derm",
    source: "self",
    date: "Aug 02 – Aug 03, 2023",
    title: "Migraine episode (self-reported)",
    description:
      "Severe headache with aura. Took prescribed sumatriptan. Trigger suspected: poor sleep + stress.",
    expandedDescription:
      "Experienced severe headache with aura lasting approx 4 hours. Took prescribed sumatriptan at onset. Rested in dark room. Trigger suspected: lack of sleep and high stress.",
    icon: AlertTriangle,
    tone: "coral",
    badge: { label: "Self-Reported", tone: "coral" },
    sections: [
      {
        id: "what-happened",
        title: "What Happened",
        icon: ScrollText,
        tone: "coral",
        summary:
          "Severe right-sided throbbing headache with visual aura, ~4 hours, started 7:20pm Aug 2.",
        body:
          "Onset around 7:20pm on Aug 2. Began with ~20min of visual aura (shimmering zig-zag in right peripheral vision), followed by severe throbbing pain on the right side of the head behind the eye. Accompanied by photophobia, mild nausea (no vomiting), and sound sensitivity. Pain peaked at ~8/10 around 9pm. Pain worsened with walking/stairs, prompting bed rest.",
        defaultOpen: true,
      },
      {
        id: "triggers",
        title: "Suspected Triggers",
        icon: AlertTriangle,
        tone: "amber",
        summary:
          "5h sleep prior night + high-stress workday. Consistent with prior migraine pattern.",
        bullets: [
          "Sleep: only 5h on Aug 1 → Aug 2 (vs 7.4h baseline).",
          "Stress: high-pressure deadline at work all day Aug 2.",
          "Hydration: ~1L water consumed (below typical ~2L).",
          "No new foods, no alcohol, no caffeine change vs baseline. Hormonal/cycle correlation not assessed in this entry.",
        ],
      },
      {
        id: "treatment",
        title: "Treatment Taken",
        icon: ListChecks,
        tone: "lilac",
        summary:
          "Sumatriptan 50mg by mouth (PO) at onset of pain phase. Rested in dark room.",
        items: [
          "Took prescribed sumatriptan 50mg by mouth (PO) at ~7:45pm (within 25min of pain onset).",
          "Moved to dark, quiet bedroom; eye mask + cold compress.",
          "Hydrated with ~500ml water + electrolyte mix.",
          "Single 50mg dose was sufficient; per sumatriptan labeling a second 50–100mg dose is allowed after ≥2h if pain recurs (max 200mg/24h) — not needed this episode.",
          "Note for chart: triptan use assumes typical visual aura and no cardiovascular contraindications; re-evaluate if aura ever includes motor weakness, brainstem symptoms, or deficits lasting >60 minutes.",
        ],
      },
      {
        id: "resolution",
        title: "Resolution",
        icon: CheckCircle2,
        tone: "mint",
        summary:
          "Pain resolved by ~11:30pm Aug 2. Residual fatigue through Aug 3 morning.",
        body:
          "Pain tapered from 8/10 at 9pm to 2/10 by 11pm and fully resolved by ~11:30pm after ~4 hours total. Slept 9h overnight. Woke Aug 3 with residual fatigue + mild brain fog (postdrome); resolved by mid-afternoon. No recurrence in following 10 days.",
      },
      {
        id: "red-flags",
        title: "When to Seek Emergency Care",
        icon: AlertTriangle,
        tone: "coral",
        summary:
          "Seek ER care if a future headache feels fundamentally different from your usual migraine.",
        bullets: [
          "Sudden \"thunderclap\" onset (peak severity in <1 minute) or \"worst headache of life.\"",
          "New focal neurological deficits: weakness, numbness, speech difficulty, or aura lasting >60 minutes.",
          "Fever, neck stiffness, confusion, or headache after head trauma.",
          "First severe headache after age 50, or a clear change in your usual migraine pattern.",
        ],
        defaultOpen: true,
      },
      {
        id: "recommendations",
        title: "Zoe's Recommendations",
        icon: Sparkles,
        tone: "lilac",
        summary:
          "Prioritize sleep ≥7h on high-stress days. Raise to PCP if ≥4 headache days/month.",
        items: [
          "Treat 7h+ sleep as non-negotiable on days with known work-stress peaks.",
          "Keep sumatriptan within reach; the early-onset dose appears to have shortened this episode.",
          "Log future migraines (date, sleep, stress, hydration, aura features — visual / sensory / aphasic) so we can spot patterns.",
          "If migraines occur ≥4 headache days per month — or any month with significant disability despite triptan use — raise it at your next PCP visit; this is the American Headache Society threshold where preventive therapy is typically discussed.",
        ],
      },
    ],
  },
  {
    id: "checkin-jul28",
    tier: "sub",
    source: "agent",
    date: "Jul 28, 2023",
    title: "Zoe weekly check-in",
    description:
      "Baseline week: no symptoms, sleep avg 7.4h, HRV 64ms. Migraine-trigger awareness reminder sent.",
    icon: Sparkles,
    tone: "lilac",
  },
];

export function MedicalTimelineView({
  onImportData,
  onAskAbout,
}: MedicalTimelineViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedEntry =
    ENTRIES.find((e) => e.id === selectedId) ?? null;

  return (
    <div className="h-full overflow-y-auto zoe-scroll">
      <div className="px-8 lg:px-12 py-8 mx-auto max-w-[1100px]">
        <header className="flex items-start justify-between gap-6 mb-8">
          <div>
            <h1 className="text-3xl md:text-[34px] font-semibold tracking-tight leading-tight">
              Medical Timeline
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Your chronological health history.
            </p>
          </div>
          <button
            type="button"
            onClick={onImportData}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors shadow-[0_2px_8px_-2px_rgba(20,20,40,0.18)]"
          >
            <FileText className="w-4 h-4" />
            Import Data
          </button>
        </header>

        {/* AI Health Status Summary — independent module above the timeline */}
        <HealthSummaryModule />

        {/* Section divider */}
        <div className="mt-10 mb-6 flex items-center gap-3">
          <span className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">
            Clinical Timeline
          </span>
          <span className="h-px flex-1 bg-foreground/8" />
        </div>

        <Timeline
          entries={ENTRIES}
          onAskAbout={onAskAbout}
          onSelect={setSelectedId}
        />

        <div className="text-center text-xs text-muted-foreground mt-10 mb-4">
          ··· End of available records
        </div>
      </div>

      <TimelineEntryDetail
        entry={selectedEntry}
        onClose={() => setSelectedId(null)}
        onAskAbout={onAskAbout}
      />
    </div>
  );
}

/* ───────────────────── AI Summary independent module ───────────────────── */

function HealthSummaryModule() {
  return (
    <section
      aria-label="AI Health Status Summary"
      className="relative overflow-hidden rounded-3xl bg-card ring-1 ring-foreground/8 px-6 md:px-8 py-7 md:py-8 shadow-[0_1px_2px_rgba(20,20,40,0.03),0_2px_18px_-6px_rgba(20,20,40,0.08)]"
    >
      {/* Lilac wash overlay (very subtle, top-left bleed) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(120% 70% at 0% 0%, color-mix(in oklab, var(--zoe-lilac-soft) 70%, transparent) 0%, transparent 55%)",
        }}
      />

      <div className="relative grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 lg:gap-8">
        {/* Left: headline + body */}
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-[color:var(--zoe-lilac-soft)] text-[color:var(--zoe-lilac)] text-[10px] font-bold uppercase tracking-[0.14em]">
              <Sparkles className="w-3 h-3" />
              AI Health Status Summary
            </span>
            <span className="text-[11px] text-muted-foreground">
              {HEALTH_SUMMARY.updated}
            </span>
          </div>

          <h2 className="mt-4 text-[22px] md:text-[26px] font-semibold leading-snug tracking-tight">
            {HEALTH_SUMMARY.headline}
          </h2>

          <p className="mt-3 text-sm md:text-[14.5px] text-foreground/80 leading-relaxed whitespace-pre-line">
            {HEALTH_SUMMARY.body}
          </p>

          <div className="mt-4 flex items-start gap-2 text-[11px] text-muted-foreground">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <p className="leading-snug">
              Generated by Zoe AI to help you read your record at a glance. Always
              consult your physician for medical decisions.
            </p>
          </div>
        </div>

        {/* Right: key signals */}
        <div className="lg:border-l lg:border-foreground/8 lg:pl-8">
          <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">
            Key signals
          </p>
          <ul className="mt-3 space-y-2">
            {HEALTH_SUMMARY.signals.map((s) => (
              <li
                key={s.label}
                className="flex items-center justify-between gap-3 rounded-xl bg-card/60 ring-1 ring-foreground/5 px-3.5 py-2.5"
              >
                <span className="text-xs text-muted-foreground">{s.label}</span>
                <span
                  className={cn(
                    "text-[11px] font-semibold inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full",
                    toneToBg(s.tone, true),
                    toneToText(s.tone)
                  )}
                >
                  {s.tone === "mint" && <CheckCircle2 className="w-3 h-3" />}
                  {s.tone === "amber" && <AlertTriangle className="w-3 h-3" />}
                  {s.value}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────── Timeline with primary + sub tiers ───────────────────── */

function Timeline({
  entries,
  onAskAbout,
  onSelect,
}: {
  entries: TimelineEntry[];
  onAskAbout: (ctx: AskContext) => void;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="relative pl-12">
      {/* Vertical rail */}
      <div
        aria-hidden
        className="absolute left-[18px] top-2 bottom-12 w-px bg-foreground/10"
      />

      <div className="space-y-6">
        {entries.map((entry) =>
          entry.tier === "primary" ? (
            <PrimaryRow
              key={entry.id}
              entry={entry}
              onAskAbout={onAskAbout}
              onSelect={() => onSelect(entry.id)}
            />
          ) : (
            <SubRow
              key={entry.id}
              entry={entry}
              onSelect={() => onSelect(entry.id)}
            />
          )
        )}
      </div>
    </div>
  );
}

function PrimaryRow({
  entry,
  onAskAbout,
  onSelect,
}: {
  entry: TimelineEntry;
  onAskAbout: (ctx: AskContext) => void;
  onSelect: () => void;
}) {
  const Icon = entry.icon;

  return (
    <div className="relative">
      {/* Dot marker */}
      <div
        className={cn(
          "absolute -left-12 top-3 w-9 h-9 rounded-full flex items-center justify-center ring-4 ring-background pointer-events-none",
          toneToBg(entry.tone),
          toneToText(entry.tone)
        )}
      >
        <Icon className="w-4 h-4" />
      </div>

      <button
        type="button"
        onClick={onSelect}
        aria-label={`Open ${entry.title} detail`}
        className="group w-full text-left rounded-2xl bg-card ring-1 ring-foreground/5 shadow-[0_1px_2px_rgba(20,20,40,0.03),0_2px_12px_-6px_rgba(20,20,40,0.06)] p-5 transition-all hover:-translate-y-0.5 hover:ring-foreground/10 hover:shadow-[0_4px_18px_-4px_rgba(20,20,40,0.10)] outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
      >
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {entry.date}
            </p>
            <h3 className="font-semibold tracking-tight mt-1 text-[17px]">
              {entry.title}
            </h3>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {entry.badge && (
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[11px] font-semibold",
                  toneToBg(entry.badge.tone, true),
                  toneToText(entry.badge.tone)
                )}
              >
                {entry.badge.tone === "mint" && <CheckCircle2 className="w-3 h-3" />}
                {entry.badge.tone === "lilac" && <Briefcase className="w-3 h-3" />}
                {entry.badge.tone === "coral" && <AlertTriangle className="w-3 h-3" />}
                {entry.badge.label}
              </span>
            )}
            {entry.labResults && entry.labResults.length > 0 && (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/60 ring-1 ring-foreground/5 rounded-full h-6 px-2.5">
                <TestTube className="w-3 h-3" />
                {entry.labResults.length}
              </span>
            )}
            {entry.scans && entry.scans.length > 0 && (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/60 ring-1 ring-foreground/5 rounded-full h-6 px-2.5">
                <Paperclip className="w-3 h-3" />
                {entry.scans.length}
              </span>
            )}
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onAskAbout({
                  label: entry.title,
                  prompt: `Walk me through this entry from ${entry.date}: ${entry.title}. What's clinically relevant for my next visit?`,
                  surface: "timeline",
                });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onAskAbout({
                    label: entry.title,
                    prompt: `Walk me through this entry from ${entry.date}: ${entry.title}. What's clinically relevant for my next visit?`,
                    surface: "timeline",
                  });
                }
              }}
              aria-label={`Ask Zoe about ${entry.title}`}
              className="w-7 h-7 rounded-lg bg-muted/60 hover:bg-[color:var(--zoe-lilac-soft)] text-foreground/60 hover:text-[color:var(--zoe-lilac)] transition-colors flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--zoe-lilac)]/40 cursor-pointer"
              title="Ask Zoe about this"
            >
              <MessageCircle className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>

        {/* Body */}
        <p className="text-sm text-foreground/80 leading-relaxed mt-3">
          {entry.description}
        </p>

        {/* Hint */}
        <p className="mt-3 text-[11px] uppercase tracking-[0.14em] font-semibold text-muted-foreground/70 group-hover:text-[color:var(--zoe-lilac)] transition-colors">
          Open full visit ↗
        </p>
      </button>
    </div>
  );
}

function SubRow({
  entry,
  onSelect,
}: {
  entry: TimelineEntry;
  onSelect: () => void;
}) {
  const Icon = entry.icon;

  return (
    <div className="relative pl-6">
      {/* Branch line off the rail */}
      <div
        aria-hidden
        className="absolute -left-[14px] top-3.5 w-[18px] h-px bg-foreground/15"
      />
      {/* Outlined sub-dot */}
      <div
        className={cn(
          "absolute -left-[36px] top-1.5 w-5 h-5 rounded-full bg-background ring-2 flex items-center justify-center pointer-events-none",
          toneToRing(entry.tone)
        )}
      >
        <Icon className={cn("w-2.5 h-2.5", toneToText(entry.tone))} />
      </div>

      {/* Sub content: no card, smaller type, muted; clickable */}
      <button
        type="button"
        onClick={onSelect}
        aria-label={`Open ${entry.title} detail`}
        className="w-full text-left py-1.5 rounded-lg hover:bg-muted/40 transition-colors px-2 -mx-2 outline-none focus-visible:ring-2 focus-visible:ring-foreground/15"
      >
        <div className="flex items-center gap-2 flex-wrap">
          {entry.source === "agent" && (
            <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-[0.14em] font-semibold text-[color:var(--zoe-lilac)] bg-[color:var(--zoe-lilac-soft)] rounded-full px-1.5 py-0.5">
              <Sparkles className="w-2.5 h-2.5" />
              Zoe
            </span>
          )}
          {entry.source === "self" && (
            <span className="inline-flex items-center text-[9px] uppercase tracking-[0.14em] font-semibold text-foreground/60 bg-muted rounded-full px-1.5 py-0.5">
              Self
            </span>
          )}
          <span className="text-[11px] text-muted-foreground">{entry.date}</span>
          <span aria-hidden className="text-muted-foreground/40">·</span>
          <h4 className="text-[13.5px] font-medium text-foreground/85">
            {entry.title}
          </h4>
          {entry.attachments && entry.attachments.length > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <Paperclip className="w-3 h-3" />
              {entry.attachments[0].name}
            </span>
          )}
        </div>
        <p className="mt-1 text-[12.5px] text-foreground/65 leading-relaxed">
          {entry.description}
        </p>
      </button>
    </div>
  );
}

/* ───────────────────── Tone helpers ───────────────────── */

function toneToBg(tone: EntryTone, soft = false) {
  if (soft) {
    switch (tone) {
      case "mint":
        return "bg-[color:var(--zoe-mint-soft)]";
      case "lilac":
      case "lilac-dark":
        return "bg-[color:var(--zoe-lilac-soft)]";
      case "amber":
        return "bg-[color:var(--zoe-amber-soft)]";
      case "coral":
        return "bg-[color:var(--zoe-coral-soft)]";
    }
  }
  // dot solid (primary markers)
  switch (tone) {
    case "mint":
      return "bg-[color:var(--zoe-mint-soft)]";
    case "lilac":
      return "bg-[color:var(--zoe-lilac-soft)]";
    case "lilac-dark":
      return "bg-foreground";
    case "amber":
      return "bg-[color:var(--zoe-amber-soft)]";
    case "coral":
      return "bg-[color:var(--zoe-coral-soft)]";
  }
}

function toneToText(tone: EntryTone) {
  switch (tone) {
    case "mint":
      return "text-[color:var(--zoe-mint)]";
    case "lilac":
      return "text-[color:var(--zoe-lilac)]";
    case "lilac-dark":
      return "text-background";
    case "amber":
      return "text-[color:var(--zoe-amber)]";
    case "coral":
      return "text-[color:var(--zoe-coral)]";
  }
}

function toneToRing(tone: EntryTone) {
  switch (tone) {
    case "mint":
      return "ring-[color:var(--zoe-mint)]/35";
    case "lilac":
    case "lilac-dark":
      return "ring-[color:var(--zoe-lilac)]/35";
    case "amber":
      return "ring-[color:var(--zoe-amber)]/45";
    case "coral":
      return "ring-[color:var(--zoe-coral)]/40";
  }
}
