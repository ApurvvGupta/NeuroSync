"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, Activity, Waves, BrainCircuit, TrendingUp, BarChart3,
  Network, Bell, Cpu, Settings, ChevronLeft, ShieldAlert, FileText,
} from "lucide-react";
import { cn } from "@/lib/ui";

const NAV = [
  { href: "/dashboard", label: "Command Center", icon: LayoutDashboard },
  { href: "/monitoring", label: "Live Monitoring", icon: Activity },
  { href: "/signal", label: "Signal Processing", icon: Waves },
  { href: "/ai-model", label: "AI Model", icon: BrainCircuit },
  { href: "/predictions", label: "Predictions & RUL", icon: TrendingUp },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/architecture", label: "System Architecture", icon: Network },
  { href: "/hardware", label: "Hardware", icon: Cpu },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={cn("sticky top-0 h-screen shrink-0 border-r border-border bg-black/30 backdrop-blur-xl transition-all",
      collapsed ? "w-[76px]" : "w-64")}>
      <div className="flex h-16 items-center gap-2 px-4">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-gradient font-bold text-white">N</div>
        {!collapsed && (
          <div className="leading-tight">
            <div className="font-bold gradient-text">NeuroSync</div>
            <div className="text-[10px] text-slate-500">Risk Intelligence</div>
          </div>
        )}
      </div>

      <nav className="mt-2 flex flex-col gap-1 px-2">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link key={href} href={href}
              className={cn("group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
                active ? "bg-brand-blue/15 text-white shadow-inner" : "text-slate-400 hover:bg-white/5 hover:text-white")}>
              <Icon className={cn("h-5 w-5 shrink-0", active && "text-brand-cyan")} />
              {!collapsed && <span>{label}</span>}
              {active && !collapsed && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-cyan" />}
            </Link>
          );
        })}
      </nav>

      <button onClick={() => setCollapsed((c) => !c)}
        className="absolute bottom-4 left-0 right-0 mx-auto flex w-[85%] items-center justify-center gap-2 rounded-xl border border-border py-2 text-xs text-slate-400 hover:text-white">
        <ChevronLeft className={cn("h-4 w-4 transition", collapsed && "rotate-180")} />
        {!collapsed && "Collapse"}
      </button>
    </aside>
  );
}
