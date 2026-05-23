"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

interface ZoeLogoProps {
  size?: number;
  className?: string;
  rounded?: "full" | "lg" | "md" | "none";
  ring?: boolean;
  priority?: boolean;
}

/**
 * Otter mascot. Source PNG has a white background, so circular slots crop it
 * cleanly with `rounded-full` + `overflow-hidden`. Pixel art stays crisp via
 * `image-rendering: pixelated`.
 */
export function ZoeLogo({
  size = 40,
  className,
  rounded = "full",
  ring = true,
  priority = false,
}: ZoeLogoProps) {
  const roundedCls =
    rounded === "full"
      ? "rounded-full"
      : rounded === "lg"
      ? "rounded-2xl"
      : rounded === "md"
      ? "rounded-lg"
      : "";

  return (
    <span
      role="img"
      aria-label="Zoe"
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden bg-white",
        ring && "ring-1 ring-foreground/10",
        roundedCls,
        className
      )}
      style={{ width: size, height: size }}
    >
      <Image
        src="/zoe-logo.png"
        alt=""
        width={size * 2}
        height={size * 2}
        sizes={`${size}px`}
        className="absolute inset-0 m-auto h-full w-full object-cover"
        style={{ imageRendering: "pixelated", objectPosition: "center" }}
        unoptimized
        priority={priority}
      />
    </span>
  );
}
