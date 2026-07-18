"use client";
import { motion } from "framer-motion";
import { Cpu, CircuitBoard, Laptop, Cloud, Smartphone, ArrowRight } from "lucide-react";
import { Page, Panel } from "@/components/ui";

const TIERS = [
  { id: 0, name: "Sense", device: "STM32U585 MCU", icon: CircuitBoard, color: "#22d3ee",
    job: "Reads sensors @ 400 Hz. INT8 TinyML anomaly < 1 ms. Z-score fallback always on." },
  { id: 1, name: "Aggregate", device: "QRB2210 MPU", icon: Cpu, color: "#3b82f6",
    job: "Sensor fusion, MQTT/WebSocket, OTA model flashing to the MCU." },
  { id: 2, name: "Teach", device: "Snapdragon X Elite", icon: Laptop, color: "#a855f7",
    job: "Teacher model + knowledge distillation. Command center. 45 TOPS NPU." },
  { id: 3, name: "Learn", device: "Cloud AI 100", icon: Cloud, color: "#22d3ee",
    job: "Fleet-wide batch analysis, baseline calibration, retraining triggers." },
  { id: 4, name: "Act", device: "OnePlus 15", icon: Smartphone, color: "#3b82f6",
    job: "Field operator alerts, human-in-the-loop confirmation." },
];

export default function ArchitecturePage() {
  return (
    <Page title="System Architecture" subtitle="Four devices, one closed intelligence loop — no subset can do the whole job">
      <Panel title="Data flow — sense → infer → fuse → score → alert → distil → improve">
        <div className="flex flex-col items-stretch gap-4 py-4 lg:flex-row lg:items-center">
          {TIERS.map((t, i) => (
            <div key={t.id} className="flex flex-1 items-center gap-4">
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.12 }}
                className="card flex-1 border-t-2" style={{ borderTopColor: t.color }}>
                <div className="flex items-center gap-2">
                  <t.icon className="h-6 w-6" style={{ color: t.color }} />
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Tier {t.id} · {t.name}</div>
                    <div className="font-semibold">{t.device}</div>
                  </div>
                </div>
                <p className="mt-2 text-xs text-slate-400">{t.job}</p>
              </motion.div>
              {i < TIERS.length - 1 && (
                <ArrowRight className="hidden h-6 w-6 shrink-0 animate-pulseGlow text-brand-cyan lg:block" />
              )}
            </div>
          ))}
        </div>
      </Panel>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Panel title="Why it wins the Multi-Device Orchestration prize">
          <ul className="space-y-2 text-sm text-slate-300">
            <li>• STM32 gives deterministic &lt;1 ms response — Linux cannot guarantee timing.</li>
            <li>• QRB2210 manages models &amp; networking the MCU has no OS for.</li>
            <li>• X Elite runs teacher + distillation the UNO Q cannot.</li>
            <li>• Cloud AI 100 sees cross-site patterns invisible to any single node.</li>
            <li>• The phone puts intelligence in the field operator&apos;s hand.</li>
          </ul>
        </Panel>
        <Panel title="Closed learning loop">
          <div className="flex flex-col gap-2 text-sm text-slate-300">
            <div className="rounded-xl bg-white/5 p-3">Sensors → STM32 (JSON/UART) → QRB2210 (fusion) → WebSocket → Command Center</div>
            <div className="rounded-xl bg-white/5 p-3">X Elite teacher → distilled INT8 student → OTA flash → STM32</div>
            <div className="rounded-xl bg-white/5 p-3">Compressed features → Cloud AI 100 → global baseline → back to X Elite</div>
          </div>
        </Panel>
      </div>
    </Page>
  );
}
