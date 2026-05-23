"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Loader2, MessageSquare, Send, Upload } from "lucide-react";
import { ChatMarkdown } from "@/components/chat-markdown";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const DEMO_USER_ID =
  process.env.NEXT_PUBLIC_DEMO_USER_ID ||
  "11111111-1111-1111-1111-111111111111";

// /api/chat already runs the deep-insights pipeline (HyDE + rerank + grounded
// synthesis). We intentionally do NOT pass agent_id here — the backend resolves
// the underlying Managed Agent. Passing a logical name like "deep-insights-agent"
// would be treated as a Managed Agent ID and fail with "Unknown agent name".

type UploadResult = {
  fileName: string;
  ok: boolean;
  message: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  pipelineLogs?: string[];
};

type StepStatus = "done" | "active" | "pending" | "skipped";

const PIPELINE_STEPS = [
  {
    key: "request",
    label: "Request accepted",
    match: (line: string) =>
      line.includes("[Graph] Starting execution graph") ||
      line.includes("[Executor] Running deep insights pipeline"),
  },
  {
    key: "router",
    label: "Routing and instruction selection",
    match: (line: string) => line.includes("[Router]"),
  },
  {
    key: "gate",
    label: "General-query gate (fast-path check)",
    match: (line: string) =>
      line.includes("Fast-path matched") ||
      line.includes("HyDE retrieved") ||
      line.includes("HyDE retrieval returned"),
  },
  {
    key: "retrieve",
    label: "HyDE retrieval + rerank",
    match: (line: string) =>
      line.includes("HyDE retrieved") ||
      line.includes("HyDE retrieval returned no relevant contexts"),
  },
  {
    key: "synthesis",
    label: "Grounded synthesis via managed agent",
    match: (line: string) =>
      line.includes("Invoking Managed Agent") ||
      line.includes("Interaction succeeded") ||
      line.includes("Interaction failed"),
  },
  {
    key: "done",
    label: "Response finalized",
    match: (line: string) =>
      line.includes("[Validator] Output validation passed") ||
      line.includes("Interaction succeeded"),
  },
] as const;

function computeStepStatuses(
  logs: string[] | undefined,
  isRunning: boolean,
  runningTick: number,
) {
  const normalized = logs ?? [];
  const usedFastPath = normalized.some((line) => line.includes("Fast-path matched"));
  const hasLogs = normalized.length > 0;

  const statuses: StepStatus[] = PIPELINE_STEPS.map((step) =>
    normalized.some((line) => step.match(line)) ? "done" : "pending",
  );

  if (usedFastPath) {
    // Skip retrieval + synthesis when fast-path handled a greeting/small-talk turn.
    const retrieveIdx = PIPELINE_STEPS.findIndex((s) => s.key === "retrieve");
    const synthesisIdx = PIPELINE_STEPS.findIndex((s) => s.key === "synthesis");
    if (retrieveIdx >= 0 && statuses[retrieveIdx] === "pending") {
      statuses[retrieveIdx] = "skipped";
    }
    if (synthesisIdx >= 0 && statuses[synthesisIdx] === "pending") {
      statuses[synthesisIdx] = "skipped";
    }
  }

  if (isRunning) {
    if (hasLogs) {
      const currentPending = statuses.findIndex((s) => s === "pending");
      if (currentPending >= 0) statuses[currentPending] = "active";
    } else {
      // Before backend logs arrive, show synthetic progress so the demo has
      // immediate visual activity.
      const idx = Math.min(runningTick, statuses.length - 1);
      for (let i = 0; i < statuses.length; i++) {
        if (i < idx) statuses[i] = "done";
        else if (i === idx) statuses[i] = "active";
      }
    }
  } else {
    // Turn all unresolved "active" to done/pending as appropriate.
    for (let i = 0; i < statuses.length; i++) {
      if (statuses[i] === "active") statuses[i] = "done";
    }
    statuses[statuses.length - 1] = "done";
  }

  return statuses;
}

function buildHistory(
  messages: ChatMessage[],
): Array<{ role: "user" | "model"; content: string }> {
  if (messages.length <= 1) return [];
  return messages.slice(0, -1).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    content: m.content,
  }));
}

