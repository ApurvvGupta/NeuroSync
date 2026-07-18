import { useEffect, useRef, useState, useCallback } from "react";

/**
 * useTelemetry — connects to the NeuroSync telemetry WebSocket (mock_server or
 * the QRB2210 bridge, both on the same frozen contract) and exposes:
 *   assets    : { [assetId]: latestFrame }
 *   history   : { [assetId]: frame[] }      (rolling window for charts)
 *   alerts    : alert[]                      (High/Critical transitions)
 *   connected : boolean
 *   send(cmd) : send a fault-injection command back over the socket
 */
const HISTORY_LEN = 120; // ~1 min at 2 Hz
const MAX_ALERTS = 50;

export function useTelemetry(url = "ws://localhost:8765") {
  const [assets, setAssets] = useState({});
  const [history, setHistory] = useState({});
  const [alerts, setAlerts] = useState([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const bandRef = useRef({}); // last risk_band per asset, to detect transitions

  useEffect(() => {
    let closed = false;
    let retry;

    const connect = () => {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        if (!closed) retry = setTimeout(connect, 1500); // auto-reconnect
      };
      ws.onerror = () => ws.close();

      ws.onmessage = (event) => {
        let frame;
        try {
          frame = JSON.parse(event.data);
        } catch {
          return;
        }
        const id = frame.asset_id;
        if (!id) return;

        setAssets((prev) => ({ ...prev, [id]: frame }));
        setHistory((prev) => {
          const buf = (prev[id] || []).concat(frame).slice(-HISTORY_LEN);
          return { ...prev, [id]: buf };
        });

        // Emit an alert when an asset escalates into High or Critical.
        const band = frame.diagnosis?.risk_band;
        const prevBand = bandRef.current[id];
        if (band && band !== prevBand && (band === "High" || band === "Critical")) {
          setAlerts((prev) =>
            [{
              ts: frame.ts,
              asset_id: id,
              band,
              risk_index: frame.risk_index,
              root_cause: frame.diagnosis?.root_cause,
              action: frame.diagnosis?.recommended_action,
            }, ...prev].slice(0, MAX_ALERTS)
          );
        }
        bandRef.current[id] = band;
      };
    };

    connect();
    return () => {
      closed = true;
      clearTimeout(retry);
      wsRef.current?.close();
    };
  }, [url]);

  const send = useCallback((cmd) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(cmd));
  }, []);

  return { assets, history, alerts, connected, send };
}

// --- Risk band -> color (shared across components) --- //
export function bandColor(band) {
  switch (band) {
    case "Safe": return "#2ecc71";
    case "Watch": return "#9bd64a";
    case "Elevated": return "#f1c40f";
    case "High": return "#e67e22";
    case "Critical": return "#e74c3c";
    default: return "#7f8c8d";
  }
}

export function riskBandFromIndex(risk) {
  if (risk < 25) return "Safe";
  if (risk < 50) return "Watch";
  if (risk < 75) return "Elevated";
  if (risk < 90) return "High";
  return "Critical";
}
