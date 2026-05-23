"use client";

interface Props {
  status: "idle" | "active" | "recording" | "processing" | "ended" | "error";
  sourceLanguage: string;
  turnCount: number;
  onStart: () => void;
  onEnd: () => void;
}

export function SessionControls({ status, sourceLanguage, turnCount, onStart, onEnd }: Props) {
  const active = status !== "idle" && status !== "ended";
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-6 py-4">
      <div className="flex flex-col">
        <div className="text-xs uppercase tracking-wide text-slate-400">Session</div>
        <div className="text-lg font-semibold text-slate-800">
          {status === "idle" && "Not started"}
          {status === "active" && "Active"}
          {status === "recording" && "Recording…"}
          {status === "processing" && "Processing…"}
          {status === "ended" && "Ended"}
          {status === "error" && "Error"}
        </div>
        <div className="mt-1 text-xs text-slate-500">
          Patient language: <span className="font-mono">{sourceLanguage}</span> · {turnCount} turn(s)
        </div>
      </div>
      <div className="flex gap-3">
        {!active && (
          <button
            type="button"
            onClick={onStart}
            className="rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white hover:bg-slate-800"
          >
            Start visit
          </button>
        )}
        {active && (
          <button
            type="button"
            onClick={onEnd}
            className="rounded-xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-700 hover:bg-slate-50"
          >
            End visit
          </button>
        )}
      </div>
    </div>
  );
}