export default function AppointmentReturnPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);
  const [hasUploadedSuccessfully, setHasUploadedSuccessfully] = useState(false);

  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [runningTick, setRunningTick] = useState(0);

  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  const successCount = useMemo(
    () => uploadResults.filter((r) => r.ok).length,
    [uploadResults],
  );

  useEffect(() => {
    if (!chatOpen) return;
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatLoading, chatOpen]);

  useEffect(() => {
    if (!chatLoading) return;
    const id = window.setInterval(() => {
      setRunningTick((tick) => tick + 1);
    }, 1200);
    return () => window.clearInterval(id);
  }, [chatLoading]);

  const onUpload = async (e: FormEvent) => {
    e.preventDefault();
    if (files.length === 0) return;

    setUploading(true);
    const nextResults: UploadResult[] = [];

    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append("user_id", DEMO_USER_ID);
        formData.append("file", file);

        const res = await fetch(`${API_BASE}/api/ingest/upload`, {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const err = await res.text().catch(() => "Upload failed.");
          nextResults.push({
            fileName: file.name,
            ok: false,
            message: `Failed (${res.status}): ${err || "Upload failed."}`,
          });
          continue;
        }

        nextResults.push({
          fileName: file.name,
          ok: true,
          message: "Uploaded and ingested into your medical records.",
        });
      }
    } finally {
      setUploadResults(nextResults);
      setHasUploadedSuccessfully(nextResults.some((r) => r.ok));
      setUploading(false);
    }
  };

  const onSend = async (e: FormEvent) => {
    e.preventDefault();
    const prompt = chatInput.trim();
    if (!prompt || chatLoading) return;

    const userMessage: ChatMessage = { role: "user", content: prompt };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setChatInput("");
    setRunningTick(0);
    setChatLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: prompt,
          user_id: DEMO_USER_ID,
          chat_history: buildHistory(nextMessages),
        }),
      });

      if (!res.ok) {
        const err = await res.text().catch(() => "");
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Could not reach deep insights right now (${res.status}). ${err || ""}`,
          },
        ]);
        return;
      }

      const data = (await res.json()) as { response?: string; logs?: string[] };
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.response || "No response from deep insights.",
          pipelineLogs: data.logs || [],
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Deep insights is temporarily unavailable. Please try again in a moment.",
        },
      ]);
    } finally {
      setChatLoading(false);
      setRunningTick(0);
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground px-6 py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">
              Just came back from an appointment
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Upload scans, reports, or PDFs. After ingestion, open the chat
              below to ask the deep insights pipeline anything about your
              records.
            </p>
          </div>
          <Link
            href="/"
            className="shrink-0 rounded-full border border-border px-4 py-2 text-sm hover:bg-muted transition-colors"
          >
            Back to talk
          </Link>
        </div>

        <form
          onSubmit={onUpload}
          className="rounded-2xl border border-border bg-card p-5 space-y-4"
        >
          <label className="block text-sm font-medium">
            Upload medical files
          </label>
          <input
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.txt,.csv,.doc,.docx"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            className="block w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={uploading || files.length === 0}
              className="inline-flex items-center gap-2 rounded-full bg-foreground text-background px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {uploading ? "Uploading..." : "Upload and ingest"}
            </button>
            <span className="text-xs text-muted-foreground">
              {files.length > 0
                ? `${files.length} file(s) selected`
                : "No files selected"}
            </span>
          </div>
        </form>

        {uploadResults.length > 0 && (
          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-medium">
                Upload results ({successCount}/{uploadResults.length} successful)
              </p>
              {hasUploadedSuccessfully && (
                <button
                  type="button"
                  onClick={() => setChatOpen((open) => !open)}
                  className="inline-flex items-center gap-2 rounded-full bg-foreground text-background px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
                  aria-expanded={chatOpen}
                  aria-controls="deep-insights-chat-panel"
                >
                  <MessageSquare className="h-4 w-4" />
                  {chatOpen ? "Hide chat" : "Chat about your records"}
                </button>
              )}
            </div>
            <ul className="mt-3 space-y-2">
              {uploadResults.map((result, idx) => (
                <li
                  key={`${result.fileName}-${idx}`}
                  className="rounded-xl border border-border bg-background px-3 py-2 text-sm min-w-0"
                >
                  <p className="font-medium break-words">{result.fileName}</p>
                  <p
                    className={
                      result.ok
                        ? "text-emerald-600 dark:text-emerald-400 break-words"
                        : "text-rose-600 dark:text-rose-400 break-words"
                    }
                  >
                    {result.message}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {hasUploadedSuccessfully && chatOpen && (
          <section
            id="deep-insights-chat-panel"
            className="rounded-2xl border border-border bg-card flex flex-col overflow-hidden"
            style={{ height: "min(72vh, 720px)" }}
          >
            <header className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">Deep Insights Chat</p>
                <p className="text-xs text-muted-foreground">
                  Pinned to the deep insights pipeline over your uploaded
                  records.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setChatOpen(false)}
                className="rounded-full border border-border px-3 py-1.5 text-xs hover:bg-muted transition-colors"
              >
                Close
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              <div className="mx-auto w-full max-w-3xl space-y-4">
                {messages.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Try asking: <em>&ldquo;Tell me about my chest X-ray&rdquo;</em>{" "}
                    or <em>&ldquo;Explain my LDL result&rdquo;</em>.
                  </p>
                )}
                {messages.map((m, idx) => (
                  <MessageBubble key={`${idx}-${m.role}`} message={m} />
                ))}
                {chatLoading && (
                  <PipelineTraceCard isRunning runningTick={runningTick} />
                )}
                <div ref={transcriptEndRef} />
              </div>
            </div>

            <form
              onSubmit={onSend}
              className="border-t border-border p-3 flex items-end gap-2"
            >
              <div className="mx-auto flex w-full max-w-3xl items-end gap-2">
                <textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      onSend(e as unknown as FormEvent);
                    }
                  }}
                  placeholder="Ask deep insights about your reports..."
                  rows={2}
                  className="min-h-11 flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/15"
                />
                <button
                  type="submit"
                  disabled={chatLoading || !chatInput.trim()}
                  aria-label="Send"
                  className="inline-flex items-center gap-1.5 rounded-full bg-foreground text-background px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  Send
                </button>
              </div>
            </form>
          </section>
        )}
      </div>
    </main>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] min-w-0 rounded-2xl rounded-br-md bg-foreground text-background px-3.5 py-2 text-[14px] leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
          {message.content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-start gap-2">
      <div className="max-w-[85%] min-w-0 rounded-2xl rounded-bl-md bg-muted px-3.5 py-2.5 text-foreground">
        <ChatMarkdown content={message.content} />
      </div>
      {message.pipelineLogs && message.pipelineLogs.length > 0 && (
        <PipelineTraceCard logs={message.pipelineLogs} />
      )}
    </div>
  );
}

function PipelineTraceCard({
  logs,
  isRunning = false,
  runningTick = 0,
}: {
  logs?: string[];
  isRunning?: boolean;
  runningTick?: number;
}) {
  const statuses = computeStepStatuses(logs, isRunning, runningTick);

  return (
    <div className="w-full rounded-xl border border-border bg-background px-3 py-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {isRunning ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
        )}
        {isRunning ? "Deep insights pipeline in progress" : "Deep insights pipeline trace"}
      </div>
      <ol className="space-y-1.5">
        {PIPELINE_STEPS.map((step, idx) => (
          <li key={step.key} className="flex items-start gap-2 text-xs min-w-0">
            <StepDot status={statuses[idx]} />
            <span
              className={
                statuses[idx] === "active"
                  ? "text-foreground font-medium"
                  : statuses[idx] === "done"
                  ? "text-foreground/90"
                  : statuses[idx] === "skipped"
                  ? "text-muted-foreground italic"
                  : "text-muted-foreground"
              }
            >
              {step.label}
            </span>
          </li>
        ))}
      </ol>
      {logs && logs.length > 0 && (
        <details className="mt-3 rounded-md border border-border/70 bg-card p-2">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
            Raw backend logs ({logs.length})
          </summary>
          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed text-muted-foreground">
            {logs.join("\n")}
          </pre>
        </details>
      )}
    </div>
  );
}

function StepDot({ status }: { status: StepStatus }) {
  if (status === "done") {
    return <span className="mt-1 h-2.5 w-2.5 rounded-full bg-emerald-500 shrink-0" />;
  }
  if (status === "active") {
    return (
      <span className="mt-0.5 h-3 w-3 rounded-full border-2 border-sky-500 border-t-transparent animate-spin shrink-0" />
    );
  }
  if (status === "skipped") {
    return <span className="mt-1 h-2.5 w-2.5 rounded-full bg-amber-400 shrink-0" />;
  }
  return <span className="mt-1 h-2.5 w-2.5 rounded-full bg-muted-foreground/40 shrink-0" />;
}
