# Deep Research: Pretrained Models for Vibration & Sensor Anomaly Detection in Oil & Gas

This document details the research findings, architectural decisions, and concrete implementations for deploying AI/ML models on **vibration data (MPU6050)** while integrating environmental sensors (**MQ2, MQ135, DS18B20, and Soil Moisture**) for an end-to-end industrial anomaly and fault detection system.

---

## Executive Summary: The "Domain Gap" & Design Philosophy

For a high-scoring hackathon project, judges evaluate both **technical sophistication** and **engineering pragmatism**. The NeuroSync architecture divides the sensing suite into two distinct processing pathways:

1. **Vibration Anomaly & Fault Classification (MPU6050 + N20 Motor Rig):** 
   * **The Reality of "Pretrained" Models:** There is no off-the-shelf model that can ingest raw accelerometer data from a low-cost, low-frequency MEMS sensor (MPU6050 running at $\sim$100–500 Hz on an Arduino) and accurately classify bearing wear or imbalance. Industrial bearing models (like those trained on the Case Western Reserve University (CWRU) or Paderborn datasets) expect high-frequency piezoelectric accelerometers sampled at $12\text{ kHz}$ to $50\text{ kHz}$.
   * **The Solution:** We bridge this **domain gap** using two methods:
     * **Transfer Learning on 2D Spectrograms:** Converting the 1D vibration time series into 2D time-frequency spectrograms using a Short-Time Fourier Transform (STFT), then feeding it into a pretrained image model (e.g., **MobileNetV2** or **ResNet50**) or pretrained audio model (**VGGish**).
     * **Domain Adaptation of 1D-CNN (WDCNN):** Fine-tuning a Wide Deep Convolutional Neural Network pretrained on CWRU with a small subset of self-collected N20 motor rig data.
     * **Unsupervised Anomaly Detection:** An autoencoder model trained purely on "normal" operational vibration to output a reconstruction error (anomaly score) for unseen faults.

2. **Environmental & Corrosion Risks (MQ2, MQ135, DS18B20, Soil Moisture):**
   * **Design Decision:** These slow-varying scalar signals **do not use deep learning**. Instead, they utilize a statistical rule-based fusion engine (`fusion.py`) calculating rate-of-rise and relative thresholds.
   * **Defense for Judges:** *"Adding a neural network to slow-varying scalar environmental sensors is over-engineering (theatre, not engineering). It introduces unnecessary latency, increases power consumption, destroys explainability, and is prone to overfitting. A deterministic statistical fusion engine is safer, faster, and complies with industrial standards like ISA and IEC."*

---

## 1. Top Pretrained Models & Frameworks for Vibration Diagnostics

Here are the primary models and datasets you can leverage on the Snapdragon X Elite AI PC (Tier 2/3) or compile for the Snapdragon NPU:

