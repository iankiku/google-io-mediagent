"use client";

import type { Role } from "./types";

interface Props {
  disabled: boolean;
  recordingRole: Role | null;
  onPressStart: (role: Role) => void;
  onPressEnd: () => void;
}

export function RoleToggle({ disabled, recordingRole, onPressStart, onPressEnd }: Props) {
  const handleStart = (role: Role) => () => {
    if (disabled || recordingRole) return;
    onPressStart(role);
  };
  const handleEnd = () => {
    if (!recordingRole) return;
    onPressEnd();
  };

  const baseClasses =
    "flex-1 select-none rounded-3xl border-4 px-12 py-16 text-4xl font-semibold transition-all duration-150 ease-out";
  const idleClasses = "bg-white border-slate-300 text-slate-700 hover:bg-slate-50 active:bg-slate-100";
  const activeClasses = "bg-rose-500 border-rose-600 text-white scale-[0.98] shadow-inner";
  const disabledClasses = "opacity-40 cursor-not-allowed";

  const buttonClass = (role: Role) => {
    if (disabled) return `${baseClasses} ${idleClasses} ${disabledClasses}`;
    if (recordingRole === role) return `${baseClasses} ${activeClasses}`;
    if (recordingRole && recordingRole !== role) return `${baseClasses} ${idleClasses} ${disabledClasses}`;
    return `${baseClasses} ${idleClasses}`;
  };

  return (
    <div className="flex w-full gap-6">
      <button
        type="button"
        disabled={disabled}
        onMouseDown={handleStart("patient")}
        onMouseUp={handleEnd}
        onMouseLeave={recordingRole === "patient" ? handleEnd : undefined}
        onTouchStart={handleStart("patient")}
        onTouchEnd={handleEnd}
        className={buttonClass("patient")}
      >
        {recordingRole === "patient" ? "Listening…" : "PATIENT"}
        <div className="mt-2 text-sm font-normal opacity-70">hold to speak</div>
      </button>
      <button
        type="button"
        disabled={disabled}
        onMouseDown={handleStart("doctor")}
        onMouseUp={handleEnd}
        onMouseLeave={recordingRole === "doctor" ? handleEnd : undefined}
        onTouchStart={handleStart("doctor")}
        onTouchEnd={handleEnd}
        className={buttonClass("doctor")}
      >
        {recordingRole === "doctor" ? "Listening…" : "DOCTOR"}
        <div className="mt-2 text-sm font-normal opacity-70">hold to speak</div>
      </button>
    </div>
  );
}
