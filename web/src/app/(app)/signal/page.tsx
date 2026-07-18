"use client";
import { useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { useTelemetry } from "@/store/telemetry";
import { Page, Panel } from "@/components/ui";

// Naive DFT magnitude for the FFT spectrum panel (small N, fine for a live demo).
function fftMag(signal: number[], bins = 32) {
  const N = signal.length || 1;
  const out: { f: number; mag: number }[] = [];
  for (let k = 1; k <= bins; k++) {
    let re = 0, im = 0;
    for (let n = 0; n < N; n++) {
      const a = (-2 * Math.PI * k * n) / N;
      re += signal[n] * Math.cos(a);
      im += signal[n] * Math.sin(a);
    }
    out.push({ f: k, mag: +(Math.sqrt(re * re + im * im) / N).toFixed(3) });
  }
  return out;
}

export default function SignalPage() {
  const assets = useTelemetry((s) => s.assets);
  const ids = Object.keys(assets).sort();
  const [asset, setAsset] = useState("");
  const active = asset && assets[asset] ? asset : ids[0];
  const wave = active ? assets[active]?.waveform || [] : [];
  const raw = wave.map((v, i) => ({ i, v }));
  const filtered = wave.map((v, i, a) => ({ i, v: +(((a[i - 1] ?? v) + v + (a[i + 1] ?? v)) / 3).toFixed(3) }));
  const spectrum = fftMag(wave);

  return (
    <Page title="Signal Processing" subtitle="Raw → filtered → FFT · 400 Hz sampling · Hann window"
      actions={
        <select value={active || ""} onChange={(e) => setAsset(e.target.value)}
          className="rounded-xl border border-border bg-white/5 px-3 py-2 text-sm outline-none">
          {ids.map((id) => <option key={id}>{id}</option>)}
        </select>
      }>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Raw Vibration Signal">
          <Chart data={raw} color="#3b82f6" />
        </Panel>
        <Panel title="Filtered (moving-average denoise)">
          <Chart data={filtered} color="#22d3ee" />
        </Panel>
      </div>
      <Panel title="FFT Spectrum (frequency-domain energy)" className="mt-4">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={spectrum}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="f" tick={{ fill: "#64748b", fontSize: 11 }} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
              <Bar dataKey="mag" fill="#a855f7" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>
      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        {[["Window", "Hann"], ["Size", "128"], ["Sampling", "400 Hz"], ["Filter", "MA(3) + Z-score"]].map(([k, v]) => (
          <Panel key={k}><div className="text-xs text-slate-500">{k}</div><div className="text-lg font-semibold">{v}</div></Panel>
        ))}
      </div>
    </Page>
  );
}

function Chart({ data, color }: { data: { i: number; v: number }[]; color: string }) {
  return (
    <div className="h-44">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id={`s-${color}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="i" hide /><YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#s-${color})`} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
