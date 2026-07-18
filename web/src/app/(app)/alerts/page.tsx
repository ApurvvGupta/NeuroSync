"use client";
import { useState } from "react";
import { Mail, MessageSquare, Phone, Bell } from "lucide-react";
import { useTelemetry } from "@/store/telemetry";
import { Page, Panel } from "@/components/ui";
import { bandColor } from "@/lib/ui";

const CHANNELS = [
  { key: "email", label: "Email", icon: Mail },
  { key: "sms", label: "SMS", icon: Phone },
  { key: "whatsapp", label: "WhatsApp", icon: MessageSquare },
  { key: "push", label: "Push", icon: Bell },
];

export default function AlertsPage() {
  const alerts = useTelemetry((s) => s.alerts);
  const [on, setOn] = useState<Record<string, boolean>>({ email: true, sms: true, whatsapp: false, push: true });

  return (
    <Page title="Alerts" subtitle="Critical & warning notifications · multi-channel dispatch">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {CHANNELS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setOn((o) => ({ ...o, [key]: !o[key] }))}
            className={`card flex items-center gap-3 transition ${on[key] ? "ring-1 ring-brand-cyan/50" : "opacity-60"}`}>
            <Icon className={`h-6 w-6 ${on[key] ? "text-brand-cyan" : "text-slate-500"}`} />
            <div className="text-left">
              <div className="text-sm font-medium">{label}</div>
              <div className="text-xs text-slate-500">{on[key] ? "Enabled" : "Off"}</div>
            </div>
          </button>
        ))}
      </div>

      <Panel title="Alert History" className="mt-4">
        {alerts.length === 0 && <div className="text-sm text-slate-500">No alerts yet. Trigger a fault to populate.</div>}
        <div className="flex flex-col gap-2">
          {alerts.map((a, i) => (
            <div key={i} className="flex items-center gap-4 rounded-xl border-l-2 bg-white/5 p-3" style={{ borderLeftColor: bandColor(a.band) }}>
              <div className="w-24 shrink-0 text-xs text-slate-500">{new Date(a.ts).toLocaleTimeString()}</div>
              <span className="rounded-md px-2 py-0.5 text-xs font-semibold" style={{ background: `${bandColor(a.band)}22`, color: bandColor(a.band) }}>{a.band}</span>
              <span className="font-medium">{a.asset_id}</span>
              <span className="text-sm text-slate-300">{a.root_cause}</span>
              <span className="ml-auto text-xs text-slate-500">risk {Math.round(a.risk_index)}</span>
            </div>
          ))}
        </div>
      </Panel>
    </Page>
  );
}
