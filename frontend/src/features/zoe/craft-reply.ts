import type { SettingsState } from "./types";

export function craftReply(
  prompt: string,
  tone: SettingsState["voice"]["tone"],
): string {
  const lower = prompt.toLowerCase();
  const empathy = tone === "Empathetic" ? "I hear you. " : "";
  const clinical = tone === "Clinical";

  if (lower.includes("workout") || lower.includes("exercise") || lower.includes("run")) {
    return clinical
      ? "Recommendation: 25–30 min Zone 2 cardio (brisk walking, 65–75% MHR). Defer HIIT until HRV returns to 7-day mean."
      : `${empathy}Given your slightly elevated resting heart rate, I'd suggest a 25–30 minute brisk walk or some restorative yoga today.`;
  }
  if (lower.includes("sleep")) {
    return clinical
      ? "Last sleep duration: 7h 12m. Deep: 1h 42m (24%). REM: 1h 36m (22%). Score: 85."
      : `${empathy}Your sleep score last night was 85 — well within the recovery range. Deep sleep contributed 1h 42m, a strong restorative signal.`;
  }
  if (lower.includes("hrv") || lower.includes("heart")) {
    return clinical
      ? "7-day rolling HRV: 64ms (+5% W/W). Resting HR: 62 bpm, baseline +3 bpm. Trend: improving."
      : `${empathy}Your 7-day HRV trend is 64 ms, up 5% from last week. That's a positive recovery signal.`;
  }
  if (lower.includes("eczema") || lower.includes("skin")) {
    return clinical
      ? "Continue topical hydrocortisone 1% BID x 7 days. Flag if pruritus or erythema persists ≥72h."
      : `${empathy}Continue the topical cream prescribed by Dr. Peterson. If redness or itching increases over 72 hours, I can help you schedule a follow-up.`;
  }
  if (lower.includes("migraine") || lower.includes("headache")) {
    return clinical
      ? "Prior migraine: linked to sleep deficit (<6h) and elevated stress. Mitigation: hydrate, reduce screen exposure 14:00–16:00."
      : `${empathy}Your last migraine episode was linked to low sleep and high stress. Today your sleep is good — staying hydrated and taking a screen break this afternoon should help.`;
  }
  return clinical
    ? "Awaiting query. I can surface insights from wearable telemetry and clinical notes."
    : `${empathy}I can pull insights from your wearables and recent clinical notes. Ask me about your sleep, HRV, medications, or recent visits — I'll keep it concise and grounded.`;
}
