import LineChart from "./LineChart.jsx";
import { bandColor } from "../telemetry.js";

const MODULE_LABELS = { gas: "Gas", vibration: "Vibration", temperature: "Temp", corrosion: "Corrosion" };

/** Compact asset summary card for the Command Center grid. */
export default function AssetCard({ frame, history = [], onClick }) {
  const d = frame.diagnosis || {};
  const band = d.risk_band || "Safe";
  const color = bandColor(band);
  const vib = history.map((f) => f.vibration_rms ?? 0);
  const warming = d.warming_up;

  return (
    <button className="asset-card" style={{ borderColor: color }} onClick={onClick}>
      <div className="asset-card-head">
        <span className="asset-id">{frame.asset_id}</span>
        <span className="risk-pill" style={{ background: color }}>
          {Math.round(frame.risk_index ?? 0)}
        </span>
      </div>

      <div className="asset-card-band" style={{ color }}>{band}</div>

      {warming && <div className="warming">Sensors warming up…</div>}

      <div className="module-chips">
        {["gas", "vibration", "temperature", "corrosion"].map((m) => {
          const mod = d.modules?.[m];
          const crit = mod && /Critical|Replacement/.test(mod.state);
          return (
            <span key={m} className={`chip ${crit ? "chip-crit" : ""}`}>
              {MODULE_LABELS[m]}: {mod?.state ?? "—"}
            </span>
          );
        })}
      </div>

      <LineChart data={vib} color={color} width={240} height={44} />
      <div className="asset-card-foot">
        {frame.temperature != null && <span>{frame.temperature.toFixed(1)}°C</span>}
        <span>vib {(frame.vibration_rms ?? 0).toFixed(2)}</span>
        <span className="src">{frame.source}</span>
      </div>
    </button>
  );
}
