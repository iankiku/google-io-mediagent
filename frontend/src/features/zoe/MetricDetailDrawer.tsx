"use client";

import { useEffect } from "react";
import {
  Activity,
  ArrowRight,
  Footprints,
  Heart,
  HeartPulse,
  Moon,
  Thermometer,
  Waves,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MetricBarChart } from "./MetricBarChart";
import type { MetricDetail, MetricId, MetricTone } from "./metric-detail";

const METRIC_ICONS: Record<MetricId, LucideIcon> = {
  hrv: HeartPulse,
  "resting-hr": Heart,
  sleep: Moon,
  "basal-temp": Thermometer,
  respiratory: Waves,
  steps: Footprints,
  ecg: Activity,
};

interface MetricDetailDrawerProps {
  metric: MetricDetail | null;
  onClose: () => void;
  onAskZoe: (metric: MetricDetail) => void;
}

const TONE_SOFT_BG: Record<MetricTone, string> = {
  lilac: "bg-[color:var(--zoe-lilac-soft)] text-[color:var(--zoe-lilac)]",
  mint: "bg-[color:var(--zoe-mint-soft)] text-[color:var(--zoe-mint)]",
  coral: "bg-[color:var(--zoe-coral-soft)] text-[color:var(--zoe-coral)]",
  amber: "bg-[color:var(--zoe-amber-soft)] text-[color:var(--zoe-amber)]",
};

const TONE_DELTA_CHIP: Record<MetricTone, string> = {
  lilac: "bg-[color:var(--zoe-lilac-soft)] text-[color:var(--zoe-lilac)]",
  mint: "bg-[color:var(--zoe-mint-soft)] text-[color:var(--zoe-mint)]",
  coral: "bg-[color:var(--zoe-coral-soft)] text-[color:var(--zoe-coral)]",
  amber: "bg-[color:var(--zoe-amber-soft)] text-[color:var(--zoe-amber)]",
};

