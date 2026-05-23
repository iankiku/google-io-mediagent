"use client";

import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  ChevronRight,
  Footprints,
  Heart,
  Moon,
  Phone,
  Send,
  Sparkles,
  Thermometer,
  TrendingUp,
  Upload,
  Utensils,
  Watch,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface InsightsViewProps {
  irregularRhythm: boolean;
  onToggleAlert: () => void;
  onImportData: () => void;
}

export function InsightsView({ irregularRhythm, onToggleAlert, onImportData }: InsightsViewProps) {
  return (
    <div className="h-full overflow-y-auto zoie-scroll">
      <div className="px-8 lg:px-12 py-8 mx-auto max-w-[1100px]">
        <header className="flex items-start justify-between gap-6 mb-8">
          <div>
            <h1 className="text-3xl md:text-[34px] font-semibold tracking-tight leading-tight">
              {irregularRhythm ? "Vitals & Alerts" : "Your Insights"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {irregularRhythm
                ? "Real-time telemetry and clinical insights from your connected devices."
                : "AI-extracted patterns from your recent health logs."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleAlert}
              className="hidden md:inline-flex items-center h-9 px-3 rounded-full text-xs font-medium text-foreground/70 hover:text-foreground hover:bg-muted transition-colors"
              title="Demo: toggle alert state"
            >
              {irregularRhythm ? "Clear Alert" : "Simulate Alert"}
            </button>
            <button
              type="button"
              onClick={onImportData}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors shadow-[0_2px_8px_-2px_rgba(20,20,40,0.18)]"
            >
              <Upload className="w-4 h-4" />
              Import Data
            </button>
          </div>
        </header>

        {irregularRhythm ? (
          <VitalsAlertContent />
        ) : (
          <InsightsContent />
        )}
      </div>
    </div>
  );
}

/* ------------------------------- Default Insights ------------------------------- */

function InsightsContent() {
  const [proteinPct, setProteinPct] = useState(78);
  const [hydrationPct, setHydrationPct] = useState(46);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* Nutrition Insights */}
      <ZoieCard className="lg:col-span-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <IconBadge className="bg-[color:var(--zoie-mint-soft)] text-[color:var(--zoie-mint)]">
              <Utensils className="w-5 h-5" />
            </IconBadge>
            <h3 className="text-lg font-semibold">Nutrition Insights</h3>
          </div>
          <StatusBadge tone="mint">Optimal</StatusBadge>
        </div>
        <p className="text-sm text-foreground/75 leading-relaxed mt-4">
          Your recent protein intake correlates positively with improved morning
          energy levels. AI suggests maintaining the current macro balance.
        </p>

        <div className="mt-8 space-y-4">
          <MetricBar
            label="Protein Synthesis Indicator"
            value={proteinPct}
            valueLabel="Excellent"
            color="mint"
            onClick={() => setProteinPct((p) => (p >= 95 ? 60 : p + 7))}
          />
          <MetricBar
            label="Hydration Consistency"
            value={hydrationPct}
            valueLabel="Needs Focus"
            color="amber"
            onClick={() => setHydrationPct((p) => (p >= 90 ? 40 : p + 8))}
          />
        </div>
      </ZoieCard>

      {/* Heart Health */}
      <ZoieCard>
        <div className="flex items-center gap-3">
          <IconBadge className="bg-[color:var(--zoie-coral-soft)] text-[color:var(--zoie-coral)]">
            <Heart className="w-5 h-5" />
          </IconBadge>
          <h3 className="text-lg font-semibold">Heart Health</h3>
        </div>

        <div className="mt-4 space-y-2.5">
          <SubMetricCard
            label="HRV (Heart Rate Variability)"
            value={
              <>
                <span className="text-[22px] font-semibold">48</span>
                <span className="text-xs text-muted-foreground ml-1">ms</span>
                <span className="text-xs text-[color:var(--zoie-mint)] font-semibold ml-2">+5%</span>
              </>
            }
          />
          <SubMetricCard
            label="Resting Heart Rate"
            value={
              <>
                <span className="text-[22px] font-semibold">62</span>
                <span className="text-xs text-muted-foreground ml-1">bpm</span>
              </>
            }
          />
          <SubMetricCard
            label="ECG Log"
            value={<span className="font-semibold">Sinus Rhythm</span>}
            action={<ChevronRight className="w-4 h-4 text-muted-foreground" />}
            interactive
          />
          <p className="text-[11px] text-muted-foreground mt-2">
            Data processed from Apple HealthKit.
          </p>
        </div>
      </ZoieCard>

      {/* Connected Devices */}
      <ZoieCard className="lg:col-span-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <IconBadge className="bg-[color:var(--zoie-lilac-soft)] text-[color:var(--zoie-lilac)]">
              <Watch className="w-5 h-5" />
            </IconBadge>
            <h3 className="text-lg font-semibold">Wearable Activity Data</h3>
          </div>
          <button
            type="button"
            onClick={() => alert("Manage Devices — coming soon")}
            className="text-xs h-9 px-3 rounded-xl border border-border bg-card hover:bg-muted transition-colors font-medium leading-tight text-center"
          >
            Manage<br />Devices
          </button>
        </div>

        <div className="mt-4 rounded-xl bg-muted/60 ring-1 ring-foreground/5 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-card ring-1 ring-foreground/10 flex items-center justify-center">
              <Watch className="w-4 h-4 text-foreground/80" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight">Apple Watch Series 9</p>
              <p className="text-xs text-muted-foreground">Last synced: 2 minutes ago</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-foreground/70">
            <span className="w-2 h-2 rounded-full bg-[color:var(--zoie-mint)]" />
            Connected
          </div>
        </div>
      </ZoieCard>

      {/* Activity Stats */}
      <ZoieCard className="lg:col-span-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <IconBadge className="bg-[color:var(--zoie-coral-soft)] text-[color:var(--zoie-coral)]">
              <Activity className="w-5 h-5" />
            </IconBadge>
            <h3 className="text-lg font-semibold">Wearable Activity Data</h3>
          </div>
          <button
            type="button"
            onClick={() => alert("Full report — coming soon")}
            className="text-xs h-9 px-3 rounded-xl border border-border bg-card hover:bg-muted transition-colors font-medium leading-tight text-center"
          >
            View Full<br />Report
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatTile icon={Footprints} label="Avg Daily Steps" value="8,432" />
          <StatTile icon={Heart} label="Resting HR" value="62" suffix="bpm" />
          <StatTile icon={Moon} label="Sleep Quality" value="7.2" suffix="hrs" />
          <StatTile
            icon={TrendingUp}
            label="Overall Trend"
            value="+12%"
            suffix="v last week"
            highlight
          />
        </div>
      </ZoieCard>
    </div>
  );
}

