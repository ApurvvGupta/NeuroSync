"use client";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BrainCircuit, Download, CheckCircle2 } from "lucide-react";
import { Page, Panel, StatCard } from "@/components/ui";

const LAYERS = [
  { name: "Input", shape: "[128 × 3]", params: 0, note: "400 Hz accel window" },
  { name: "Conv1D ×32", shape: "[128 × 32]", params: 3200, note: "kernel 5, ReLU" },
  { name: "Conv1D ×64", shape: "[64 × 64]", params: 10304, note: "stride 2, BN" },
  { name: "Conv1D ×64", shape: "[32 × 64]", params: 12352, note: "kernel 3" },
  { name: "GlobalAvgPool", shape: "[64]", params: 0, note: "" },
  { name: "Dense (softmax)", shape: "[4]", params: 260, note: "fault classes" },
];
const loss = Array.from({ length: 30 }, (_, i) => ({ epoch: i + 1, train: +(0.9 * Math.exp(-i / 6) + 0.05).toFixed(3), val: +(0.95 * Math.exp(-i / 6.5) + 0.08).toFixed(3) }));
const CM = [[48, 1, 1, 0], [2, 45, 2, 1], [1, 3, 44, 2], [0, 1, 2, 47]];
const CLASSES = ["normal", "imbalance", "misalign", "bearing"];

export default function AiModelPage() {
  return (
    <Page title="AI Model" subtitle="INT8 1D-CNN vibration classifier · TFLite Micro · distilled from X Elite teacher">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Accuracy" value="96.4%" icon={BrainCircuit} accent="#22d3ee" />
        <StatCard label="F1 Score" value="0.95" icon={BrainCircuit} accent="#3b82f6" />
        <StatCard label="Model Size" value="214" unit="KB" icon={BrainCircuit} accent="#a855f7" hint="< 256 KB budget" />
        <StatCard label="Inference" value="0.9" unit="ms" icon={BrainCircuit} accent="#22d3ee" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Architecture (student model)">
          <div className="flex flex-col gap-2">
            {LAYERS.map((l) => (
              <div key={l.name} className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand-gradient text-xs font-bold text-white">›</div>
                <div className="flex-1">
                  <div className="text-sm font-medium">{l.name}</div>
                  <div className="text-xs text-slate-500">{l.note}</div>
                </div>
                <div className="text-right text-xs text-slate-400">
                  <div>{l.shape}</div><div>{l.params.toLocaleString()} p</div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel title="Training / Validation Loss">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={loss}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="epoch" tick={{ fill: "#64748b", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "#0b111a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }} />
                  <Line dataKey="train" stroke="#3b82f6" dot={false} strokeWidth={2} />
                  <Line dataKey="val" stroke="#a855f7" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="Confusion Matrix">
            <div className="grid grid-cols-5 gap-1 text-center text-xs">
              <div />
              {CLASSES.map((c) => <div key={c} className="text-slate-400">{c}</div>)}
              {CM.map((row, i) => (
                <div key={i} className="contents">
                  <div className="text-slate-400">{CLASSES[i]}</div>
                  {row.map((v, j) => (
                    <div key={j} className="rounded-md py-2 font-medium"
                      style={{ background: `rgba(34,211,238,${(v / 50) * 0.9 + 0.05})`, color: i === j ? "#001018" : "#cbd5e1" }}>{v}</div>
                  ))}
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      <Panel title="Edge Deployment" className="mt-4">
        <div className="flex flex-wrap items-center gap-4">
          {["TFLite Micro (STM32)", "ONNX (X Elite teacher)", "QNN / Hexagon NPU"].map((x) => (
            <span key={x} className="inline-flex items-center gap-2 rounded-xl bg-white/5 px-4 py-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-risk-safe" /> {x}
            </span>
          ))}
          <button className="btn-ghost ml-auto"><Download className="h-4 w-4" /> Export .tflite</button>
          <button className="btn-ghost"><Download className="h-4 w-4" /> Export .onnx</button>
        </div>
      </Panel>
    </Page>
  );
}
