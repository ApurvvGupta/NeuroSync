"use client";
import { useState } from "react";
import { Page, Panel } from "@/components/ui";

export default function SettingsPage() {
  const [port, setPort] = useState("COM5");
  const [baud, setBaud] = useState("115200");
  const [model, setModel] = useState("1D-CNN INT8 (student)");
  const [threshold, setThreshold] = useState(75);

  return (
    <Page title="Settings" subtitle="Connection, model, thresholds and profile">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Serial Connection">
          <Field label="Serial / COM Port">
            <input value={port} onChange={(e) => setPort(e.target.value)} className="input" />
          </Field>
          <Field label="Baud Rate">
            <select value={baud} onChange={(e) => setBaud(e.target.value)} className="input">
              {["9600", "57600", "115200", "230400"].map((b) => <option key={b}>{b}</option>)}
            </select>
          </Field>
          <p className="text-xs text-slate-500">Bridge command: <code className="text-brand-cyan">python main.py --serial {port} --baud {baud}</code></p>
        </Panel>

        <Panel title="Model & Detection">
          <Field label="Active Model">
            <select value={model} onChange={(e) => setModel(e.target.value)} className="input">
              <option>1D-CNN INT8 (student)</option>
              <option>1D-CNN teacher (X Elite)</option>
              <option>Z-score fallback only</option>
            </select>
          </Field>
          <Field label={`Alert threshold (risk ≥ ${threshold})`}>
            <input type="range" min={25} max={95} value={threshold} onChange={(e) => setThreshold(+e.target.value)} className="w-full accent-brand-cyan" />
          </Field>
        </Panel>

        <Panel title="Preferences">
          <Toggle label="Dark mode" defaultOn />
          <Toggle label="Desktop notifications" defaultOn />
          <Toggle label="Sound on critical alert" />
        </Panel>

        <Panel title="User Profile">
          <Field label="Name"><input defaultValue="Control Room Operator" className="input" /></Field>
          <Field label="Email"><input defaultValue="operator@neurosync.io" className="input" /></Field>
          <button className="btn-primary mt-2">Save changes</button>
        </Panel>
      </div>

      <style jsx global>{`
        .input { width: 100%; border-radius: 12px; border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.05); padding: 0.55rem 0.75rem; outline: none; color: #e6edf3; }
      `}</style>
    </Page>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="mb-3 block text-sm"><span className="mb-1 block text-slate-400">{label}</span>{children}</label>;
}
function Toggle({ label, defaultOn }: { label: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(!!defaultOn);
  return (
    <div className="mb-3 flex items-center justify-between">
      <span className="text-sm text-slate-300">{label}</span>
      <button onClick={() => setOn(!on)} className={`h-6 w-11 rounded-full p-0.5 transition ${on ? "bg-brand-blue" : "bg-white/10"}`}>
        <span className={`block h-5 w-5 rounded-full bg-white transition ${on ? "translate-x-5" : ""}`} />
      </button>
    </div>
  );
}
