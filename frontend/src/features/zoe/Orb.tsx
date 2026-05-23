"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

interface OrbProps {
  size?: number;
  listening?: boolean;
  className?: string;
}

export function Orb({ size = 220, listening = false, className }: OrbProps) {
  const otterSize = Math.round(size * 0.78);

  return (
    <div
      className={cn("relative inline-block", className)}
      style={{ width: size, height: size }}
    >
      <span className="zoe-orb-halo" />
      <div
        className={cn("zoe-otter-orb", listening && "zoe-otter-orb--listening")}
        style={{ width: size, height: size }}
      >
        <Image
          src="/zoe-logo.png"
          alt=""
          width={otterSize}
          height={otterSize}
          sizes={`${otterSize}px`}
          className="zoe-otter-orb__art relative z-10"
          style={{ imageRendering: "pixelated" }}
          unoptimized
          priority
        />
      </div>
    </div>
  );
}
