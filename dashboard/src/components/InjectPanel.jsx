/**
 * Fault-injection panel — drives the live demo. Sends inject/clear commands over
 * the same WebSocket. Works against the mock server and the bridge's --demo mode.
 * (With real hardware, faults are triggered physically instead — motor, gas, etc.)
 */
const FAULTS = [
  { key: "vibration", label: "Vibration" },
  { key: "temperature", label: "Temp Rise" },
  { key: "gas", label: "Gas Leak" },
  { key: "corrosion", label: "Corrosion" },
  { key: "fusion", label: "★ Gas + Heat (fusion)" },
];

export default function InjectPanel({ assetId, onSend }) {
  return (
    <div className="inject-panel">
      <span className="inject-title">Inject fault → {assetId}</span>
      <div className="inject-buttons">
        {FAULTS.map((f) => (
          <button key={f.key} className={`inject-btn ${f.key === "fusion" ? "inject-star" : ""}`}
                  onClick={() => onSend({ cmd: "inject", asset: assetId, fault: f.key })}>
            {f.label}
          </button>
        ))}
        <button className="inject-btn inject-clear"
                onClick={() => onSend({ cmd: "clear", asset: assetId })}>
          Clear
        </button>
      </div>
    </div>
  );
}
