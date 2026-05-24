import type { PersonaTimeline } from "./types";
import { RAVI } from "./ravi";
import { ZHANG } from "./zhang";
import { withDerivedSections } from "./derive";

export type PersonaId = PersonaTimeline["id"];

const RAVI_FULL = withDerivedSections(RAVI);
const ZHANG_FULL = withDerivedSections(ZHANG);

export const PERSONAS: PersonaTimeline[] = [RAVI_FULL, ZHANG_FULL];

export const PERSONA_BY_ID: Record<PersonaId, PersonaTimeline> = {
  ravi: RAVI_FULL,
  zhang: ZHANG_FULL,
};

export const DEFAULT_PERSONA: PersonaId = "ravi";

export type { PersonaTimeline } from "./types";
