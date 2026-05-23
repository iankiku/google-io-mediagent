"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AuiIf,
  ComposerPrimitive,
  MessagePrimitive,
  SuggestionPrimitive,
  ThreadPrimitive,
  useAui,
  useAuiState,
} from "@assistant-ui/react";
import { ArrowUpIcon, MessageSquare, SquareIcon, X } from "lucide-react";
import { Orb } from "./Orb";
import { ZoeAssistantProvider } from "./ZoeAssistantProvider";
import { cn } from "@/lib/utils";
import type { SettingsState } from "./types";

interface TalkViewProps {
  tone: SettingsState["voice"]["tone"];
}

export function TalkView({ tone }: TalkViewProps) {
  return (
    <ZoeAssistantProvider tone={tone}>
      <TalkScene />
    </ZoeAssistantProvider>
  );
}

function TalkScene() {
  const [chatOpen, setChatOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const aui = useAui();

  const handleOrbTap = useCallback(() => {
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
    <ThreadPrimitive.Root
      className="relative flex h-full w-full overflow-hidden bg-background"
      style={{ ["--composer-radius" as string]: "20px" }}
    >
      <section className="flex flex-1 min-w-0 flex-col">
        <TalkHero listening={listening} onOrbTap={handleOrbTap} />
        <TranscriptScroll />
        <ChatTrigger onClick={() => setChatOpen(true)} hidden={chatOpen} />
      </section>

      <ChatDrawer open={chatOpen} onClose={() => setChatOpen(false)} />
    </ThreadPrimitive.Root>
  );
}

/* ─────────────────────────── Hero (orb + heading) ─────────────────────────── */

function TalkHero({
  listening,
  onOrbTap,
}: {
  listening: boolean;
  onOrbTap: () => void;
}) {
  return (
    <div className="shrink-0 flex flex-col items-center pt-14 pb-6 px-6">
      <button
        type="button"
        onClick={onOrbTap}
        aria-label={listening ? "Stop listening" : "Tap to speak"}
        className="outline-none focus-visible:ring-2 focus-visible:ring-foreground/15 rounded-full transition-transform active:scale-95"
      >
        <Orb size={168} listening={listening} />
      </button>
      <h1 className="mt-8 font-semibold text-[22px] tracking-tight">
        Hi, I&apos;m Zoe
      </h1>
      <p className="mt-1.5 text-[13px] text-muted-foreground">
        {listening ? "Listening…" : "Tap the orb to speak with me"}
      </p>
    </div>
  );
}

/* ─────────────────────────── Live transcript area ─────────────────────────── */

function TranscriptScroll() {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto zoe-scroll">
      <div className="mx-auto max-w-2xl px-6 pb-6">
        <AuiIf condition={(s) => s.thread.isEmpty}>
          <EmptyTranscript />
        </AuiIf>

        <AuiIf condition={(s) => !s.thread.isEmpty}>
          <div className="mt-2 mb-3 flex items-center gap-3">
            <span className="h-px flex-1 bg-foreground/8" />
            <span className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">
              Live transcript
            </span>
            <span className="h-px flex-1 bg-foreground/8" />
          </div>
        </AuiIf>

        <div className="space-y-4">
          <ThreadPrimitive.Messages>
            {() => <TranscriptItem />}
          </ThreadPrimitive.Messages>
        </div>
        <TranscriptAutoScroll />
      </div>
    </div>
  );
}

function EmptyTranscript() {
  return (
    <div className="mt-8 flex flex-col items-center gap-4">
      <p className="text-center text-sm text-muted-foreground max-w-md">
        Anything Zoe says will appear here. Tap the orb to start a voice
        conversation, or open the chat panel to type.
      </p>
      <div className="grid w-full grid-cols-1 sm:grid-cols-2 gap-2">
        <ThreadPrimitive.Suggestions>
          {() => <SuggestionPill />}
        </ThreadPrimitive.Suggestions>
      </div>
    </div>
  );
}

function SuggestionPill() {
  return (
    <SuggestionPrimitive.Trigger
      send
      render={
        <button
          type="button"
          className="h-auto w-full text-left rounded-2xl border border-border bg-card px-4 py-2.5 text-sm transition-colors hover:bg-muted"
        />
      }
    >
      <SuggestionPrimitive.Title className="font-medium text-foreground" />
    </SuggestionPrimitive.Trigger>
  );
}

function TranscriptItem() {
  const role = useAuiState((s) => s.message.role);
  if (role !== "assistant") return null;
  return (
    <MessagePrimitive.Root
      data-role="assistant"
      className="fade-in slide-in-from-bottom-1 flex animate-in gap-3 duration-200"
    >
      <span
        aria-hidden
        className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[color:var(--zoe-lilac)]"
      />
      <div className="text-[14.5px] leading-relaxed text-foreground/85 wrap-break-word">
        <MessagePrimitive.Parts />
      </div>
    </MessagePrimitive.Root>
  );
}

/**
 * Auto-scrolls the nearest scroll container to the bottom whenever a new
 * assistant chunk arrives. This is simpler than wiring an `aui` viewport here
 * since the transcript intentionally uses a plain scrollable div.
 */
function TranscriptAutoScroll() {
  const ref = useRef<HTMLDivElement | null>(null);
  const lastAssistant = useAuiState((s) => {
    const msgs = s.thread.messages;
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i];
      if (m.role !== "assistant") continue;
      const text = m.content
        .filter((p) => p.type === "text")
        .map((p) => (p as { type: "text"; text: string }).text)
        .join("");
      return `${m.id}:${text.length}`;
    }
    return "";
  });

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const scroller = node.closest(".zoe-scroll") as HTMLElement | null;
    if (!scroller) return;
    scroller.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" });
  }, [lastAssistant]);

  return <div ref={ref} aria-hidden className="h-px w-full" />;
}

