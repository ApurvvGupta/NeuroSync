"use client";
import { FileText, FileSpreadsheet, Download } from "lucide-react";
import { useTelemetry } from "@/store/telemetry";
import { Page, Panel } from "@/components/ui";
import { bandColor } from "@/lib/ui";

export default function ReportsPage() {
  const alerts = useTelemetry((s) => s.alerts);
  return (
    <Page title="Reports" subtitle="Generate fault, prediction and maintenance reports">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          { t: "Fault Report", d: "All detected faults with root cause + action", icon: FileText },
          { t: "Prediction History", d: "RUL estimates and confidence over time", icon: FileSpreadsheet },
          { t: "Maintenance Report", d: "Scheduled interventions & downtime avoided", icon: FileText },
        ].map((r) => (
          <Panel key={r.t}>
            <r.icon className="h-8 w-8 text-brand-cyan" />
            <h3 className="mt-3 font-semibold">{r.t}</h3>
            <p className="mt-1 text-sm text-slate-400">{r.d}</p>
            <div className="mt-4 flex gap-2">
              <button className="btn-ghost flex-1 justify-center"><Download className="h-4 w-4" /> PDF</button>
              <button className="btn-ghost flex-1 justify-center"><Download className="h-4 w-4" /> Excel</button>
            </div>
          </Panel>
        ))}
      </div>

      <Panel title="Recent Events (export preview)" className="mt-4">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-slate-500">
            <tr><th className="py-2">Time</th><th>Asset</th><th>Band</th><th>Root cause</th><th>Risk</th></tr>
          </thead>
          <tbody>
            {alerts.length === 0 && <tr><td colSpan={5} className="py-4 text-slate-500">No events yet.</td></tr>}
            {alerts.map((a, i) => (
              <tr key={i} className="border-t border-border">
                <td className="py-2 text-slate-400">{new Date(a.ts).toLocaleTimeString()}</td>
                <td className="font-medium">{a.asset_id}</td>
                <td style={{ color: bandColor(a.band) }}>{a.band}</td>
                <td className="text-slate-300">{a.root_cause}</td>
                <td>{Math.round(a.risk_index)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </Page>
  );
}
