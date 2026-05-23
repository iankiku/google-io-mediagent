export type Role = "patient" | "doctor";
export type LanguageCode = "en-US" | "hi-IN" | "zh-CN" | "hi-en-IN";

export interface StartSessionResponse {
  session_id: string;
  source_language: LanguageCode;
  target_language: LanguageCode;
}

export interface TurnResponse {
  session_id: string;
  turn_index: number;
  role: Role;
  raw: string;
  cleaned: string;
  created_at: string;
}

export interface EndSessionResponse {
  session_id: string;
  record_id: string;
  turn_count: number;
}
