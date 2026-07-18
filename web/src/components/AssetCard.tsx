"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import type { TelemetryFrame } from "@/types/telemetry";
import { bandColor, isCriticalState } from "@/lib/ui";

const MODS: { key: keyof TelemetryFrame["diagnosis"]["modules"]; label: string }[] = [
  { key: "gas", label: "Gas" }, { key: "vibration", label: "Vibration" },
  { key: "temperature", label: "Temp" }, { key: "corrosion", label: "Corrosion" },
];

export default function AssetCard({ frame, history }: { frame: TelemetryFrame; history: TelemetryFrame[] }) {
  const d = frame.diagnosis;
  const color = bandColor(d?.risk_band);
  const data = history.slice(-40).map((f, i) => ({ i, v: f.vibration_rms ?? 0 }));

  return (
    <Link href={`/monitoring?asset=${frame.asset_id}`}>
      <motion.div whileHover={{ y: -4 }} className="card cursor-pointer border-l-4" style={{ borderLeftColor: color }}>
        <div className="flex items-center justify-between">
          <span className="font-bold">{frame.asset_id}</span>
          <span className="rounded-lg px-2.5 py-0.5 text-sm font-bold text-black" style={{ background: color }}>
            {Math.round(frame.risk_index ?? 0)}
          </span>
        </div>
        <div className="mt-0.5 text-xs font-semibold" style={{ color }}>{d?.risk_band}</div>
        {d?.warming_up && <div className="mt-1 text-xs text-risk-elevated">Sensors warming up…</div>}

        <div className="mt-3 flex flex-wrap gap-1.5">
          {MODS.map(({ key, label }) => {
            const m = d?.modules[key];
            const crit = isCriticalState(m?.state);
            return (
              <span key={key} className={`rounded-md px-2 py-0.5 text-[11px] ${crit ? "bg-risk-critical/20 text-red-300" : "bg-white/5 text-slate-400"}`}>
                {label}: {m?.state ?? "—"}
              </span>
            );
          })}
        </div>

        <div className="mt-3 h-12">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id={`g-${frame.asset_id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#g-${frame.asset_id})`} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-2 flex gap-3 text-xs text-slate-400">
          {frame.temperature != null && <span>{frame.temperature.toFixed(1)}°C</span>}
          <span>vib {(frame.vibration_rms ?? 0).toFixed(2)}</span>
          <span className="ml-auto uppercase">{frame.source}</span>
        </div>
      </motion.div>
    </Link>
  );
}
