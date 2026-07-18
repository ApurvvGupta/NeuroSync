"use client";
import { create } from "zustand";
import type { TelemetryFrame, AlertItem, InjectCommand } from "@/types/telemetry";
import { createMockFeed } from "@/lib/mockFeed";

const HISTORY_LEN = 120;
const MAX_ALERTS = 50;
const WS_URL = "ws://localhost:8765";

interface TelemetryState {
  assets: Record<string, TelemetryFrame>;
  history: Record<string, TelemetryFrame[]>;
  alerts: AlertItem[];
  connected: boolean;
  source: "live" | "mock" | "connecting";
  _started: boolean;
  start: () => void;
  send: (cmd: InjectCommand) => void;
}

let ws: WebSocket | null = null;
let mock: ReturnType<typeof createMockFeed> | null = null;
const lastBand: Record<string, string> = {};

export const useTelemetry = create<TelemetryState>((set, get) => ({
  assets: {},
  history: {},
  alerts: [],
  connected: false,
  source: "connecting",
  _started: false,

  start: () => {
    if (get()._started || typeof window === "undefined") return;
    set({ _started: true });

    const ingest = (frame: TelemetryFrame) => {
      const id = frame.asset_id;
      if (!id) return;
      set((s) => {
        const buf = (s.history[id] || []).concat(frame).slice(-HISTORY_LEN);
        const band = frame.diagnosis?.risk_band;
        let alerts = s.alerts;
        if (band && band !== lastBand[id] && (band === "High" || band === "Critical")) {
          alerts = [{
            ts: frame.ts, asset_id: id, band, risk_index: frame.risk_index,
            root_cause: frame.diagnosis.root_cause, action: frame.diagnosis.recommended_action,
          }, ...alerts].slice(0, MAX_ALERTS);
        }
        lastBand[id] = band;
        return { assets: { ...s.assets, [id]: frame }, history: { ...s.history, [id]: buf }, alerts };
      });
    };

    const startMock = () => {
      if (mock) return;
      mock = createMockFeed(ingest);
      set({ source: "mock", connected: false });
    };

    try {
      ws = new WebSocket(WS_URL);
      const failTimer = setTimeout(() => { if (ws?.readyState !== WebSocket.OPEN) { ws?.close(); startMock(); } }, 2000);
      ws.onopen = () => { clearTimeout(failTimer); mock?.stop(); mock = null; set({ connected: true, source: "live" }); };
      ws.onmessage = (e) => { try { ingest(JSON.parse(e.data)); } catch { /* ignore */ } };
      ws.onclose = () => { set({ connected: false }); startMock(); };
      ws.onerror = () => ws?.close();
    } catch {
      startMock();
    }
  },

  send: (cmd) => {
    if (ws && ws.readyState === WebSocket.OPEN) { ws.send(JSON.stringify(cmd)); return; }
    if (!mock) return;
    if (cmd.cmd === "inject") mock.inject(cmd.asset, cmd.fault);
    else mock.clear(cmd.asset);
  },
}));
