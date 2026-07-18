"use client";
import { useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTelemetry } from "@/store/telemetry";
import { Page, Panel, RiskGauge, SeverityBar } from "@/components/ui";
import InjectPanel from "@/components/InjectPanel";
import { bandColor, isCriticalState } from "@/lib/ui";

const CHART = { grid: "rgba(255,255,255,0.06)" };

export default function MonitoringPage() {
  const assets = useTelemetry((s) => s.assets);
  const history = useTelemetry((s) => s.history);
  const ids = Object.keys(assets).sort();
  const [asset, setAsset] = useState<string>("");
  const active = asset && assets[asset] ? asset : ids[0];
  const frame = active ? assets[active] : undefined;
  const hist = (active ? history[active] : [])?.slice(-80) || [];

  const series = hist.map((f, i) => ({
    i, rms: f.vibration_rms, temp: f.temperature ?? 0, gas: f.gas_mq2 ?? 0,
  }));
  const wave = (frame?.waveform || []).map((v, i) => ({ i, v }));

  if (!frame) return <Page title="Live Monitoring"><div className="text-slate-500">Connecting…</div></Page>;
  const d = frame.diagnosis;
  const color = bandColor(d?.risk_band);

  return (
    <Page title="Live Monitoring" subtitle="Real-time sensor streams · MPU6050 · DS18B20 · MQ-2 / MQ135"
      actions={
        <select value={active} onChange={(e) => setAsset(e.target.value)}
          className="rounded-xl border border-border bg-white/5 px-3 py-2 text-sm outline-none">
          {ids.map((id) => <option key={id} value={id}>{id}</option>)}
        </select>
      }>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="Vibration RMS (mm/s)" className="lg:col-span-2">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series}>
                <CartesianGrid stroke={CHART.grid} />
                <XAxis dataKey="i" tick={{ fill: "#64748b", fontSize: 11 }} />
                <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#0b111a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }} />
                <Line type="monotone" dataKey="rms" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Fused Risk">
          <div className="flex flex-col items-center">
            <RiskGauge value={frame.risk_index ?? 0} />
            <div className="mt-3 rounded-xl border p-3 text-center text-sm" style={{ borderColor: color }}>
              <div className="font-semibold">{d?.root_cause}</div>
              <div className="mt-1 text-xs" style={{ color }}>→ {d?.recommended_action}</div>
            </div>
          </div>
        </Panel>
      </div>

      <Panel title="Vibration Waveform (live window)" className="mt-4">
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={wave}>
              <CartesianGrid stroke={CHART.grid} />
              <XAxis dataKey="i" hide />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
              <Line type="monotone" dataKey="v" stroke="#22d3ee" strokeWidth={1.5} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Panel title="Temperature (°C)">
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series}>
                <CartesianGrid stroke={CHART.grid} />
                <XAxis dataKey="i" hide /><YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
                <Line type="monotone" dataKey="temp" stroke="#f39c12" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Gas (MQ-2 raw)">
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series}>
                <CartesianGrid stroke={CHART.grid} />
                <XAxis dataKey="i" hide /><YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
                <Line type="monotone" dataKey="gas" stroke="#ef4444" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {(["gas", "vibration", "temperature", "corrosion"] as const).map((k) => {
          const m = d?.modules[k];
          const crit = isCriticalState(m?.state);
          return (
            <Panel key={k} title={k[0].toUpperCase() + k.slice(1)}>
              <div className="text-lg font-semibold">{m?.state}</div>
              <div className="mt-2"><SeverityBar severity={m?.severity ?? 0} critical={crit} /></div>
              <div className="mt-1 text-xs text-slate-500">{Math.round(m?.severity ?? 0)}/100</div>
            </Panel>
          );
        })}
      </div>

      <div className="mt-4"><InjectPanel assetId={active} /></div>
    </Page>
  );
}