/* ------------------------------- Vitals & Alerts ------------------------------- */

function VitalsAlertContent() {
  return (
    <div className="space-y-5">
      {/* Big alert */}
      <div className="rounded-3xl bg-[color:var(--zoie-coral)] text-white px-7 py-6 shadow-[0_12px_30px_-12px_rgba(220,60,60,0.45)]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <h2 className="text-2xl md:text-[26px] font-semibold leading-tight">
            Irregular Rhythm Detected
          </h2>
        </div>
        <p className="text-sm md:text-[13.5px] text-white/90 mt-3 leading-relaxed">
          Your Apple Watch detected a sustained heart rate of 112 BPM while inactive for 10 minutes,
          with patterns consistent with AFib.
        </p>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => alert("Dialing your clinic…")}
            className="flex items-center justify-center gap-2 h-11 rounded-2xl bg-white text-[color:var(--zoie-coral)] font-semibold text-sm hover:bg-white/90 transition-colors"
          >
            <Phone className="w-4 h-4" />
            Call Clinic
          </button>
          <button
            type="button"
            onClick={() => alert("Telemetry shared with your care team.")}
            className="flex items-center justify-center gap-2 h-11 rounded-2xl bg-black/20 text-white font-semibold text-sm hover:bg-black/30 transition-colors"
          >
            <Send className="w-4 h-4" />
            Share Telemetry
          </button>
        </div>

        <div className="mt-5 rounded-2xl bg-black/60 px-5 py-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.14em] text-white/60 font-semibold">
              Clinical Protocol
            </p>
            <ul className="mt-2 space-y-1.5 text-[13px] text-white/90">
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-white/80" /> Remain seated and rest for 15 mins
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-white/80" /> Perform a manual ECG on Watch
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-white/80" /> Ensure you are well hydrated
              </li>
            </ul>
          </div>
          <div className="flex items-center gap-3 md:border-l md:border-white/10 md:pl-5">
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center font-semibold">
              AP
            </div>
            <div>
              <p className="text-sm font-semibold">Dr. Aris Patel</p>
              <p className="text-xs text-white/70">Cardiologist on call</p>
            </div>
          </div>
        </div>
      </div>

      {/* Three vitals cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ZoieCard>
          <div className="flex items-center gap-3">
            <IconBadge className="bg-[color:var(--zoie-coral-soft)] text-[color:var(--zoie-coral)]">
              <Heart className="w-5 h-5" />
            </IconBadge>
            <h3 className="text-base font-semibold leading-tight">
              Cardiovascular
              <br />
              Resilience
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mt-4 mb-2">HRV Trend (7 days)</p>
          <Sparkline color="oklch(0.62 0.13 165)" />
          <div className="mt-5 rounded-xl bg-muted/60 ring-1 ring-foreground/5 p-3">
            <p className="text-[11px] font-semibold text-foreground/70 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" />
              AI Analysis
            </p>
            <p className="text-xs text-foreground/75 mt-1 leading-relaxed">
              Your HRV is 64ms, showing a slight recovery trend compared to early week baseline.
            </p>
          </div>
        </ZoieCard>

        <ZoieCard>
          <div className="flex items-center gap-3">
            <IconBadge className="bg-[color:var(--zoie-lilac-soft)] text-[color:var(--zoie-lilac)]">
              <Moon className="w-5 h-5" />
            </IconBadge>
            <h3 className="text-base font-semibold leading-tight">
              Autonomic
              <br />
              Recovery
            </h3>
          </div>
          <div className="mt-4 space-y-3">
            <div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Sleep Stages</span>
                <span className="font-semibold">7.2h total</span>
              </div>
              <div className="mt-1.5 flex h-2 rounded-full overflow-hidden bg-muted">
                <div className="w-[18%] bg-[color:var(--zoie-lilac)]/70" />
                <div className="w-[42%] bg-[color:var(--zoie-lilac)]" />
                <div className="w-[40%] bg-[color:var(--zoie-lilac)]/40" />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Respiratory Rate</span>
                <span className="font-semibold">14 bpm</span>
              </div>
              <div className="mt-1.5 h-2 rounded-full overflow-hidden bg-muted">
                <div className="h-full w-[65%] bg-[color:var(--zoie-mint)]" />
              </div>
            </div>
          </div>
          <div className="mt-5 rounded-xl bg-muted/60 ring-1 ring-foreground/5 p-3">
            <p className="text-[11px] font-semibold text-foreground/70 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" />
              AI Analysis
            </p>
            <p className="text-xs text-foreground/75 mt-1 leading-relaxed">
              Respiratory rate stable during deep sleep phases, indicating good restorative load.
            </p>
          </div>
        </ZoieCard>

        <ZoieCard>
          <div className="flex items-center gap-3">
            <IconBadge className="bg-[color:var(--zoie-amber-soft)] text-[color:var(--zoie-amber)]">
              <Thermometer className="w-5 h-5" />
            </IconBadge>
            <h3 className="text-base font-semibold leading-tight">Basal Variations</h3>
          </div>
          <div className="mt-4 flex flex-col items-center">
            <p className="text-[40px] font-semibold leading-none tracking-tight">−0.2°F</p>
            <p className="text-xs text-muted-foreground mt-1">Deviation from baseline</p>
            <div className="w-full mt-4 h-1.5 rounded-full bg-muted relative">
              <div
                className="absolute top-1/2 -translate-y-1/2 w-1 h-3 rounded-sm bg-[color:var(--zoie-amber)]"
                style={{ left: "40%" }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-px h-3 bg-foreground/30"
                style={{ left: "50%" }}
              />
            </div>
          </div>
          <div className="mt-5 rounded-xl bg-muted/60 ring-1 ring-foreground/5 p-3">
            <p className="text-[11px] font-semibold text-foreground/70 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" />
              AI Analysis
            </p>
            <p className="text-xs text-foreground/75 mt-1 leading-relaxed">
              Skin temp dropped by 0.2F from baseline overnight, normal fluctuation.
            </p>
          </div>
        </ZoieCard>
      </div>

      {/* Active Telemetry Sources */}
      <ZoieCard>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <IconBadge className="bg-[color:var(--zoie-lilac-soft)] text-[color:var(--zoie-lilac)]">
              <Watch className="w-5 h-5" />
            </IconBadge>
            <h3 className="text-lg font-semibold">Active Telemetry Sources</h3>
          </div>
          <button
            type="button"
            onClick={() => alert("Manage Devices — coming soon")}
            className="text-xs h-9 px-3 rounded-xl border border-border bg-card hover:bg-muted transition-colors font-medium leading-tight text-center"
          >
            Manage<br />Devices
          </button>
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <TelemetrySource
            icon={<Watch className="w-4 h-4" />}
            name="Apple Watch Series 9"
            synced="Last synced: Just now"
            status="live"
          />
          <TelemetrySource
            icon={<Activity className="w-4 h-4" />}
            name="Withings BPM Connect"
            synced="Last synced: 4 hours ago"
            status="standby"
          />
        </div>
      </ZoieCard>
    </div>
  );
}

