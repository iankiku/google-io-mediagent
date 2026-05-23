"use client";

import Image from "next/image";
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
      <span className="zoe-orb-halo" />
      <div
        className={cn(
          "zoe-otter-orb relative overflow-hidden",
          listening && "zoe-otter-orb--listening"
        )}
        style={{ width: size, height: size }}
      >
        <Image
          src="/zoe-logo.png"
          alt=""
          width={size}
          height={size}
          sizes={`${size}px`}
          className="h-full w-full object-cover"
          style={{ imageRendering: "pixelated", objectPosition: "center" }}
          unoptimized
          priority
        />
      </div>
    </div>
  );
}
