"use client";

/**
 * VoiceCallDialog — modal that:
 *   1. Calls `POST /api/vapi/assistants/create-from-records` to spin up a
 *      one-shot Vapi assistant tailored to the user's uploaded PDFs.
 *   2. Lazy-loads the @vapi-ai/web SDK in the browser (it's purely
 *      client-side and would explode under SSR if imported at module top).
 *   3. Runs the live voice call, surfaces a transcript + a pulsing orb,
 *      and cleans up the connection on close / unmount.
 *
 * Why a separate file: the dialog owns the entire Vapi lifecycle, including
 * the mic permission prompt, transcript stream, and termination. The host
 * page (`/talk/appointment-return`) just toggles `open` and forgets.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Loader2,
  Mic,
  MicOff,
  PhoneOff,
  Sparkles,
  Volume2,
  X,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type CallStatus =
  | "idle"
  | "preparing"
  | "ready"
  | "connecting"
  | "live"
  | "ended"
  | "error";

type RecordRef = {
  record_id: string;
  file_name: string;
  file_type: string;
};

type CreateAssistantResponse = {
  assistant_id: string;
  public_key: string;
  voice_id: string;
  records_included: RecordRef[];
  briefing_excerpt: string;
  briefing_char_count: number;
  logs: string[];
};

type TranscriptTurn = {
  role: "user" | "assistant";
  text: string;
  // `partial` turns are continuously overwritten by Vapi's interim transcripts
  // until the final one comes through. We compress them in the UI by only
  // ever showing the most recent partial per role.
  partial: boolean;
};

type VapiInstance = {
  start: (assistantId: string) => Promise<unknown> | unknown;
  stop: () => void;
  setMuted: (muted: boolean) => void;
  isMuted: () => boolean;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  removeAllListeners?: () => void;
};

export type VoiceCallDialogProps = {
  open: boolean;
  onClose: () => void;
  userId: string;
  recordId?: string;
};

export function VoiceCallDialog({
  open,
  onClose,
  userId,
  recordId,
}: VoiceCallDialogProps) {
  const [status, setStatus] = useState<CallStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [assistantInfo, setAssistantInfo] =
    useState<CreateAssistantResponse | null>(null);
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false);
  const [volume, setVolume] = useState(0);
  const [showDebug, setShowDebug] = useState(false);

  // Hold the Vapi instance in a ref so React doesn't try to re-render every
  // time we attach/detach event listeners. We also use refs to read the
  // latest values inside the long-lived listener closures.
  const vapiRef = useRef<VapiInstance | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  // -------------------------------------------------------------------------
  // Tear-down
  // -------------------------------------------------------------------------

  const teardown = useCallback(() => {
    const v = vapiRef.current;
    if (v) {
      try {
        v.stop();
      } catch {
        // Vapi throws if stop() is called twice; safe to ignore.
      }
      try {
        v.removeAllListeners?.();
      } catch {
        // Optional method depending on SDK version.
      }
      vapiRef.current = null;
    }
  }, []);

  // -------------------------------------------------------------------------
  // Reset on close
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!open) {
      teardown();
      setStatus("idle");
      setError(null);
      setTranscript([]);
      setAssistantInfo(null);
      setIsMuted(false);
      setIsAssistantSpeaking(false);
      setVolume(0);
      setShowDebug(false);
    }
  }, [open, teardown]);

  useEffect(() => () => teardown(), [teardown]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript, status]);

  // -------------------------------------------------------------------------
  // Boot — fetch the assistant, then start the Vapi call
  // -------------------------------------------------------------------------

  const startCall = useCallback(async () => {
    setError(null);
    setStatus("preparing");
    setTranscript([]);

    let info: CreateAssistantResponse;
    try {
      const res = await fetch(
        `${API_BASE}/api/vapi/assistants/create-from-records`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: userId,
            ...(recordId ? { record_id: recordId } : {}),
          }),
        },
      );
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(
          (errBody && typeof errBody === "object" && "detail" in errBody
            ? String((errBody as { detail?: unknown }).detail)
            : "") || `Could not create voice assistant (HTTP ${res.status}).`,
        );
      }
      info = (await res.json()) as CreateAssistantResponse;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setStatus("error");
      return;
    }

    setAssistantInfo(info);
    setStatus("connecting");

    let VapiCtor: { new (publicKey: string): VapiInstance };
    try {
      const mod = await import("@vapi-ai/web");
      VapiCtor = (mod.default ?? mod) as unknown as {
        new (publicKey: string): VapiInstance;
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Could not load the Vapi web SDK: ${msg}`);
      setStatus("error");
      return;
    }

    let vapi: VapiInstance;
    try {
      vapi = new VapiCtor(info.public_key);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Failed to initialize Vapi: ${msg}`);
      setStatus("error");
      return;
    }
    vapiRef.current = vapi;

    vapi.on("call-start", () => {
      setStatus("live");
    });
    vapi.on("call-end", () => {
      setStatus("ended");
      setIsAssistantSpeaking(false);
    });
    vapi.on("speech-start", () => setIsAssistantSpeaking(true));
    vapi.on("speech-end", () => setIsAssistantSpeaking(false));
    vapi.on("volume-level", (...args) => {
      const v = typeof args[0] === "number" ? args[0] : 0;
      setVolume(v);
    });
    vapi.on("error", (...args) => {
      const e = args[0];
      const msg =
        typeof e === "string"
          ? e
          : e instanceof Error
            ? e.message
            : (e as { message?: string; errorMsg?: string })?.message ||
              (e as { errorMsg?: string })?.errorMsg ||
              "Voice call error.";
      setError(msg);
      setStatus("error");
    });
    vapi.on("message", (...args) => {
      const m = args[0] as
        | {
            type?: string;
            role?: "user" | "assistant";
            transcript?: string;
            transcriptType?: "partial" | "final";
          }
        | undefined;
      if (!m || m.type !== "transcript") return;
      const role = m.role === "user" ? "user" : "assistant";
      const text = (m.transcript || "").trim();
      if (!text) return;
      const isPartial = m.transcriptType === "partial";
      setTranscript((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.role === role && last.partial) {
          next[next.length - 1] = { role, text, partial: isPartial };
          return next;
        }
        next.push({ role, text, partial: isPartial });
        return next;
      });
    });

    try {
      await vapi.start(info.assistant_id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Failed to start the voice call: ${msg}`);
      setStatus("error");
    }
  }, [recordId, userId]);

  // Auto-start the call as soon as the dialog opens — saves the user a click.
  useEffect(() => {
    if (open && status === "idle") {
      void startCall();
    }
  }, [open, status, startCall]);

  // -------------------------------------------------------------------------
  // Controls
  // -------------------------------------------------------------------------

  const toggleMute = () => {
    const v = vapiRef.current;
    if (!v) return;
    const next = !isMuted;
    v.setMuted(next);
    setIsMuted(next);
  };

  const hangUp = () => {
    teardown();
    setStatus("ended");
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Talk to voice agent"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => {
          teardown();
          onClose();
        }}
      />
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-500" />
            <p className="text-sm font-semibold">Talk to your records</p>
          </div>
          <button
            type="button"
            onClick={() => {
              teardown();
              onClose();
            }}
            aria-label="Close"
            className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Body */}
        <div className="px-5 py-5 space-y-4">
          <StatusBanner
            status={status}
            error={error}
            assistantInfo={assistantInfo}
          />

          <Orb status={status} isAssistantSpeaking={isAssistantSpeaking} volume={volume} />

          {/* Transcript */}
          <div className="rounded-xl border border-border bg-background">
            <div className="px-3 py-2 border-b border-border text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
              Live transcript
            </div>
            <div className="max-h-56 overflow-y-auto px-3 py-2 space-y-2 text-sm">
              {transcript.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  {status === "live"
                    ? "Listening… say something."
                    : status === "preparing" || status === "connecting"
                      ? "Warming up the assistant…"
                      : status === "ended"
                        ? "Call ended. Start a new one to chat again."
                        : "The transcript of your conversation will appear here."}
                </p>
              ) : (
                transcript.map((turn, idx) => (
                  <TranscriptLine key={idx} turn={turn} />
                ))
              )}
              <div ref={transcriptEndRef} />
            </div>
          </div>

          {/* Records included */}
          {assistantInfo && assistantInfo.records_included.length > 0 && (
            <details className="rounded-xl border border-border bg-background px-3 py-2 text-xs">
              <summary className="cursor-pointer font-semibold text-muted-foreground">
                Records included in this assistant ({assistantInfo.records_included.length})
              </summary>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                {assistantInfo.records_included.map((r) => (
                  <li
                    key={r.record_id}
                    className="break-words rounded bg-muted/60 px-2 py-1"
                  >
                    {r.file_name}{" "}
                    <span className="opacity-60">({r.file_type})</span>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {/* Debug pane */}
          {assistantInfo && (
            <details
              className="rounded-xl border border-border bg-background px-3 py-2 text-xs"
              open={showDebug}
              onToggle={(e) => setShowDebug((e.target as HTMLDetailsElement).open)}
            >
              <summary className="cursor-pointer font-semibold text-muted-foreground">
                Backend trace & briefing excerpt
              </summary>
              <p className="mt-2 text-[11px] text-muted-foreground">
                <strong>Assistant id:</strong>{" "}
                <code className="rounded bg-muted px-1">
                  {assistantInfo.assistant_id}
                </code>{" "}
                · <strong>Voice:</strong> {assistantInfo.voice_id} ·{" "}
                <strong>Briefing chars:</strong> {assistantInfo.briefing_char_count}
              </p>
              <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded bg-muted/60 p-2 text-[11px] text-muted-foreground">
                {assistantInfo.briefing_excerpt}
                {assistantInfo.briefing_char_count > 600 ? "\n[…]" : ""}
              </pre>
              {assistantInfo.logs.length > 0 && (
                <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded bg-muted/60 p-2 text-[11px] text-muted-foreground">
                  {assistantInfo.logs.join("\n")}
                </pre>
              )}
            </details>
          )}
        </div>

        {/* Footer controls */}
        <footer className="flex items-center justify-end gap-2 border-t border-border bg-muted/40 px-5 py-3">
          {status === "live" ? (
            <>
              <button
                type="button"
                onClick={toggleMute}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? (
                  <MicOff className="h-3.5 w-3.5" />
                ) : (
                  <Mic className="h-3.5 w-3.5" />
                )}
                {isMuted ? "Unmute" : "Mute"}
              </button>
              <button
                type="button"
                onClick={hangUp}
                className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 transition-colors"
              >
                <PhoneOff className="h-3.5 w-3.5" />
                End call
              </button>
            </>
          ) : status === "ended" || status === "error" ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setStatus("idle");
                  setError(null);
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-4 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
              >
                Call again
              </button>
              <button
                type="button"
                onClick={() => {
                  teardown();
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-1.5 text-xs font-semibold text-background hover:opacity-90"
              >
                Done
              </button>
            </>
          ) : (
            <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {status === "preparing"
                ? "Building your assistant…"
                : "Connecting to Vapi…"}
            </div>
          )}
        </footer>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function StatusBanner({
  status,
  error,
  assistantInfo,
}: {
  status: CallStatus;
  error: string | null;
  assistantInfo: CreateAssistantResponse | null;
}) {
  if (status === "error" && error) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
        <div className="min-w-0 break-words [overflow-wrap:anywhere]">
          <p className="font-semibold">Something went wrong.</p>
          <p className="mt-1 opacity-90">{error}</p>
        </div>
      </div>
    );
  }
  if (status === "preparing") {
    return (
      <p className="text-xs text-muted-foreground">
        Summarizing your uploaded PDFs into a voice-friendly briefing…
      </p>
    );
  }
  if (status === "connecting") {
    return (
      <p className="text-xs text-muted-foreground">
        Connecting the voice assistant — allow microphone access if prompted.
      </p>
    );
  }
  if (status === "live") {
    return (
      <p className="text-xs text-muted-foreground">
        You&apos;re live with a voice assistant briefed on{" "}
        <strong>
          {assistantInfo?.records_included.length ?? 0} record
          {(assistantInfo?.records_included.length ?? 0) === 1 ? "" : "s"}
        </strong>
        . Speak naturally — it can answer follow-ups.
      </p>
    );
  }
  if (status === "ended") {
    return (
      <p className="text-xs text-muted-foreground">
        Call ended. Hit <strong>Call again</strong> to chat more.
      </p>
    );
  }
  return null;
}

function Orb({
  status,
  isAssistantSpeaking,
  volume,
}: {
  status: CallStatus;
  isAssistantSpeaking: boolean;
  volume: number;
}) {
  const scale = 1 + Math.min(0.4, volume * 1.2);
  const isLive = status === "live";
  return (
    <div className="flex items-center justify-center py-2">
      <div
        className={`relative h-24 w-24 rounded-full transition-all duration-100 ${
          isLive
            ? isAssistantSpeaking
              ? "bg-emerald-500/80"
              : "bg-sky-500/70"
            : status === "ended"
              ? "bg-muted"
              : "bg-foreground/30"
        }`}
        style={{
          transform: `scale(${isLive ? scale.toFixed(3) : 1})`,
          boxShadow: isLive
            ? `0 0 ${20 + volume * 60}px ${isAssistantSpeaking ? "rgba(16,185,129,0.6)" : "rgba(14,165,233,0.5)"}`
            : "none",
        }}
      >
        <div className="absolute inset-0 flex items-center justify-center text-white">
          {status === "preparing" || status === "connecting" ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : isAssistantSpeaking ? (
            <Volume2 className="h-6 w-6" />
          ) : isLive ? (
            <Mic className="h-6 w-6" />
          ) : (
            <Mic className="h-6 w-6 opacity-70" />
          )}
        </div>
      </div>
    </div>
  );
}

function TranscriptLine({ turn }: { turn: TranscriptTurn }) {
  const isUser = turn.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] min-w-0 rounded-2xl px-3 py-1.5 text-[13px] leading-snug whitespace-pre-wrap break-words [overflow-wrap:anywhere] ${
          isUser
            ? "rounded-br-md bg-foreground text-background"
            : "rounded-bl-md bg-muted text-foreground"
        } ${turn.partial ? "opacity-70 italic" : ""}`}
      >
        {turn.text}
      </div>
    </div>
  );
}
