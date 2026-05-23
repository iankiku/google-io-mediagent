"use client";

import {
  AssistantRuntimeProvider,
  useLocalRuntime,
  type AssistantRuntime,
} from "@assistant-ui/react";
import { useMemo, type ReactNode } from "react";
import { createZoeChatAdapter } from "./zoe-chat-adapter";
import { zoeSuggestionAdapter } from "./zoe-suggestions";
import type { SettingsState } from "./types";

function useZoeRuntime(tone: SettingsState["voice"]["tone"]): AssistantRuntime {
  const adapter = useMemo(() => createZoeChatAdapter(tone), [tone]);
  return useLocalRuntime(adapter, {
    initialMessages: [],
    adapters: {
      suggestion: zoeSuggestionAdapter,
    },
  });
}

export function ZoeAssistantProvider({
  tone,
  children,
}: {
  tone: SettingsState["voice"]["tone"];
  children: ReactNode;
}) {
  const runtime = useZoeRuntime(tone);
  return (
    <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>
  );
}
