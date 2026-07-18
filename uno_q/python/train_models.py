"""
NeuroSync ML Model Training Script
===================================
Implements:
1. 2D Spectrogram Transfer Learning using PyTorch and a Pretrained MobileNetV2
   to classify vibration patterns (normal, imbalance, misalignment, bearing_wear).
2. 1D Autoencoder for unsupervised anomaly detection (learning the 'normal' state).

Run:
    pip install torch torchvision numpy scipy
    python train_models.py
"""

import os
import sys
import numpy as np
import scipy.signal as signal
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
import torchvision.models as models

# Configure device (GPU, CPU, or Apple Silicon MPS)
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"[ML] Using device: {DEVICE}")

# --------------------------------------------------------------------------- #
# 1. 2D Spectrogram Transfer Learning Model
# --------------------------------------------------------------------------- #
class VibrationSpectrogramClassifier(nn.Module):
    def __init__(self, num_classes=4):
        super(VibrationSpectrogramClassifier, self).__init__()
        # Load a lightweight pretrained model
        # weights=models.MobileNet_V2_Weights.DEFAULT or weights=None can be used
        self.feature_extractor = models.mobilenet_v2(pretrained=True)
        
        # Freeze feature extraction layers
        for param in self.feature_extractor.parameters():
            param.requires_grad = False
            
        # Replace classification head
        in_features = self.feature_extractor.classifier[1].in_features
        self.feature_extractor.classifier = nn.Sequential(
            nn.Dropout(0.2),
            nn.Linear(in_features, 128),
            nn.ReLU(),
            nn.Linear(128, num_classes)
        )

    def forward(self, x):
        return self.feature_extractor(x)

# --------------------------------------------------------------------------- #
# 2. 1D Autoencoder for Anomaly Detection
# --------------------------------------------------------------------------- #
class VibrationAutoencoder(nn.Module):
    def __init__(self, input_dim=60):
        super(VibrationAutoencoder, self).__init__()
        self.encoder = nn.Sequential(
            nn.Linear(input_dim, 32),
            nn.ReLU(),
            nn.Linear(32, 16),
            nn.ReLU(),
            nn.Linear(16, 8)  # Bottleneck representation
        )
        self.decoder = nn.Sequential(
            nn.Linear(8, 16),
            nn.ReLU(),
            nn.Linear(16, 32),
            nn.ReLU(),
            nn.Linear(32, input_dim)
        )

    def forward(self, x):
        return self.decoder(self.encoder(x))

# --------------------------------------------------------------------------- #
# 3. Data Processing Helpers
# --------------------------------------------------------------------------- #
def compute_spectrogram(time_series, fs=200, nperseg=64, noverlap=32):
    """Converts 1D vibration time series to a 2D Spectrogram."""
    frequencies, times, spec = signal.spectrogram(time_series, fs=fs, nperseg=nperseg, noverlap=noverlap)
    log_spec = np.log(spec + 1e-10)
    
    # Normalize to 0-255
    log_spec_min, log_spec_max = log_spec.min(), log_spec.max()
    if log_spec_max > log_spec_min:
        norm_spec = 255.0 * (log_spec - log_spec_min) / (log_spec_max - log_spec_min)
    else:
        norm_spec = np.zeros_like(log_spec)
    return norm_spec.astype(np.uint8)

class VibrationDataset(Dataset):
    def __init__(self, raw_samples, labels, fs=200):
        self.samples = raw_samples
        self.labels = labels
        self.fs = fs

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        series = self.samples[idx]
        label = self.labels[idx]
        
        # Get 2D spectrogram
        spec = compute_spectrogram(series, fs=self.fs)
        
        # Resize to 224x224 (expected by MobileNetV2) using linear interpolation
        # Avoiding external dependency for resizing by using simple numpy scaling
        from scipy.ndimage import zoom
        zoom_factors = (224 / spec.shape[0], 224 / spec.shape[1])
        resized_spec = zoom(spec, zoom_factors, order=1)
        
        # Stack to create 3 channels (RGB)
        rgb_spec = np.stack([resized_spec, resized_spec, resized_spec], axis=0)
        rgb_spec = (rgb_spec / 255.0).astype(np.float32)
        
        return torch.tensor(rgb_spec), torch.tensor(label, dtype=torch.long)

# --------------------------------------------------------------------------- #
# 4. Mock Data Generation for Hackathon Validation
# --------------------------------------------------------------------------- #
def generate_mock_data(num_samples=100, length=256, fs=200):
    """Generates synthetic vibration data simulating the N20 motor rig classes."""
    data = []
    labels = []
    t = np.linspace(0, length / fs, length)
    
    for i in range(num_samples):
        label = i % 4
        # Normal operation: clean low frequency sine + low noise
        if label == 0:
            wave = np.sin(2 * np.pi * 30 * t) + np.random.normal(0, 0.1, length)
        # Imbalance: strong high amplitude sine wave at rotational frequency
        elif label == 1:
            wave = 2.5 * np.sin(2 * np.pi * 30 * t) + np.random.normal(0, 0.15, length)
        # Misalignment: dual frequency vibration components
        elif label == 2:
            wave = np.sin(2 * np.pi * 30 * t) + 1.2 * np.sin(2 * np.pi * 60 * t) + np.random.normal(0, 0.2, length)
        # Bearing wear: high frequency friction noise / impact spikes
        else:
            wave = np.sin(2 * np.pi * 30 * t) + np.random.normal(0, 0.5, length)
            
        data.append(wave)
        labels.append(label)
        
    return np.array(data), np.array(labels)