/* ─────────────────────── "Chat with Zoe" trigger button ─────────────────────── */

function ChatTrigger({
  onClick,
  hidden,
}: {
  onClick: () => void;
  hidden: boolean;
}) {
  return (
    <div
      className={cn(
        "shrink-0 px-6 pb-6 flex justify-center transition-opacity",
        hidden && "pointer-events-none opacity-0"
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-card text-foreground ring-1 ring-foreground/10 shadow-[0_6px_18px_-8px_rgba(20,20,40,0.18)] hover:bg-muted transition-colors outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
      >
        <MessageSquare className="w-4 h-4 text-foreground/80" />
        <span className="text-sm font-medium">Chat with Zoe</span>
      </button>
    </div>
  );
}

/* ───────────────────────────── Side chat drawer ───────────────────────────── */

function ChatDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <aside
      aria-hidden={!open}
      className={cn(
        "shrink-0 h-full border-l border-border bg-card overflow-hidden transition-[width] duration-300 ease-out",
        open ? "w-[380px]" : "w-0"
      )}
    >
      <div className="flex h-full w-[380px] flex-col">
        <header className="shrink-0 flex items-center justify-between h-14 px-4 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-[color:var(--zoe-lilac-soft)] flex items-center justify-center text-[11px] font-semibold">
              Z
            </span>
            <p className="text-sm font-semibold">Chat with Zoe</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close chat"
            className="w-8 h-8 rounded-full hover:bg-muted text-foreground/70 hover:text-foreground transition-colors flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-foreground/15"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <ThreadPrimitive.Viewport
          turnAnchor="top"
          className="zoe-scroll relative flex flex-1 flex-col overflow-y-auto scroll-smooth"
        >
          <div className="flex flex-col flex-1 px-3 pt-3">
            <AuiIf condition={(s) => s.thread.isEmpty}>
              <ChatEmptyState />
            </AuiIf>

            <div className="flex flex-col gap-y-3 pb-4">
              <ThreadPrimitive.Messages>
                {() => <ChatMessageItem />}
              </ThreadPrimitive.Messages>
            </div>

            <ThreadPrimitive.ViewportFooter className="sticky bottom-0 mt-auto bg-card pb-3 pt-2">
              <ChatComposer />
            </ThreadPrimitive.ViewportFooter>
          </div>
        </ThreadPrimitive.Viewport>
      </div>
    </aside>
  );
}

