"use client";
import { useTelemetry } from "@/store/telemetry";
import { bandColor } from "@/lib/ui";
import { ShieldCheck } from "lucide-react";

const fmt = (ts: number) => new Date(ts).toLocaleTimeString();

export default function AlertFeed({ limit = 8 }: { limit?: number }) {
  const alerts = useTelemetry((s) => s.alerts).slice(0, limit);
  return (
    <div className="card">
      <h3 className="mb-3 text-sm font-semibold text-slate-200">Active Alerts</h3>
      {alerts.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <ShieldCheck className="h-4 w-4 text-risk-safe" /> All assets nominal.
        </div>
      )}
      <div className="flex flex-col gap-2">
        {alerts.map((a, i) => (
          <div key={`${a.ts}-${i}`} className="rounded-xl border-l-2 bg-white/5 p-3" style={{ borderLeftColor: bandColor(a.band) }}>
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold">{a.asset_id}</span>
              <span style={{ color: bandColor(a.band) }} className="font-semibold">{a.band} · {Math.round(a.risk_index)}</span>
              <span className="ml-auto text-slate-500">{fmt(a.ts)}</span>
            </div>
            <div className="mt-1 text-sm">{a.root_cause}</div>
            <div className="mt-0.5 text-xs text-slate-400">→ {a.action}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
