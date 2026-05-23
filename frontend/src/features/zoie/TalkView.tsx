"use client";

import { useCallback, useState } from "react";
import { useAui } from "@assistant-ui/react";
import { Thread } from "@/components/thread";
import { ZoieAssistantProvider } from "./ZoieAssistantProvider";
import { ZoieTalkProvider } from "./ZoieTalkContext";
import type { SettingsState } from "./types";

interface TalkViewProps {
  tone: SettingsState["voice"]["tone"];
}

export function TalkView({ tone }: TalkViewProps) {
  return (
    <ZoieAssistantProvider tone={tone}>
      <TalkViewContent />
    </ZoieAssistantProvider>
  );
}

function TalkViewContent() {
  const [listening, setListening] = useState(false);
  const aui = useAui();

  const onOrbTap = useCallback(() => {
    if (listening) {
      setListening(false);
      return;
    }
    setListening(true);
    window.setTimeout(() => {
      setListening(false);
      aui.thread().append({
        role: "user",
        content: [
          {
            type: "text",
            text: "How am I doing today based on my recent sleep and activity data?",
          },
        ],
      });
    }, 1400);
  }, [listening, aui]);

  return (
    <ZoieTalkProvider value={{ listening, onOrbTap }}>
      <div className="relative h-full w-full">
        <Thread />
      </div>
    </ZoieTalkProvider>
  );
}
