"use client";
import { useEffect } from "react";
import { useTelemetry } from "@/store/telemetry";

// Kicks off the telemetry feed once on mount (tries live WS, falls back to mock).
export default function TelemetryProvider({ children }: { children: React.ReactNode }) {
  const start = useTelemetry((s) => s.start);
  useEffect(() => { start(); }, [start]);
  return <>{children}</>;
}
