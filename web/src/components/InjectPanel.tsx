"use client";
import { Flame, Thermometer, Waves, Droplets, Zap, X } from "lucide-react";
import { useTelemetry } from "@/store/telemetry";
import type { InjectCommand } from "@/types/telemetry";

type FaultKey = "vibration" | "temperature" | "gas" | "corrosion" | "fusion";
const FAULTS: { key: FaultKey; label: string; icon: typeof Waves; star?: boolean }[] = [
  { key: "vibration", label: "Vibration", icon: Waves },
  { key: "temperature", label: "Temp Rise", icon: Thermometer },
  { key: "gas", label: "Gas Leak", icon: Flame },
  { key: "corrosion", label: "Corrosion", icon: Droplets },
  { key: "fusion", label: "Gas + Heat", icon: Zap, star: true },
];

export default function InjectPanel({ assetId }: { assetId: string }) {
  const send = useTelemetry((s) => s.send);
  const go = (cmd: InjectCommand) => send(cmd);

  return (
    <div className="card">
      <div className="mb-3 text-sm font-semibold text-slate-200">Demo — inject fault → {assetId}</div>
      <div className="grid grid-cols-2 gap-2">
        {FAULTS.map(({ key, label, icon: Icon, star }) => (
          <button key={key} onClick={() => go({ cmd: "inject", asset: assetId, fault: key })}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
              star ? "border-brand-cyan/60 text-brand-cyan hover:bg-brand-cyan/10" : "border-border text-slate-300 hover:border-brand-blue/50 hover:bg-white/5"}`}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
        <button onClick={() => go({ cmd: "clear", asset: assetId })}
          className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm text-risk-safe hover:bg-white/5">
          <X className="h-4 w-4" /> Clear
        </button>
      </div>
      <p className="mt-3 text-[11px] text-slate-500">On real hardware, faults are triggered physically (motor, gas near MQ-2). Same result on screen.</p>
    </div>
  );
}
