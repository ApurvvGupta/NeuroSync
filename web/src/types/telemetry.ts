// Frozen telemetry contract (docs/telemetry-frame.md) as TypeScript types.

export type RiskBand = "Safe" | "Watch" | "Elevated" | "High" | "Critical";

export interface ModuleState {
  severity: number; // 0-100
  state: string;
}

export interface Diagnosis {
  risk_band: RiskBand;
  modules: {
    gas: ModuleState;
    vibration: ModuleState;
    temperature: ModuleState;
    corrosion: ModuleState;
  };
  root_cause: string;
  recommended_action: string;
  warming_up: boolean;
}

export interface TelemetryFrame {
  ts: number;
  asset_id: string;
  vibration_rms: number;
  temperature: number | null;
  gas_mq2: number | null;
  gas_mq135: number | null;
  corrosion: number;
  waveform: number[];
  fault_probability: number;
  fault_flag: boolean;
  fault_type: string;
  severity: number;
  risk_index: number;
  source: "zscore" | "cnn";
  diagnosis: Diagnosis;
}

export interface AlertItem {
  ts: number;
  asset_id: string;
  band: RiskBand;
  risk_index: number;
  root_cause: string;
  action: string;
}

export type InjectCommand =
  | { cmd: "inject"; asset: string; fault: "vibration" | "temperature" | "gas" | "corrosion" | "fusion" }
  | { cmd: "clear"; asset: string };
