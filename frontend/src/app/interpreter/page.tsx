"use client";

import { useState } from "react";
import { useInterpreter } from "@/features/interpreter/useInterpreter";
import { RoleToggle } from "@/features/interpreter/RoleToggle";
import { TranscriptPane } from "@/features/interpreter/TranscriptPane";
import { SessionControls } from "@/features/interpreter/SessionControls";

const DEFAULT_USER_ID =
  process.env.NEXT_PUBLIC_DEMO_USER_ID || "demo-patient-uuid-001";

export default function InterpreterPage() {
  const [userId] = useState<string>(DEFAULT_USER_ID);
  const {
    status,
    sourceLanguage,
    turns,
    error,
    recordingRole,
    start,
    beginTurn,
    endTurn,
    end,
  } = useInterpreter(userId);

  const sessionActive = status !== "idle" && status !== "ended" && status !== "error";
  const buttonsDisabled = !sessionActive || status === "processing";

  return (
    <main className="flex h-screen w-screen flex-col gap-4 bg-slate-100 p-6">
      <SessionControls
        status={status}
        sourceLanguage={sourceLanguage}
        turnCount={turns.length}
        onStart={start}
        onEnd={end}
      />
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}
      <TranscriptPane
        turns={turns}
        recordingRole={recordingRole}
        processing={status === "processing"}
      />
      <RoleToggle
        disabled={buttonsDisabled}
        recordingRole={recordingRole}
        onPressStart={beginTurn}
        onPressEnd={endTurn}
      />
    </main>
  );
}
