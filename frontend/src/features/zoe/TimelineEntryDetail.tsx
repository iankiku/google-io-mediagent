"use client";

import { useEffect } from "react";
import Image from "next/image";
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  CheckCircle2,
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
          "fixed right-0 top-0 z-40 h-full w-full sm:w-[560px] bg-card border-l border-border shadow-[0_30px_60px_-20px_rgba(20,20,40,0.25)] transition-transform duration-300 ease-out",
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
  const body = entry.expandedDescription ?? entry.description;

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
        {/* Badge + description */}
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
          <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-line">
            {body}
          </p>
        </section>

        {/* Lab results */}
        {entry.labResults && entry.labResults.length > 0 && (
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
                {entry.labResults.map((lab) => (
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
        )}

        {/* Scans */}
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

        {/* AI Takeaway */}
        {entry.aiTakeaway && (
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
