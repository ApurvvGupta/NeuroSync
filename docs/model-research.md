# NeuroSync — Model Research: Vibration Anomaly / Fault Detection

Research question: is there a **pretrained model** we can deploy to detect
anomalies/faults from an **MPU6050** on rotating machinery (oil & gas), with the
N20 motor + L293D as the live fault-injection rig?

## Headline finding

**No pretrained model runs directly on raw MPU6050 data for this task.**
- Qualcomm AI Hub's catalog is vision / LLM / audio — no vibration or bearing
  fault model ([AI Hub models](https://aihub.qualcomm.com/models)).
- Public bearing models are trained on lab rigs sampled at 12–48 kHz (CWRU, etc.);
  the MPU6050 runs at a few hundred Hz, ±2 g. The **domain gap** means those
  weights do not transfer to our sensor without retraining.

The field solves this two ways, and both fit our 3-model plan:

## Edge models (STM32 + MPU6050) — self-trained TinyML is the proven path

This exact hardware pattern (MPU6050 + MCU + motor) is well established:
- **VibroSense** — MPU6050 + ESP32 TinyML classifies vibration as normal/faulty on
  device ([electronicwings](https://www.electronicwings.com/users/JEEVITHT/projects/6655/vibrosense-real-time-machine-anomaly-detection-using-tinyml-on-esp32)).
- **Edge Impulse** motor anomaly reference projects
  ([EI blog](https://edgeimpulse.com/blog/detect-motor-anomalies-using-edge-ml/)).
- **TI Motor Bearing Fault** TinyML example
  ([TI docs](https://software-dl.ti.com/C2000/esd/mcu_ai/01_03_00/user_guide/examples/motor_bearing_fault.html)).
- Autoencoder reconstruction-error anomaly on MPU6050 for CNC PdM
  ([Springer 2025](https://link.springer.com/10.1007/s12008-025-02407-2)).

**Decision:**
- **Model #1 (classifier):** self-trained **1D-CNN** in Edge Impulse on our N20-rig
  data (normal / imbalance / misalignment / bearing_wear). No pretrained model
  fits — this is the correct, credible call, not a shortcut.
- **Model #2 (anomaly):** Edge Impulse **anomaly block (GMM/K-means)** or an
  **autoencoder** trained on the `normal` class — flags unseen faults by
  reconstruction/distance. Z-score fallback already ships in `sketch.ino`.

## Heavy model (X Elite AI PC, model #3) — here a pretrained model IS available

Use a genuinely pretrained model as the deep-diagnosis / distillation teacher:

- **BearLLM** — pretrained bearing health model with a unified frequency-domain
  vibration representation; reports SOTA across nine public benchmarks with one
  set of weights. Research-grade, PC-class — ideal for the **X Elite heavy tier**
  ([Hugging Face](https://huggingface.co/SIA-IDE/BearLLM),
  [paper](https://arxiv.org/html/2408.11281)).
- **Transfer learning from a pretrained audio CNN (VGGish)** fine-tuned on
  vibration spectrograms — a documented, effective route
  ([MDPI Sensors](https://www.mdpi.com/article/10.3390/s23010211)).
- **Pretrained CWRU CNNs** (lite ShuffleNetV2-class) to fine-tune / act as teacher
  ([MDPI 2025](https://www.mdpi.com/2227-9717/13/11/3600),
  [CWRU data on GitHub](https://github.com/XiongMeijing/CWRU-1)).

**Decision (model #3):** run a pretrained deep model on the X Elite NPU as the
**teacher**, then knowledge-distill into the tiny STM32 student (#1). Best single
pick: **BearLLM** (already pretrained, frequency-domain — robust to our lower
sample rate). Fallback teacher: VGGish transfer learning on spectrograms, or a
CWRU-pretrained CNN. Training/fine-tuning data: **MAFAULDA** (has our exact
classes) or CWRU.

## Non-vibration sensors — no model (by design)
Gas (MQ-2, MQ135), temperature (DS18B20), corrosion (soil-moisture ER/LPR proxy)
use rate-of-rise + threshold fusion in `fusion.py`. Adding a NN there is theatre.

## What to tell judges
"There is no off-the-shelf model for raw MPU6050 fault detection — the sample
rate and scale don't match public bearing datasets, so we self-train a TinyML
1D-CNN + anomaly detector on the device's own data (the credible approach). On
the X Elite we run a *pretrained* deep bearing model (BearLLM) as a teacher and
distill it into the MCU student — that's the four-device intelligence loop."

*Content rephrased/summarised from the linked sources for licensing compliance.*