function ChatEmptyState() {
  return (
    <div className="my-auto flex flex-col items-center gap-3 px-4 py-8 text-center">
      <span className="w-9 h-9 rounded-full bg-[color:var(--zoe-lilac-soft)] flex items-center justify-center">
        <MessageSquare className="w-4 h-4 text-[color:var(--zoe-lilac)]" />
      </span>
      <p className="text-sm font-medium">Ask Zoe anything</p>
      <p className="text-xs text-muted-foreground max-w-[260px]">
        Try sleep quality, HRV trends, or workout suggestions. Zoe will reply
        here and read it out in the transcript on the left.
      </p>
    </div>
  );
}

function ChatMessageItem() {
  const role = useAuiState((s) => s.message.role);
  if (role === "user") {
    return (
      <MessagePrimitive.Root
        data-role="user"
        className="flex justify-end fade-in slide-in-from-bottom-1 animate-in duration-150"
      >
        <div className="rounded-2xl rounded-br-md bg-foreground text-background px-3.5 py-2 text-[13.5px] leading-relaxed max-w-[82%] wrap-break-word">
          <MessagePrimitive.Parts />
        </div>
      </MessagePrimitive.Root>
    );
  }
  return (
    <MessagePrimitive.Root
      data-role="assistant"
      className="flex justify-start fade-in slide-in-from-bottom-1 animate-in duration-150"
    >
      <div className="rounded-2xl rounded-bl-md bg-[color:var(--zoe-lilac-soft)] text-foreground px-3.5 py-2 text-[13.5px] leading-relaxed max-w-[88%] wrap-break-word">
        <MessagePrimitive.Parts />
      </div>
    </MessagePrimitive.Root>
  );
}

function ChatComposer() {
  return (
    <ComposerPrimitive.Root className="relative flex w-full">
      <ComposerPrimitive.AttachmentDropzone
        render={
          <div className="flex w-full items-end gap-1.5 rounded-(--composer-radius) border border-border bg-background p-2 transition-shadow focus-within:border-foreground/30 focus-within:ring-2 focus-within:ring-foreground/10" />
        }
      >
        <ComposerPrimitive.Input
          placeholder="Message Zoe…"
          rows={1}
          aria-label="Message input"
          className="flex-1 max-h-32 min-h-9 resize-none bg-transparent px-2 py-1.5 text-[13.5px] outline-none placeholder:text-muted-foreground/80"
        />
        <AuiIf condition={(s) => !s.thread.isRunning}>
          <ComposerPrimitive.Send
            render={
              <button
                type="button"
                aria-label="Send"
                className="size-8 shrink-0 rounded-full bg-foreground text-background flex items-center justify-center transition-colors hover:bg-foreground/90 disabled:opacity-40 disabled:cursor-not-allowed"
              />
            }
          >
            <ArrowUpIcon className="size-4" />
          </ComposerPrimitive.Send>
        </AuiIf>
        <AuiIf condition={(s) => s.thread.isRunning}>
          <ComposerPrimitive.Cancel
            render={
              <button
                type="button"
                aria-label="Stop"
                className="size-8 shrink-0 rounded-full bg-foreground text-background flex items-center justify-center"
              />
            }
          >
            <SquareIcon className="size-3 fill-current" />
          </ComposerPrimitive.Cancel>
        </AuiIf>
      </ComposerPrimitive.AttachmentDropzone>
    </ComposerPrimitive.Root>
  );
}
