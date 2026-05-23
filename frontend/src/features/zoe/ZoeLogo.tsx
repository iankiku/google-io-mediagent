"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

interface ZoeLogoProps {
  size?: number;
  className?: string;
  rounded?: "full" | "lg" | "md" | "none";
  ring?: boolean;
  priority?: boolean;
  /**
   * Whether to wrap the otter in a soft pad/disc. Off by default — the source
   * art is transparent and reads best on whatever surface sits behind it.
   */
  padded?: boolean;
}

/**
 * Otter mascot lockup. Pixel-art source → render with `image-rendering: pixelated`
 * for crisp edges at any size.
 */
export function ZoeLogo({
  size = 40,
  className,
  rounded = "none",
  ring = false,
  padded = false,
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
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden",
        padded && "bg-[color:var(--zoe-sand)]",
        ring && "ring-1 ring-foreground/10",
        roundedCls,
        className
      )}
      style={{ width: size, height: size }}
    >
      <Image
        src="/zoe-logo.png"
        alt=""
        width={size}
        height={size}
        sizes={`${size}px`}
        className="h-full w-full object-contain"
        style={{ imageRendering: "pixelated" }}
        unoptimized
        priority={priority}
      />
    </span>
  );
}
