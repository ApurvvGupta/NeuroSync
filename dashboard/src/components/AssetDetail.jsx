import LineChart from "./LineChart.jsx";
import RiskGauge from "./RiskGauge.jsx";
import InjectPanel from "./InjectPanel.jsx";
import { bandColor } from "../telemetry.js";

const isCritical = (state) => /Critical|Replacement/.test(state || "");

function ModuleCard({ name, mod }) {
  if (!mod) return null;
  const crit = isCritical(mod.state);
  return (
    <div className={`module-card ${crit ? "module-crit" : ""}`}>
      <div className="module-name">{name}</div>
      <div className="module-state">{mod.state}</div>
      <div className="module-sev-bar">
        <div className="module-sev-fill"
             style={{ width: `${mod.severity}%`, background: crit ? "#e74c3c" : "#4aa3ff" }} />
      </div>
      <div className="module-sev-num">{Math.round(mod.severity)}/100</div>
    </div>
  );
}

/** Full asset view: risk index, per-module states, root cause + action, charts. */
export default function AssetDetail({ frame, history = [], onSend, onBack }) {
  const d = frame.diagnosis || {};
  const color = bandColor(d.risk_band);
  const vib = history.map((f) => f.vibration_rms ?? 0);
  const temp = history.map((f) => f.temperature ?? 0);
  const gas = history.map((f) => f.gas_mq2 ?? 0);

  return (
    <div className="asset-detail">
      <div className="detail-head">
        <button className="back-btn" onClick={onBack}>← Fleet</button>
        <h2>{frame.asset_id}</h2>
        <span className="detail-src">source: {frame.source}</span>
      </div>

      <div className="detail-top">
        <div className="detail-gauge">
          <RiskGauge value={frame.risk_index ?? 0} size={160} />
          {d.warming_up && <div className="warming">Sensors warming up…</div>}
        </div>

        <div className="diagnosis-box" style={{ borderColor: color }}>
          <div className="diag-label">Fused diagnosis</div>
          <div className="diag-cause">{d.root_cause}</div>
          <div className="diag-action" style={{ color }}>→ {d.recommended_action}</div>
          {frame.fault_type && frame.fault_type !== "none" && (
            <div className="diag-fault">Fault type: <b>{frame.fault_type}</b></div>
          )}
        </div>
      </div>

      <div className="module-grid">
        <ModuleCard name="Gas" mod={d.modules?.gas} />
        <ModuleCard name="Vibration" mod={d.modules?.vibration} />
        <ModuleCard name="Temperature" mod={d.modules?.temperature} />
        <ModuleCard name="Corrosion" mod={d.modules?.corrosion} />
      </div>

      <div className="chart-grid">
        <div className="chart-box">
          <div className="chart-title">Vibration waveform</div>
          <LineChart data={frame.waveform || []} color="#4aa3ff" width={520} height={90} fill={false} />
        </div>
        <div className="chart-box">
          <div className="chart-title">Vibration RMS trend</div>
          <LineChart data={vib} color="#4aa3ff" width={250} height={80} />
        </div>
        <div className="chart-box">
          <div className="chart-title">Temperature trend (°C)</div>
          <LineChart data={temp} color="#e67e22" width={250} height={80} />
        </div>
        <div className="chart-box">
          <div className="chart-title">Gas (MQ-2) trend</div>
          <LineChart data={gas} color="#e74c3c" width={250} height={80} />
        </div>
      </div>

      <InjectPanel assetId={frame.asset_id} onSend={onSend} />
    </div>
  );
}
