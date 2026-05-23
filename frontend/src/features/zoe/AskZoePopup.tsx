"use client";

import { useEffect, useRef } from "react";
import {
  AuiIf,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAui,
  useAuiState,
} from "@assistant-ui/react";
import { ArrowUpIcon, MessageCircle, SquareIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SettingsState } from "./types";
import { ZoeAssistantProvider } from "./ZoeAssistantProvider";
import { ZoeLogo } from "./ZoeLogo";

export interface AskContext {
  /** Short label shown as a context chip. */
  label: string;
  /** Pre-composed prompt auto-sent on open. */
  prompt: string;
  /** Optional surface (insights / timeline / etc.) used for telemetry tagging. */
  surface?: string;
}

interface AskZoePopupProps {
  tone: SettingsState["voice"]["tone"];
  context: AskContext | null;
  /** Imperative open trigger from the FAB; null context means "no auto-send". */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Cleared after the prompt is dispatched into the thread. */
  onContextConsumed: () => void;
}

export function AskZoePopup({
  tone,
  context,
  open,
  onOpenChange,
  onContextConsumed,
}: AskZoePopupProps) {
  // Use the context label as a remount key so each new ask starts a fresh thread.
  const threadKey = context?.label ?? "__general__";

  return (
    <>
      <Fab
        open={open}
        contextLabel={context?.label}
        onClick={() => onOpenChange(!open)}
      />

      <div
        aria-hidden={!open}
        className={cn(
          "fixed bottom-24 right-6 z-50 w-[min(420px,calc(100vw-2rem))] origin-bottom-right transition-all duration-200",
          open
            ? "opacity-100 scale-100 translate-y-0 pointer-events-auto"
            : "opacity-0 scale-95 translate-y-2 pointer-events-none"
        )}
      >
        <div className="flex h-[560px] max-h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-3xl bg-card ring-1 ring-foreground/10 shadow-[0_30px_60px_-20px_rgba(20,20,40,0.35),0_4px_12px_-2px_rgba(20,20,40,0.10)]">
          <PopupHeader
            context={context}
            onClose={() => onOpenChange(false)}
          />
          <ZoeAssistantProvider key={threadKey} tone={tone}>
            <PopupBody
              context={context}
              onContextConsumed={onContextConsumed}
            />
          </ZoeAssistantProvider>
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────── Floating action button ─────────────────────────── */

function Fab({
  open,
  contextLabel,
  onClick,
}: {
  open: boolean;
  contextLabel?: string;
  onClick: () => void;
}) {
  const hasContext = !!contextLabel;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={open ? "Close Ask Zoe" : "Ask Zoe"}
      aria-expanded={open}
      className={cn(
        "fixed bottom-6 right-6 z-50 group inline-flex items-center justify-center transition-all outline-none focus-visible:ring-2 focus-visible:ring-foreground/30",
        open && "scale-95"
      )}
    >
      <span
        className={cn(
          "relative inline-flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--zoe-sand)] ring-1 ring-foreground/10 shadow-[0_12px_28px_-12px_rgba(20,20,40,0.35),0_2px_4px_rgba(20,20,40,0.08)] transition-transform group-hover:-translate-y-0.5",
          hasContext && "ring-[color:var(--zoe-lilac)]/40"
        )}
      >
        {/* Subtle lilac glow when context is queued */}
        {hasContext && !open && (
          <span
            aria-hidden
            className="absolute inset-0 rounded-full bg-[color:var(--zoe-lilac)] opacity-15 animate-pulse"
          />
        )}
        <ZoeLogo size={44} />
      </span>
      {/* Context dot */}
      {hasContext && !open && (
        <span
          aria-hidden
          className="absolute top-1 right-1 inline-flex items-center justify-center h-4 w-4 rounded-full bg-[color:var(--zoe-coral)] ring-2 ring-background"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-white" />
        </span>
      )}
    </button>
  );
}

/* ─────────────────────────── Popup header + body ─────────────────────────── */

function PopupHeader({
  context,
  onClose,
}: {
  context: AskContext | null;
  onClose: () => void;
}) {
  return (
    <header className="shrink-0 border-b border-border/60">
      <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <ZoeLogo size={28} />
          <div className="min-w-0 leading-tight">
            <p className="text-sm font-semibold">Ask Zoe</p>
            <p className="text-[11px] text-muted-foreground">
              {context ? "Scoped chat" : "Anytime questions"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="w-8 h-8 rounded-full hover:bg-muted text-foreground/70 hover:text-foreground transition-colors flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-foreground/15"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      {context && (
        <div className="px-4 pb-3">
          <span className="inline-flex items-center gap-1.5 max-w-full h-7 px-2.5 rounded-full bg-[color:var(--zoe-lilac-soft)] text-[color:var(--zoe-lilac)] text-[11px] font-semibold">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[color:var(--zoe-lilac)]" />
            <span className="truncate">About: {context.label}</span>
          </span>
        </div>
      )}
    </header>
  );
}

function PopupBody({
  context,
  onContextConsumed,
}: {
  context: AskContext | null;
  onContextConsumed: () => void;
}) {
  const aui = useAui();
  const dispatchedRef = useRef<string | null>(null);

  // Auto-send the context prompt once per new context.
  useEffect(() => {
    if (!context) return;
    if (dispatchedRef.current === context.label) return;
    dispatchedRef.current = context.label;
    aui.thread().append({
      role: "user",
      content: [{ type: "text", text: context.prompt }],
    });
    onContextConsumed();
  }, [context, aui, onContextConsumed]);

  return (
    <ThreadPrimitive.Root className="flex flex-1 min-h-0 flex-col">
      <ThreadPrimitive.Viewport
        turnAnchor="top"
        className="zoe-scroll relative flex flex-1 flex-col overflow-y-auto scroll-smooth"
      >
        <div className="flex flex-col flex-1 px-3 pt-3">
          <AuiIf condition={(s) => s.thread.isEmpty}>
            <PopupEmpty context={context} />
          </AuiIf>

          <div className="flex flex-col gap-y-3 pb-4">
            <ThreadPrimitive.Messages>
              {() => <PopupMessage />}
            </ThreadPrimitive.Messages>
          </div>

          <ThreadPrimitive.ViewportFooter className="sticky bottom-0 mt-auto bg-card pb-3 pt-2">
            <PopupComposer />
          </ThreadPrimitive.ViewportFooter>
        </div>
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  );
}

function PopupEmpty({ context }: { context: AskContext | null }) {
  if (context) {
    // Auto-send will fire — keep this slot quiet to avoid flashing copy.
    return null;
  }
  return (
    <div className="my-auto flex flex-col items-center gap-3 px-4 py-8 text-center">
      <ZoeLogo size={56} />
      <p className="text-sm font-medium">Ask me anything</p>
      <p className="text-xs text-muted-foreground max-w-[260px]">
        Trends, your latest labs, a symptom you&apos;re tracking — I&apos;ll
        pull the relevant record and walk you through it.
      </p>
    </div>
  );
}

function PopupMessage() {
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
      className="flex items-start gap-2 fade-in slide-in-from-bottom-1 animate-in duration-150"
    >
      <ZoeLogo size={24} className="mt-1" />
      <div className="rounded-2xl rounded-bl-md bg-[color:var(--zoe-lilac-soft)] text-foreground px-3.5 py-2 text-[13.5px] leading-relaxed max-w-[82%] wrap-break-word">
        <MessagePrimitive.Parts />
      </div>
    </MessagePrimitive.Root>
  );
}

function PopupComposer() {
  return (
    <ComposerPrimitive.Root className="relative flex w-full">
      <ComposerPrimitive.AttachmentDropzone
        render={
          <div className="flex w-full items-end gap-1.5 rounded-2xl border border-border bg-background p-2 transition-shadow focus-within:border-foreground/30 focus-within:ring-2 focus-within:ring-foreground/10" />
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

/* Keep an unused export so the icon imports work even if future variants need them. */
export const _AskZoePopupHints = { MessageCircle };
