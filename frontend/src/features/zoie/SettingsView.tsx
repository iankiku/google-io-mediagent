"use client";

import { useState } from "react";
import {
  Activity,
  Cloud,
  HeartPulse,
  Plus,
  Shield,
  ShieldCheck,
  User,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { ResponseTone, SettingsState } from "./types";

interface SettingsViewProps {
  state: SettingsState;
  onChange: (state: SettingsState) => void;
  onImportData: () => void;
}

export function SettingsView({ state, onChange, onImportData }: SettingsViewProps) {
  const [savedFlash, setSavedFlash] = useState(false);
  const [profileDraft, setProfileDraft] = useState(state.profile);

  const updateConnections = (patch: Partial<SettingsState["connections"]>) =>
    onChange({ ...state, connections: { ...state.connections, ...patch } });

  const updatePrivacy = (patch: Partial<SettingsState["privacy"]>) =>
    onChange({ ...state, privacy: { ...state.privacy, ...patch } });

  const updateVoice = (patch: Partial<SettingsState["voice"]>) =>
    onChange({ ...state, voice: { ...state.voice, ...patch } });

  const saveProfile = () => {
    onChange({ ...state, profile: profileDraft });
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1600);
  };

  return (
    <div className="relative h-full overflow-y-auto zoie-scroll">
      <span className="zoie-topbar-strip" />
      <div className="px-8 lg:px-12 py-8 mx-auto max-w-[1100px]">
        <header className="flex items-start justify-between gap-6 mb-8">
          <h1 className="text-3xl md:text-[34px] font-semibold tracking-tight">Settings</h1>
          <button
            type="button"
            onClick={onImportData}
            className="inline-flex items-center gap-2 h-9 px-3 rounded-full text-xs font-medium text-foreground/70 hover:text-foreground hover:bg-muted transition-colors"
          >
            <Cloud className="w-4 h-4" />
            Import Data
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Profile */}
          <SettingsCard
            icon={<User className="w-5 h-5" />}
            iconClass="bg-[color:var(--zoie-lilac-soft)] text-[color:var(--zoie-lilac)]"
            title="Profile"
            subtitle="Personal and emergency details"
          >
            <div className="space-y-3 mt-2">
              <FloatingField
                label="Full Name"
                value={profileDraft.fullName}
                onChange={(v) => setProfileDraft({ ...profileDraft, fullName: v })}
              />
              <FloatingField
                label="Emergency Contact"
                value={profileDraft.emergencyContact}
                onChange={(v) =>
                  setProfileDraft({ ...profileDraft, emergencyContact: v })
                }
              />
              <button
                type="button"
                onClick={saveProfile}
                className="inline-flex items-center justify-center h-10 px-4 rounded-xl bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 transition-colors"
              >
                {savedFlash ? "Saved ✓" : "Save Profile"}
              </button>
            </div>
          </SettingsCard>

          {/* Connections */}
          <SettingsCard
            icon={<ShieldCheck className="w-5 h-5" />}
            iconClass="bg-foreground/5 text-foreground"
            title="Connections"
            subtitle="Linked medical portals"
          >
            <div className="space-y-2 mt-2">
              <div className="rounded-xl bg-muted/60 ring-1 ring-foreground/5 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <HeartPulse className="w-4 h-4 text-foreground/70" />
                  <span className="text-sm font-medium">Apple Health</span>
                </div>
                <Switch
                  checked={state.connections.appleHealth}
                  onCheckedChange={(c) => updateConnections({ appleHealth: c })}
                />
              </div>
              <div className="rounded-xl bg-muted/60 ring-1 ring-foreground/5 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Plus className="w-4 h-4 text-foreground/70" />
                  <span className="text-sm font-medium">MyChart</span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    updateConnections({
                      myChartConnected: !state.connections.myChartConnected,
                    })
                  }
                  className={cn(
                    "h-7 px-3 rounded-full text-xs font-semibold transition-colors",
                    state.connections.myChartConnected
                      ? "bg-[color:var(--zoie-mint-soft)] text-[color:var(--zoie-mint)]"
                      : "bg-card ring-1 ring-foreground/15 text-foreground hover:bg-muted"
                  )}
                >
                  {state.connections.myChartConnected ? "Connected" : "Connect"}
                </button>
              </div>
            </div>
          </SettingsCard>

          {/* Privacy & Data */}
          <SettingsCard
            icon={<Shield className="w-5 h-5" />}
            iconClass="bg-foreground/5 text-foreground"
            title="Privacy & Data"
            subtitle="How Zoie learns from you"
          >
            <div className="space-y-2 mt-2">
              <PrivacyRow
                label="Allow Clinical Summaries"
                helper="Let AI scan connected records to generate timeline insights."
                checked={state.privacy.allowClinicalSummaries}
                onCheckedChange={(c) =>
                  updatePrivacy({ allowClinicalSummaries: c })
                }
              />
              <PrivacyRow
                label="De-identified Research"
                helper="Contribute anonymous data to improve medical models."
                checked={state.privacy.deidentifiedResearch}
                onCheckedChange={(c) =>
                  updatePrivacy({ deidentifiedResearch: c })
                }
              />
            </div>
          </SettingsCard>

          {/* Voice Assistant */}
          <SettingsCard
            icon={<Activity className="w-5 h-5" />}
            iconClass="bg-[color:var(--zoie-coral-soft)] text-[color:var(--zoie-coral)]"
            title="Voice Assistant"
            subtitle="Zoie's tone and delivery"
          >
            <div className="space-y-4 mt-2">
              <div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Speaking Rate</span>
                  <span className="text-foreground font-semibold">
                    {state.voice.speakingRate.toFixed(1)}x
                  </span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={2}
                  step={0.1}
                  value={state.voice.speakingRate}
                  onChange={(e) =>
                    updateVoice({ speakingRate: parseFloat(e.target.value) })
                  }
                  className="w-full mt-2 accent-foreground"
                  aria-label="Speaking rate"
                />
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-2">Response Tone</p>
                <div className="grid grid-cols-3 gap-2">
                  {(["Empathetic", "Direct", "Clinical"] as ResponseTone[]).map(
                    (tone) => (
                      <button
                        key={tone}
                        type="button"
                        onClick={() => updateVoice({ tone })}
                        className={cn(
                          "h-10 rounded-xl text-sm font-medium transition-colors",
                          state.voice.tone === tone
                            ? "bg-foreground text-background"
                            : "bg-card ring-1 ring-foreground/10 hover:bg-muted"
                        )}
                      >
                        {tone}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          </SettingsCard>
        </div>
      </div>
    </div>
  );
}

function SettingsCard({
  icon,
  iconClass,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  iconClass: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl bg-card ring-1 ring-foreground/5 shadow-[0_1px_2px_rgba(20,20,40,0.03),0_2px_12px_-6px_rgba(20,20,40,0.06)] p-6">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center",
            iconClass
          )}
        >
          {icon}
        </div>
        <div>
          <h3 className="text-lg font-semibold leading-tight">{title}</h3>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function FloatingField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="rounded-xl bg-card ring-1 ring-foreground/10 px-3.5 py-2 focus-within:ring-2 focus-within:ring-foreground/20 transition-shadow">
      <label className="block text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent outline-none text-sm font-medium mt-0.5"
      />
    </div>
  );
}

function PrivacyRow({
  label,
  helper,
  checked,
  onCheckedChange,
}: {
  label: string;
  helper: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="min-w-0">
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
          {helper}
        </p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
