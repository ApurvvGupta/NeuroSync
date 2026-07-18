// Browser-side mock telemetry generator so the app works with zero backend.
// Mirrors mock_server/server.py behaviour (two assets, fault ramps).
import { fuse, TEMP_BASELINE_C, GAS_BASELINE_RAW, CORROSION_BASELINE, VIB_RMS_BASELINE } from "./fusion";
import type { TelemetryFrame } from "@/types/telemetry";

type Fault = "vibration" | "temperature" | "gas" | "corrosion";

class AssetSim {
  private phase = 0;
  private ramps: Record<Fault, number> = { vibration: 0, temperature: 0, gas: 0, corrosion: 0 };
  private targets: Record<Fault, number> = { vibration: 0, temperature: 0, gas: 0, corrosion: 0 };
  constructor(public id: string, private ownsEnv: boolean) {}

  inject(fault: string) {
    if (fault === "fusion") { this.targets.gas = 1; this.targets.temperature = 1; }
    else if (fault in this.targets) this.targets[fault as Fault] = 1;
  }
  clear() { (Object.keys(this.targets) as Fault[]).forEach((k) => (this.targets[k] = 0)); }

  private step() {
    (Object.keys(this.targets) as Fault[]).forEach((k) => {
      const t = this.targets[k];
      const s = t > this.ramps[k] ? 0.06 : 0.1;
      if (this.ramps[k] < t) this.ramps[k] = Math.min(t, this.ramps[k] + s);
      else if (this.ramps[k] > t) this.ramps[k] = Math.max(t, this.ramps[k] - s);
    });
  }

  frame(): TelemetryFrame {
    this.step();
    this.phase += 0.4;
    const g = () => (Math.random() - 0.5) * 2;

    const rms = VIB_RMS_BASELINE + g() * 0.05 + this.ramps.vibration * 6;
    const z = Math.max(0, (rms - VIB_RMS_BASELINE) / 0.5);
    const amp = 0.2 + this.ramps.vibration * 1.5;
    const waveform = Array.from({ length: 60 }, (_, i) =>
      Math.round((amp * Math.sin(this.phase + i * 0.5) + g() * 0.03) * 1000) / 1000);

    const temperature = TEMP_BASELINE_C + g() * 0.3 + this.ramps.temperature * 30;
    const gas_mq2 = GAS_BASELINE_RAW + g() * 3 + this.ramps.gas * 260;
    const gas_mq135 = GAS_BASELINE_RAW + g() * 3 + this.ramps.gas * 200;
    const corrosion = Math.min(1, CORROSION_BASELINE + g() * 0.005 + this.ramps.corrosion * 0.85);

    const { risk_index, severity, diagnosis } = fuse({ temperature, gas_mq2, gas_mq135, corrosion, z_score: z });
    const fault_type = diagnosis.modules.vibration.state !== "Normal"
      ? ["bearing_wear", "imbalance", "misalignment"][Math.floor(Math.random() * 3)] : "none";

    return {
      ts: Date.now(), asset_id: this.id,
      vibration_rms: Math.round(rms * 1000) / 1000,
      temperature: Math.round(temperature * 100) / 100,
      gas_mq2: this.ownsEnv ? Math.round(gas_mq2) : null,
      gas_mq135: this.ownsEnv ? Math.round(gas_mq135) : null,
      corrosion: Math.round(corrosion * 1000) / 1000,
      waveform,
      fault_probability: Math.round(Math.min(1, z / 10) * 1000) / 1000,
      fault_flag: severity >= 50, fault_type, severity, risk_index,
      source: z >= 3 ? "cnn" : "zscore", diagnosis,
    };
  }
}

export function createMockFeed(onFrame: (f: TelemetryFrame) => void) {
  const sims = [new AssetSim("PUMP-01", true), new AssetSim("COMP-01", true), new AssetSim("COMP-02", false)];
  const timer = setInterval(() => sims.forEach((s) => onFrame(s.frame())), 500);
  return {
    stop: () => clearInterval(timer),
    inject: (asset: string, fault: string) => sims.find((s) => s.id === asset)?.inject(fault),
    clear: (asset: string) => sims.find((s) => s.id === asset)?.clear(),
  };
}
