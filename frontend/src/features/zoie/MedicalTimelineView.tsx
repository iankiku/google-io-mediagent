"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Briefcase,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  ClipboardList,
  Eye,
  FileText,
  Info,
  Paperclip,
  Sparkles,
  Stethoscope,
  TestTube,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MedicalTimelineViewProps {
  onImportData: () => void;
}

type EntryTone = "lilac" | "mint" | "lilac-dark" | "amber" | "coral";

interface TimelineEntry {
  id: string;
  date: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: EntryTone;
  badge?: { label: string; tone: EntryTone };
  hideDateInline?: boolean;
  isSummary?: boolean;
  attachments?: { name: string; type: "pdf" | "img" }[];
  aiTakeaway?: string;
  attachedDocsLabel?: string;
  attachedImagesLabel?: string;
  showViewPdf?: boolean;
  collapsible?: boolean;
  expandedDescription?: string;
  hasClinicalNotes?: boolean;
}

const ENTRIES: TimelineEntry[] = [
  {
    id: "summary",
    date: "Updated Today",
    title: "Health Status Summary",
    description:
      "Your recent clinical data indicates a stable baseline with consistent metabolic performance. Your latest blood work from October shows all primary markers are within optimal ranges, reflecting good systemic health.\n\nWhile the dermatology consultation was routine, continue to monitor the eczema as prescribed. The self-reported migraine in August appears to be an isolated event linked to lifestyle stressors rather than a chronic pattern. Overall, your health trajectory remains positive and well-managed.",
    icon: Sparkles,
    tone: "lilac-dark",
    isSummary: true,
  },
  {
    id: "cmp",
    date: "OCT 24, 2023",
    title: "Comprehensive Metabolic Panel",
    description:
      "Annual blood work results reviewed by Dr. Sarah Jenkins. All metabolic markers, including glucose, calcium, and electrolytes, indicate stable metabolic function.",
    icon: TestTube,
    tone: "lilac",
    badge: { label: "Within Normal Thresholds", tone: "mint" },
    aiTakeaway:
      "No markers outside normal range. Glucose levels are stable compared to previous year.",
    attachedDocsLabel: "CMP_Results_Oct23.pdf",
    showViewPdf: true,
  },
  {
    id: "symptom-knee",
    date: "OCT 10 - OCT 12, 2023",
    title: "Symptom Log: Joint Pain",
    description: "Mild aching in right knee after morning runs. Applied ice.",
    icon: ClipboardList,
    tone: "lilac",
    collapsible: true,
    attachments: [{ name: "Run_Log.txt", type: "pdf" }],
  },
  {
    id: "derm",
    date: "SEP 15, 2023",
    title: "Dermatology Consultation",
    description:
      "Routine mole mapping and skin check with Dr. Peterson. Prescribed topical cream for mild eczema on left elbow. Follow-up recommended in 12 months.",
    icon: Stethoscope,
    tone: "lilac-dark",
    badge: { label: "Specialist Visit", tone: "lilac" },
    aiTakeaway:
      "Eczema is common and localized. Monitoring required if redness spreads or itching increases.",
    attachedImagesLabel: "Skin_Map_Elbow.jpg",
    hasClinicalNotes: true,
  },
  {
    id: "migraine",
    date: "AUG 02 - AUG 03, 2023",
    title: "Symptom Log: Migraine",
    description:
      "Experienced severe headache with aura. Took prescribed sumatriptan.",
    expandedDescription:
      "Experienced severe headache with aura lasting approx 4 hours. Took prescribed sumatriptan at onset. Rested in dark room. Trigger suspected: lack of sleep and high stress.",
    icon: AlertTriangle,
    tone: "amber",
    badge: { label: "Self-Reported", tone: "coral" },
    collapsible: true,
  },
];

export function MedicalTimelineView({ onImportData }: MedicalTimelineViewProps) {
  return (
    <div className="h-full overflow-y-auto zoie-scroll">
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

        <div className="relative pl-12">
          {/* Vertical line */}
          <div className="absolute left-[18px] top-2 bottom-12 w-px bg-foreground/10" />

          <div className="space-y-6">
            {ENTRIES.map((entry) => (
              <TimelineRow key={entry.id} entry={entry} />
            ))}
          </div>

          <div className="text-center text-xs text-muted-foreground mt-10 mb-4">
            ··· End of available records
          </div>
        </div>
      </div>
    </div>
  );
}

