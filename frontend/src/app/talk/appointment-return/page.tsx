"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Brain,
  CheckCircle2,
  FileText,
  Globe,
  ImageIcon,
  Loader2,
  Mic,
  Send,
  Sparkles,
  Upload,
  Workflow,
} from "lucide-react";
import { ChatMarkdown } from "@/components/chat-markdown";
import { VoiceCallDialog } from "@/features/voice/VoiceCallDialog";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const DEMO_USER_ID =
  process.env.NEXT_PUBLIC_DEMO_USER_ID ||
  "11111111-1111-1111-1111-111111111111";

// ---------------------------------------------------------------------------
// Agent catalog
//
// Each entry maps a UI button to one of the four specialist managed agents
// (or the orchestrator). The `id` is sent to the backend as `agent_id` on
// /api/chat — the FastAPI router uses these logical ids to dispatch to the
// correct pipeline (see `backend/app/domains/orchestration/router.py`).
// ---------------------------------------------------------------------------

type AgentMode =
  | "deep_insights"
  | "research"
  | "reports"
  | "scans"
  | "orchestrator";

type AgentConfig = {
  id: AgentMode;
  label: string;
  tagline: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  ringAccent: string;
  emptyHints: string[];
};

const AGENTS: Record<AgentMode, AgentConfig> = {
  deep_insights: {
    id: "deep_insights",
    label: "Get Deep Insights",
    tagline: "Personalized HyDE + rerank + grounded synthesis over your own records.",
    icon: Brain,
    accent: "bg-violet-600 text-white hover:bg-violet-700",
    ringAccent: "ring-violet-300/60",
    emptyHints: [
      "What does my LDL result really mean?",
      "Summarize what's been going on with my health.",
    ],
  },
  research: {
    id: "research",
    label: "Ask general knowledge Qs",
    tagline:
      "Public medical APIs (RxNorm, MedlinePlus, DailyMed, openFDA, MeSH) — no private data.",
    icon: Globe,
    accent: "bg-sky-600 text-white hover:bg-sky-700",
    ringAccent: "ring-sky-300/60",
    emptyHints: [
      "What are common side effects of metformin?",
      "Explain hypertension stages.",
    ],
  },
  reports: {
    id: "reports",
    label: "Chat about your PDF",
    tagline: "Lab PDFs and doctor/physician notes only — cited with [doc:].",
    icon: FileText,
    accent: "bg-emerald-600 text-white hover:bg-emerald-700",
    ringAccent: "ring-emerald-300/60",
    emptyHints: [
      "Explain my lipid panel in plain English.",
      "What did the doctor's note say about my BP?",
    ],
  },
  scans: {
    id: "scans",
    label: "Chat about your Image",
    tagline: "Scan / imaging records only — MedGemma-style text reasoning.",
    icon: ImageIcon,
    accent: "bg-amber-600 text-white hover:bg-amber-700",
    ringAccent: "ring-amber-300/60",
    emptyHints: [
      "What does my chest X-ray impression say?",
      "Tell me about the MRI report.",
    ],
  },
  orchestrator: {
    id: "orchestrator",
    label: "Generate Report",
    tagline:
      "Orchestrator (Antigravity / Gemini 3.5 Flash) calls all 4 specialist agents and writes a one-page understanding guide.",
    icon: Workflow,
    accent: "bg-foreground text-background hover:opacity-90",
    ringAccent: "ring-foreground/30",
    emptyHints: [],
  },
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type UploadResult = {
  fileName: string;
  fileType: string;
  ok: boolean;
  message: string;
};

type AgentTraceEntry = {
  agent: string;
  why: string;
  sub_query: string;
  success: boolean;
  output_excerpt: string;
  output_full: string;
  logs?: string[];
};

type RunningTraceStatus = "pending" | "running" | "done" | "error";

type RunningTraceEntry = {
  index: number;
  agent: string;
  why: string;
  sub_query: string;
  status: RunningTraceStatus;
  success?: boolean;
  output_excerpt?: string;
  output_full?: string;
  logs?: string[];
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  pipelineLogs?: string[];
  agentRoute?: AgentMode | string;
  agentTrace?: AgentTraceEntry[];
  uploadMix?: Record<string, number>;
  managedAgentId?: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isPdf(fileType: string, fileName: string): boolean {
  return (
    fileType.toLowerCase().includes("pdf") ||
    fileName.toLowerCase().endsWith(".pdf")
  );
}

function isImage(fileType: string, fileName: string): boolean {
  if (fileType.toLowerCase().startsWith("image/")) return true;
  const lower = fileName.toLowerCase();
  return (
    lower.endsWith(".png") ||
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".webp")
  );
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

/**
 * Minimal Server-Sent Events reader for a `fetch`-based POST stream.
 *
 * We can't use the native `EventSource` here because that API only supports
 * GET requests and doesn't allow custom headers. So we parse the SSE wire
 * format manually: events are separated by a blank line and each event has
 * one or more `data: <json>` lines.
 */
async function consumeSseStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: Record<string, unknown>) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let separatorIdx: number;
    while ((separatorIdx = buffer.indexOf("\n\n")) !== -1) {
      const block = buffer.slice(0, separatorIdx);
      buffer = buffer.slice(separatorIdx + 2);

      // Collect all `data:` lines in the block (SSE spec allows multiple).
      const dataLines = block
        .split("\n")
        .filter((line) => line.startsWith("data: "))
        .map((line) => line.slice(6));
      if (dataLines.length === 0) continue;

      const joined = dataLines.join("\n");
      try {
        const parsed = JSON.parse(joined) as Record<string, unknown>;
        onEvent(parsed);
      } catch {
        // Ignore malformed events instead of aborting the whole stream.
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AppointmentReturnPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);

  const [activeAgent, setActiveAgent] = useState<AgentMode | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [runningTrace, setRunningTrace] = useState<RunningTraceEntry[]>([]);
  const [synthesisRunning, setSynthesisRunning] = useState(false);
  const [synthesisAgentId, setSynthesisAgentId] = useState<string | null>(null);
  const [uploadMixLive, setUploadMixLive] = useState<Record<string, number> | null>(null);
  const [voiceCallOpen, setVoiceCallOpen] = useState(false);

  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  const successCount = useMemo(
    () => uploadResults.filter((r) => r.ok).length,
    [uploadResults],
  );

  const hasUploadedSuccessfully = successCount > 0;
  const hasPdf = uploadResults.some(
    (r) => r.ok && isPdf(r.fileType, r.fileName),
  );
  const hasImage = uploadResults.some(
    (r) => r.ok && isImage(r.fileType, r.fileName),
  );

  useEffect(() => {
    if (!activeAgent) return;
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatLoading, activeAgent]);

  // Reset chat state when switching agents. We do this in the click handler
  // (not in an effect) so React's set-state-in-effect rule stays happy.
  const switchAgent = (next: AgentMode | null) => {
    if (next !== activeAgent) {
      setMessages([]);
      setChatInput("");
    }
    setActiveAgent(next);
  };

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
            fileType: file.type || "",
            ok: false,
            message: `Failed (${res.status}): ${err || "Upload failed."}`,
          });
          continue;
        }

        nextResults.push({
          fileName: file.name,
          fileType: file.type || "",
          ok: true,
          message: "Uploaded and ingested into your medical records.",
        });
      }
    } finally {
      setUploadResults(nextResults);
      setUploading(false);
    }
  };

  const onSend = async (e: FormEvent) => {
    e.preventDefault();
    const prompt = chatInput.trim();
    if (!prompt || chatLoading || !activeAgent) return;

    const userMessage: ChatMessage = { role: "user", content: prompt };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setChatInput("");
    setChatLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: prompt,
          user_id: DEMO_USER_ID,
          agent_id: activeAgent,
          chat_history: buildHistory(nextMessages),
        }),
      });

      if (!res.ok) {
        const err = await res.text().catch(() => "");
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Could not reach the ${AGENTS[activeAgent].label.toLowerCase()} agent right now (${res.status}). ${err || ""}`,
            agentRoute: activeAgent,
          },
        ]);
        return;
      }

      const data = (await res.json()) as {
        response?: string;
        logs?: string[];
        agent_route?: string;
      };
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.response || "No response from the agent.",
          pipelineLogs: data.logs || [],
          agentRoute: (data.agent_route as AgentMode) || activeAgent,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "The specialist agent is temporarily unavailable. Please try again in a moment.",
          agentRoute: activeAgent,
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const onGenerateReport = async () => {
    if (!hasUploadedSuccessfully || reportLoading) return;
    switchAgent("orchestrator");
    setReportLoading(true);
    setRunningTrace([]);
    setSynthesisRunning(false);
    setSynthesisAgentId(null);
    setUploadMixLive(null);
    // Seed a synthetic user turn so the trace card has a slot to attach to.
    const userTurn: ChatMessage = {
      role: "user",
      content: "Generate a one-page understanding guide for my uploaded records.",
    };
    setMessages([userTurn]);

    try {
      const res = await fetch(`${API_BASE}/api/chat/generate-report/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: DEMO_USER_ID,
          goal: "",
        }),
      });

      if (!res.ok || !res.body) {
        const err = await res.text().catch(() => "");
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Could not generate the report (${res.status}). ${err || ""}`,
            agentRoute: "orchestrator",
          },
        ]);
        return;
      }

      await consumeSseStream(res.body, (event) => {
        switch (event.type) {
          case "plan": {
            const planned = (event.planned_calls as Array<{
              index: number;
              agent: string;
              why: string;
              sub_query: string;
            }>) || [];
            setRunningTrace(
              planned.map((c) => ({
                index: c.index,
                agent: c.agent,
                why: c.why,
                sub_query: c.sub_query,
                status: "pending",
              })),
            );
            setUploadMixLive(
              (event.upload_mix as Record<string, number>) || null,
            );
            setSynthesisAgentId(
              (event.managed_agent_id as string) || null,
            );
            break;
          }
          case "agent_start": {
            const idx = event.index as number;
            setRunningTrace((prev) =>
              prev.map((t) =>
                t.index === idx ? { ...t, status: "running" } : t,
              ),
            );
            break;
          }
          case "agent_complete": {
            const idx = event.index as number;
            const success = Boolean(event.success);
            setRunningTrace((prev) =>
              prev.map((t) =>
                t.index === idx
                  ? {
                      ...t,
                      status: success ? "done" : "error",
                      success,
                      output_excerpt: (event.output_excerpt as string) || "",
                      output_full: (event.output_full as string) || "",
                      logs: (event.logs as string[]) || [],
                    }
                  : t,
              ),
            );
            break;
          }
          case "synthesis_start": {
            setSynthesisRunning(true);
            setSynthesisAgentId(
              (event.managed_agent_id as string) ||
                synthesisAgentId ||
                null,
            );
            break;
          }
          case "synthesis_complete": {
            setSynthesisRunning(false);
            break;
          }
          case "done": {
            const trace = (event.agent_trace as AgentTraceEntry[]) || [];
            const uploadMix =
              (event.upload_mix as Record<string, number>) || {};
            const managedAgentId =
              (event.managed_agent_id as string) || undefined;
            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content:
                  (event.final_report_markdown as string) || "(Empty report)",
                pipelineLogs: (event.logs as string[]) || [],
                agentRoute: "orchestrator",
                agentTrace: trace,
                uploadMix,
                managedAgentId,
              },
            ]);
            break;
          }
          case "error": {
            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content: `Orchestrator error: ${event.detail || "unknown error"}`,
                agentRoute: "orchestrator",
              },
            ]);
            break;
          }
          default:
            // Unknown event types are ignored so older clients still work
            // with future event additions on the backend.
            break;
        }
      });
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "The orchestrator agent is temporarily unavailable. Please try again in a moment.",
          agentRoute: "orchestrator",
        },
      ]);
    } finally {
      setReportLoading(false);
      setSynthesisRunning(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <main className="min-h-screen bg-background text-foreground px-6 py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">
              Just came back from an appointment
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Upload scans, reports, or PDFs. Then pick a specialist Managed
              Agent — or one-click <em>Generate Report</em> to have the
              Orchestrator agent coordinate all four agents and produce an
              understanding guide.
            </p>
          </div>
          <Link
            href="/"
            className="shrink-0 rounded-full border border-border px-4 py-2 text-sm hover:bg-muted transition-colors"
          >
            Back to talk
          </Link>
        </div>

        {/* Upload form */}
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

        {/* Upload results */}
        {uploadResults.length > 0 && (
          <section className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm font-medium">
              Upload results ({successCount}/{uploadResults.length} successful)
            </p>
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

        {/* Agent picker */}
        {hasUploadedSuccessfully && (
          <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <div>
              <p className="text-sm font-semibold">Pick a specialist</p>
              <p className="text-xs text-muted-foreground">
                Every button is a Gemini <strong>Managed Agent</strong> wrapper
                — each one mounts its own <code>.agents/AGENTS.md</code> persona
                via the Managed Agents API. The Orchestrator coordinates all
                four to produce a single report.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <AgentButton
                cfg={AGENTS.deep_insights}
                active={activeAgent === "deep_insights"}
                onClick={() => switchAgent("deep_insights")}
              />
              <AgentButton
                cfg={AGENTS.research}
                active={activeAgent === "research"}
                onClick={() => switchAgent("research")}
              />
              {hasPdf && (
                <AgentButton
                  cfg={AGENTS.reports}
                  active={activeAgent === "reports"}
                  onClick={() => switchAgent("reports")}
                />
              )}
              {hasImage && (
                <AgentButton
                  cfg={AGENTS.scans}
                  active={activeAgent === "scans"}
                  onClick={() => switchAgent("scans")}
                />
              )}
            </div>
            <div className="border-t border-border pt-4">
              <button
                type="button"
                onClick={onGenerateReport}
                disabled={reportLoading}
                className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-foreground text-background px-5 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {reportLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {reportLoading ? "Orchestrating…" : "Generate Report"}
              </button>
              <p className="mt-2 text-[11px] text-muted-foreground">
                One click → Orchestrator (Antigravity / Gemini 3.5 Flash) calls
                the relevant specialist agents and writes a Markdown
                understanding guide.
              </p>
            </div>
          </section>
        )}

        <VoiceCallDialog
          open={voiceCallOpen}
          onClose={() => setVoiceCallOpen(false)}
          userId={DEMO_USER_ID}
        />

        {/* Chat panel */}
        {activeAgent && (
          <section
            id="agent-chat-panel"
            className="rounded-2xl border border-border bg-card flex flex-col overflow-hidden"
            style={{ height: "min(75vh, 760px)" }}
          >
            <ChatHeader
              cfg={AGENTS[activeAgent]}
              onClose={() => switchAgent(null)}
              onVoiceCall={
                activeAgent === "reports" && hasPdf
                  ? () => setVoiceCallOpen(true)
                  : undefined
              }
            />

            <div className="flex-1 overflow-y-auto px-4 py-4">
              <div className="mx-auto w-full max-w-3xl space-y-4">
                {messages.length === 0 && (
                  <ChatEmptyState cfg={AGENTS[activeAgent]} />
                )}
                {messages.map((m, idx) => (
                  <MessageBubble key={`${idx}-${m.role}`} message={m} />
                ))}
                {chatLoading && activeAgent !== "orchestrator" && (
                  <RunningCard
                    isOrchestrator={false}
                    cfg={AGENTS[activeAgent]}
                  />
                )}
                {activeAgent === "orchestrator" &&
                  (reportLoading || runningTrace.length > 0) && (
                    <LiveOrchestratorCard
                      trace={runningTrace}
                      synthesisRunning={synthesisRunning}
                      synthesisAgentId={synthesisAgentId}
                      uploadMix={uploadMixLive}
                      reportLoading={reportLoading}
                    />
                  )}
                <div ref={transcriptEndRef} />
              </div>
            </div>

            {activeAgent !== "orchestrator" && (
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
                    placeholder={`Message the ${AGENTS[activeAgent].label.toLowerCase()} agent…`}
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
            )}
          </section>
        )}
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function AgentButton({
  cfg,
  active,
  onClick,
}: {
  cfg: AgentConfig;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = cfg.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all ${
        active
          ? `border-transparent ring-2 ${cfg.ringAccent} ${cfg.accent}`
          : "border-border bg-background hover:bg-muted"
      }`}
    >
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${active ? "" : "text-muted-foreground"}`} />
        <p className="text-sm font-semibold">{cfg.label}</p>
      </div>
      <p
        className={`text-[11px] leading-relaxed ${
          active ? "opacity-90" : "text-muted-foreground"
        }`}
      >
        {cfg.tagline}
      </p>
    </button>
  );
}

function ChatHeader({
  cfg,
  onClose,
  onVoiceCall,
}: {
  cfg: AgentConfig;
  onClose: () => void;
  onVoiceCall?: () => void;
}) {
  const Icon = cfg.icon;
  return (
    <header className="flex items-center justify-between border-b border-border px-4 py-3 gap-2">
      <div className="min-w-0 flex items-center gap-2">
        <Icon className="h-4 w-4 text-foreground/80" />
        <div className="min-w-0">
          <p className="text-sm font-semibold">{cfg.label}</p>
          <p className="text-xs text-muted-foreground truncate">
            {cfg.tagline}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {onVoiceCall && (
          <button
            type="button"
            onClick={onVoiceCall}
            title="Spin up a Vapi voice assistant briefed on your uploaded PDFs and talk to it live."
            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-emerald-700 transition-colors"
          >
            <Mic className="h-3.5 w-3.5" />
            Talk to Agent instead
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-border px-3 py-1.5 text-xs hover:bg-muted transition-colors"
        >
          Close
        </button>
      </div>
    </header>
  );
}

function ChatEmptyState({ cfg }: { cfg: AgentConfig }) {
  if (cfg.id === "orchestrator") {
    return (
      <p className="text-sm text-muted-foreground">
        Click <strong>Generate Report</strong> again to re-run the orchestrator.
      </p>
    );
  }
  return (
    <div className="text-sm text-muted-foreground">
      <p>Try asking:</p>
      <ul className="mt-2 list-disc pl-5 space-y-1">
        {cfg.emptyHints.map((hint) => (
          <li key={hint}>
            <em>“{hint}”</em>
          </li>
        ))}
      </ul>
    </div>
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
      {message.agentRoute && (
        <AgentRouteBadge route={message.agentRoute as AgentMode} />
      )}
      <div className="max-w-[85%] min-w-0 rounded-2xl rounded-bl-md bg-muted px-3.5 py-2.5 text-foreground">
        <ChatMarkdown content={message.content} />
      </div>
      {message.agentTrace && message.agentTrace.length > 0 && (
        <OrchestratorTraceCard
          trace={message.agentTrace}
          uploadMix={message.uploadMix}
          managedAgentId={message.managedAgentId}
        />
      )}
      {message.pipelineLogs && message.pipelineLogs.length > 0 && (
        <PipelineLogsCard logs={message.pipelineLogs} />
      )}
    </div>
  );
}

function AgentRouteBadge({ route }: { route: AgentMode | string }) {
  const cfg =
    typeof route === "string" && route in AGENTS
      ? AGENTS[route as AgentMode]
      : null;
  if (!cfg) return null;
  const Icon = cfg.icon;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-0.5 text-[10px] uppercase tracking-wide font-semibold text-foreground/80">
      <Icon className="h-3 w-3" />
      Handled by: {cfg.label}
    </span>
  );
}

function RunningCard({
  isOrchestrator,
  cfg,
}: {
  isOrchestrator: boolean;
  cfg: AgentConfig;
}) {
  return (
    <div className="w-full rounded-xl border border-border bg-background px-3 py-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {isOrchestrator
          ? "Orchestrator running — Antigravity / Gemini 3.5 Flash is coordinating specialists…"
          : `Managed Agent in progress — ${cfg.label}…`}
      </div>
    </div>
  );
}

/**
 * Live trace card rendered while the orchestrator SSE stream is open.
 *
 * Each entry mirrors the post-completion `OrchestratorTraceCard` row, but
 * shows a status dot (pending → running → done/error) and gates the
 * sub-query and output behind explicit "Show query" / "Show output" toggles
 * so the running card doesn't visually explode with raw query text.
 */
function LiveOrchestratorCard({
  trace,
  synthesisRunning,
  synthesisAgentId,
  uploadMix,
  reportLoading,
}: {
  trace: RunningTraceEntry[];
  synthesisRunning: boolean;
  synthesisAgentId: string | null;
  uploadMix: Record<string, number> | null;
  reportLoading: boolean;
}) {
  const overallRunning = reportLoading;
  const planningOnly = trace.length === 0;
  return (
    <div className="w-full rounded-xl border border-border bg-background px-3 py-3 space-y-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {overallRunning ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Workflow className="h-3.5 w-3.5" />
        )}
        Orchestrator — live progress
      </div>

      <div className="text-[11px] text-muted-foreground space-y-1">
        {synthesisAgentId && (
          <p>
            <strong>Final synthesis agent:</strong>{" "}
            <code className="rounded bg-muted px-1">{synthesisAgentId}</code>
          </p>
        )}
        {uploadMix && (
          <p>
            <strong>Upload mix:</strong> {uploadMix.pdfs ?? 0} PDFs ·{" "}
            {uploadMix.images ?? 0} images · {uploadMix.notes ?? 0} notes ·{" "}
            {uploadMix.other ?? 0} other ({uploadMix.total ?? 0} total)
          </p>
        )}
        {planningOnly && (
          <p>Planning specialist calls based on your upload mix…</p>
        )}
      </div>

      {trace.length > 0 && (
        <ol className="space-y-2">
          {trace.map((entry) => (
            <li
              key={entry.index}
              className="rounded-md border border-border/70 bg-card p-2.5 text-[12px] leading-relaxed"
            >
              <div className="flex items-center gap-2">
                <LiveStatusDot status={entry.status} />
                <span className="font-semibold">
                  [{entry.index + 1}] {entry.agent}
                </span>
                <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide font-semibold text-foreground/70">
                  {entry.status}
                </span>
              </div>
              <p className="mt-1 text-muted-foreground">
                <strong>Why:</strong> {entry.why}
              </p>
              <details className="mt-1">
                <summary className="cursor-pointer text-[11px] font-medium text-muted-foreground hover:text-foreground">
                  Show query
                </summary>
                <pre className="mt-1.5 whitespace-pre-wrap break-words rounded bg-muted/60 p-2 text-[11px]">
                  {entry.sub_query}
                </pre>
              </details>
              {entry.status === "done" || entry.status === "error" ? (
                <details className="mt-1">
                  <summary className="cursor-pointer text-[11px] font-medium text-muted-foreground hover:text-foreground">
                    Show output ({(entry.output_full || "").length} chars)
                  </summary>
                  <pre className="mt-1.5 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-muted/60 p-2 text-[11px]">
                    {entry.output_excerpt || entry.output_full || "(empty)"}
                  </pre>
                </details>
              ) : null}
            </li>
          ))}
        </ol>
      )}

      {synthesisRunning && (
        <div className="flex items-center gap-2 rounded-md border border-border/70 bg-card px-3 py-2 text-[12px]">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-foreground/70" />
          <span>
            All specialists finished. Composing the final understanding guide
            with {synthesisAgentId ? (
              <code className="rounded bg-muted px-1">{synthesisAgentId}</code>
            ) : (
              "the orchestrator managed agent"
            )}
            …
          </span>
        </div>
      )}
    </div>
  );
}

function LiveStatusDot({ status }: { status: RunningTraceStatus }) {
  if (status === "running") {
    return <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-500 shrink-0" />;
  }
  if (status === "done") {
    return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />;
  }
  if (status === "error") {
    return <AlertCircle className="h-3.5 w-3.5 text-rose-500 shrink-0" />;
  }
  return (
    <span
      aria-hidden
      className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40 shrink-0"
    />
  );
}

function OrchestratorTraceCard({
  trace,
  uploadMix,
  managedAgentId,
}: {
  trace: AgentTraceEntry[];
  uploadMix?: Record<string, number>;
  managedAgentId?: string;
}) {
  return (
    <div className="w-full rounded-xl border border-border bg-background px-3 py-3 space-y-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        <Workflow className="h-3.5 w-3.5" />
        Orchestrator trace
      </div>

      <div className="text-[11px] text-muted-foreground space-y-1">
        {managedAgentId && (
          <p>
            <strong>Final synthesis agent:</strong>{" "}
            <code className="rounded bg-muted px-1">{managedAgentId}</code>
          </p>
        )}
        {uploadMix && (
          <p>
            <strong>Upload mix:</strong> {uploadMix.pdfs ?? 0} PDFs ·{" "}
            {uploadMix.images ?? 0} images · {uploadMix.notes ?? 0} notes ·{" "}
            {uploadMix.other ?? 0} other ({uploadMix.total ?? 0} total)
          </p>
        )}
      </div>

      <ol className="space-y-2">
        {trace.map((entry, idx) => (
          <li
            key={`${entry.agent}-${idx}`}
            className="rounded-md border border-border/70 bg-card p-2.5 text-[12px] leading-relaxed"
          >
            <div className="flex items-center gap-2">
              {entry.success ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              ) : (
                <AlertCircle className="h-3.5 w-3.5 text-rose-500 shrink-0" />
              )}
              <span className="font-semibold">
                [{idx + 1}] {entry.agent}
              </span>
            </div>
            <p className="mt-1 text-muted-foreground">
              <strong>Why:</strong> {entry.why}
            </p>
            <details className="mt-1">
              <summary className="cursor-pointer text-[11px] font-medium text-muted-foreground hover:text-foreground">
                Show query
              </summary>
              <pre className="mt-1.5 whitespace-pre-wrap break-words rounded bg-muted/60 p-2 text-[11px]">
                {entry.sub_query}
              </pre>
            </details>
            <details className="mt-1">
              <summary className="cursor-pointer text-[11px] font-medium text-muted-foreground hover:text-foreground">
                Show output ({entry.output_full.length} chars)
              </summary>
              <pre className="mt-1.5 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-muted/60 p-2 text-[11px]">
                {entry.output_excerpt || entry.output_full || "(empty)"}
              </pre>
            </details>
            {entry.logs && entry.logs.length > 0 && (
              <details className="mt-1">
                <summary className="cursor-pointer text-muted-foreground">
                  Sub-agent logs ({entry.logs.length})
                </summary>
                <pre className="mt-1.5 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded bg-muted/60 p-2 text-[11px]">
                  {entry.logs.join("\n")}
                </pre>
              </details>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function PipelineLogsCard({ logs }: { logs: string[] }) {
  return (
    <details className="w-full rounded-xl border border-border bg-background px-3 py-2">
      <summary className="cursor-pointer text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Backend pipeline logs ({logs.length})
      </summary>
      <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed text-muted-foreground">
        {logs.join("\n")}
      </pre>
    </details>
  );
}
