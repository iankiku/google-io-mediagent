"use client";

import { useCallback, useMemo, useState } from "react";
import { Sidebar } from "@/features/zoe/Sidebar";
import { TalkView } from "@/features/zoe/TalkView";
import { InsightsView } from "@/features/zoe/InsightsView";
import { MedicalTimelineView } from "@/features/zoe/MedicalTimelineView";
import { SettingsView } from "@/features/zoe/SettingsView";
import { AskZoePopup, type AskContext } from "@/features/zoe/AskZoePopup";
import type { SettingsState, VitalsState, ZoeView } from "@/features/zoe/types";

const INITIAL_SETTINGS: SettingsState = {
  profile: {
    fullName: "Jane Doe",
    emergencyContact: "+1 (555) 019-2834",
  },
  connections: {
    appleHealth: true,
    myChartConnected: false,
  },
  privacy: {
    allowClinicalSummaries: true,
    deidentifiedResearch: false,
  },
  voice: {
    speakingRate: 1.0,
    tone: "Empathetic",
  },
};

const INITIAL_VITALS: VitalsState = {
  irregularRhythm: false,
};

export default function Page() {
  const [view, setView] = useState<ZoeView>("talk");
  const [settings, setSettings] = useState<SettingsState>(INITIAL_SETTINGS);
  const [vitals, setVitals] = useState<VitalsState>(INITIAL_VITALS);

  const [askContext, setAskContext] = useState<AskContext | null>(null);
  const [askOpen, setAskOpen] = useState(false);

  const askAbout = useCallback((ctx: AskContext) => {
    setAskContext(ctx);
    setAskOpen(true);
  }, []);

  const handleImportData = useCallback(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,.png,.jpg,.jpeg,.txt,.csv";
    input.multiple = true;
    input.onchange = async () => {
      const files = input.files;
      if (!files || files.length === 0) return;
      for (let i = 0; i < files.length; i++) {
        const form = new FormData();
        form.append("user_id", "demo-patient-uuid-001");
        form.append("file", files[i]);
        try {
          const res = await fetch(`${apiBase}/api/ingest/upload`, { method: "POST", body: form });
          if (res.ok) {
            const data = await res.json();
            alert(`✅ ${files[i].name} processed and saved to your health record.`);
          } else {
            alert(`❌ Failed to process ${files[i].name}`);
          }
        } catch {
          alert(`❌ Could not connect to Zoie backend for ${files[i].name}`);
        }
      }
    };
    input.click();
  }, []);

  const content = useMemo(() => {
    switch (view) {
      case "talk":
        return <TalkView tone={settings.voice.tone} />;
      case "insights":
        return (
          <InsightsView
            irregularRhythm={vitals.irregularRhythm}
            onToggleAlert={() =>
              setVitals((v) => ({ ...v, irregularRhythm: !v.irregularRhythm }))
            }
            onImportData={handleImportData}
            onAskAbout={askAbout}
          />
        );
      case "timeline":
        return (
          <MedicalTimelineView
            onImportData={handleImportData}
            onAskAbout={askAbout}
          />
        );
      case "settings":
        return (
          <SettingsView
            state={settings}
            onChange={setSettings}
            onImportData={handleImportData}
          />
        );
    }
  }, [view, vitals, handleImportData, settings, askAbout]);

  // FAB is hidden on Talk because Talk is itself the primary chat surface.
  const showAsk = view !== "talk";

  return (
    <div className="flex h-screen w-screen bg-background text-foreground overflow-hidden">
      <Sidebar active={view} onChange={setView} />
      <main className="flex-1 h-full overflow-hidden bg-background">
        {content}
      </main>

      {showAsk && (
        <AskZoePopup
          tone={settings.voice.tone}
          context={askContext}
          open={askOpen}
          onOpenChange={(o) => {
            setAskOpen(o);
            if (!o) setAskContext(null);
          }}
          onContextConsumed={() => setAskContext((c) => c)}
        />
      )}
    </div>
  );
}
