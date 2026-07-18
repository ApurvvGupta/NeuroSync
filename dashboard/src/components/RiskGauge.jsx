import { bandColor, riskBandFromIndex } from "../telemetry.js";

/** Circular 0-100 Risk Index gauge, colored by band. */
export default function RiskGauge({ value = 0, size = 140 }) {
  const band = riskBandFromIndex(value);
  const color = bandColor(band);
  const r = size / 2 - 12;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value)) / 100;
  const dash = c * pct;

  return (
    <div className="gauge" style={{ width: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#26313d"
                strokeWidth="12" fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth="12"
                fill="none" strokeLinecap="round"
                strokeDasharray={`${dash} ${c}`}
                transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        <text x="50%" y="46%" textAnchor="middle" className="gauge-value"
              fill={color}>{Math.round(value)}</text>
        <text x="50%" y="64%" textAnchor="middle" className="gauge-band"
              fill={color}>{band}</text>
      </svg>
    </div>
  );
}
