"use client";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { bandColor } from "@/lib/ui";
import { riskBand } from "@/lib/fusion";

// --- Page wrapper with entrance transition --- //
export function Page({ title, subtitle, children, actions }: {
  title: string; subtitle?: string; children: React.ReactNode; actions?: React.ReactNode;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
        </div>
        {actions}
      </div>
      {children}
    </motion.div>
  );
}

export function Panel({ title, children, className = "", right }: {
  title?: string; children: React.ReactNode; className?: string; right?: React.ReactNode;
}) {
  return (
    <div className={`card ${className}`}>
      {title && (
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

export function StatCard({ label, value, unit, icon: Icon, accent = "#22d3ee", hint }: {
  label: string; value: string | number; unit?: string; icon: LucideIcon; accent?: string; hint?: string;
}) {
  return (
    <motion.div whileHover={{ y: -3 }} className="card relative overflow-hidden">
      <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-20 blur-2xl" style={{ background: accent }} />
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-slate-400">{label}</span>
        <Icon className="h-5 w-5" style={{ color: accent }} />
      </div>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-3xl font-bold">{value}</span>
        {unit && <span className="text-sm text-slate-400">{unit}</span>}
      </div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </motion.div>
  );
}

export function SeverityBar({ severity, critical }: { severity: number; critical?: boolean }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
      <div className="h-full rounded-full transition-all"
        style={{ width: `${Math.min(100, severity)}%`, background: critical ? "#ef4444" : "#3b82f6" }} />
    </div>
  );
}

export function RiskGauge({ value, size = 150 }: { value: number; size?: number }) {
  const band = riskBand(value);
  const color = bandColor(band);
  const r = size / 2 - 12;
  const c = 2 * Math.PI * r;
  const dash = c * (Math.max(0, Math.min(100, value)) / 100);
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={12} fill="none" />
        <motion.circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={12} fill="none"
          strokeLinecap="round" strokeDasharray={`${dash} ${c}`}
          initial={false} animate={{ strokeDasharray: `${dash} ${c}` }} transition={{ duration: 0.6 }} />
      </svg>
      <div className="absolute text-center">
        <div className="text-3xl font-bold" style={{ color }}>{Math.round(value)}</div>
        <div className="text-xs font-semibold" style={{ color }}>{band}</div>
      </div>
    </div>
  );
}

export function Badge({ children, color = "#64748b" }: { children: React.ReactNode; color?: string }) {
  return (
    <span className="rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ background: `${color}22`, color }}>{children}</span>
  );
}
