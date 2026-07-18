"""
NeuroSync fusion + risk engine (canonical implementation).

Implements the per-module grading and the fused Risk Index defined in the Team
Build Handbook, Section 3. This module is intentionally dependency-free so it can
be reused by the mock server, the QRB2210 bridge, and unit tests. The React
dashboard mirrors the *thresholds* (not this code) in JS.

Every scoring function returns a (severity, state) pair:
  - severity: float 0-100 (0 = healthy, 100 = worst)
  - state:    the exact UI string from the handbook

Design rule (§3.6): never average away an emergency. If ANY module is Critical,
the fused risk_index is forced to >= 90 regardless of the weighted mean.
"""

from __future__ import annotations

from dataclasses import dataclass


# --- Nominal baselines (tune during the build; §3 grades are relative to these) ---
TEMP_BASELINE_C = 40.0        # DS18B20 nominal asset body temperature
GAS_BASELINE_RAW = 90.0       # MQ2/MQ135 nominal raw reading after warm-up
CORROSION_BASELINE = 0.10     # soil-moisture/conductivity probe at rest
VIBRATION_RMS_BASELINE = 1.0  # mm/s nominal

# Fusion weights (§3.6). Gas weighted highest: only life-safety-immediate mode.
WEIGHTS = {"gas": 0.35, "vibration": 0.25, "temperature": 0.20, "corrosion": 0.20}


def _clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(high, value))


# --------------------------------------------------------------------------- #
# Temperature module (§3.3)
# --------------------------------------------------------------------------- #
def grade_temperature(temp_c: float, baseline_c: float = TEMP_BASELINE_C) -> tuple[float, str]:
    delta = temp_c - baseline_c
    if delta < 5:
        # Normal: severity ramps gently up to the Warning boundary.
        return _clamp(delta / 5 * 25), "Normal"
    if delta < 20:
        # Warning: 5-20 degC above baseline.
        return _clamp(25 + (delta - 5) / 15 * 50), "Warning"
    # Critical: >20 degC above baseline. Fire risk in hydrocarbon service.
    return _clamp(75 + (delta - 20) / 20 * 25), "Critical"


# --------------------------------------------------------------------------- #
# Gas module (§3.4) — rate-of-rise matters more than absolute, but for the
# steady-state grade we score the delta above the warmed-up baseline.
# --------------------------------------------------------------------------- #
def grade_gas(gas_mq2: float, gas_mq135: float, baseline_raw: float = GAS_BASELINE_RAW) -> tuple[float, str]:
    # Use the worse of the two flammable/air-quality channels.
    delta = max(gas_mq2, gas_mq135) - baseline_raw
    severity = _clamp(delta / 300 * 100)
    if severity < 15:
        return severity, "Clear"
    if severity < 45:
        return severity, "Trace Detected"
    if severity < 80:
        return severity, "Leak Confirmed"
    return severity, "Critical / Evacuate"


# --------------------------------------------------------------------------- #
# Corrosion module (§3.5)
# --------------------------------------------------------------------------- #
def grade_corrosion(corrosion_index: float, gas_mq135: float,
                    baseline: float = CORROSION_BASELINE) -> tuple[float, str]:
    severity = _clamp(corrosion_index * 100)
    corrosive_gas = gas_mq135 - GAS_BASELINE_RAW > 120  # corrosive-gas signature
    if severity < 20:
        return severity, "Protected"
    if severity < 50:
        return severity, "Early Corrosion"
    if severity < 80 and not corrosive_gas:
        return severity, "Active Corrosion"
    # Rapid change combined with a corrosive-gas signature -> priority inspection.
    return _clamp(max(severity, 85)), "Critical Thinning Risk"


# --------------------------------------------------------------------------- #
# Vibration module (§3.1 normal-state grade + §3.2 fault-state diagnosis)
# --------------------------------------------------------------------------- #
def grade_vibration(z_score: float) -> tuple[float, str]:
    """Fault-state grading driven by the Z-score anomaly detector (§3.2)."""
    if z_score < 3:
        # Below the fault threshold -> graded on the normal-state health scale.
        return _clamp(z_score / 3 * 25), "Normal"
    if z_score < 5:
        return _clamp(30 + (z_score - 3) / 2 * 20), "Recovery Required"
    if z_score < 8:
        return _clamp(50 + (z_score - 5) / 3 * 30), "Repair Required"
    return _clamp(80 + (z_score - 8) / 4 * 20), "Replacement Required"


