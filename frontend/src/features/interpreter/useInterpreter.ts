"use client";

import { useCallback, useRef, useState } from "react";
import { startSession, submitTurn, endSession } from "./api";
import type { Role, TurnResponse } from "./types";

type Status = "idle" | "active" | "recording" | "processing" | "ended" | "error";

export function useInterpreter(userId: string) {
  const [status, setStatus] = useState<Status>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sourceLanguage, setSourceLanguage] = useState<string>("en-US");
  const [turns, setTurns] = useState<TurnResponse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [recordingRole, setRecordingRole] = useState<Role | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const start = useCallback(async () => {
    setError(null);
    setTurns([]);
    setStatus("active");
    try {
      const res = await startSession(userId);
      setSessionId(res.session_id);
      setSourceLanguage(res.source_language);
    } catch (e) {
      setError(String(e));
      setStatus("error");
    }
  }, [userId]);

  const beginTurn = useCallback(async (role: Role) => {
    if (!sessionId) return;
    setError(null);
    setRecordingRole(role);
    setStatus("recording");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start();
      recorderRef.current = recorder;
    } catch (e) {
      setError(`mic access denied: ${e}`);
      setStatus("error");
      setRecordingRole(null);
    }
  }, [sessionId]);

  const endTurn = useCallback(async () => {
    const recorder = recorderRef.current;
    const role = recordingRole;
    if (!recorder || !sessionId || !role) return;
    setStatus("processing");

    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      recorder.stop();
      recorder.stream.getTracks().forEach((t) => t.stop());
    });

    const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
    chunksRef.current = [];
    recorderRef.current = null;

    try {
      const turn = await submitTurn(sessionId, role, audioBlob);
      setTurns((prev) => [...prev, turn]);
      setStatus("active");
    } catch (e) {
      setError(String(e));
      setStatus("error");
    } finally {
      setRecordingRole(null);
    }
  }, [sessionId, recordingRole]);

  const end = useCallback(async () => {
    if (!sessionId) return;
    try {
      await endSession(sessionId);
      setStatus("ended");
      setSessionId(null);
    } catch (e) {
      setError(String(e));
      setStatus("error");
    }
  }, [sessionId]);

  return {
    status,
    sessionId,
    sourceLanguage,
    turns,
    error,
    recordingRole,
    start,
    beginTurn,
    endTurn,
    end,
  };
}
