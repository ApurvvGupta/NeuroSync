/**
 * Lightweight SVG line chart — no chart library, keeps installs fast/reliable.
 * Renders `data` (array of numbers) as a polyline, auto-scaled to the box.
 */
export default function LineChart({ data = [], color = "#4aa3ff", height = 60,
                                    width = 260, fill = true }) {
  if (!data.length) {
    return <svg width={width} height={height} className="chart-empty" />;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const stepX = width / Math.max(1, data.length - 1);

  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / span) * (height - 6) - 3;
    return [x, y];
  });

  const line = points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;

  return (
    <svg width={width} height={height} className="chart">
      {fill && <path d={area} fill={color} opacity="0.12" />}
      <path d={line} fill="none" stroke={color} strokeWidth="2" />
    </svg>
  );
}
