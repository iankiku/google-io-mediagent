import {
  Activity,
  AlertTriangle,
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  FlaskConical,
  History,
  Star,
} from "lucide-react";
import type { DetailSection } from "../TimelineEntryDetail";
import type { PersonaTimeline, TimelineEntry } from "./types";

/**
 * Demo-grade synthesizer: builds a postvisit.ai-style 7-section breakdown for
 * every timeline entry from the fields the entry already provides. Section
 * labels are fixed (HPI / Reported Symptoms / Physical Examination / Assessment
 * / Plan / Follow-up / Doctor's Recommendations) so the detail panel reads the
 * same shape every time. Where structured data is absent, we fall back to a
 * short summary line; the row's "Ask" pill still works.
 */
function defaultRecommendationsFor(entry: TimelineEntry): string[] {
  if (entry.tier === "sub") {
    return [
      "Continue current medications and self-monitoring.",
      "Log any new symptoms or side effects in Zoe.",
      "Bring this entry up at the next clinic visit.",
    ];
  }
  return [
    "Follow medication plan exactly as discussed.",
    "Track any new or worsening symptoms in Zoe.",
    "Schedule the recommended labs and follow-ups on time.",
  ];
}

function deriveSections(entry: TimelineEntry): DetailSection[] {
  if (entry.sections && entry.sections.length > 0) return entry.sections;

  const expanded = entry.expandedDescription ?? entry.description;
  const isClinical = entry.tier === "primary";

  const sections: DetailSection[] = [
    {
      id: `${entry.id}-hpi`,
      title: "History of Present Illness",
      icon: History,
      tone: "lilac",
      summary: entry.description,
      body: expanded !== entry.description ? expanded : undefined,
      defaultOpen: true,
    },
    {
      id: `${entry.id}-symptoms`,
      title: "Reported Symptoms",
      icon: ClipboardList,
      tone: "amber",
      summary:
        entry.source === "self"
          ? entry.description
          : "Patient-reported symptoms summarized in the HPI above.",
    },
    {
      id: `${entry.id}-exam`,
      title: "Physical Examination",
      icon: Activity,
      tone: "mint",
      summary: isClinical
        ? "Vitals and focused exam findings documented in the encounter note."
        : "No in-person exam — agent / self-report event.",
    },
    {
      id: `${entry.id}-assessment`,
      title: "Assessment",
      icon: FlaskConical,
      tone: "lilac",
      summary:
        entry.aiTakeaway ??
        entry.badge?.label ??
        "Clinical assessment captured in HPI.",
      body: entry.aiTakeaway,
      labRows: entry.labResults,
    },
    {
      id: `${entry.id}-plan`,
      title: "Plan",
      icon: Star,
      tone: "lilac",
      summary: isClinical
        ? "Medication, monitoring, and lifestyle plan recorded in HPI."
        : "Continue current plan; no changes from this event.",
    },
    {
      id: `${entry.id}-followup`,
      title: "Follow-up",
      icon: CalendarClock,
      tone: "mint",
      summary: isClinical
        ? "Next clinic visit + interval lab schedule per discussion."
        : "Resume normal cadence; agent will check in on the usual schedule.",
    },
    {
      id: `${entry.id}-recommendations`,
      title: "Doctor's Recommendations",
      icon: AlertTriangle,
      tone: "amber",
      summary: "Actionable steps for the patient.",
      items: defaultRecommendationsFor(entry),
      defaultOpen: true,
    },
  ];

  // Drop "Reported Symptoms" pill for purely-clinical events with no symptom data
  // — keeps the layout from showing a redundant row for lab-only entries.
  if (entry.tier === "primary" && entry.source === undefined) {
    // keep it — primary visits typically have symptom content in the HPI
  }

  // Replace the "Assessment" body with the takeaway when we have one, leave the
  // labRows attached so they render inside the section.
  if (!entry.aiTakeaway && entry.labResults) {
    sections.find((s) => s.id.endsWith("-assessment"))!.body =
      "Lab values from this visit are listed below.";
  }

  return sections;
}

/** Attach a derived `sections[]` to every entry in the persona that lacks one. */
export function withDerivedSections(persona: PersonaTimeline): PersonaTimeline {
  const entries = persona.entries.map((e) => ({
    ...e,
    sections: deriveSections(e),
  }));
  return { ...persona, entries };
}
