import numpy as np
import pandas as pd
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier
import os
import time

try:
    from skl2onnx import convert_sklearn
    from skl2onnx.common.data_types import FloatTensorType
    ONNX_AVAILABLE = True
except ImportError:
    ONNX_AVAILABLE = False
    print("Warning: skl2onnx not installed, skipping ONNX export.")

print("NeuroSync V3: Generating Massive Industrial Dataset (1,000,000 telemetry points)...")
start_time = time.time()
N = 1000000
np.random.seed(42)

# Raw Vibration, Temperature, Gas (MQ2), Corrosion
vib = np.random.uniform(0.01, 15.0, N).astype(np.float32)
temp = np.random.uniform(20.0, 100.0, N).astype(np.float32)
gas = np.random.uniform(200, 3000, N).astype(np.float32)
corr = np.random.uniform(0.0, 1.0, N).astype(np.float32)

X = np.column_stack((vib, temp, gas, corr))

# MCU Target: Risk Level (0: Normal, 1: Warning, 2: Critical)
# Using strict raw thresholds instead of Z-scores
highs = np.zeros(N, dtype=int)
highs += (vib > 3.0).astype(int)
highs += (temp > 60.0).astype(int)
highs += (gas > 1500).astype(int)
highs += (corr > 0.5).astype(int)

y_mcu = np.zeros(N, dtype=int)
y_mcu[highs >= 2] = 2
y_mcu[highs == 1] = 1

# MPU Target: Fault Type (0: none, 1: bearing_wear, 2: thermal_runaway, 3: gas_leak)
y_mpu = np.zeros(N, dtype=int)
y_mpu[gas > 2000] = 3
y_mpu[temp > 80.0] = 2
y_mpu[vib > 4.5] = 1

print(f"Dataset generated in {time.time() - start_time:.2f} seconds.")

# ---------------------------------------------------------
# 1. MCU TinyML (Decision Tree to C++)
# ---------------------------------------------------------
print("Training TinyML Decision Tree for MCU (STM32U585)...")
dt = DecisionTreeClassifier(max_depth=4, random_state=42)
dt.fit(X, y_mcu)

def tree_to_cpp(tree, feature_names):
    tree_ = tree.tree_
    feature_name = [feature_names[i] if i != -2 else "undefined!" for i in tree_.feature]
    cpp_code = "int predict_risk(float vib, float temp, float gas, float corr) {\n"

    def recurse(node, depth):
        indent = "  " * depth
        if tree_.feature[node] != -2:
            name = feature_name[node]
            threshold = tree_.threshold[node]
            s = f"{indent}if ({name} <= {threshold:.3f}) {{\n"
            s += recurse(tree_.children_left[node], depth + 1)
            s += f"{indent}}} else {{\n"
            s += recurse(tree_.children_right[node], depth + 1)
            s += f"{indent}}}\n"
            return s
        else:
            class_val = np.argmax(tree_.value[node][0])
            return f"{indent}return {class_val};\n"

    cpp_code += recurse(0, 1)
    cpp_code += "}\n"
    return cpp_code

cpp_code = tree_to_cpp(dt, ["vib", "temp", "gas", "corr"])
os.makedirs("C:/NS1/sketch", exist_ok=True)
with open("C:/NS1/sketch/ml_model.h", "w") as f:
    f.write("#ifndef ML_MODEL_H\n#define ML_MODEL_H\n\n")
    f.write("// NeuroSync Edge AI - MCU TinyML Decision Tree\n")
    f.write("// Trained on 1,000,000 industrial data points\n\n")
    f.write(cpp_code)
    f.write("\n#endif\n")

# ---------------------------------------------------------
# 2. MPU ONNX (Random Forest for Qualcomm AI Hub)
# ---------------------------------------------------------
print("Training Random Forest for MPU (Qualcomm Hexagon NPU)...")
rf = RandomForestClassifier(n_estimators=15, max_depth=6, random_state=42, n_jobs=-1)
rf.fit(X, y_mpu)

os.makedirs("C:/NS1/python", exist_ok=True)

if ONNX_AVAILABLE:
    print("Exporting model to ONNX Runtime format...")
    # 4 input features of type float32
    initial_type = [('float_input', FloatTensorType([None, 4]))]
    onx = convert_sklearn(rf, initial_types=initial_type, target_opset=12)
    with open("C:/NS1/python/rf_model.onnx", "wb") as f:
        f.write(onx.SerializeToString())
    print("ONNX model saved successfully to C:/NS1/python/rf_model.onnx")
else:
    print("Skipped ONNX export due to missing dependencies.")

print("Pipeline execution complete! 🚀")
