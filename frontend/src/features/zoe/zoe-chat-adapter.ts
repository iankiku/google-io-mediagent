import type { ChatModelAdapter } from "@assistant-ui/react";
import { craftReply } from "./craft-reply";
import type { SettingsState } from "./types";

function getLastUserText(
  messages: Parameters<ChatModelAdapter["run"]>[0]["messages"],
): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== "user") continue;
    return message.content
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n")
      .trim();
  }
  return "";
}

export function createZoeChatAdapter(
  tone: SettingsState["voice"]["tone"],
): ChatModelAdapter {
  return {
    async *run({ messages, abortSignal }) {
      const prompt = getLastUserText(messages);
      const reply = craftReply(prompt, tone);

      const chunkSize = 4;
      const delayMs = 14;

      for (let i = chunkSize; i <= reply.length; i += chunkSize) {
        if (abortSignal.aborted) return;
        yield {
          content: [{ type: "text", text: reply.slice(0, i) }],
        };
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      if (!abortSignal.aborted && reply.length % chunkSize !== 0) {
        yield {
          content: [{ type: "text", text: reply }],
        };
      }
    },
  };
}
