// TS mirror of mock_server/fusion.py — used by the browser mock feed so the
// dashboard shows correct Risk Index / states with zero backend. Keep the
// thresholds in sync with the Python canonical implementation.
import type { Diagnosis, ModuleState, RiskBand } from "@/types/telemetry";

export const TEMP_BASELINE_C = 40;
export const GAS_BASELINE_RAW = 90;
export const CORROSION_BASELINE = 0.1;
export const VIB_RMS_BASELINE = 1.0;

const WEIGHTS = { gas: 0.35, vibration: 0.25, temperature: 0.2, corrosion: 0.2 };
const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

export function gradeTemperature(t: number): ModuleState {
  const d = t - TEMP_BASELINE_C;
  if (d < 5) return { severity: clamp((d / 5) * 25), state: "Normal" };
  if (d < 20) return { severity: clamp(25 + ((d - 5) / 15) * 50), state: "Warning" };
  return { severity: clamp(75 + ((d - 20) / 20) * 25), state: "Critical" };
}

export function gradeGas(mq2: number, mq135: number): ModuleState {
  const sev = clamp(((Math.max(mq2, mq135) - GAS_BASELINE_RAW) / 300) * 100);
  if (sev < 15) return { severity: sev, state: "Clear" };
  if (sev < 45) return { severity: sev, state: "Trace Detected" };
  if (sev < 80) return { severity: sev, state: "Leak Confirmed" };
  return { severity: sev, state: "Critical / Evacuate" };
}

export function gradeCorrosion(index: number, mq135: number): ModuleState {
  const sev = clamp(index * 100);
  const corrosiveGas = mq135 - GAS_BASELINE_RAW > 120;
  if (sev < 20) return { severity: sev, state: "Protected" };
  if (sev < 50) return { severity: sev, state: "Early Corrosion" };
  if (sev < 80 && !corrosiveGas) return { severity: sev, state: "Active Corrosion" };
  return { severity: clamp(Math.max(sev, 85)), state: "Critical Thinning Risk" };
}

export function gradeVibration(z: number): ModuleState {
  if (z < 3) return { severity: clamp((z / 3) * 25), state: "Normal" };
  if (z < 5) return { severity: clamp(30 + ((z - 3) / 2) * 20), state: "Recovery Required" };
  if (z < 8) return { severity: clamp(50 + ((z - 5) / 3) * 30), state: "Repair Required" };
  return { severity: clamp(80 + ((z - 8) / 4) * 20), state: "Replacement Required" };
}

const CRITICAL = new Set([
  "Critical", "Critical / Evacuate", "Critical Thinning Risk", "Replacement Required",
]);

export function riskBand(risk: number): RiskBand {
  if (risk < 25) return "Safe";
  if (risk < 50) return "Watch";
  if (risk < 75) return "Elevated";
  if (risk < 90) return "High";
  return "Critical";
}

export function fuse(args: {
  temperature: number; gas_mq2: number; gas_mq135: number; corrosion: number; z_score: number;
}): { risk_index: number; severity: number; diagnosis: Diagnosis } {
  const t = gradeTemperature(args.temperature);
  const g = gradeGas(args.gas_mq2, args.gas_mq135);
  const c = gradeCorrosion(args.corrosion, args.gas_mq135);
  const v = gradeVibration(args.z_score);
  const modules = { gas: g, vibration: v, temperature: t, corrosion: c };

  let risk =
    WEIGHTS.gas * g.severity + WEIGHTS.vibration * v.severity +
    WEIGHTS.temperature * t.severity + WEIGHTS.corrosion * c.severity;
  if (Object.values(modules).some((m) => CRITICAL.has(m.state))) risk = Math.max(risk, 90);

  const { root_cause, recommended_action } = diagnose(modules);
  const worst = Math.max(...Object.values(modules).map((m) => m.severity));

  return {
    risk_index: Math.round(clamp(risk) * 10) / 10,
    severity: Math.round(worst * 10) / 10,
    diagnosis: {
      risk_band: riskBand(risk),
      modules: {
        gas: round(g), vibration: round(v), temperature: round(t), corrosion: round(c),
      },
      root_cause,
      recommended_action,
      warming_up: false,
    },
  };
}

const round = (m: ModuleState): ModuleState => ({ severity: Math.round(m.severity * 10) / 10, state: m.state });

function diagnose(m: Record<string, ModuleState>) {
  const gas = m.gas.state, temp = m.temperature.state, vib = m.vibration.state, corr = m.corrosion.state;
  if ((gas === "Leak Confirmed" || gas === "Critical / Evacuate") && temp !== "Normal")
    return { root_cause: "Gas release with rising temperature — fire/explosion precursor.", recommended_action: "Evacuate zone. Emergency shutdown. Restrict ignition sources." };
  if (corr === "Critical Thinning Risk")
    return { root_cause: "Accelerated wall thinning with corrosive-gas signature.", recommended_action: "Priority UT wall-thickness inspection. Consider pressure de-rating." };
  if (vib === "Replacement Required")
    return { root_cause: "Advanced bearing failure — imminent seizure risk.", recommended_action: "Take asset offline. Do not run to failure in hydrocarbon service." };
  if (gas === "Leak Confirmed" || gas === "Critical / Evacuate")
    return { root_cause: "Sustained gas rise across sensors.", recommended_action: "Isolate section. Ventilate. Notify control room." };
  if (vib === "Repair Required")
    return { root_cause: "Bearing wear / misalignment trend rising.", recommended_action: "Schedule bearing replacement at next planned shutdown. Report RUL." };
  if (temp === "Warning")
    return { root_cause: "Temperature climbing above baseline.", recommended_action: "Check cooling, lubrication, and load. Correlate with vibration." };
  if (corr === "Early Corrosion" || corr === "Active Corrosion")
    return { root_cause: "Corrosion conditions developing.", recommended_action: "Inspect coating/insulation. Check cathodic protection." };
  return { root_cause: "All signals within adaptive baseline.", recommended_action: "No action. Continue routine monitoring." };
}
