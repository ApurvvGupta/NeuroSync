"use client";
import { motion } from "framer-motion";
import { Page, Panel, Badge } from "@/components/ui";

const COMPONENTS = [
  { name: "Snapdragon X Elite AI PC", role: "Tier 2 — teacher + distillation + command center", spec: "Oryon CPU · Hexagon NPU 45 TOPS · 32 GB", status: "Online" },
  { name: "Arduino UNO Q", role: "Tier 0/1 — sensing + aggregation", spec: "QRB2210 MPU (Debian) + STM32U585 MCU (Zephyr)", status: "Online" },
  { name: "MPU6050 ×2", role: "Vibration (2 assets)", spec: "3-axis accel + gyro · I²C 0x68 / 0x69", status: "Online" },
  { name: "DS18B20", role: "Asset temperature", spec: "1-Wire · waterproof · ±0.5 °C", status: "Online" },
  { name: "MQ-2 ×2", role: "Flammable gas / smoke leak", spec: "Analog · A0 · 5V heater · 10k/10k divider", status: "Warming up" },
  { name: "MQ135 ×2", role: "Corrosive gas / air quality", spec: "Analog · A2 · divider", status: "Warming up" },
  { name: "Soil-moisture probe", role: "Corrosion (ER/LPR proxy)", spec: "Analog · A1 · 3.3V direct", status: "Online" },
  { name: "N20 motor + L293D", role: "Fault injection rig", spec: "PWM D9/D10 via L293D driver", status: "Standby" },
];

const statusColor = (s: string) => s === "Online" ? "#2ecc71" : s === "Warming up" ? "#f1c40f" : "#64748b";

export default function HardwarePage() {
  return (
    <Page title="Hardware" subtitle="Physical edge stack — Arduino UNO Q + Snapdragon X Elite">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {COMPONENTS.map((c, i) => (
          <motion.div key={c.name} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Panel>
              <div className="flex items-start justify-between">
                <h3 className="font-semibold">{c.name}</h3>
                <Badge color={statusColor(c.status)}>{c.status}</Badge>
              </div>
              <p className="mt-2 text-sm text-slate-400">{c.role}</p>
              <div className="mt-3 rounded-lg bg-white/5 p-2 text-xs text-slate-400">{c.spec}</div>
            </Panel>
          </motion.div>
        ))}
      </div>
    </Page>
  );
}