function TimelineRow({ entry }: { entry: TimelineEntry }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = entry.icon;

  return (
    <div className="relative">
      {/* Dot marker */}
      <div
        className={cn(
          "absolute -left-12 top-3 w-9 h-9 rounded-full flex items-center justify-center ring-4 ring-background",
          toneToBg(entry.tone),
          toneToText(entry.tone)
        )}
      >
        <Icon className="w-4 h-4" />
      </div>

      <div
        className={cn(
          "rounded-2xl bg-card ring-1 ring-foreground/5 shadow-[0_1px_2px_rgba(20,20,40,0.03),0_2px_12px_-6px_rgba(20,20,40,0.06)]",
          entry.isSummary ? "p-6" : "p-5"
        )}
      >
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {entry.isSummary && (
              <span className="inline-flex items-center h-6 px-2.5 rounded-full bg-[color:var(--zoie-lilac-soft)] text-[color:var(--zoie-lilac)] text-[10px] font-bold uppercase tracking-wider">
                AI Generated Analysis
              </span>
            )}
            {!entry.isSummary && (
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {entry.date}
              </p>
            )}
            <h3
              className={cn(
                "font-semibold tracking-tight mt-1",
                entry.isSummary ? "text-xl" : "text-[17px]"
              )}
            >
              {entry.title}
            </h3>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {entry.isSummary && (
              <span className="text-xs text-muted-foreground">{entry.date}</span>
            )}
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
            {entry.collapsible && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="w-7 h-7 rounded-lg hover:bg-muted text-foreground/60 hover:text-foreground transition-colors flex items-center justify-center"
                aria-label={expanded ? "Collapse" : "Expand"}
              >
                {expanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
            )}
            {entry.attachments && entry.attachments.length > 0 && (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/60 ring-1 ring-foreground/5 rounded-full h-6 px-2.5">
                <Paperclip className="w-3 h-3" />
                {entry.attachments.length} File
              </span>
            )}
          </div>
        </div>

        {/* Body */}
        {!entry.collapsible || expanded ? (
          <p className="text-sm text-foreground/80 leading-relaxed mt-3 whitespace-pre-line">
            {entry.expandedDescription ?? entry.description}
          </p>
        ) : (
          <p className="text-sm text-foreground/80 leading-relaxed mt-3">
            {entry.description}
          </p>
        )}

        {/* Summary info banner */}
        {entry.isSummary && (
          <div className="mt-4 rounded-xl bg-muted/60 ring-1 ring-foreground/5 px-3.5 py-2.5 flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-[12px] text-muted-foreground leading-snug">
              This summary is generated by Zoie AI to help you understand your clinical
              records. Always consult with your physician for medical decisions.
            </p>
          </div>
        )}

        {/* AI Takeaway / Attachments grid */}
        {(entry.aiTakeaway || entry.attachedDocsLabel || entry.attachedImagesLabel) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            {entry.aiTakeaway && (
              <div className="rounded-xl bg-muted/50 ring-1 ring-foreground/5 px-3.5 py-3">
                <p className="text-[11px] font-semibold text-foreground/70 flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3" />
                  {entry.id === "derm" ? "AI Analysis" : "AI Key Takeaway"}
                </p>
                <p className="text-xs text-foreground/75 mt-1.5 leading-relaxed">
                  {entry.aiTakeaway}
                </p>
              </div>
            )}
            {(entry.attachedDocsLabel || entry.attachedImagesLabel) && (
              <div className="rounded-xl bg-muted/50 ring-1 ring-foreground/5 px-3.5 py-3">
                <p className="text-[11px] font-semibold text-foreground/70 flex items-center gap-1.5">
                  <Paperclip className="w-3 h-3" />
                  {entry.attachedImagesLabel ? "Attached Images" : "Attached Documents"}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    alert(
                      `Opening ${entry.attachedImagesLabel ?? entry.attachedDocsLabel}…`
                    )
                  }
                  className="text-xs text-[color:var(--zoie-lilac)] hover:underline mt-1.5 flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5" />
                  {entry.attachedImagesLabel ?? entry.attachedDocsLabel}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Action row */}
        {(entry.showViewPdf || entry.hasClinicalNotes) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {entry.showViewPdf && (
              <button
                type="button"
                onClick={() => alert("Opening PDF…")}
                className="inline-flex items-center gap-2 h-9 px-3 rounded-xl bg-foreground text-background text-xs font-semibold hover:bg-foreground/90 transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
                View Full Report
              </button>
            )}
            {entry.hasClinicalNotes && (
              <button
                type="button"
                onClick={() => alert("Opening clinical notes…")}
                className="inline-flex items-center gap-2 h-9 px-3 rounded-xl bg-card ring-1 ring-foreground/10 text-xs font-semibold hover:bg-muted transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                Clinical Notes
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function toneToBg(tone: EntryTone, soft = false) {
  const base = soft ? "soft" : "solid";
  if (base === "soft") {
    switch (tone) {
      case "mint":
        return "bg-[color:var(--zoie-mint-soft)]";
      case "lilac":
      case "lilac-dark":
        return "bg-[color:var(--zoie-lilac-soft)]";
      case "amber":
        return "bg-[color:var(--zoie-amber-soft)]";
      case "coral":
        return "bg-[color:var(--zoie-coral-soft)]";
    }
  }
  // dot solid
  switch (tone) {
    case "mint":
      return "bg-[color:var(--zoie-mint-soft)]";
    case "lilac":
      return "bg-[color:var(--zoie-lilac-soft)]";
    case "lilac-dark":
      return "bg-foreground";
    case "amber":
      return "bg-[color:var(--zoie-amber-soft)]";
    case "coral":
      return "bg-[color:var(--zoie-coral-soft)]";
  }
}

function toneToText(tone: EntryTone) {
  switch (tone) {
    case "mint":
      return "text-[color:var(--zoie-mint)]";
    case "lilac":
      return "text-[color:var(--zoie-lilac)]";
    case "lilac-dark":
      return "text-background";
    case "amber":
      return "text-[color:var(--zoie-amber)]";
    case "coral":
      return "text-[color:var(--zoie-coral)]";
  }
}
