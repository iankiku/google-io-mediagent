"use client";

import { MessageSquare, LineChart, History, Settings as SettingsIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ZoieView } from "./types";

interface SidebarProps {
  active: ZoieView;
  onChange: (view: ZoieView) => void;
}

interface NavItem {
  id: ZoieView;
  label: string;
  icon: typeof MessageSquare;
}

const NAV_ITEMS: NavItem[] = [
  { id: "talk", label: "Talk", icon: MessageSquare },
  { id: "insights", label: "Insights", icon: LineChart },
  { id: "timeline", label: "Medical Timeline", icon: History },
];

export function Sidebar({ active, onChange }: SidebarProps) {
  return (
    <aside className="w-[240px] shrink-0 border-r border-sidebar-border bg-sidebar flex flex-col h-full">
      <div className="px-6 pt-6 pb-5">
        <button
          type="button"
          className="flex items-center gap-3 w-full text-left outline-none"
          onClick={() => onChange("talk")}
        >
          <div className="w-10 h-10 rounded-full bg-[color:var(--zoie-lilac-soft)] flex items-center justify-center font-semibold text-foreground ring-1 ring-foreground/10">
            Z
          </div>
          <div className="leading-tight">
            <p className="font-semibold text-[15px] tracking-tight">Zoie</p>
            <p className="text-[11px] text-muted-foreground">Health Companion</p>
          </div>
        </button>
      </div>

      <nav className="px-3 flex-1 flex flex-col gap-1.5">
        {NAV_ITEMS.map((item) => {
          const isActive = item.id === active;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className={cn(
                "relative flex items-center gap-3 px-3 h-10 rounded-xl text-sm transition-all outline-none focus-visible:ring-2 focus-visible:ring-foreground/15",
                isActive
                  ? "bg-sidebar-accent text-foreground font-semibold shadow-[0_1px_2px_rgba(20,20,40,0.04),0_2px_8px_-2px_rgba(20,20,40,0.06)] ring-1 ring-foreground/5"
                  : "text-foreground/70 hover:text-foreground hover:bg-sidebar-accent/60"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="w-[18px] h-[18px]" />
              <span>{item.label}</span>
              {isActive && (
                <span
                  aria-hidden
                  className="absolute -right-3 top-1/2 -translate-y-1/2 w-2.5 h-7 rounded-r-full bg-sidebar-accent ring-1 ring-foreground/5 shadow-[1px_1px_2px_rgba(20,20,40,0.05)]"
                />
              )}
            </button>
          );
        })}
      </nav>

      <div className="px-3 pb-5 pt-3">
        <button
          type="button"
          onClick={() => onChange("settings")}
          className={cn(
            "flex items-center gap-3 px-3 h-10 w-full rounded-xl text-sm transition-all outline-none focus-visible:ring-2 focus-visible:ring-foreground/15",
            active === "settings"
              ? "bg-sidebar-accent text-foreground font-semibold ring-1 ring-foreground/5"
              : "text-foreground/70 hover:text-foreground hover:bg-sidebar-accent/60"
          )}
        >
          <SettingsIcon className="w-[18px] h-[18px]" />
          <span>Settings</span>
        </button>
      </div>
    </aside>
  );
}
