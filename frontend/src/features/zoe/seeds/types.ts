import type { ComponentType } from "react";
import type {
  DetailSection,
  EntryTone,
  LabResult,
  ScanItem,
} from "../TimelineEntryDetail";

export type EntryTier = "primary" | "sub";
export type EntrySource = "self" | "agent" | "clinical";

export interface TimelineEntry {
  id: string;
  tier: EntryTier;
  source?: EntrySource;
  date: string;
  title: string;
  description: string;
  expandedDescription?: string;
  icon: ComponentType<{ className?: string }>;
  tone: EntryTone;
  badge?: { label: string; tone: EntryTone };
  attachments?: { name: string; type: "pdf" | "img" }[];
  aiTakeaway?: string;
  attachedDocsLabel?: string;
  attachedImagesLabel?: string;
  showViewPdf?: boolean;
  collapsible?: boolean;
  hasClinicalNotes?: boolean;
  /** Sub-tier entries are nested under the closest preceding primary entry. */
  parentId?: string;
  labResults?: LabResult[];
  scans?: ScanItem[];
  /** Optional structured sections (postvisit.ai-style detail breakdown). */
  sections?: DetailSection[];
}

export interface HealthSignal {
  label: string;
  value: string;
  tone: EntryTone;
}

export interface HealthSummary {
  updated: string;
  headline: string;
  body: string;
  signals: HealthSignal[];
}

export interface PersonaDemographics {
  /** "58M" / "64M" — age + sex shorthand used on cards. */
  ageSex: string;
  /** Body mass index, two-decimal string e.g. "27.2". */
  bmi: string;
  /** Two-letter language pill, e.g. "HI" (Hindi), "ZH" (Mandarin). */
  languageTag: string;
  /** Specialty bucket — "Cardiology" / "Endocrinology" etc. */
  specialty: string;
  /** Card numbering prefix shown before the name. */
  cardNumber: string;
  /** Optional /public path to a portrait. If absent, picker renders a glyph. */
  photo?: string;
  /** 1-2 sentence presenting complaint shown on the card. */
  presenting: string;
}

export interface PersonaTimeline {
  /** Stable key (used in URLs / switcher state). */
  id: "ravi" | "zhang";
  /** Display name shown in the persona switcher. */
  displayName: string;
  /** Short tag shown next to the name (e.g. "Diabetes", "AFib"). */
  conditionTag: string;
  demographics: PersonaDemographics;
  summary: HealthSummary;
  entries: TimelineEntry[];
}
