export type ZoeView = "talk" | "insights" | "timeline" | "settings";

export type ResponseTone = "Empathetic" | "Direct" | "Clinical";

export interface VoiceSettings {
  speakingRate: number;
  tone: ResponseTone;
}

export interface ProfileSettings {
  fullName: string;
  emergencyContact: string;
}

export interface ConnectionState {
  appleHealth: boolean;
  myChartConnected: boolean;
}

export interface PrivacySettings {
  allowClinicalSummaries: boolean;
  deidentifiedResearch: boolean;
}

export interface SettingsState {
  profile: ProfileSettings;
  connections: ConnectionState;
  privacy: PrivacySettings;
  voice: VoiceSettings;
}

export interface VitalsState {
  irregularRhythm: boolean;
}
