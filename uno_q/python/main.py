"""
NeuroSync — Tier 1 bridge (QRB2210 MPU on the Arduino UNO Q).

Two jobs, one WebSocket contract:

  --serial <port>   Read the STM32's telemetry JSON lines over UART, learn
                    adaptive baselines after warm-up, run the fusion/risk engine,
                    and rebroadcast the full frozen frame (docs/telemetry-frame.md)
                    on ws://<host>:<port>.

  --demo            No hardware. Reuse the mock AssetSimulator so the dashboard /
                    Kotlin app can be built and demoed. Identical output shape.

Because both paths emit the exact same frame, the UI never changes when you swap
the simulator for the real board (Handbook §4.3, §6.5).

Run:
    pip install -r requirements.txt
    python main.py --demo                       # hardware-free
    python main.py --serial COM5                # real board (Windows)
    python main.py --serial /dev/ttyACM0        # real board (Linux/QRB2210)
"""

from __future__ import annotations

import argparse
import asyncio
import json
import math
import os
import random
import sys
import time

import websockets

# Reuse the canonical fusion engine and the mock simulator from mock_server/.
_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(_REPO_ROOT, "mock_server"))
import fusion  # noqa: E402
from server import AssetSimulator  # noqa: E402


WS_HOST = "0.0.0.0"
WS_PORT = 8765
CLIENTS: set = set()


# --------------------------------------------------------------------------- #
# Adaptive baseline calibration (Handbook: "adaptive baseline continues").
# After warm-up we watch a handful of quiet frames and set the fusion baselines
# to the observed normals, so real ADC-scaled readings grade correctly instead
# of against the mock's synthetic constants.
# --------------------------------------------------------------------------- #
class BaselineCalibrator:
    def __init__(self, samples_needed: int = 20) -> None:
        self._needed = samples_needed
        self._temp: list[float] = []
        self._gas: list[float] = []
        self._corr: list[float] = []
        self._vib: list[float] = []
        self.calibrated = False

    def observe(self, *, temperature, gas_mq2, gas_mq135, corrosion, vibration_rms) -> None:
        if self.calibrated:
            return
        if temperature is not None and not math.isnan(temperature):
            self._temp.append(temperature)
        if gas_mq2 is not None:
            self._gas.append(max(gas_mq2, gas_mq135 or gas_mq2))
        if corrosion is not None:
            self._corr.append(corrosion)
        if vibration_rms is not None:
            self._vib.append(vibration_rms)

        if len(self._vib) >= self._needed and len(self._gas) >= self._needed:
            self._apply()

    def _apply(self) -> None:
        if self._temp:
            fusion.TEMP_BASELINE_C = sum(self._temp) / len(self._temp)
        if self._gas:
            fusion.GAS_BASELINE_RAW = sum(self._gas) / len(self._gas)
        if self._corr:
            fusion.CORROSION_BASELINE = sum(self._corr) / len(self._corr)
        if self._vib:
            fusion.VIBRATION_RMS_BASELINE = max(0.01, sum(self._vib) / len(self._vib))
        self.calibrated = True
        print(f"[baseline] calibrated: temp={fusion.TEMP_BASELINE_C:.1f} "
              f"gas={fusion.GAS_BASELINE_RAW:.0f} corr={fusion.CORROSION_BASELINE:.3f} "
              f"vib={fusion.VIBRATION_RMS_BASELINE:.3f}")


def _synth_waveform(rms: float, n: int = 60) -> list[float]:
    """The STM32 does not stream the raw waveform (keeps UART light); synthesize
    a representative trace from the RMS so the dashboard chart stays alive."""
    amp = max(0.05, rms * 3.0)
    phase = time.time() * 4.0
    return [round(amp * math.sin(phase + i * 0.5) + random.gauss(0, 0.02), 3)
            for i in range(n)]


def build_frame(asset_id: str, *, vibration_rms: float, z_score: float,
                temperature: float, gas_mq2, gas_mq135, corrosion: float,
                warming_up: bool) -> dict:
    """Enrich a raw sensor reading into the full frozen telemetry frame."""
    gas2 = gas_mq2 if gas_mq2 is not None else fusion.GAS_BASELINE_RAW
    gas135 = gas_mq135 if gas_mq135 is not None else fusion.GAS_BASELINE_RAW

    diagnosis = fusion.fuse(
        temperature=temperature if temperature is not None and not math.isnan(temperature)
        else fusion.TEMP_BASELINE_C,
        gas_mq2=gas2, gas_mq135=gas135, corrosion=corrosion, z_score=z_score,
    )

    fault_type = "none"
    if diagnosis.modules["vibration"]["state"] != "Normal":
        fault_type = random.choice(["bearing_wear", "imbalance", "misalignment"])

    return {
        "ts": int(time.time() * 1000),
        "asset_id": asset_id,
        "vibration_rms": round(vibration_rms, 3),
        "temperature": None if temperature is None else round(temperature, 2),
        "gas_mq2": None if gas_mq2 is None else round(gas_mq2),
        "gas_mq135": None if gas_mq135 is None else round(gas_mq135),
        "corrosion": round(corrosion, 3),
        "waveform": _synth_waveform(vibration_rms),
        "fault_probability": round(min(1.0, z_score / 10), 3),
        "fault_flag": diagnosis.severity >= 50,
        "fault_type": fault_type,
        "severity": diagnosis.severity,
        "risk_index": diagnosis.risk_index,
        "source": "cnn" if z_score >= 3 else "zscore",
        "diagnosis": {
            "risk_band": diagnosis.risk_band,
            "modules": diagnosis.modules,
            "root_cause": diagnosis.root_cause,
            "recommended_action": diagnosis.recommended_action,
            "warming_up": warming_up,
        },
    }


