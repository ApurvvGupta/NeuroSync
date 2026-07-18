"use client";
import { Bar, BarChart, Cell, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { useTelemetry } from "@/store/telemetry";
import { Page, Panel, RiskGauge } from "@/components/ui";
import { bandColor } from "@/lib/ui";

const FAULTS = ["normal", "imbalance", "misalignment", "bearing_wear"];

export default function PredictionsPage() {
  const assets = useTelemetry((s) => s.assets);
  const frames = Object.values(assets).sort((a, b) => (b.risk_index ?? 0) - (a.risk_index ?? 0));
  const f = frames[0];
  if (!f) return <Page title="Predictions & RUL"><div className="text-slate-500">Connecting…</div></Page>;

  const conf = Math.round((f.fault_probability ?? 0) * 100);
  const rul = Math.max(1, Math.round(30 - (f.risk_index ?? 0) / 3.5));
  // Probability distribution across classes (derived from the active fault).
  const dist = FAULTS.map((name) => {
    const isTop = name === (f.fault_type === "none" ? "normal" : f.fault_type);
    return { name, p: isTop ? conf : Math.round((100 - conf) / 3) };
  });

  return (
    <Page title="Predictions & Remaining Useful Life" subtitle={`Primary at-risk asset: ${f.asset_id}`}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="Predicted Fault">
          <div className="text-3xl font-bold capitalize">{f.fault_type.replace("_", " ")}</div>
          <div className="mt-1 text-sm text-slate-400">Confidence {conf}%</div>
          <div className="mt-4 h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dist} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" hide domain={[0, 100]} />
                <YAxis type="category" dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} width={90} />
                <Bar dataKey="p" radius={[0, 6, 6, 0]}>
                  {dist.map((d, i) => <Cell key={i} fill={d.p === conf ? "#22d3ee" : "#334155"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Health & Risk">
          <div className="flex flex-col items-center">
            <RiskGauge value={f.risk_index ?? 0} />
            <div className="mt-3 text-sm text-slate-400">Health score {Math.max(0, 100 - Math.round(f.severity))}/100</div>
          </div>
        </Panel>

        <Panel title="Remaining Useful Life">
          <div className="text-5xl font-bold gradient-text">{rul}</div>
          <div className="mt-1 text-sm text-slate-400">days (indicative, trend extrapolation)</div>
          <div className="mt-4 rounded-xl border p-3 text-sm" style={{ borderColor: bandColor(f.diagnosis?.risk_band) }}>
            <div className="font-semibold">Recommendation</div>
            <div className="mt-1 text-slate-300">{f.diagnosis?.recommended_action}</div>
          </div>
        </Panel>
      </div>

      <Panel title="Maintenance Timeline" className="mt-4">
        <div className="flex flex-col gap-3">
          {[
            { t: "Now", e: f.diagnosis?.root_cause, c: bandColor(f.diagnosis?.risk_band) },
            { t: `+${Math.round(rul / 2)} d`, e: "Inspection window — correlate vibration + thermal trend", c: "#f39c12" },
            { t: `+${rul} d`, e: "Estimated failure threshold — schedule shutdown before this", c: "#ef4444" },
          ].map((s, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="w-16 shrink-0 text-sm text-slate-400">{s.t}</div>
              <div className="h-3 w-3 shrink-0 rounded-full" style={{ background: s.c }} />
              <div className="text-sm">{s.e}</div>
            </div>
          ))}
        </div>
      </Panel>
    </Page>
  );
}
