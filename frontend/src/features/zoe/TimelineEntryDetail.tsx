"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  CheckCircle2,
  ChevronDown,
  Eye,
  FileText,
  ImageIcon,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AskContext } from "./AskZoePopup";

export type EntryTone = "lilac" | "mint" | "lilac-dark" | "amber" | "coral";

export interface LabResult {
  name: string;
  value: string;
  unit: string;
  refRange: string;
  flag?: "normal" | "high" | "low";
}

export interface ScanItem {
  name: string;
  type: "image" | "pdf";
  /** Optional preview src (defaults to the otter placeholder). */
  src?: string;
}

export interface DetailSection {
  /** Stable id, used as section anchor + ask prompt scoping. */
  id: string;
  /** Title shown in the row header. */
  title: string;
  /** Icon shown on the left in a tonal pill. */
  icon: React.ComponentType<{ className?: string }>;
  /** Optional tone for the icon pill. Defaults to neutral. */
  tone?: EntryTone;
  /** One-line collapsed summary (always visible). */
  summary: string;
  /** Optional expanded prose. */
  body?: string;
  /** Optional numbered list (used by Recommendations, Plan steps, etc). */
  items?: string[];
  /** Optional bullets (Symptoms, Triggers, etc). */
  bullets?: string[];
  /** Optional lab rows rendered as a table inside the section. */
  labRows?: LabResult[];
  /** Expanded by default when true. */
  defaultOpen?: boolean;
}

export interface TimelineEntryDetailData {
  id: string;
  date: string;
  title: string;
  description: string;
  expandedDescription?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: EntryTone;
  tier: "primary" | "sub";
  badge?: { label: string; tone: EntryTone };
  aiTakeaway?: string;
  attachedDocsLabel?: string;
  attachedImagesLabel?: string;
  showViewPdf?: boolean;
  hasClinicalNotes?: boolean;
  labResults?: LabResult[];
  scans?: ScanItem[];
  /** Structured per-section breakdown (postvisit.ai-style). */
  sections?: DetailSection[];
}

interface Props {
  entry: TimelineEntryDetailData | null;
  onClose: () => void;
  onAskAbout: (ctx: AskContext) => void;
}

