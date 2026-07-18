"use client";
import { Activity, Cpu, Gauge, ShieldAlert, Timer, Zap } from "lucide-react";
import { useTelemetry } from "@/store/telemetry";
import { Page, StatCard, Panel, RiskGauge } from "@/components/ui";
import AssetCard from "@/components/AssetCard";
import AlertFeed from "@/components/AlertFeed";
import InjectPanel from "@/components/InjectPanel";

export default function DashboardPage() {
  const assets = useTelemetry((s) => s.assets);
  const history = useTelemetry((s) => s.history);
  const ids = Object.keys(assets).sort();
  const frames = ids.map((id) => assets[id]);

  const maxRisk = frames.reduce((m, f) => Math.max(m, f.risk_index ?? 0), 0);
  const worst = frames.slice().sort((a, b) => (b.risk_index ?? 0) - (a.risk_index ?? 0))[0];
  const criticalCount = frames.filter((f) => f.diagnosis?.risk_band === "Critical").length;
  const avgConfidence = frames.length
    ? Math.round((frames.reduce((s, f) => s + (f.fault_probability ?? 0), 0) / frames.length) * 100) : 0;

  return (
    <Page title="Command Center" subtitle="Fleet-wide edge AI risk intelligence · Snapdragon X Elite">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Assets Monitored" value={ids.length} icon={Activity} accent="#22d3ee" hint="Live edge nodes" />
        <StatCard label="Highest Risk Index" value={Math.round(maxRisk)} icon={Gauge} accent="#f39c12" hint={worst?.asset_id} />
        <StatCard label="Critical Assets" value={criticalCount} icon={ShieldAlert} accent="#ef4444" hint="Immediate action" />
        <StatCard label="NPU Inference" value="0.9" unit="ms" icon={Zap} accent="#a855f7" hint="STM32 TinyML < 1 ms" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel title="Monitored Assets">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {frames.length === 0 && <div className="text-sm text-slate-500">Connecting to telemetry…</div>}
              {ids.map((id) => <AssetCard key={id} frame={assets[id]} history={history[id] || []} />)}
            </div>
          </Panel>
        </div>

        <div className="flex flex-col gap-4">
          <Panel title="Highest-Risk Asset">
            {worst ? (
              <div className="flex flex-col items-center">
                <RiskGauge value={worst.risk_index ?? 0} />
                <div className="mt-2 font-semibold">{worst.asset_id}</div>
                <div className="mt-1 text-center text-xs text-slate-400">{worst.diagnosis?.root_cause}</div>
              </div>
            ) : <div className="text-sm text-slate-500">—</div>}
          </Panel>
          <div className="grid grid-cols-2 gap-4">
            <StatCard label="Prediction Conf." value={`${avgConfidence}%`} icon={Cpu} accent="#3b82f6" />
            <StatCard label="X Elite NPU" value="45" unit="TOPS" icon={Timer} accent="#22d3ee" />
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2"><AlertFeed /></div>
        {ids[0] && <InjectPanel assetId={ids[0]} />}
      </div>
    </Page>
  );
}