def health_grade(vibration_severity: float) -> str:
    """Induction-motor normal-state grade (§3.1). Below 50 escalates to §3.2."""
    score = 100 - vibration_severity
    if score >= 85:
        return "Excellent"
    if score >= 70:
        return "Good"
    if score >= 50:
        return "Fair"
    return "Escalated"


CRITICAL_STATES = {
    "Critical",
    "Critical / Evacuate",
    "Critical Thinning Risk",
    "Replacement Required",
}


@dataclass
class Diagnosis:
    """Extended fusion output delivered on the `diagnosis` channel."""
    risk_index: float
    risk_band: str
    severity: float
    modules: dict  # {name: {"severity": float, "state": str}}
    root_cause: str
    recommended_action: str


def _risk_band(risk: float) -> str:
    if risk < 25:
        return "Safe"
    if risk < 50:
        return "Watch"
    if risk < 75:
        return "Elevated"
    if risk < 90:
        return "High"
    return "Critical"


def fuse(*, temperature: float, gas_mq2: float, gas_mq135: float,
         corrosion: float, z_score: float) -> Diagnosis:
    """Combine all four modules into a single Risk Index (§3.6)."""
    t_sev, t_state = grade_temperature(temperature)
    g_sev, g_state = grade_gas(gas_mq2, gas_mq135)
    c_sev, c_state = grade_corrosion(corrosion, gas_mq135)
    v_sev, v_state = grade_vibration(z_score)

    modules = {
        "gas": {"severity": round(g_sev, 1), "state": g_state},
        "vibration": {"severity": round(v_sev, 1), "state": v_state},
        "temperature": {"severity": round(t_sev, 1), "state": t_state},
        "corrosion": {"severity": round(c_sev, 1), "state": c_state},
    }

    # Weighted mean of module severities.
    risk = (WEIGHTS["gas"] * g_sev + WEIGHTS["vibration"] * v_sev
            + WEIGHTS["temperature"] * t_sev + WEIGHTS["corrosion"] * c_sev)

    # Critical override: any single Critical module forces risk >= 90.
    if any(m["state"] in CRITICAL_STATES for m in modules.values()):
        risk = max(risk, 90.0)

    root_cause, action = _diagnose(modules)
    worst_severity = max(m["severity"] for m in modules.values())

    return Diagnosis(
        risk_index=round(_clamp(risk), 1),
        risk_band=_risk_band(risk),
        severity=round(worst_severity, 1),
        modules=modules,
        root_cause=root_cause,
        recommended_action=action,
    )


def _diagnose(modules: dict) -> tuple[str, str]:
    """Turn module states into a fused root cause + recommended action.

    This is where sensor fusion beats single-sensor alarms: correlated signals
    become one diagnosis instead of several unrelated alerts (Handbook §2.2).
    """
    gas = modules["gas"]["state"]
    temp = modules["temperature"]["state"]
    vib = modules["vibration"]["state"]
    corr = modules["corrosion"]["state"]

    # Gas + temperature together -> treat as fire/explosion precursor.
    if gas in ("Leak Confirmed", "Critical / Evacuate") and temp != "Normal":
        return ("Gas release with rising temperature — fire/explosion precursor.",
                "Evacuate zone. Emergency shutdown. Restrict ignition sources.")

    # Corrosion + corrosive-gas signature.
    if corr == "Critical Thinning Risk":
        return ("Accelerated wall thinning with corrosive-gas signature.",
                "Priority UT wall-thickness inspection. Consider pressure de-rating.")

    # Bearing seizure path.
    if vib == "Replacement Required":
        return ("Advanced bearing failure — imminent seizure risk.",
                "Take asset offline. Do not run to failure in hydrocarbon service.")

    if gas in ("Leak Confirmed", "Critical / Evacuate"):
        return ("Sustained gas rise across sensors.",
                "Isolate section. Ventilate. Notify control room.")

    if vib == "Repair Required":
        return ("Bearing wear / misalignment trend rising.",
                "Schedule bearing replacement at next planned shutdown. Report RUL.")

    if temp == "Warning":
        return ("Temperature climbing above baseline.",
                "Check cooling, lubrication, and load. Correlate with vibration.")

    if corr in ("Early Corrosion", "Active Corrosion"):
        return ("Corrosion conditions developing.",
                "Inspect coating/insulation. Check cathodic protection.")

    return ("All signals within adaptive baseline.",
            "No action. Continue routine monitoring.")
