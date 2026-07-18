import { bandColor } from "../telemetry.js";

const fmt = (ts) => new Date(ts).toLocaleTimeString();

/** Chronological High/Critical alert feed — the "weak-signal trail". */
export default function AlertFeed({ alerts = [] }) {
  return (
    <div className="alert-feed">
      <h3>Active Alerts</h3>
      {alerts.length === 0 && <div className="alert-empty">No active alerts. All assets nominal.</div>}
      {alerts.map((a, i) => (
        <div key={`${a.ts}-${i}`} className="alert-row" style={{ borderLeftColor: bandColor(a.band) }}>
          <div className="alert-row-head">
            <span className="alert-asset">{a.asset_id}</span>
            <span className="alert-band" style={{ color: bandColor(a.band) }}>
              {a.band} · {Math.round(a.risk_index)}
            </span>
            <span className="alert-time">{fmt(a.ts)}</span>
          </div>
          <div className="alert-cause">{a.root_cause}</div>
          <div className="alert-action">→ {a.action}</div>
        </div>
      ))}
    </div>
  );
}
