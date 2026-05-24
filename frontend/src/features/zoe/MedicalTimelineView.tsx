"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Briefcase,
  CheckCircle2,
  FileText,
  Info,
  MessageCircle,
  Paperclip,
  Sparkles,
  TestTube,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AskContext } from "./AskZoePopup";
import {
  TimelineEntryDetail,
  type EntryTone,
} from "./TimelineEntryDetail";
import { PersonaPickerView } from "./PersonaPickerView";
import { PERSONA_BY_ID, type PersonaId } from "./seeds";
import type { HealthSummary, TimelineEntry } from "./seeds/types";

interface MedicalTimelineViewProps {
  onImportData: () => void;
  onAskAbout: (ctx: AskContext) => void;
}

export function MedicalTimelineView({
  onImportData,
  onAskAbout,
}: MedicalTimelineViewProps) {
  const [personaId, setPersonaId] = useState<PersonaId | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const persona = personaId ? PERSONA_BY_ID[personaId] : null;
  const entries = persona?.entries ?? [];
  const selectedEntry = useMemo(
    () => entries.find((e) => e.id === selectedId) ?? null,
    [entries, selectedId]
  );

  if (!persona) {
    return <PersonaPickerView onSelect={setPersonaId} />;
  }

  return (
    <div className="h-full overflow-y-auto zoe-scroll">
      <div className="px-8 lg:px-12 py-8 mx-auto max-w-[1100px]">
        <header className="flex items-start justify-between gap-6 mb-6">
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => {
                setPersonaId(null);
                setSelectedId(null);
              }}
              className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors mb-2 outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 rounded"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Choose another patient
            </button>
            <h1 className="text-3xl md:text-[34px] font-semibold tracking-tight leading-tight">
              Medical Timeline
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {persona.displayName} · {persona.demographics.ageSex} · BMI{" "}
              {persona.demographics.bmi} · {persona.conditionTag}
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

        <div className="mt-2">
          <HealthSummaryModule summary={persona.summary} />
        </div>

        <div className="mt-10 mb-6 flex items-center gap-3">
          <span className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">
            Clinical Timeline
          </span>
          <span className="h-px flex-1 bg-foreground/8" />
        </div>

        <Timeline
          entries={entries}
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

/* ───────────────────── AI Summary module ───────────────────── */

function HealthSummaryModule({ summary }: { summary: HealthSummary }) {
  return (
    <section
      aria-label="AI Health Status Summary"
      className="relative overflow-hidden rounded-3xl bg-card ring-1 ring-foreground/8 px-6 md:px-8 py-7 md:py-8 shadow-[0_1px_2px_rgba(20,20,40,0.03),0_2px_18px_-6px_rgba(20,20,40,0.08)]"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(120% 70% at 0% 0%, color-mix(in oklab, var(--zoe-lilac-soft) 70%, transparent) 0%, transparent 55%)",
        }}
      />

      <div className="relative grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 lg:gap-8">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-[color:var(--zoe-lilac-soft)] text-[color:var(--zoe-lilac)] text-[10px] font-bold uppercase tracking-[0.14em]">
              <Sparkles className="w-3 h-3" />
              AI Health Status Summary
            </span>
            <span className="text-[11px] text-muted-foreground">
              {summary.updated}
            </span>
          </div>

          <h2 className="mt-4 text-[22px] md:text-[26px] font-semibold leading-snug tracking-tight">
            {summary.headline}
          </h2>

          <p className="mt-3 text-sm md:text-[14.5px] text-foreground/80 leading-relaxed whitespace-pre-line">
            {summary.body}
          </p>

          <div className="mt-4 flex items-start gap-2 text-[11px] text-muted-foreground">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <p className="leading-snug">
              Generated by Zoe AI to help you read your record at a glance. Always
              consult your physician for medical decisions.
            </p>
          </div>
        </div>

        <div className="lg:border-l lg:border-foreground/8 lg:pl-8">
          <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">
            Key signals
          </p>
          <ul className="mt-3 space-y-2">
            {summary.signals.map((s) => (
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
                  {(s.tone === "amber" || s.tone === "coral") && (
                    <AlertTriangle className="w-3 h-3" />
                  )}
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

/* ───────────────────── Timeline ───────────────────── */

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

        <p className="text-sm text-foreground/80 leading-relaxed mt-3">
          {entry.description}
        </p>

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
      <div
        aria-hidden
        className="absolute -left-[14px] top-3.5 w-[18px] h-px bg-foreground/15"
      />
      <div
        className={cn(
          "absolute -left-[36px] top-1.5 w-5 h-5 rounded-full bg-background ring-2 flex items-center justify-center pointer-events-none",
          toneToRing(entry.tone)
        )}
      >
        <Icon className={cn("w-2.5 h-2.5", toneToText(entry.tone))} />
      </div>

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