async def _broadcast(payload: str) -> None:
    if not CLIENTS:
        return
    await asyncio.gather(*(_safe_send(ws, payload) for ws in list(CLIENTS)),
                         return_exceptions=True)


async def _safe_send(ws, payload: str) -> None:
    try:
        await ws.send(payload)
    except websockets.ConnectionClosed:
        CLIENTS.discard(ws)


# --------------------------------------------------------------------------- #
# Real path: serial -> fusion -> WebSocket
# --------------------------------------------------------------------------- #
async def serial_loop(port: str, baud: int) -> None:
    import serial  # lazy import; only needed on the real board

    calibrator = BaselineCalibrator()
    # Latest zone environment (only PUMP-01 owns the env sensors; COMP-01 inherits).
    zone = {"temperature": fusion.TEMP_BASELINE_C, "gas_mq2": None,
            "gas_mq135": None, "corrosion": fusion.CORROSION_BASELINE}

    loop = asyncio.get_running_loop()
    ser = serial.Serial(port, baud, timeout=1)
    print(f"[serial] reading {port} @ {baud}")

    while True:
        line = await loop.run_in_executor(None, ser.readline)
        line = line.decode("utf-8", "ignore").strip()
        if not line or line.startswith("#") or not line.startswith("{"):
            continue
        try:
            raw = json.loads(line)
        except ValueError:
            continue

        warming_up = bool(raw.get("warming_up", False))
        if "temperature" in raw:  # this asset owns the zone env sensors
            zone.update({k: raw.get(k) for k in
                         ("temperature", "gas_mq2", "gas_mq135", "corrosion")})

        if not warming_up:
            calibrator.observe(
                temperature=zone["temperature"], gas_mq2=zone["gas_mq2"],
                gas_mq135=zone["gas_mq135"], corrosion=zone["corrosion"] or 0.0,
                vibration_rms=raw.get("vibration_rms"),
            )

        frame = build_frame(
            raw["asset_id"], vibration_rms=raw.get("vibration_rms", 0.0),
            z_score=raw.get("z_score", 0.0), temperature=zone["temperature"],
            gas_mq2=zone["gas_mq2"], gas_mq135=zone["gas_mq135"],
            corrosion=zone["corrosion"] or 0.0, warming_up=warming_up,
        )
        await _broadcast(json.dumps(frame))


# --------------------------------------------------------------------------- #
# Demo path: reuse the mock simulator (no hardware)
# --------------------------------------------------------------------------- #
async def demo_loop() -> None:
    sims = {"PUMP-01": AssetSimulator("PUMP-01", seed=1),
            "COMP-01": AssetSimulator("COMP-01", seed=2)}
    start = time.time()
    print("[demo] simulated telemetry (no hardware)")
    while True:
        warmed = (time.time() - start) >= 3
        for sim in sims.values():
            await _broadcast(json.dumps(sim.frame(warmed)))
        await asyncio.sleep(0.5)
        # allow inject commands to reach the simulators via the shared handler
        globals()["_DEMO_SIMS"] = sims


async def _handle_client(websocket) -> None:
    CLIENTS.add(websocket)
    try:
        async for message in websocket:
            try:
                cmd = json.loads(message)
            except ValueError:
                continue
            sims = globals().get("_DEMO_SIMS", {})
            sim = sims.get(cmd.get("asset"))
            if sim is None:
                continue
            if cmd.get("cmd") == "inject":
                sim.inject(cmd.get("fault", ""))
            elif cmd.get("cmd") == "clear":
                sim.clear()
    finally:
        CLIENTS.discard(websocket)


async def main() -> None:
    parser = argparse.ArgumentParser(description="NeuroSync QRB2210 bridge")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--serial", metavar="PORT", help="serial port of the STM32")
    mode.add_argument("--demo", action="store_true", help="simulated data, no hardware")
    parser.add_argument("--baud", type=int, default=115200)
    parser.add_argument("--host", default=WS_HOST)
    parser.add_argument("--port", type=int, default=WS_PORT)
    args = parser.parse_args()

    print(f"NeuroSync bridge on ws://{args.host}:{args.port}")
    async with websockets.serve(_handle_client, args.host, args.port):
        if args.demo:
            await demo_loop()
        else:
            await serial_loop(args.serial, args.baud)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nstopped")
