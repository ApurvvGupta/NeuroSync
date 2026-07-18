import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { RiskBand } from "@/types/telemetry";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function bandColor(band?: RiskBand | string): string {
  switch (band) {
    case "Safe": return "#2ecc71";
    case "Watch": return "#9bd64a";
    case "Elevated": return "#f1c40f";
    case "High": return "#f39c12";
    case "Critical": return "#ef4444";
    default: return "#64748b";
  }
}

export const isCriticalState = (state?: string) => /Critical|Replacement/.test(state || "");
