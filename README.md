# NeuroSync

**AI-Powered Industrial Risk Intelligence for Oil & Gas Infrastructure**
*Detecting the weak signals that precede industrial disasters — at the edge, without the cloud.*

Snapdragon® Multiverse Hackathon — Noida 2026

---

## What it is

NeuroSync is an edge-AI risk intelligence platform that detects the weak signals
preceding catastrophic oil & gas failures — **gas leaks, corrosion, thermal
runaway, and bearing seizure** — and tells the operator *what* will fail, *when*,
and *what to do about it*.

The differentiator is **sensor fusion**: five sensors together produce one
diagnosis with a root cause and a single **Risk Index (0–100)**, instead of
several unrelated single-sensor alarms.

## Four-device architecture

| Tier | Device | Job |
|------|--------|-----|
| 0 — Sense | STM32U585 MCU (on Arduino UNO Q) | Read sensors @ 400 Hz; INT8 anomaly detection < 1 ms; Z-score fallback |
| 1 — Aggregate | QRB2210 MPU (on Arduino UNO Q) | Sensor fusion, MQTT/WebSocket, OTA model flashing to the MCU |
| 2 — Teach | Snapdragon X Elite AI PC | Teacher model, knowledge distillation, command-center dashboard |
| 3 — Learn | Qualcomm Cloud AI 100 | Fleet-wide batch analysis, baseline calibration, retraining triggers |
| 4 — Act | OnePlus 15 (Kotlin app) | Field alerts, human-in-the-loop feedback |

Data flow: `sense → infer → fuse → score → alert → distil → improve`

## Sensors → fault modules

| Module | Sensor(s) |
|--------|-----------|
| Gas leakage | MQ-2 ×2, MQ135 ×2 (analog) |
| Corrosion (internal) | Soil-moisture module as ER/LPR conductivity probe + MQ135 corrosive-gas signature + humidity/temp cycling — **sensor fusion, not camera** (internal pipe corrosion is not optically observable) |
| Temperature | DS18B20 waterproof probe (1-Wire) |
| Vibration | MPU6050 ×2 (I²C) + N20 motor ×2 for live fault injection |

## Repository layout

```
NeuroSync/
├── docs/               # frozen telemetry contract, design notes & research
│   └── vibration_model_research.md  # [NEW] Pretrained & Transfer Learning Research
├── mock_server/        # hardware-free telemetry source (build/demo against this)
├── uno_q/              # Arduino App Lab app: sketch/ (STM32) + python/ (QRB2210)
│   └── python/train_models.py       # [NEW] PyTorch Transfer Learning & Autoencoder script
├── dashboard/          # React command center (Snapdragon X Elite)                  [planned]
├── mobile/             # Kotlin Android field app (OnePlus 15)                       [planned]
└── ai_pc/              # teacher model + knowledge distillation                      [planned]
```

## Quick start — mock telemetry (no hardware)

This is critical-path step 1: build and demo the whole UI against fake data.

```bash
cd mock_server
pip install -r requirements.txt
python server.py            # serves ws://localhost:8765
```

Every frame follows [`docs/telemetry-frame.md`](docs/telemetry-frame.md). Send a
fault-injection command over the same WebSocket to drive the demo:

```json
{"cmd": "inject", "asset": "PUMP-01", "fault": "gas"}
{"cmd": "inject", "asset": "PUMP-01", "fault": "fusion"}   // gas + temp together
{"cmd": "clear",  "asset": "PUMP-01"}
```

## Quick start — web console (AI Command Center)

The enterprise multi-page frontend is in `web/` (Next.js 15 + TypeScript +
Tailwind + Framer Motion + Recharts + Zustand). It runs on **mock data with zero
backend**, and auto-connects to the live feed (mock server or bridge) on
`ws://localhost:8765` when available.

```bash
cd web
npm install
npm run dev            # http://localhost:3000
```

Pages: Landing, Login, Command Center, Live Monitoring, Signal Processing,
AI Model, Predictions & RUL, Analytics, System Architecture, Hardware, Alerts,
Reports, Settings. The **Inject fault** panel (Command Center / Monitoring)
drives the demo — `Gas + Heat` triggers the fused fire-precursor diagnosis.

> The earlier `dashboard/` (Vite) prototype is superseded by `web/` and can be removed.

## Team

| Name | Email | Role |
|------|-------|------|
| _TODO_ | _TODO_ | AI/ML Software Engineer |
| _TODO_ | _TODO_ | Embedded Software Developer |
| _TODO_ | _TODO_ | Android/Kotlin Developer |
| _TODO_ | _TODO_ | Frontend / Fusion logic |
| _TODO_ | _TODO_ | Lead / Demo & Pitch |

## License

Released under the [MIT License](LICENSE).
