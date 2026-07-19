# 🛢️ NeuroSync: 3-Tier Edge AI Pipeline for Predictive Maintenance

**NeuroSync** is a decentralized, offline-first Industrial IoT (IIoT) architecture designed to monitor, predict, and autonomously resolve faults in Oil & Gas pipelines. It leverages a unique 3-tier AI hierarchy, scaling from milliwatt microcontrollers to powerful Qualcomm Snapdragon Edge NPUs, and finally to a localized Generative AI Copilot.

![NeuroSync Architecture](assets/banner.jpg)

---

## 🧠 The 3-Tier AI Architecture

### 1️⃣ Tier 1: Extreme Edge (MCU Node)
At the physical sensor level, we utilize **TinyML** deployed on an STM32/Arduino microcontroller.
*   **Sensors:** MPU6050 (Vibration/IMU), MQ2 (Gas Leakage), DS18B20 (Temperature), Soil Moisture (Corrosion).
*   **AI/ML:** A lightweight **C++ Decision Tree** analyzes raw analog signals at hundreds of Hz. It performs physics-based calculations (like gravity cancellation) to instantly calculate a baseline Risk Index with true zero-latency.

### 2️⃣ Tier 2: Heavy Edge (Qualcomm Snapdragon NPU)
Data from the MCU is streamed to a high-compute edge node (PC/Snapdragon).
*   **ONNX ML Engine:** We trained a Random Forest Classifier and exported it to the `.onnx` format. This allows us to utilize **Qualcomm AI Hub** tools and execution providers to run the model natively on Snapdragon Hexagon DSPs/NPUs for extreme power efficiency and speed.
*   **Adaptive Self-Learning Baseline:** Instead of relying on hardcoded thresholds, our ML backend implements an online learning algorithm. It observes the natural "stationary noise" of the pipeline and dynamically scales its fault thresholds. If the machine vibrates slightly more due to environmental changes, the AI adapts. If a spike breaks this dynamically learned limit, it classifies the fault (e.g., `bearing_wear`, `gas_leak`).

### 3️⃣ Tier 3: Cloudless GenAI Copilot
When a critical fault is confirmed by the ONNX model, human operators need instant, actionable guidance without relying on slow or insecure internet connections.
*   **Local LLM:** We deployed **Google Gemma (2B/7B)** completely locally using Ollama.
*   **Autonomous Agent:** The dashboard automatically injects the active fault type and real-time telemetry (Vibration m/s², Temp °C, Gas concentration) into a highly engineered prompt. The Gemma model instantly types out a strict, 3-step Emergency Maintenance Protocol, ensuring operators know exactly what valves to shut or which ventilation systems to activate.

---

## 🛠️ Qualcomm AI Hub Integration
This project utilizes workflows inspired by the **Qualcomm AI Hub**:
1.  **Model Optimization:** The core anomaly detection model was trained using Scikit-Learn and exported to the ONNX format. This format is natively supported by the Qualcomm AI Engine Direct architecture.
2.  **Edge Execution:** By running the `.onnx` model locally on the Edge PC (representing the Snapdragon Compute platform), we bypass cloud latency, ensuring that industrial data never leaves the facility floor.
3.  **Heterogeneous Compute:** The architecture is designed to offload the heavy LLM (Gemma) to the GPU/NPU, while the ONNX Random Forest runs efficiently on the CPU/DSP, showcasing a true heterogeneous compute environment.

---

## 📂 Project Structure

```text
NeuroSync/
├── sketch/                   # Tier 1: Arduino/STM32 C++ Code
│   ├── sketch.ino            # Main TinyML Sensor Polling & RPC Logic
│   └── ml_model.h            # Exported TinyML Decision Tree
├── python/                   # Tier 2 & 3: Python Backend
│   ├── main.py               # ONNX Engine, Adaptive Baseline, and WebSocket Server
│   └── rf_model.onnx         # Trained Machine Learning Model
├── streamlit_dash.py         # The SCADA Command Center UI
├── telemetry.csv             # Training dataset for the ONNX model
└── .streamlit/config.toml    # Industrial Dark Theme configuration
```

---

## 🚀 How to Run the Project

### Prerequisites
*   **Hardware:** Arduino/STM32 compatible board, MPU6050, MQ2, DS18B20.
*   **Software:** Python 3.10+, Streamlit, Ollama.

### Step 1: Start the Local LLM (Tier 3)
Ensure Ollama is installed and the Gemma model is loaded in the background:
```bash
ollama run gemma
```

### Step 2: Flash the MCU (Tier 1)
Upload the `sketch/sketch.ino` file to your microcontroller using the Arduino IDE or App Lab.

### Step 3: Start the AI Backend (Tier 2)
Run the Python ML engine to connect to the MCU and start the adaptive baseline algorithm:
```bash
python python/main.py
```

### Step 4: Launch the Command Center
Open a new terminal and launch the Streamlit SCADA Dashboard:
```bash
streamlit run streamlit_dash.py
```
