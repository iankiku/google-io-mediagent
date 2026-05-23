"use client";

import { useCallback, useRef, useState } from "react";
import { useAui } from "@assistant-ui/react";

export type InterpreterRole = "patient" | "doctor";
export type OrbMode = "daily" | "visit";

interface Turn {
  role: InterpreterRole;
  raw: string;
  cleaned: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const DEMO_USER_ID =
  process.env.NEXT_PUBLIC_DEMO_USER_ID ||
  "11111111-1111-1111-1111-111111111111";
const SOURCE_LANGUAGE =
  process.env.NEXT_PUBLIC_DEMO_LANGUAGE || "zh-CN";

function newSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useInterpreterOrb(mode: OrbMode) {
  const aui = useAui();
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [currentRole, setCurrentRole] = useState<InterpreterRole>("patient");
  const [turnCount, setTurnCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const turnsRef = useRef<Turn[]>([]);
  const sessionIdRef = useRef<string>(newSessionId());

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch (e) {
      setError(`mic access denied: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, []);

  const sendVisitTurn = useCallback(
    async (blob: Blob) => {
      const roleAtCapture = currentRole;
      const fd = new FormData();
      fd.append("role", roleAtCapture);
      fd.append("session_id", sessionIdRef.current);
      fd.append("audio", blob, "turn.webm");

      const res = await fetch(`${API_BASE}/api/interpreter/turn`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`turn failed: ${res.status} ${txt}`);
      }
      const data = (await res.json()) as {
        raw_transcript?: string;
        cleaned?: string;
      };
      const raw = data.raw_transcript || "(no transcript)";
      const cleaned = data.cleaned || "(empty)";

      aui.thread().append({
        role: "user",
        content: [
          {
            type: "text",
            text: `[${roleAtCapture.toUpperCase()}] ${raw}`,
          },
        ],
      });
      aui.thread().append({
        role: "assistant",
        content: [{ type: "text", text: cleaned }],
      });

      turnsRef.current.push({ role: roleAtCapture, raw, cleaned });
      setTurnCount(turnsRef.current.length);
      setCurrentRole((r) => (r === "patient" ? "doctor" : "patient"));
    },
    [aui, currentRole],
  );

  const sendDailyTurn = useCallback(
    async (blob: Blob) => {
      const fd = new FormData();
      fd.append("audio", blob, "turn.webm");
      fd.append("source_language", SOURCE_LANGUAGE);

      const res = await fetch(`${API_BASE}/api/interpreter/transcribe`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`transcribe failed: ${res.status} ${txt}`);
      }
      const data = (await res.json()) as { transcript?: string };
      const transcript = (data.transcript || "").trim();
      if (!transcript) {
        setError("Zoe didn't catch that — try again.");
        return;
      }
      // Appending a user message triggers the chat adapter -> /api/chat.
      aui.thread().append({
        role: "user",
        content: [{ type: "text", text: transcript }],
      });
    },
    [aui],
  );

  const stopAndSend = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    setRecording(false);
    setProcessing(true);

    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      recorder.stop();
      recorder.stream.getTracks().forEach((t) => t.stop());
    });

    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    chunksRef.current = [];
    recorderRef.current = null;

    try {
      if (mode === "visit") {
        await sendVisitTurn(blob);
      } else {
        await sendDailyTurn(blob);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setProcessing(false);
    }
  }, [mode, sendVisitTurn, sendDailyTurn]);

  const onOrbTap = useCallback(() => {
    if (processing) return;
    if (recording) {
      stopAndSend();
    } else {
      startRecording();
    }
  }, [recording, processing, stopAndSend, startRecording]);

  const saveTranscript = useCallback(async () => {
    if (turnsRef.current.length === 0) return;
    try {
      const fd = new FormData();
      fd.append("user_id", DEMO_USER_ID);
      fd.append("turns", JSON.stringify(turnsRef.current));
      const res = await fetch(`${API_BASE}/api/interpreter/end`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`save failed: ${res.status} ${txt}`);
      }
      turnsRef.current = [];
      sessionIdRef.current = newSessionId();
      setTurnCount(0);
      setCurrentRole("patient");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const resetVisit = useCallback(() => {
    turnsRef.current = [];
    sessionIdRef.current = newSessionId();
    setTurnCount(0);
    setCurrentRole("patient");
    setError(null);
  }, []);

  return {
    recording,
    processing,
    currentRole,
    turnCount,
    error,
    onOrbTap,
    saveTranscript,
    resetVisit,
  };
}