### A. BearLLM (Multimodal Bearing Health Management)
* **What:** A state-of-the-art framework that unifies vibration analysis, fault diagnosis, and operational decision-making. It maps frequency-domain vibration signals to semantic embeddings aligned with a Large Language Model (Gemma/Llama-based).
* **Source:** [Hugging Face (SIA-IDE/MBHM)](https://huggingface.co/datasets/SIA-IDE/MBHM) / [Paper (arXiv:2408.11281)](https://arxiv.org/abs/2408.11281).
* **Why it fits:** It utilizes a **Discrete Cosine Transform (DCT) / Spectral normalization** representation, making it robust to different sensor sampling rates. It represents the "heavy tier" running on the X Elite NPU to act as a diagnostic narrator.

### B. WDCNN (Wide-Kernel Deep Convolutional Neural Network)
* **What:** The benchmark 1D-CNN architecture for bearing fault diagnosis. The first layer uses a very wide convolution kernel (e.g., size 64 or 128) to suppress high-frequency noise and capture low-frequency vibration trends.
* **Source:** Multiple open-source implementations on GitHub (e.g., [monologuesmw/bearing-fault-diagnosis-by-wdcnn](https://github.com/monologuesmw/bearing-fault-diagnosis-by-wdcnn)).
* **Why it fits:** You can load the weights pretrained on the CWRU dataset, slice off the final fully connected layers, freeze the wide feature extractor, and add a small dense classifier to fine-tune on your N20 vibration data.

### C. Pretrained Audio CNNs (VGGish / YAMNet)
* **What:** Models pretrained on millions of audio clips (which are physically identical to vibration waves).
* **Source:** TensorFlow Hub / PyTorch Hub.
* **Why it fits:** By framing the MPU6050 vibration signal as an audio spectrogram, you can leverage VGGish's rich feature representation. Fine-tuning is fast and requires very few samples from your N20 rig.

---

## 2. Technical Implementation: PyTorch Spectrogram Transfer Learning Pipeline

Below is a complete, runnable PyTorch script that implements **2D Spectrogram Transfer Learning**. It converts a 1D vibration window from the MPU6050 into a spectrogram and utilizes a pretrained **MobileNetV2** (ideal for low-power edge deployment or X Elite NPU execution) to classify the four target states: `normal`, `imbalance`, `misalignment`, `bearing_wear`.

```python
import os
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
import torchvision.models as models
import numpy as np
from scipy import signal

# Define the MPU6050 Transfer Learning Model
class VibrationSpectrogramClassifier(nn.Module):
    def __init__(self, num_classes=4):
        super(VibrationSpectrogramClassifier, self).__init__()
        # Load a lightweight pretrained model (MobileNetV2)
        self.feature_extractor = models.mobilenet_v2(pretrained=True)
        
        # Freeze the feature extractor layers to retain pretrained weights
        for param in self.feature_extractor.parameters():
            param.requires_grad = False
            
        # Replace the final classification head
        in_features = self.feature_extractor.classifier[1].in_features
        self.feature_extractor.classifier = nn.Sequential(
            nn.Dropout(0.2),
            nn.Linear(in_features, 128),
            nn.ReLU(),
            nn.Linear(128, num_classes)
        )

    def forward(self, x):
        # x shape: [batch_size, 3, 224, 224] (ImageNet expected shape)
        return self.feature_extractor(x)

# Signal processing: Convert raw MPU6050 1D vibration to 2D Spectrogram
def compute_spectrogram(time_series, fs=200, nperseg=64, noverlap=32):
    """
    Converts 1D vibration time series to 2D Spectrogram.
    time_series: numpy array of shape (N,)
    fs: sampling rate of MPU6050 (typically ~200 Hz on Arduino)
    """
    frequencies, times, spec = signal.spectrogram(time_series, fs=fs, nperseg=nperseg, noverlap=noverlap)
    # Convert to log scale to compress dynamic range
    log_spec = np.log(spec + 1e-10)
    
    # Normalize to 0-255 range for image models
    log_spec_min = log_spec.min()
    log_spec_max = log_spec.max()
    if log_spec_max > log_spec_min:
        norm_spec = 255.0 * (log_spec - log_spec_min) / (log_spec_max - log_spec_min)
    else:
        norm_spec = np.zeros_like(log_spec)
        
    return norm_spec.astype(np.uint8)

# PyTorch Dataset for Hackathon Data (N20 rig)
class VibrationDataset(Dataset):
    def __init__(self, raw_samples, labels, fs=200):
        """
        raw_samples: list/array of MPU6050 windows, each of shape (window_length,)
        labels: corresponding class indices (0: normal, 1: imbalance, 2: misalignment, 3: bearing_wear)
        """
        self.samples = raw_samples
        self.labels = labels
        self.fs = fs

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        series = self.samples[idx]
        label = self.labels[idx]
        
        # 1. Compute spectrogram
        spec = compute_spectrogram(series, fs=self.fs)
        
        # 2. Resize/pad spectrogram to 224x224 and make it 3-channel (RGB representation)
        # For simplicity in NumPy, we interpolate the 2D array
        from scipy.ndimage import zoom
        zoom_factors = (224 / spec.shape[0], 224 / spec.shape[1])
        resized_spec = zoom(spec, zoom_factors, order=1)
        
        # Duplicate to 3 channels: [3, 224, 224]
        rgb_spec = np.stack([resized_spec, resized_spec, resized_spec], axis=0)
        rgb_spec = (rgb_spec / 255.0).astype(np.float32) # Scale to [0, 1]
        
        return torch.tensor(rgb_spec), torch.tensor(label, dtype=torch.long)
```

---

## 3. Technical Implementation: Unsupervised Autoencoder for Anomaly Detection

To detect **unseen anomalies** (faults not covered by your training data, such as a loose pipeline bolt or bearing dry-out), use an **Autoencoder**. It is trained **only on normal data**. When presented with a fault, its reconstruction error spikes.

```python
class VibrationAutoencoder(nn.Module):
    def __init__(self, input_dim=60): # fits the 60-sample telemetry waveform
        super(VibrationAutoencoder, self).__init__()
        # Encoder
        self.encoder = nn.Sequential(
            nn.Linear(input_dim, 32),
            nn.ReLU(),
            nn.Linear(32, 16),
            nn.ReLU(),
            nn.Linear(16, 8) # Latent bottleneck representation
        )
        # Decoder
        self.decoder = nn.Sequential(
            nn.Linear(8, 16),
            nn.ReLU(),
            nn.Linear(16, 32),
            nn.ReLU(),
            nn.Linear(32, input_dim)
        )

    def forward(self, x):
        latent = self.encoder(x)
        reconstruction = self.decoder(latent)
        return reconstruction

# Training Loop & Anomaly Threshold Calculation
def train_autoencoder(normal_data, epochs=50, lr=0.001):
    model = VibrationAutoencoder(input_dim=normal_data.shape[1])
    criterion = nn.MSELoss()
    optimizer = optim.Adam(model.parameters(), lr=lr)
    
    dataset = torch.tensor(normal_data, dtype=torch.float32)
    dataloader = DataLoader(dataset, batch_size=16, shuffle=True)
    
    model.train()
    for epoch in range(epochs):
        for batch in dataloader:
            optimizer.zero_grad()
            reconstructed = model(batch)
            loss = criterion(reconstructed, batch)
            loss.backward()
            optimizer.step()
            
    # Calculate anomaly threshold (e.g., 95th percentile of normal reconstruction error)
    model.eval()
    with torch.no_grad():
        reconstructed_normal = model(dataset)
        mse_errors = torch.mean((reconstructed_normal - dataset) ** 2, dim=1).numpy()
        threshold = np.percentile(mse_errors, 95)
        
    print(f"Autoencoder anomaly threshold established: {threshold:.5f}")
    return model, threshold
```

---

## 4. How to Structure the Hackathon Data Collection Rig

Since public datasets cannot match the MPU6050 mounted on your physical N20 motor rig, you should collect **10–15 minutes of training data** per class:

1. **Class 0: Normal**
   * Run the N20 motor at standard speeds ($3\text{V} - 6\text{V}$ PWM control) with the motor securely clamped to the mock pipeline/rig.
2. **Class 1: Imbalance (Eccentric Load)**
   * Attach a tiny off-center weight (e.g., a small piece of hot glue or tape) to the N20 motor shaft. This creates a rotating imbalance fault.
3. **Class 2: Misalignment**
   * Loosen one side of the motor mounting bracket, or tilt the motor slightly relative to the MPU6050 sensor's axis.
4. **Class 3: Bearing Wear / Structural Looseness**
   * Place the N20 motor on a loose surface that rattles when run, mimicking bearing degradation and structural clearance issues.

---

## 5. Industrial Context: Fusing the Environmental Sensors

While vibration detects mechanical faults in rotatory machinery, the other sensors cover critical safety domains:

| Sensor | Industrial Threat | Detection Method | Action Threshold / Logic |
| :--- | :--- | :--- | :--- |
| **MPU6050** | Mechanical failure (bearing, misalignment, imbalance) | TinyML 1D-CNN + Autoencoder | Anomaly score/Z-score $\ge 3$ triggers alert. |
| **MQ135** | Toxic/Acidic Gas Leak ($H_2S, NH_3$, Benzene) | Statistical Rate-of-Rise | Delta over baseline $\ge 120\text{ ppm}$. |
| **MQ2** | Fire/Explosion risk (Methane, Propane, Smoke) | Threshold + Rate-of-Rise | Delta over baseline $\ge 300\text{ ppm}$. |
| **Soil Moisture** | Pipeline corrosion / External degradation | Conductivity Index | Index $> 0.8$ flags high corrosion risk. |
| **DS18B20** | Hot-spots / Friction / Fire precursor | Absolute delta from baseline | Temp delta $\ge 20^\circ\text{C}$ is Critical. |

### Fused Risk Index Formula
The system combines these indicators into a unified Risk Index ($0-100$):
$$\text{Risk} = 0.35 \times \text{Gas} + 0.25 \times \text{Vibration} + 0.20 \times \text{Temperature} + 0.20 \times \text{Corrosion}$$

**Critical Override Constraint:** If any individual sensor enters a **Critical** state (e.g., MQ2 detects methane leak, or DS18B20 spikes over warning thresholds), the final Risk Index is immediately overridden to $\ge 90$ to prevent averaging away a life-safety emergency.

---

## 6. Judges' Pitch & Q&A Preparation

When presenting, use this script to handle common questions:

* **Q: Why didn't you train a deep learning model for the MQ gas or temperature sensors?**
  * **A:** *"Industrial process safety requires deterministic predictability. Environmental leak and temperature signatures are simple, slow-moving scalar variables. A neural network here would add latency and risk 'catastrophic forgetting' or false negatives under unseen conditions. Our rule-based statistical fusion engine is explainable, instant, and follows standard engineering principles."*
* **Q: How did you solve the domain gap for the MPU6050 sensor?**
  * **A:** *"We recognized that industrial vibration datasets (CWRU, MAFAULDA) operate at high sampling rates ($12\text{ kHz}$ to $50\text{ kHz}$) using expensive industrial sensors, while our rig uses a MEMS MPU6050. To bridge this, we converted our raw signals to the frequency domain (Spectrograms) and leveraged transfer learning using a pretrained MobileNetV2 feature extractor. This allows us to benefit from large-scale pretraining while aligning the sensor domains."*
* **Q: Explain the multi-tier orchestration.**
  * **A:** *"We employ a 4-tier intelligence architecture: Tier 0 runs raw sensor reading and real-time Z-score/1D-CNN scoring on the STM32 microcontroller. Tier 1 aggregates data and applies adaptive baselines on the QRB2210 bridge. Tier 2 uses the Snapdragon X Elite AI PC to run the heavy diagnostic teacher model (BearLLM) and distill its knowledge into the microcontroller's tiny student network. Tier 4 represents the field operator's Android app (OnePlus 15) for alert display."*
