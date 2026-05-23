"use client";

import { createContext, useContext, type ReactNode } from "react";

export type ZoeTalkContextValue = {
  listening: boolean;
  onOrbTap: () => void;
};

const ZoeTalkContext = createContext<ZoeTalkContextValue | null>(null);

export function ZoeTalkProvider({
  value,
  children,
}: {
  value: ZoeTalkContextValue;
  children: ReactNode;
}) {
  return (
    <ZoeTalkContext.Provider value={value}>{children}</ZoeTalkContext.Provider>
  );
}

export function useZoeTalk() {
  const ctx = useContext(ZoeTalkContext);
  if (!ctx) {
    throw new Error("useZoeTalk must be used within ZoeTalkProvider");
  }
  return ctx;
}