/* ------------------------------- Shared atoms ------------------------------- */

function ZoieCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-3xl bg-card ring-1 ring-foreground/5 shadow-[0_1px_2px_rgba(20,20,40,0.03),0_2px_12px_-6px_rgba(20,20,40,0.06)] p-6",
        className
      )}
    >
      {children}
    </div>
  );
}

function IconBadge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "w-10 h-10 rounded-full flex items-center justify-center",
        className
      )}
    >
      {children}
    </div>
  );
}

function StatusBadge({
  tone,
  children,
}: {
  tone: "mint" | "amber" | "coral" | "lilac";
  children: React.ReactNode;
}) {
  const toneMap: Record<typeof tone, string> = {
    mint: "bg-[color:var(--zoie-mint-soft)] text-[color:var(--zoie-mint)]",
    amber: "bg-[color:var(--zoie-amber-soft)] text-[color:var(--zoie-amber)]",
    coral: "bg-[color:var(--zoie-coral-soft)] text-[color:var(--zoie-coral)]",
    lilac: "bg-[color:var(--zoie-lilac-soft)] text-[color:var(--zoie-lilac)]",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-xs font-semibold",
        toneMap[tone]
      )}
    >
      {children}
    </span>
  );
}

function MetricBar({
  label,
  value,
  valueLabel,
  color,
  onClick,
}: {
  label: string;
  value: number;
  valueLabel: string;
  color: "mint" | "amber";
  onClick?: () => void;
}) {
  const fillClass =
    color === "mint"
      ? "bg-[color:var(--zoie-mint)]"
      : "bg-[color:var(--zoie-amber)]";
  const textClass =
    color === "mint"
      ? "text-[color:var(--zoie-mint)]"
      : "text-[color:var(--zoie-amber)]";
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn("cursor-pointer select-none", !onClick && "cursor-default")}
      title={onClick ? "Click to refresh sample" : undefined}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-foreground/80">{label}</span>
        <span className={cn("text-xs font-semibold", textClass)}>{valueLabel}</span>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", fillClass)}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function SubMetricCard({
  label,
  value,
  action,
  interactive,
}: {
  label: string;
  value: React.ReactNode;
  action?: React.ReactNode;
  interactive?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl bg-muted/60 ring-1 ring-foreground/5 px-3.5 py-2.5 flex items-center justify-between",
        interactive && "cursor-pointer hover:bg-muted transition-colors"
      )}
      onClick={interactive ? () => alert("Opening ECG log…") : undefined}
    >
      <div className="leading-tight">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="text-foreground mt-0.5">{value}</p>
      </div>
      {action}
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  suffix,
  highlight,
}: {
  icon: typeof Heart;
  label: string;
  value: string;
  suffix?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl p-4 ring-1 transition-colors",
        highlight
          ? "bg-[color:var(--zoie-mint-soft)]/70 ring-[color:var(--zoie-mint)]/30"
          : "bg-muted/50 ring-foreground/5"
      )}
    >
      <Icon
        className={cn(
          "w-4 h-4",
          highlight ? "text-[color:var(--zoie-mint)]" : "text-foreground/70"
        )}
      />
      <p className="text-[11px] text-muted-foreground mt-2">{label}</p>
      <p
        className={cn(
          "mt-1 leading-none",
          highlight ? "text-[color:var(--zoie-mint)] text-[22px] font-semibold" : "text-foreground"
        )}
      >
        {!highlight && <span className="text-[22px] font-semibold">{value}</span>}
        {highlight && value}
        {suffix && (
          <span className="text-xs text-muted-foreground ml-1 font-normal">
            {suffix}
          </span>
        )}
      </p>
    </div>
  );
}

function Sparkline({ color }: { color: string }) {
  // Simple polyline sparkline
  return (
    <svg viewBox="0 0 120 36" className="w-full h-12">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points="2,28 14,22 26,24 38,18 50,20 62,14 74,16 86,10 98,12 118,6"
      />
    </svg>
  );
}

function TelemetrySource({
  icon,
  name,
  synced,
  status,
}: {
  icon: React.ReactNode;
  name: string;
  synced: string;
  status: "live" | "standby";
}) {
  const dotClass =
    status === "live"
      ? "bg-[color:var(--zoie-mint)]"
      : "bg-foreground/30";
  return (
    <div className="rounded-xl bg-muted/60 ring-1 ring-foreground/5 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-card ring-1 ring-foreground/10 flex items-center justify-center text-foreground/80">
          {icon}
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight">{name}</p>
          <p className="text-xs text-muted-foreground">{synced}</p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-foreground/70 capitalize">
        <span className={cn("w-2 h-2 rounded-full", dotClass)} />
        {status}
      </div>
    </div>
  );
}
