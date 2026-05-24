"use client";

import Image from "next/image";
import { CheckCircle2, User } from "lucide-react";
import { PERSONAS, type PersonaId } from "./seeds";
import type { PersonaTimeline } from "./seeds/types";

interface PersonaPickerViewProps {
  onSelect: (id: PersonaId) => void;
}

const PLACEHOLDER_TILES = [
  { num: "03", title: "Sofia Kowalska", demo: "48F · BMI 31.8", specialty: "Cardiology", lang: "EN", presenting: "Pre-operative cardiac clearance for gastric bypass surgery…" },
  { num: "04", title: "Henri Lambert", demo: "69M · BMI 26.8", specialty: "Cardiology", lang: "FR", presenting: "Routine hypertension follow-up with medication adjustment and lifestyle…" },
];

export function PersonaPickerView({ onSelect }: PersonaPickerViewProps) {
  return (
    <div className="h-full overflow-y-auto zoe-scroll bg-[color:var(--background)]">
      <div className="mx-auto max-w-[1180px] px-8 lg:px-12 py-14">
        {/* Header */}
        <div className="flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2.5">
            <span className="inline-flex w-7 h-7 items-center justify-center rounded-full bg-[color:var(--zoe-mint-soft)] text-[color:var(--zoe-mint)]">
              <CheckCircle2 className="w-4 h-4" />
            </span>
            <h1 className="text-[28px] md:text-[32px] font-semibold tracking-tight">
              Select Demo Scenario
            </h1>
          </div>
          <p className="mt-3 max-w-[640px] text-[13.5px] md:text-sm text-muted-foreground leading-relaxed">
            Select a patient to start a demo session. Each scenario loads a
            realistic visit transcript and clinical data relevant to the
            individual pathology.
          </p>
        </div>

        {/* Cards */}
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {PERSONAS.map((p) => (
            <PersonaCard key={p.id} persona={p} onSelect={() => onSelect(p.id)} />
          ))}
          {PLACEHOLDER_TILES.map((tile) => (
            <PlaceholderCard key={tile.num} {...tile} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────── Card ───────────────────── */

function PersonaCard({
  persona,
  onSelect,
}: {
  persona: PersonaTimeline;
  onSelect: () => void;
}) {
  const d = persona.demographics;
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group relative text-left rounded-2xl bg-card ring-1 ring-[color:var(--zoe-mint)]/35 hover:ring-[color:var(--zoe-mint)]/60 transition-all overflow-hidden shadow-[0_1px_2px_rgba(20,20,40,0.03),0_2px_14px_-6px_rgba(20,20,40,0.10)] hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-8px_rgba(20,20,40,0.14)] outline-none focus-visible:ring-2 focus-visible:ring-foreground/25"
    >
      {/* Portrait area */}
      <div className="relative aspect-[4/3] bg-[color:var(--zoe-sand)] flex items-center justify-center">
        {d.photo ? (
          <Image
            src={d.photo}
            alt={`${persona.displayName} portrait`}
            fill
            sizes="(max-width: 768px) 100vw, 280px"
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-foreground/30">
            <User className="w-10 h-10" strokeWidth={1.4} />
          </div>
        )}

        {/* Language pill (top-right) */}
        <span className="absolute top-3 right-3 inline-flex items-center h-6 px-2 rounded-md bg-foreground/80 text-background text-[10px] font-semibold tracking-wide">
          {d.languageTag}
        </span>

        {/* Specialty chip (bottom-left) */}
        <span className="absolute bottom-3 left-3 inline-flex items-center h-6 px-2.5 rounded-md bg-foreground/85 text-background text-[10.5px] font-medium">
          {d.specialty}
        </span>
      </div>

      {/* Meta */}
      <div className="px-4 py-4">
        <p className="text-[13px] font-semibold text-foreground">
          <span className="text-muted-foreground mr-1.5">{d.cardNumber}</span>—
          <span className="ml-1.5">{persona.displayName}</span>
        </p>
        <p className="mt-1 text-[12px] text-muted-foreground tabular-nums">
          {d.ageSex} · BMI {d.bmi}
        </p>
        <p className="mt-2.5 text-[12.5px] italic text-[color:var(--zoe-lilac)] leading-snug line-clamp-3">
          {d.presenting}
        </p>
      </div>
    </button>
  );
}

function PlaceholderCard({
  num,
  title,
  demo,
  specialty,
  lang,
  presenting,
}: {
  num: string;
  title: string;
  demo: string;
  specialty: string;
  lang: string;
  presenting: string;
}) {
  return (
    <div className="relative rounded-2xl bg-card ring-1 ring-foreground/10 overflow-hidden opacity-70">
      <div className="relative aspect-[4/3] bg-[color:var(--zoe-sand)]/60 flex items-center justify-center">
        <User className="w-10 h-10 text-foreground/20" strokeWidth={1.4} />
        <span className="absolute top-3 right-3 inline-flex items-center h-6 px-2 rounded-md bg-foreground/40 text-background text-[10px] font-semibold tracking-wide">
          {lang}
        </span>
        <span className="absolute bottom-3 left-3 inline-flex items-center h-6 px-2.5 rounded-md bg-foreground/40 text-background text-[10.5px] font-medium">
          {specialty}
        </span>
      </div>
      <div className="px-4 py-4">
        <p className="text-[13px] font-semibold text-foreground/80">
          <span className="text-muted-foreground mr-1.5">{num}</span>—
          <span className="ml-1.5">{title}</span>
        </p>
        <p className="mt-1 text-[12px] text-muted-foreground tabular-nums">
          {demo}
        </p>
        <p className="mt-2.5 text-[12.5px] italic text-muted-foreground leading-snug line-clamp-3">
          {presenting}
        </p>
      </div>
    </div>
  );
}
