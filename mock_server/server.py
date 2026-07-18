"""
NeuroSync mock telemetry server.

Emits the frozen telemetry frame (docs/telemetry-frame.md) over WebSocket for
two demo assets (a pump and a compressor), with no hardware required. This is
critical-path step 1 (Handbook §6.5): everything downstream — the React command
center and the Kotlin app — is built and demoed against this feed. When the real
hardware is ready, the QRB2210 bridge emits the identical shape and the UI does
not change.

Run:
    pip install -r requirements.txt
    python server.py                 # ws://localhost:8765

Fault injection (drives the live demo). A client sends:
    {"cmd": "inject", "asset": "PUMP-01", "fault": "gas"}   fault in
        {vibration | temperature | gas | corrosion | fusion}
    {"cmd": "clear",  "asset": "PUMP-01"}                   back to normal

`fusion` injects gas + temperature together — the winning demo moment (§2.2).
"""

from __future__ import annotations

import argparse
import asyncio
import json
import math
import random
import time

import websockets

import fusion


SAMPLE_RATE_HZ = 2          # telemetry frames per second
WAVEFORM_LEN = 60           # samples per frame for the vibration chart
WARMUP_SECONDS = 3          # short warm-up so the UI can show "Sensor warming up"


class AssetSimulator:
    """Generates a realistic telemetry stream for a single asset.

    A fault injection ramps the relevant reading toward a fault value; clearing
    it ramps back down. This mimics the rate-of-rise behaviour the handbook says
    matters more than absolute values.
    """

    def __init__(self, asset_id: str, seed: int = 0) -> None:
        self.asset_id = asset_id
        self._rng = random.Random(seed)
        self._phase = 0.0
        # Injection ramps, each 0..1 (0 = normal, 1 = full fault).
        self._ramps = {"vibration": 0.0, "temperature": 0.0, "gas": 0.0, "corrosion": 0.0}
        self._targets = {"vibration": 0.0, "temperature": 0.0, "gas": 0.0, "corrosion": 0.0}

    def inject(self, fault: str) -> None:
        if fault == "fusion":  # gas + temperature together (§2.2)
            self._targets["gas"] = 1.0
            self._targets["temperature"] = 1.0
        elif fault in self._targets:
            self._targets[fault] = 1.0

    def clear(self) -> None:
        for key in self._targets:
            self._targets[key] = 0.0

    def _step_ramps(self) -> None:
        # Move each ramp toward its target a little each frame (smooth trend).
        for key, target in self._targets.items():
            step = 0.06 if target > self._ramps[key] else 0.10
            if self._ramps[key] < target:
                self._ramps[key] = min(target, self._ramps[key] + step)
            elif self._ramps[key] > target:
                self._ramps[key] = max(target, self._ramps[key] - step)

    def frame(self, warmed_up: bool) -> dict:
        self._step_ramps()
        self._phase += 0.4

        # --- Vibration ---
        base_rms = fusion.VIBRATION_RMS_BASELINE + self._rng.gauss(0, 0.05)
        rms = base_rms + self._ramps["vibration"] * 6.0
        # Z-score proxy: how many "sigmas" above the quiet baseline.
        z_score = max(0.0, (rms - fusion.VIBRATION_RMS_BASELINE) / 0.5)
        amp = 0.2 + self._ramps["vibration"] * 1.5
        waveform = [round(amp * math.sin(self._phase + i * 0.5)
                          + self._rng.gauss(0, 0.03), 3) for i in range(WAVEFORM_LEN)]

        # --- Temperature ---
        temperature = (fusion.TEMP_BASELINE_C + self._rng.gauss(0, 0.3)
                       + self._ramps["temperature"] * 30.0)

        # --- Gas (two channels) ---
        gas_mq2 = fusion.GAS_BASELINE_RAW + self._rng.gauss(0, 3) + self._ramps["gas"] * 260
        gas_mq135 = fusion.GAS_BASELINE_RAW + self._rng.gauss(0, 3) + self._ramps["gas"] * 200

        # --- Corrosion ---
        corrosion = min(1.0, fusion.CORROSION_BASELINE + self._rng.gauss(0, 0.005)
                        + self._ramps["corrosion"] * 0.85)

        if not warmed_up:
            # During warm-up the gas heater is unstable; readings are meaningless.
            gas_mq2 = gas_mq135 = None

        diagnosis = fusion.fuse(
            temperature=temperature,
            gas_mq2=gas_mq2 if gas_mq2 is not None else fusion.GAS_BASELINE_RAW,
            gas_mq135=gas_mq135 if gas_mq135 is not None else fusion.GAS_BASELINE_RAW,
            corrosion=corrosion,
            z_score=z_score,
        )

        fault_type = "none"
        if diagnosis.modules["vibration"]["state"] != "Normal":
            fault_type = self._rng.choice(["bearing_wear", "imbalance", "misalignment"])

        return {
            "ts": int(time.time() * 1000),
            "asset_id": self.asset_id,
            "vibration_rms": round(rms, 3),
            "temperature": round(temperature, 2),
            "gas_mq2": None if gas_mq2 is None else round(gas_mq2),
            "gas_mq135": None if gas_mq135 is None else round(gas_mq135),
            "corrosion": round(corrosion, 3),
            "waveform": waveform,
            "fault_probability": round(min(1.0, z_score / 10), 3),
            "fault_flag": diagnosis.severity >= 50,
            "fault_type": fault_type,
            "severity": diagnosis.severity,
            "risk_index": diagnosis.risk_index,
            "source": "cnn" if z_score >= 3 else "zscore",
            # Extended diagnosis channel (root cause + recommended action).
            "diagnosis": {
                "risk_band": diagnosis.risk_band,
                "modules": diagnosis.modules,
                "root_cause": diagnosis.root_cause,
                "recommended_action": diagnosis.recommended_action,
                "warming_up": not warmed_up,
            },
        }