export function MetricDetailDrawer({
  metric,
  onClose,
  onAskZoe,
}: MetricDetailDrawerProps) {
  // close on Escape
  useEffect(() => {
    if (!metric) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [metric, onClose]);

  const open = metric !== null;

  return (
    <>
      {/* Scrim */}
      <button
        type="button"
        aria-label="Close detail"
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-30 bg-foreground/15 backdrop-blur-[2px] transition-opacity duration-300",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      />
      {/* Drawer */}
      <aside
        aria-hidden={!open}
        role="dialog"
        aria-label={metric ? `${metric.name} detail` : undefined}
        className={cn(
          "fixed right-0 top-0 z-40 h-full w-full sm:w-[520px] bg-card border-l border-border shadow-[0_30px_60px_-20px_rgba(20,20,40,0.25)] transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {metric && <DrawerBody metric={metric} onClose={onClose} onAskZoe={onAskZoe} />}
      </aside>
    </>
  );
}

function DrawerBody({
  metric,
  onClose,
  onAskZoe,
}: {
  metric: MetricDetail;
  onClose: () => void;
  onAskZoe: (metric: MetricDetail) => void;
}) {
  const Icon = METRIC_ICONS[metric.id];
  const fmt = metric.valueFormatter ?? ((n: number) => String(n));
  const deltaSign = metric.deltaPct > 0 ? "+" : metric.deltaPct < 0 ? "" : "";
  const deltaTone =
    metric.deltaPct > 0
      ? metric.tone
      : metric.deltaPct < 0
      ? ("coral" as MetricTone)
      : ("lilac" as MetricTone);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="shrink-0 flex items-center justify-between gap-3 px-6 pt-6 pb-4 border-b border-border/60">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center",
              TONE_SOFT_BG[metric.tone]
            )}
          >
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">
              Clinical detail
            </p>
            <h2 className="text-[17px] font-semibold tracking-tight leading-tight truncate">
              {metric.name}
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={cn(
              "hidden sm:inline-flex items-center h-7 px-2.5 rounded-full text-[11px] font-semibold",
              TONE_DELTA_CHIP[deltaTone]
            )}
          >
            {metric.deltaPct === 0
              ? "Flat"
              : `${deltaSign}${metric.deltaPct}% vs avg`}
          </span>
          <span className="hidden sm:inline-flex items-center h-7 px-2.5 rounded-full text-[11px] font-medium bg-muted text-foreground/70">
            7d
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full hover:bg-muted text-foreground/70 hover:text-foreground transition-colors flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-foreground/15"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto zoe-scroll px-6 py-6 space-y-6">
        {/* Hero value */}
        <section>
          <div className="flex items-end gap-3">
            <p className="text-[48px] font-semibold leading-none tracking-tight">
              {fmt(metric.current)}
            </p>
            <p className="pb-1.5 text-sm text-muted-foreground">{metric.unit}</p>
          </div>
          <p className="mt-2 text-xs text-foreground/70">
            7-day average <span className="font-semibold">{fmt(metric.average)} {metric.unit}</span>
            {metric.deltaPct !== 0 && (
              <>
                <span className="mx-1.5 text-foreground/30">·</span>
                <span
                  className={cn(
                    "font-semibold",
                    metric.deltaPct > 0
                      ? "text-[color:var(--zoe-mint)]"
                      : "text-[color:var(--zoe-coral)]"
                  )}
                >
                  {deltaSign}
                  {metric.deltaPct}% week-over-week
                </span>
              </>
            )}
          </p>
        </section>

        {/* Chart */}
        <section className="rounded-2xl bg-muted/40 ring-1 ring-foreground/5 px-4 pt-5 pb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] uppercase tracking-[0.16em] font-semibold text-muted-foreground">
              Last 7 days
            </p>
            <p className="text-[11px] text-muted-foreground">
              hover a bar for daily detail
            </p>
          </div>
          <MetricBarChart detail={metric} />
        </section>

        {/* Clinical-ready summary block */}
        <section className="rounded-2xl bg-card ring-1 ring-foreground/8 px-5 py-4">
          <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">
            Clinical-ready summary
          </p>
          <p className="mt-2 text-sm text-foreground/85 leading-relaxed">
            {summaryParagraph(metric)}
          </p>
        </section>

        {/* Ask CTA */}
        <button
          type="button"
          onClick={() => onAskZoe(metric)}
          className="group w-full flex items-center justify-between gap-3 h-12 px-5 rounded-2xl bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 transition-colors shadow-[0_8px_22px_-10px_rgba(20,20,40,0.45)] outline-none focus-visible:ring-2 focus-visible:ring-foreground/30"
        >
          <span>Ask Zoe about this</span>
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>

      {/* Footer meta */}
      <footer className="shrink-0 border-t border-border/60 px-6 py-3 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>Source · {metric.source}</span>
        <span>{metric.updatedAgo}</span>
      </footer>
    </div>
  );
}

function summaryParagraph(metric: MetricDetail): string {
  const fmt = metric.valueFormatter ?? ((n: number) => String(n));
  const direction =
    metric.deltaPct > 0
      ? "trending upward"
      : metric.deltaPct < 0
      ? "trending downward"
      : "holding steady";
  const valueLine = `${fmt(metric.current)} ${metric.unit} — ${direction} versus a 7-day average of ${fmt(metric.average)} ${metric.unit}.`;

  switch (metric.id) {
    case "hrv":
      return `${valueLine} HRV improvements like this typically reflect better autonomic recovery — worth flagging at your next visit if you're tracking stress or training load.`;
    case "resting-hr":
      return `${valueLine} A downward drift in resting HR usually points to improved cardiovascular fitness, but bring any sustained outliers to your physician.`;
    case "sleep":
      return `${valueLine} Sleep duration above your 30-day baseline correlates with better recovery scores — see the timeline for any contributing entries.`;
    case "basal-temp":
      return `${valueLine} Small overnight skin-temperature deviations are normal; flag larger sustained shifts during your next consultation.`;
    case "respiratory":
      return `${valueLine} Stable respiratory rate during sleep is a positive recovery signal.`;
    case "steps":
      return `${valueLine} Daily step counts above your average correlate with better cardiovascular and metabolic markers in your record.`;
    case "ecg":
      return `${valueLine} Rhythm classified as sinus across all recent readings. Share the underlying ECG strip with your cardiologist if you want a closer review.`;
    default:
      return valueLine;
  }
}
