"use client";

import { useEffect, useRef } from "react";
import type { TurnResponse } from "./types";

interface Props {
  turns: TurnResponse[];
  recordingRole: "patient" | "doctor" | null;
  processing: boolean;
}

export function TranscriptPane({ turns, recordingRole, processing }: Props) {
  const endRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns.length, processing, recordingRole]);

  return (
    <div className="flex-1 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-6">
      {turns.length === 0 && !recordingRole && !processing && (
        <div className="flex h-full items-center justify-center text-slate-400">
          Press and hold PATIENT or DOCTOR to begin.
        </div>
      )}
      <ul className="space-y-4">
        {turns.map((t) => (
          <li key={t.turn_index} className="rounded-xl bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2">
              <span
                className={
                  "rounded-full px-3 py-0.5 text-xs font-semibold uppercase tracking-wide " +
                  (t.role === "patient"
                    ? "bg-sky-100 text-sky-700"
                    : "bg-emerald-100 text-emerald-700")
                }
              >
                {t.role}
              </span>
              <span className="text-xs text-slate-400">
                turn #{t.turn_index + 1}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Raw
                </div>
                <div className="mt-1 text-slate-700">{t.raw || "—"}</div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Cleaned
                </div>
                <div className="mt-1 text-slate-900 font-medium">{t.cleaned || "—"}</div>
              </div>
            </div>
          </li>
        ))}
        {(recordingRole || processing) && (
          <li className="rounded-xl border border-dashed border-slate-300 bg-white p-4">
            <div className="flex items-center gap-3 text-slate-500">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-500" />
              {recordingRole ? `Listening to ${recordingRole}…` : "Processing…"}
            </div>
          </li>
        )}
        <div ref={endRef} />
      </ul>
    </div>
  );
}
