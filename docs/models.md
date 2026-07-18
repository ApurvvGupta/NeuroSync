# NeuroSync Model Plan — FIXED v1.0

Maps every model to a device we physically have, the runtime it uses, and the
data it trains on. **Only vibration uses a learned model.** Gas, temperature,
and corrosion are statistical fusion (no ML) — this is deliberate and defensible.

## Devices in hand

| Device | Role (tier) | AI runtime |
|--------|-------------|------------|
| Arduino UNO Q — STM32U585 MCU | Tier 0 Sense | TFLite Micro (INT8), Edge Impulse export |
| Arduino UNO Q — QRB2210 MPU | Tier 1 Aggregate | LiteRT (.tflite) / Python fusion |
| Snapdragon X Elite AI PC | Tier 2 Teach | onnxruntime-qnn (x64), PyTorch (train/distill), Qualcomm AI Hub |
| OnePlus 15 (Snapdragon 8 Elite) | Tier 4 Act | LiteRT / onnxruntime-android, LiteRT-LM |
| Qualcomm Cloud AI 100 | Tier 3 Learn | REST batch analysis |

Sensors: MPU6050 ×2, DS18B20, MQ-2 ×2, MQ135 ×2, soil-moisture probe, N20 motor ×2 + L293D.

---

## The models (fixed)

### 1. Vibration fault classifier — **1D-CNN (INT8)** · CORE / must-have
- **What:** 3 conv layers → global average pool → dense. Classes: `normal`,
  `imbalance`, `misalignment`, `bearing_wear`. Footprint < 256 KB, < 1 ms.
- **Where:** STM32U585 MCU (Tier 0). This is the "student" model.
- **Runtime:** TFLite Micro, INT8, exported as an Arduino library from Edge Impulse.
- **Data:** **self-collected** on the N20 motor rig + MPU6050 via Edge Impulse
  (normal / add weight = imbalance / loosen mount = misalignment). ~10–15 min per
  class. Self-collected because public datasets (12–50 kHz lab rigs) do NOT
  transfer to the MPU6050 (~few-hundred-Hz, ±2 g).
- **Fallback:** Z-score detector (no model) — already in `sketch/sketch.ino`.

### 2. Vibration anomaly detector — **GMM / K-means** · CORE
- **What:** unsupervised anomaly score for unseen fault types (covers what the
  classifier wasn't trained on).
- **Where:** Edge Impulse "Anomaly" block on the STM32, alongside model #1.
- **Data:** the `normal` class from #1.

### 3. Vibration teacher — **deeper 1D-CNN (1D-ResNet style)** · HIGH VALUE
- **What:** larger, more accurate teacher; distilled (temperature T≈4) into the
  INT8 student (#1). This is what makes the cross-device knowledge-distillation
  loop real — the headline multi-device story.
- **Where:** Snapdragon X Elite AI PC (Tier 2), Hexagon NPU.
- **Runtime:** train in **PyTorch (x64)**, optimize/run via **onnxruntime-qnn**;
  optionally compile through **Qualcomm AI Hub**.
- **Data:** **MAFAULDA** (has normal / imbalance / misalignment / bearing — exact
  class match). CWRU or Paderborn as supplements.

### 4. Command-center LLM — **Gemma3-1B** · OPTIONAL WOW (NPU)
- **What:** turns the fused module states into operator-language explanations and
  answers Q&A ("Bearing seizure likely within ~12 days — schedule at next
  shutdown"). Not a detector — a narrator.
- **Where:** X Elite (onnxruntime-genai) or OnePlus 15 (LiteRT-LM), on the NPU.
- **Data:** none (pretrained; from the hackathon LiteRT model list).

### NOT modelled (statistical fusion — intentional)
- **Gas (MQ-2, MQ135):** rate-of-rise + threshold. `fusion.py grade_gas()`.
- **Temperature (DS18B20):** delta + rate-of-change. `fusion.py grade_temperature()`.
- **Corrosion (internal):** ER/LPR-proxy conductivity drift + corrosive-gas
  signature + humidity/temp cycling. `fusion.py grade_corrosion()`.
- **Fusion / Risk Index:** weighted rule engine with Critical override. `fusion.py fuse()`.

Say this to judges: "Only vibration warrants a learned model; the slow scalar
signals are better served by rate-of-rise statistics — adding a NN there would be
theatre, not engineering."

---

## Priority order (build under time pressure)

1. **#1 + #2** (STM32 1D-CNN + anomaly, self-collected) — the must-have model.
2. **#3** (X Elite teacher on MAFAULDA → distill to student) — the multi-device
   distillation headline; strongest for the 100-pt orchestration prize.
3. **#4** (Gemma3-1B narration) — cheap wow, real NPU usage (40-pt technical).

## NPU utilization (Technical Implementation = 40%)
- Teacher #3 → X Elite Hexagon NPU (onnxruntime-qnn). Verify with `get_ep_devices()`.
- LLM #4 → NPU on X Elite/phone.
- Student #1 → STM32 Cortex-M33 (TinyML, not NPU — by design for Tier 0).
- Always verify real NPU execution; never assume a clean load = NPU.