export function TimelineEntryDetail({ entry, onClose, onAskAbout }: Props) {
  useEffect(() => {
    if (!entry) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [entry, onClose]);

  const open = entry !== null;

  return (
    <>
      <button
        type="button"
        aria-label="Close detail"
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-30 bg-foreground/15 backdrop-blur-[2px] transition-opacity duration-300",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      />
      <aside
        aria-hidden={!open}
        role="dialog"
        aria-label={entry ? `${entry.title} detail` : undefined}
        className={cn(
          "fixed right-0 top-0 z-40 h-full w-full sm:w-[600px] bg-card border-l border-border shadow-[0_30px_60px_-20px_rgba(20,20,40,0.25)] transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {entry && (
          <DetailBody entry={entry} onClose={onClose} onAskAbout={onAskAbout} />
        )}
      </aside>
    </>
  );
}

function DetailBody({
  entry,
  onClose,
  onAskAbout,
}: {
  entry: TimelineEntryDetailData;
  onClose: () => void;
  onAskAbout: (ctx: AskContext) => void;
}) {
  const Icon = entry.icon;
  const fallbackBody = entry.expandedDescription ?? entry.description;
  const hasStructured = !!entry.sections && entry.sections.length > 0;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="shrink-0 flex items-center justify-between gap-3 px-6 pt-6 pb-4 border-b border-border/60">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center",
              toneBgSoft(entry.tone),
              toneText(entry.tone)
            )}
          >
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">
              {entry.date}
            </p>
            <h2 className="text-[17px] font-semibold tracking-tight leading-tight truncate">
              {entry.title}
            </h2>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="w-8 h-8 rounded-full hover:bg-muted text-foreground/70 hover:text-foreground transition-colors flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-foreground/15"
        >
          <X className="w-4 h-4" />
        </button>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto zoe-scroll px-6 py-6 space-y-6">
        {/* Badge + 1-line description */}
        <section>
          {entry.badge && (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[11px] font-semibold mb-3",
                toneBgSoft(entry.badge.tone),
                toneText(entry.badge.tone)
              )}
            >
              {entry.badge.tone === "mint" && <CheckCircle2 className="w-3 h-3" />}
              {entry.badge.tone === "lilac" && <Briefcase className="w-3 h-3" />}
              {entry.badge.tone === "coral" && <AlertTriangle className="w-3 h-3" />}
              {entry.badge.label}
            </span>
          )}
          {!hasStructured && (
            <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-line">
              {fallbackBody}
            </p>
          )}
          {hasStructured && (
            <p className="text-sm text-foreground/70 leading-relaxed">
              {entry.description}
            </p>
          )}
        </section>

        {/* Structured sections (postvisit.ai-style) */}
        {hasStructured && (
          <section
            aria-label="Visit breakdown"
            className="space-y-2"
          >
            {entry.sections!.map((s) => (
              <SectionRow
                key={s.id}
                entry={entry}
                section={s}
                onAskAbout={onAskAbout}
              />
            ))}
          </section>
        )}

        {/* Legacy fallback: only when not using structured sections */}
        {!hasStructured && entry.labResults && entry.labResults.length > 0 && (
          <LegacyLabTable rows={entry.labResults} />
        )}

        {/* Scans (always shown when present — visual artifacts live outside the section list) */}
        {entry.scans && entry.scans.length > 0 && (
          <section>
            <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground mb-2">
              Scans &amp; Images
            </p>
            <div className="grid grid-cols-2 gap-3">
              {entry.scans.map((scan) => (
                <button
                  key={scan.name}
                  type="button"
                  onClick={() => alert(`Opening ${scan.name}…`)}
                  className="group text-left rounded-xl bg-muted/40 ring-1 ring-foreground/5 overflow-hidden hover:ring-foreground/15 transition-all outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
                >
                  <div className="aspect-[4/3] bg-[color:var(--zoe-sand)] flex items-center justify-center">
                    {scan.src ? (
                      <Image
                        src={scan.src}
                        alt={scan.name}
                        width={220}
                        height={165}
                        className="h-full w-full object-cover"
                        style={{ imageRendering: "pixelated" }}
                        unoptimized
                      />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-foreground/30" />
                    )}
                  </div>
                  <div className="px-3 py-2 flex items-center justify-between">
                    <span className="text-[12px] font-medium truncate">
                      {scan.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                      {scan.type}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Legacy AI Takeaway: only when no structured sections (sections carry their own asks). */}
        {!hasStructured && entry.aiTakeaway && (
          <section className="rounded-2xl bg-[color:var(--zoe-lilac-soft)]/50 ring-1 ring-[color:var(--zoe-lilac)]/15 px-4 py-3.5">
            <p className="text-[11px] font-semibold text-[color:var(--zoe-lilac)] flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" />
              AI Key Takeaway
            </p>
            <p className="text-[13px] text-foreground/80 mt-1.5 leading-relaxed">
              {entry.aiTakeaway}
            </p>
          </section>
        )}

        {/* Attachments */}
        {(entry.attachedDocsLabel || entry.attachedImagesLabel) && (
          <section>
            <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground mb-2">
              Attachments
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {entry.attachedDocsLabel && (
                <AttachmentChip
                  label={entry.attachedDocsLabel}
                  icon={<FileText className="w-3.5 h-3.5" />}
                />
              )}
              {entry.attachedImagesLabel && (
                <AttachmentChip
                  label={entry.attachedImagesLabel}
                  icon={<ImageIcon className="w-3.5 h-3.5" />}
                />
              )}
            </div>
          </section>
        )}

        {/* Action row */}
        {(entry.showViewPdf || entry.hasClinicalNotes) && (
          <div className="flex flex-wrap gap-2">
            {entry.showViewPdf && (
              <button
                type="button"
                onClick={() => alert("Opening PDF…")}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 transition-colors"
              >
                <Eye className="w-4 h-4" />
                View Full Report
              </button>
            )}
            {entry.hasClinicalNotes && (
              <button
                type="button"
                onClick={() => alert("Opening clinical notes…")}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-card ring-1 ring-foreground/10 text-sm font-semibold hover:bg-muted transition-colors"
              >
                <FileText className="w-4 h-4" />
                Clinical Notes
              </button>
            )}
          </div>
        )}

        {/* Ask CTA */}
        <button
          type="button"
          onClick={() =>
            onAskAbout({
              label: entry.title,
              prompt: `Walk me through this entry from ${entry.date}: ${entry.title}. What's clinically relevant for my next visit, and what should I keep an eye on?`,
              surface: "timeline-detail",
            })
          }
          className="group w-full flex items-center justify-between gap-3 h-12 px-5 rounded-2xl bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 transition-colors shadow-[0_8px_22px_-10px_rgba(20,20,40,0.45)] outline-none focus-visible:ring-2 focus-visible:ring-foreground/30"
        >
          <span>Ask Zoe about this</span>
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>

      <footer className="shrink-0 border-t border-border/60 px-6 py-3 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>Entry · {entry.id}</span>
        <span>{entry.date}</span>
      </footer>
    </div>
  );
}

/* ───────── Section row (collapsible, with Ask + Expand) ───────── */

function SectionRow({
  entry,
  section,
  onAskAbout,
}: {
  entry: TimelineEntryDetailData;
  section: DetailSection;
  onAskAbout: (ctx: AskContext) => void;
}) {
  const [open, setOpen] = useState(!!section.defaultOpen);
  const Icon = section.icon;
  const tone = section.tone ?? "lilac";

  const hasExpandable = useMemo(
    () =>
      !!section.body ||
      (section.items && section.items.length > 0) ||
      (section.bullets && section.bullets.length > 0) ||
      (section.labRows && section.labRows.length > 0),
    [section]
  );

  const askPrompt = `In the ${entry.title} from ${entry.date}, walk me through the "${section.title}" section. ${section.summary}`;

  return (
    <div className="rounded-2xl bg-card ring-1 ring-foreground/8 hover:ring-foreground/15 transition-all overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div
          className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
            toneBgSoft(tone),
            toneText(tone)
          )}
          aria-hidden
        >
          <Icon className="w-4 h-4" />
        </div>

        <button
          type="button"
          onClick={() => hasExpandable && setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={`section-body-${section.id}`}
          disabled={!hasExpandable}
          className="flex-1 min-w-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-foreground/15 rounded-md"
        >
          <p className="text-[14px] font-semibold tracking-tight truncate">
            {section.title}
          </p>
          {!open && (
            <p className="text-[12.5px] text-muted-foreground leading-snug line-clamp-1 mt-0.5">
              {section.summary}
            </p>
          )}
        </button>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAskAbout({
                label: `${section.title} — ${entry.title}`,
                prompt: askPrompt,
                surface: "timeline-section",
              });
            }}
            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-[color:var(--zoe-mint-soft)] text-[color:var(--zoe-mint)] hover:brightness-95 text-[11px] font-semibold transition outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--zoe-mint)]/40"
            aria-label={`Ask Zoe about ${section.title}`}
          >
            <CheckCircle2 className="w-3 h-3" />
            Ask
          </button>
          {hasExpandable && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="inline-flex items-center gap-1 h-7 px-2 rounded-full text-[11px] font-semibold text-foreground/60 hover:text-foreground hover:bg-muted/60 transition outline-none focus-visible:ring-2 focus-visible:ring-foreground/15"
              aria-label={open ? `Collapse ${section.title}` : `Expand ${section.title}`}
            >
              <span>{open ? "Collapse" : "Expand"}</span>
              <ChevronDown
                className={cn(
                  "w-3.5 h-3.5 transition-transform",
                  open && "rotate-180"
                )}
              />
            </button>
          )}
        </div>
      </div>

      {/* Expanded body */}
      {open && hasExpandable && (
        <div
          id={`section-body-${section.id}`}
          className="px-4 pb-4 pt-1 space-y-3 border-t border-border/40"
        >
          {section.body && (
            <p className="text-[13px] text-foreground/85 leading-relaxed whitespace-pre-line pt-3">
              {section.body}
            </p>
          )}

          {section.bullets && section.bullets.length > 0 && (
            <ul className="space-y-1.5">
              {section.bullets.map((b, i) => (
                <li
                  key={i}
                  className="flex gap-2 text-[13px] text-foreground/85 leading-relaxed"
                >
                  <span
                    className={cn(
                      "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                      toneBg(tone)
                    )}
                    aria-hidden
                  />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}

          {section.items && section.items.length > 0 && (
            <ol className="space-y-2">
              {section.items.map((item, i) => (
                <li
                  key={i}
                  className="flex gap-3 text-[13px] text-foreground/85 leading-relaxed"
                >
                  <span
                    className={cn(
                      "shrink-0 w-5 h-5 rounded-full text-[11px] font-semibold flex items-center justify-center",
                      toneBgSoft(tone),
                      toneText(tone)
                    )}
                  >
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{item}</span>
                </li>
              ))}
            </ol>
          )}

          {section.labRows && section.labRows.length > 0 && (
            <div className="rounded-xl ring-1 ring-foreground/8 overflow-hidden">
              <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 px-3 py-2 bg-muted/40 text-[10px] uppercase tracking-[0.14em] font-semibold text-muted-foreground">
                <span>Analyte</span>
                <span>Result</span>
                <span>Reference</span>
              </div>
              <div className="divide-y divide-border/60">
                {section.labRows.map((lab) => (
                  <div
                    key={lab.name}
                    className="grid grid-cols-[1fr_auto_auto] gap-x-4 px-3 py-2 items-center"
                  >
                    <span className="text-[12.5px] text-foreground/85">
                      {lab.name}
                    </span>
                    <span
                      className={cn(
                        "text-[12.5px] font-semibold tabular-nums",
                        lab.flag === "high" && "text-[color:var(--zoe-coral)]",
                        lab.flag === "low" && "text-[color:var(--zoe-amber)]",
                        (!lab.flag || lab.flag === "normal") && "text-foreground"
                      )}
                    >
                      {lab.value}
                      <span className="text-[10.5px] text-muted-foreground font-normal ml-1">
                        {lab.unit}
                      </span>
                    </span>
                    <span className="text-[10.5px] text-muted-foreground tabular-nums">
                      {lab.refRange}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ───────── Legacy lab table (when entry has no sections) ───────── */

function LegacyLabTable({ rows }: { rows: LabResult[] }) {
  return (
    <section>
      <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground mb-2">
        Lab Results
      </p>
      <div className="rounded-2xl bg-card ring-1 ring-foreground/8 overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 px-4 py-2.5 bg-muted/40 text-[10px] uppercase tracking-[0.14em] font-semibold text-muted-foreground">
          <span>Analyte</span>
          <span>Result</span>
          <span>Reference</span>
        </div>
        <div className="divide-y divide-border/60">
          {rows.map((lab) => (
            <div
              key={lab.name}
              className="grid grid-cols-[1fr_auto_auto] gap-x-4 px-4 py-2.5 items-center"
            >
              <span className="text-[13px] text-foreground/85">{lab.name}</span>
              <span
                className={cn(
                  "text-[13px] font-semibold tabular-nums",
                  lab.flag === "high" && "text-[color:var(--zoe-coral)]",
                  lab.flag === "low" && "text-[color:var(--zoe-amber)]",
                  (!lab.flag || lab.flag === "normal") && "text-foreground"
                )}
              >
                {lab.value}
                <span className="text-[11px] text-muted-foreground font-normal ml-1">
                  {lab.unit}
                </span>
              </span>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {lab.refRange}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AttachmentChip({
  label,
  icon,
}: {
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => alert(`Opening ${label}…`)}
      className="flex items-center gap-2 rounded-xl bg-muted/50 ring-1 ring-foreground/5 px-3.5 py-2.5 hover:bg-muted transition-colors text-left"
    >
      <span className="w-7 h-7 rounded-lg bg-card ring-1 ring-foreground/10 flex items-center justify-center text-foreground/70">
        {icon}
      </span>
      <span className="text-[12.5px] text-[color:var(--zoe-lilac)] hover:underline truncate">
        {label}
      </span>
    </button>
  );
}

/* ───────── Tone helpers (local copy to avoid coupling) ───────── */

function toneBgSoft(tone: EntryTone) {
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

function toneBg(tone: EntryTone) {
  switch (tone) {
    case "mint":
      return "bg-[color:var(--zoe-mint)]";
    case "lilac":
    case "lilac-dark":
      return "bg-[color:var(--zoe-lilac)]";
    case "amber":
      return "bg-[color:var(--zoe-amber)]";
    case "coral":
      return "bg-[color:var(--zoe-coral)]";
  }
}

function toneText(tone: EntryTone) {
  switch (tone) {
    case "mint":
      return "text-[color:var(--zoe-mint)]";
    case "lilac":
      return "text-[color:var(--zoe-lilac)]";
    case "lilac-dark":
      return "text-foreground";
    case "amber":
      return "text-[color:var(--zoe-amber)]";
    case "coral":
      return "text-[color:var(--zoe-coral)]";
  }
}
