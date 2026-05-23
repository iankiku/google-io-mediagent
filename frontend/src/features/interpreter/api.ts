import type {
  StartSessionResponse,
  TurnResponse,
  EndSessionResponse,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function startSession(userId: string): Promise<StartSessionResponse> {
  const res = await fetch(`${API_BASE}/api/interpreter/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId }),
  });
  if (!res.ok) throw new Error(`start failed: ${res.status}`);
  return res.json();
}

export async function submitTurn(
  sessionId: string,
  role: "patient" | "doctor",
  audio: Blob,
): Promise<TurnResponse> {
  const fd = new FormData();
  fd.append("session_id", sessionId);
  fd.append("role", role);
  fd.append("audio", audio, "turn.webm");
  const res = await fetch(`${API_BASE}/api/interpreter/turn`, {
    method: "POST",
    body: fd,
  });
  if (!res.ok) throw new Error(`turn failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function endSession(sessionId: string): Promise<EndSessionResponse> {
  const fd = new FormData();
  fd.append("session_id", sessionId);
  const res = await fetch(`${API_BASE}/api/interpreter/end`, {
    method: "POST",
    body: fd,
  });
  if (!res.ok) throw new Error(`end failed: ${res.status}`);
  return res.json();
}
