import { useState } from "react";
import { useTelemetry, bandColor } from "./telemetry.js";
import AssetCard from "./components/AssetCard.jsx";
import AssetDetail from "./components/AssetDetail.jsx";
import AlertFeed from "./components/AlertFeed.jsx";
import InjectPanel from "./components/InjectPanel.jsx";

export default function App() {
  const { assets, history, alerts, connected, send } = useTelemetry();
  const [selected, setSelected] = useState(null);

  const assetIds = Object.keys(assets).sort();
  const frames = assetIds.map((id) => assets[id]);

  // Fleet summary
  const maxRisk = frames.reduce((m, f) => Math.max(m, f.risk_index ?? 0), 0);
  const criticalCount = frames.filter((f) => (f.diagnosis?.risk_band === "Critical")).length;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-name">NeuroSync</span>
          <span className="brand-sub">AI Command Center · Oil &amp; Gas Risk Intelligence</span>
        </div>
        <div className="topbar-right">
          <span className={`conn ${connected ? "conn-on" : "conn-off"}`}>
            {connected ? "● live" : "○ reconnecting"}
          </span>
        </div>
      </header>

      {!selected && (
        <main className="command-center">
          <section className="fleet-summary">
            <div className="summary-tile">
              <div className="summary-num">{assetIds.length}</div>
              <div className="summary-label">Assets monitored</div>
            </div>
            <div className="summary-tile">
              <div className="summary-num" style={{ color: bandColor(
                maxRisk >= 90 ? "Critical" : maxRisk >= 75 ? "High" : "Safe") }}>
                {Math.round(maxRisk)}
              </div>
              <div className="summary-label">Highest risk index</div>
            </div>
            <div className="summary-tile">
              <div className="summary-num" style={{ color: criticalCount ? "#e74c3c" : "#2ecc71" }}>
                {criticalCount}
              </div>
              <div className="summary-label">Critical assets</div>
            </div>
          </section>

          <div className="cc-body">
            <section className="asset-grid">
              {frames.length === 0 && (
                <div className="waiting">Waiting for telemetry… start the mock server or bridge on ws://localhost:8765</div>
              )}
              {assetIds.map((id) => (
                <AssetCard key={id} frame={assets[id]} history={history[id]}
                           onClick={() => setSelected(id)} />
              ))}
            </section>

            <aside className="cc-side">
              <AlertFeed alerts={alerts} />
              {assetIds.length > 0 && (
                <InjectPanel assetId={assetIds[0]} onSend={send} />
              )}
            </aside>
          </div>
        </main>
      )}

      {selected && assets[selected] && (
        <AssetDetail frame={assets[selected]} history={history[selected]}
                     onSend={send} onBack={() => setSelected(null)} />
      )}
    </div>
  );
}
