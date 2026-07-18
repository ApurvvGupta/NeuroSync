"use client";
import { Search, Bell, Sun } from "lucide-react";
import { useTelemetry } from "@/store/telemetry";

export default function Topbar() {
  const source = useTelemetry((s) => s.source);
  const alerts = useTelemetry((s) => s.alerts);

  const badge =
    source === "live" ? { t: "● Live hardware", c: "text-risk-safe" }
    : source === "mock" ? { t: "● Simulated feed", c: "text-brand-cyan" }
    : { t: "○ Connecting…", c: "text-slate-400" };

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-border bg-black/30 px-6 backdrop-blur-xl">
      <div className="relative w-full max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input placeholder="Search assets, alerts, models…"
          className="w-full rounded-xl border border-border bg-white/5 py-2 pl-10 pr-3 text-sm outline-none placeholder:text-slate-500 focus:border-brand-cyan/50" />
      </div>

      <div className="ml-auto flex items-center gap-4">
        <span className={`text-xs font-medium ${badge.c}`}>{badge.t}</span>
        <button className="relative rounded-lg p-2 hover:bg-white/5">
          <Bell className="h-5 w-5 text-slate-300" />
          {alerts.length > 0 && (
            <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-risk-critical px-1 text-[10px] font-bold text-white">
              {alerts.length}
            </span>
          )}
        </button>
        <button className="rounded-lg p-2 hover:bg-white/5"><Sun className="h-5 w-5 text-slate-300" /></button>
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-brand-gradient text-sm font-bold text-white">OP</div>
          <div className="hidden leading-tight sm:block">
            <div className="text-sm font-medium">Operator</div>
            <div className="text-[11px] text-slate-500">Control Room</div>
          </div>
        </div>
      </div>
    </header>
  );
}
