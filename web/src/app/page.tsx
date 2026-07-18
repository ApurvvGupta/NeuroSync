"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight, Flame, Waves, Thermometer, Droplets, Cpu, ShieldCheck, Zap, Gauge, Network,
} from "lucide-react";

const FEATURES = [
  { icon: Flame, title: "Gas Leak Detection", text: "Rate-of-rise ppm monitoring across MQ-2 / MQ135 — not a dumb threshold alarm." },
  { icon: Droplets, title: "Corrosion Intelligence", text: "ER/LPR-proxy probe + corrosive-gas signature infer internal wall thinning." },
  { icon: Thermometer, title: "Thermal Runaway", text: "Absolute + rate-of-change temperature, correlated with vibration." },
  { icon: Waves, title: "Vibration TinyML", text: "INT8 1D-CNN on the MCU classifies bearing wear, imbalance, misalignment in <1 ms." },
  { icon: Network, title: "Sensor Fusion", text: "Five sensors → one Risk Index with a life-safety Critical override." },
  { icon: Cpu, title: "Edge-First", text: "Runs on-device across 4 Snapdragon-class tiers. No cloud dependency for safety decisions." },
];

const STATS = [
  { v: "<1 ms", l: "Edge inference" },
  { v: "4", l: "Orchestrated devices" },
  { v: "$38M", l: "Avg. annual downtime loss" },
  { v: "45 TOPS", l: "X Elite NPU" },
];

export default function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-gradient font-bold text-white">N</div>
          <span className="text-lg font-bold gradient-text">NeuroSync</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="btn-ghost">Sign in</Link>
          <Link href="/dashboard" className="btn-primary">Launch Console <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-20 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-white/5 px-4 py-1.5 text-xs text-brand-cyan">
            <Zap className="h-3.5 w-3.5" /> Snapdragon Multiverse Hackathon · Noida 2026
          </span>
          <h1 className="mt-6 text-5xl font-bold leading-tight tracking-tight md:text-6xl">
            Detect the weak signals that precede
            <span className="gradient-text"> industrial disasters</span>.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
            NeuroSync is an edge-AI risk intelligence platform for oil &amp; gas infrastructure —
            fusing gas, corrosion, thermal and vibration signals into a single Risk Index, on-device,
            in under a millisecond, without the cloud.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link href="/dashboard" className="btn-primary text-base">Open Command Center <ArrowRight className="h-4 w-4" /></Link>
            <Link href="/architecture" className="btn-ghost text-base">See Architecture</Link>
          </div>
        </motion.div>

        <div className="mt-16 grid grid-cols-2 gap-4 md:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.l} className="card">
              <div className="text-2xl font-bold gradient-text">{s.v}</div>
              <div className="mt-1 text-xs text-slate-400">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-24">
        <h2 className="text-center text-3xl font-bold">One platform, four failure modes</h2>
        <p className="mt-2 text-center text-slate-400">Purpose-built for refineries, pipelines, storage tanks and rotating equipment.</p>
        <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div key={f.title} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.05 }} className="card">
              <f.icon className="h-8 w-8 text-brand-cyan" />
              <h3 className="mt-3 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-slate-400">{f.text}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-slate-500">
        NeuroSync · Edge AI Risk Intelligence · MIT Licensed · Built for the Snapdragon Multiverse Hackathon
      </footer>
    </div>
  );
}
