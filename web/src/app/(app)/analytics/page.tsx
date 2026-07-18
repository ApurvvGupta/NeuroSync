"use client";
import { Area, AreaChart, Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Page, Panel, StatCard } from "@/components/ui";
import { Clock, TrendingDown, Wrench, Activity } from "lucide-react";

const weekly = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => ({ d, alerts: [3, 5, 2, 6, 4, 1, 2][i], downtime: [1.2, 2.1, 0.5, 3.0, 1.8, 0.3, 0.6][i] }));
const faults = [
  { name: "Bearing wear", value: 38, color: "#3b82f6" },
  { name: "Imbalance", value: 24, color: "#22d3ee" },
  { name: "Gas leak", value: 18, color: "#ef4444" },
  { name: "Corrosion", value: 12, color: "#a855f7" },
  { name: "Thermal", value: 8, color: "#f39c12" },
];

export default function AnalyticsPage() {
  return (
    <Page title="Analytics" subtitle="Fleet trends · failure distribution · downtime avoided">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Downtime Avoided" value="27" unit="d/yr" icon={Clock} accent="#22d3ee" />
        <StatCard label="Est. Cost Saved" value="$5.1M" icon={TrendingDown} accent="#2ecc71" />
        <StatCard label="Predictions" value="1,284" icon={Activity} accent="#3b82f6" />
        <StatCard label="Interventions" value="46" icon={Wrench} accent="#a855f7" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="Weekly Alert Trend" className="lg:col-span-2">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekly}>
                <XAxis dataKey="d" tick={{ fill: "#64748b", fontSize: 11 }} /><YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#0b111a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }} />
                <Bar dataKey="alerts" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Failure Distribution">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={faults} dataKey="value" innerRadius={45} outerRadius={80} paddingAngle={3}>
                  {faults.map((f, i) => <Cell key={i} fill={f.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#0b111a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {faults.map((f) => <span key={f.name} className="flex items-center gap-1 text-slate-400"><span className="h-2 w-2 rounded-full" style={{ background: f.color }} />{f.name}</span>)}
          </div>
        </Panel>
      </div>

      <Panel title="Monthly Downtime (hours)" className="mt-4">
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={weekly}>
              <defs><linearGradient id="dt" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22d3ee" stopOpacity={0.4} /><stop offset="100%" stopColor="#22d3ee" stopOpacity={0} /></linearGradient></defs>
              <XAxis dataKey="d" tick={{ fill: "#64748b", fontSize: 11 }} /><YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
              <Area type="monotone" dataKey="downtime" stroke="#22d3ee" fill="url(#dt)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </Page>
  );
}
