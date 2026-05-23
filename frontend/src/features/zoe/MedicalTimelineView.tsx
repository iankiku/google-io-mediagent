"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Eye,
  FileText,
  Info,
  MessageCircle,
  Paperclip,
  Sparkles,
  Stethoscope,
  TestTube,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AskContext } from "./AskZoePopup";

interface MedicalTimelineViewProps {
  onImportData: () => void;
  onAskAbout: (ctx: AskContext) => void;
}

type EntryTone = "lilac" | "mint" | "lilac-dark" | "amber" | "coral";
type EntryTier = "primary" | "sub";

interface TimelineEntry {
  id: string;
  tier: EntryTier;
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
    tier: "sub",
    parentId: "cmp",
    date: "Oct 10 – Oct 12, 2023",
    title: "Joint pain (self-reported)",
    description:
      "Mild aching in right knee after morning runs. Applied ice. Resolved without intervention.",
    icon: ClipboardList,
    tone: "amber",
    collapsible: true,
    attachments: [{ name: "Run_Log.txt", type: "pdf" }],
  },
  {
    id: "derm",
    tier: "primary",
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
    tier: "sub",
    parentId: "derm",
    date: "Aug 02 – Aug 03, 2023",
    title: "Migraine episode (self-reported)",
    description:
      "Severe headache with aura. Took prescribed sumatriptan. Trigger suspected: poor sleep + stress.",
    expandedDescription:
      "Experienced severe headache with aura lasting approx 4 hours. Took prescribed sumatriptan at onset. Rested in dark room. Trigger suspected: lack of sleep and high stress.",
    icon: AlertTriangle,
    tone: "coral",
    badge: { label: "Self-Reported", tone: "coral" },
    collapsible: true,
  },
];

export function MedicalTimelineView({
  onImportData,
  onAskAbout,
}: MedicalTimelineViewProps) {
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

        <Timeline entries={ENTRIES} onAskAbout={onAskAbout} />

        <div className="text-center text-xs text-muted-foreground mt-10 mb-4">
          ··· End of available records
        </div>
      </div>
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
}: {
  entries: TimelineEntry[];
  onAskAbout: (ctx: AskContext) => void;
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
            <PrimaryRow key={entry.id} entry={entry} onAskAbout={onAskAbout} />
          ) : (
            <SubRow key={entry.id} entry={entry} />
          )
        )}
      </div>
    </div>
  );
}

function PrimaryRow({
  entry,
  onAskAbout,
}: {
  entry: TimelineEntry;
  onAskAbout: (ctx: AskContext) => void;
}) {
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

      <div className="rounded-2xl bg-card ring-1 ring-foreground/5 shadow-[0_1px_2px_rgba(20,20,40,0.03),0_2px_12px_-6px_rgba(20,20,40,0.06)] p-5">
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
            <button
              type="button"
              onClick={() =>
                onAskAbout({
                  label: entry.title,
                  prompt: `Walk me through this entry from ${entry.date}: ${entry.title}. What's clinically relevant for my next visit?`,
                  surface: "timeline",
                })
              }
              aria-label={`Ask Zoe about ${entry.title}`}
              className="w-7 h-7 rounded-lg bg-muted/60 hover:bg-[color:var(--zoe-lilac-soft)] text-foreground/60 hover:text-[color:var(--zoe-lilac)] transition-colors flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--zoe-lilac)]/40"
              title="Ask Zoe about this"
            >
              <MessageCircle className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <p className="text-sm text-foreground/80 leading-relaxed mt-3 whitespace-pre-line">
          {!entry.collapsible || expanded
            ? entry.expandedDescription ?? entry.description
            : entry.description}
        </p>

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
                  className="text-xs text-[color:var(--zoe-lilac)] hover:underline mt-1.5 flex items-center gap-1.5"
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

function SubRow({ entry }: { entry: TimelineEntry }) {
  const [expanded, setExpanded] = useState(false);
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
          "absolute -left-[36px] top-1.5 w-5 h-5 rounded-full bg-background ring-2 flex items-center justify-center",
          toneToRing(entry.tone)
        )}
      >
        <Icon className={cn("w-2.5 h-2.5", toneToText(entry.tone))} />
      </div>

      {/* Sub content: no card, smaller type, muted */}
      <div className="py-1">
        <div className="flex items-center gap-2 flex-wrap">
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
          {entry.collapsible && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="ml-auto w-6 h-6 rounded-md hover:bg-muted text-foreground/50 hover:text-foreground transition-colors flex items-center justify-center"
              aria-label={expanded ? "Collapse" : "Expand"}
            >
              {expanded ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>
        <p className="mt-1 text-[12.5px] text-foreground/65 leading-relaxed">
          {!entry.collapsible || expanded
            ? entry.expandedDescription ?? entry.description
            : entry.description}
        </p>
      </div>
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
