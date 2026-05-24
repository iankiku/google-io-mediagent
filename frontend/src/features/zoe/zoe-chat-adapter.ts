import type { ChatModelAdapter } from "@assistant-ui/react";
import type { SettingsState } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const DEMO_USER_ID =
  process.env.NEXT_PUBLIC_DEMO_USER_ID ||
  "11111111-1111-1111-1111-111111111111";

function extractText(
  parts: Array<{ type: string; text?: string }>,
): string {
  return parts
    .filter((p) => p.type === "text" && typeof p.text === "string")
    .map((p) => p.text as string)
    .join("\n");
}

function getLastUserText(
  messages: Parameters<ChatModelAdapter["run"]>[0]["messages"],
): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== "user") continue;
    return extractText(
      message.content as Array<{ type: string; text?: string }>,
    ).trim();
  }
  return "";
}

function buildHistory(
  messages: Parameters<ChatModelAdapter["run"]>[0]["messages"],
): Array<{ role: "user" | "model"; content: string }> {
  // Drop the most recent user message — that's the prompt being sent.
  let lastUserDropped = false;
  const history: Array<{ role: "user" | "model"; content: string }> = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (!lastUserDropped && m.role === "user") {
      lastUserDropped = true;
      continue;
    }
    const text = extractText(
      m.content as Array<{ type: string; text?: string }>,
    );
    if (!text) continue;
    history.unshift({
      role: m.role === "assistant" ? "model" : "user",
      content: text,
    });
  }
  return history;
}

export function createZoeChatAdapter(
  _tone: SettingsState["voice"]["tone"],
): ChatModelAdapter {
  return {
    async *run({ messages, abortSignal }) {
      const prompt = getLastUserText(messages);
      if (!prompt) {
        yield { content: [{ type: "text", text: "(empty message)" }] };
        return;
      }

      // Visit / live-interpreter messages are tagged with [PATIENT]/[DOCTOR].
      // The interpreter pipeline already appends the cleaned translation as
      // its own assistant message — we must NOT call the chat agent here.
      if (/^\[(PATIENT|DOCTOR)\]\s/.test(prompt)) {
        yield { content: [{ type: "text", text: "" }] };
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: abortSignal,
          body: JSON.stringify({
            message: prompt,
            user_id: DEMO_USER_ID,
            chat_history: buildHistory(messages),
          }),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          yield {
            content: [
              {
                type: "text",
                text: `Zoe is having trouble reaching the assistant (${res.status}). ${errText}`,
              },
            ],
          };
          return;
        }

        const data = (await res.json()) as { response?: string };
        yield {
          content: [{ type: "text", text: data.response ?? "" }],
        };
      } catch (err) {
        if (abortSignal.aborted) return;
        yield {
          content: [
            {
              type: "text",
              text: `Zoe couldn't connect right now. Please try again.`,
            },
          ],
        };
      }
    },
  };
}
