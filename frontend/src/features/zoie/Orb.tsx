"use client";

import { cn } from "@/lib/utils";

interface OrbProps {
  size?: number;
  listening?: boolean;
  className?: string;
}

export function Orb({ size = 220, listening = false, className }: OrbProps) {
  return (
    <div
      className={cn("relative inline-block", className)}
      style={{ width: size, height: size }}
    >
      <span className="zoie-orb-halo" />
      <div
        className={cn("zoie-orb", listening && "zoie-orb--listening")}
        style={{ width: size, height: size }}
      />
    </div>
  );
}
