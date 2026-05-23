"use client";

import {
  AssistantRuntimeProvider,
  useLocalRuntime,
  type AssistantRuntime,
} from "@assistant-ui/react";
import { useMemo, type ReactNode } from "react";
import { createZoieChatAdapter } from "./zoie-chat-adapter";
import { ZOIE_INITIAL_MESSAGES } from "./zoie-initial-messages";
import type { SettingsState } from "./types";

function useZoieRuntime(tone: SettingsState["voice"]["tone"]): AssistantRuntime {
  const adapter = useMemo(() => createZoieChatAdapter(tone), [tone]);
  return useLocalRuntime(adapter, {
    initialMessages: ZOIE_INITIAL_MESSAGES,
  });
}

export function ZoieAssistantProvider({
  tone,
  children,
}: {
  tone: SettingsState["voice"]["tone"];
  children: ReactNode;
}) {
  const runtime = useZoieRuntime(tone);
  return (
    <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>
  );
}