ASSETS = {
    "PUMP-01": AssetSimulator("PUMP-01", seed=1),
    "COMP-01": AssetSimulator("COMP-01", seed=2),
}

CLIENTS: set = set()
START_TIME = time.time()


async def _handle_client(websocket) -> None:
    CLIENTS.add(websocket)
    try:
        async for message in websocket:
            try:
                cmd = json.loads(message)
            except (ValueError, TypeError):
                continue
            asset = ASSETS.get(cmd.get("asset"))
            if asset is None:
                continue
            if cmd.get("cmd") == "inject":
                asset.inject(cmd.get("fault", ""))
                print(f"[inject] {asset.asset_id} <- {cmd.get('fault')}")
            elif cmd.get("cmd") == "clear":
                asset.clear()
                print(f"[clear ] {asset.asset_id}")
    finally:
        CLIENTS.discard(websocket)


async def _broadcast_loop() -> None:
    period = 1.0 / SAMPLE_RATE_HZ
    while True:
        warmed_up = (time.time() - START_TIME) >= WARMUP_SECONDS
        for sim in ASSETS.values():
            frame = sim.frame(warmed_up)
            if CLIENTS:
                payload = json.dumps(frame)
                await asyncio.gather(
                    *(_safe_send(ws, payload) for ws in list(CLIENTS)),
                    return_exceptions=True,
                )
        await asyncio.sleep(period)


async def _safe_send(ws, payload: str) -> None:
    try:
        await ws.send(payload)
    except websockets.ConnectionClosed:
        CLIENTS.discard(ws)


async def main(host: str, port: int) -> None:
    print(f"NeuroSync mock telemetry server on ws://{host}:{port}")
    print(f"Assets: {', '.join(ASSETS)} | warm-up: {WARMUP_SECONDS}s")
    async with websockets.serve(_handle_client, host, port):
        await _broadcast_loop()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="NeuroSync mock telemetry server")
    parser.add_argument("--host", default="localhost")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    try:
        asyncio.run(main(args.host, args.port))
    except KeyboardInterrupt:
        print("\nstopped")
