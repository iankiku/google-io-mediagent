"use client";

import { createContext, useContext, type ReactNode } from "react";

export type ZoieTalkContextValue = {
  listening: boolean;
  onOrbTap: () => void;
};

const ZoieTalkContext = createContext<ZoieTalkContextValue | null>(null);

export function ZoieTalkProvider({
  value,
  children,
}: {
  value: ZoieTalkContextValue;
  children: ReactNode;
}) {
  return (
    <ZoieTalkContext.Provider value={value}>{children}</ZoieTalkContext.Provider>
  );
}

export function useZoieTalk() {
  const ctx = useContext(ZoieTalkContext);
  if (!ctx) {
    throw new Error("useZoieTalk must be used within ZoieTalkProvider");
  }
  return ctx;
}
