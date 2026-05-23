"use client";

import { useCallback, useMemo, useState } from "react";
import { Sidebar } from "@/features/zoie/Sidebar";
import { TalkView } from "@/features/zoie/TalkView";
import { InsightsView } from "@/features/zoie/InsightsView";
import { MedicalTimelineView } from "@/features/zoie/MedicalTimelineView";
import { SettingsView } from "@/features/zoie/SettingsView";
import type { SettingsState, VitalsState, ZoieView } from "@/features/zoie/types";

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
  const [view, setView] = useState<ZoieView>("talk");
  const [settings, setSettings] = useState<SettingsState>(INITIAL_SETTINGS);
  const [vitals, setVitals] = useState<VitalsState>(INITIAL_VITALS);

  const handleImportData = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,.png,.jpg,.jpeg,.txt,.csv";
    input.multiple = true;
    input.onchange = () => {
      const count = input.files?.length ?? 0;
      if (count > 0) {
        alert(`Imported ${count} file${count === 1 ? "" : "s"}. Zoie will process them shortly.`);
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
          />
        );
      case "timeline":
        return <MedicalTimelineView onImportData={handleImportData} />;
      case "settings":
        return (
          <SettingsView
            state={settings}
            onChange={setSettings}
            onImportData={handleImportData}
          />
        );
    }
  }, [view, vitals, handleImportData, settings]);

  return (
    <div className="flex h-screen w-screen bg-background text-foreground overflow-hidden">
      <Sidebar active={view} onChange={setView} />
      <main className="flex-1 h-full overflow-hidden bg-background">
        {content}
      </main>
    </div>
  );
}