# --------------------------------------------------------------------------- #
# 5. Main Model Orchestration
# --------------------------------------------------------------------------- #
def main():
    print("[ML] Generating synthetic N20 vibration datasets...")
    raw_data, labels = generate_mock_data(num_samples=80, length=256)
    
    # 1. Train the Spectrogram Classifier
    print("\n[ML] --- Phase 1: Training Spectrogram Classifier ---")
    dataset = VibrationDataset(raw_data, labels)
    dataloader = DataLoader(dataset, batch_size=8, shuffle=True)
    
    model = VibrationSpectrogramClassifier(num_classes=4).to(DEVICE)
    optimizer = optim.Adam(model.feature_extractor.classifier.parameters(), lr=0.001)
    criterion = nn.CrossEntropyLoss()
    
    model.train()
    for epoch in range(5): # Short epochs for verification
        epoch_loss = 0.0
        correct = 0
        total = 0
        for batch_x, batch_y in dataloader:
            batch_x, batch_y = batch_x.to(DEVICE), batch_y.to(DEVICE)
            optimizer.zero_grad()
            outputs = model(batch_x)
            loss = criterion(outputs, batch_y)
            loss.backward()
            optimizer.step()
            
            epoch_loss += loss.item() * batch_x.size(0)
            _, predicted = torch.max(outputs, 1)
            correct += (predicted == batch_y).sum().item()
            total += batch_y.size(0)
            
        acc = (correct / total) * 100
        print(f"Epoch {epoch+1}/5 | Loss: {epoch_loss/total:.4f} | Accuracy: {acc:.2f}%")
        
    print("[ML] Spectrogram classifier trained successfully!")
    
    # 2. Train the Anomaly Autoencoder (using only Class 0: Normal data)
    print("\n[ML] --- Phase 2: Training Anomaly Autoencoder ---")
    normal_indices = np.where(labels == 0)[0]
    # Slice the first 60 samples from the normal vibration windows to match the telemetry waveform contract
    normal_waveforms = raw_data[normal_indices][:, :60]
    
    ae_model = VibrationAutoencoder(input_dim=60).to(DEVICE)
    ae_optimizer = optim.Adam(ae_model.parameters(), lr=0.005)
    ae_criterion = nn.MSELoss()
    
    ae_dataset = torch.tensor(normal_waveforms, dtype=torch.float32).to(DEVICE)
    ae_dataloader = DataLoader(ae_dataset, batch_size=4, shuffle=True)
    
    ae_model.train()
    for epoch in range(15):
        epoch_loss = 0.0
        for batch in ae_dataloader:
            ae_optimizer.zero_grad()
            reconstructed = ae_model(batch)
            loss = ae_criterion(reconstructed, batch)
            loss.backward()
            ae_optimizer.step()
            epoch_loss += loss.item() * batch.size(0)
        print(f"Epoch {epoch+1}/15 | AE Loss: {epoch_loss/len(normal_waveforms):.5f}")
        
    # Determine the reconstruction error threshold (95th percentile of normal data error)
    ae_model.eval()
    with torch.no_grad():
        reconstructed_normal = ae_model(ae_dataset)
        mse_errors = torch.mean((reconstructed_normal - ae_dataset) ** 2, dim=1).cpu().numpy()
        threshold = np.percentile(mse_errors, 95)
    print(f"[ML] Autoencoder normal reconstruction baseline established.")
    print(f"[ML] Anomaly threshold (95th percentile): {threshold:.5f}")
    
    # Test Autoencoder on a known anomaly (Class 1: Imbalance)
    print("\n[ML] --- Phase 3: Testing Anomaly Detection ---")
    imbalance_indices = np.where(labels == 1)[0]
    imbalance_waveforms = torch.tensor(raw_data[imbalance_indices][:, :60], dtype=torch.float32).to(DEVICE)
    
    with torch.no_grad():
        reconstructed_imbalance = ae_model(imbalance_waveforms)
        anomaly_errors = torch.mean((reconstructed_imbalance - imbalance_waveforms) ** 2, dim=1).cpu().numpy()
        
    print(f"Normal waveforms average reconstruction error: {np.mean(mse_errors):.5f}")
    print(f"Anomalous (Imbalance) average reconstruction error: {np.mean(anomaly_errors):.5f}")
    
    anomalies_detected = sum(err > threshold for err in anomaly_errors)
    print(f"Detected {anomalies_detected} out of {len(anomaly_errors)} mock anomalies (Detection Rate: {(anomalies_detected/len(anomaly_errors))*100:.1f}%)")

if __name__ == "__main__":
    main()
