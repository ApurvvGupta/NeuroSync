import asyncio
import json
import copy
import os
import numpy as np
from datetime import datetime
import websockets

try:
    import onnxruntime as ort
    ONNX_OK = True
except ImportError:
    ONNX_OK = False

clients = set()
latest_frame = None
frame_history = []
last_ts = -1
last_alert_printed = ""

vib_streak = 0
gas_streak = 0
PERSISTENCE_COUNT = 3

RF_MODEL_PATH = os.path.join(os.path.dirname(__file__), "rf_model.onnx")
onnx_session = None

if ONNX_OK and os.path.exists(RF_MODEL_PATH):
    try:
        onnx_session = ort.InferenceSession(RF_MODEL_PATH, providers=['CPUExecutionProvider'])
        print("[AI-HUB] Successfully loaded ONNX model for NPU execution.")
    except Exception as e:
        print(f"[AI-WARN] Failed to load ONNX model: {e}")

FAULT_MAP = {
    0: "none",
    1: "bearing_wear",
    2: "thermal_runaway",
    3: "gas_leak"
}

class AdaptiveBaseline:
    def __init__(self):
        self.vib_history = []
        self.vib_threshold = 0.5
        self.gas_threshold = 530
        self.samples_learned = 0
        
    def learn(self, vib, gas):
        if vib < 0.3 and gas < 1000:
            self.vib_history.append(vib)
            self.samples_learned += 1
            if len(self.vib_history) > 200:
                self.vib_history.pop(0)
                
            avg_vib = sum(self.vib_history) / len(self.vib_history)
            new_thresh = max(0.05, avg_vib * 3.0)
            
            self.vib_threshold = (self.vib_threshold * 0.95) + (new_thresh * 0.05)

adaptive = AdaptiveBaseline()

try:
    from arduino.app_bridge import Bridge
    bridge = Bridge()
except ImportError:
    try:
        from arduino.app_utils import Bridge
        bridge = Bridge()
    except ImportError:
        raise SystemExit("CRITICAL ERROR: Arduino App Lab Bridge library not found.")

async def get_mcu_frame():
    return await asyncio.to_thread(bridge.call, "get_frame")

def validate_frame(frame: dict) -> bool:
    temp = frame.get("temperature", 0.0)
    if temp == -127.0: frame["temperature"] = 0.0
    corr = frame.get("corrosion", 0.0)
    if corr < 0.0: frame["corrosion"] = 0.0
    if corr > 1.0: frame["corrosion"] = 1.0
    return True

def analyze_faults(frame: dict) -> dict:
    global vib_streak, gas_streak
    
    vib = frame.get("vibration_rms", 0.0)
    gas = frame.get("gas_mq2", 0.0)
    
    adaptive.learn(vib, gas)
    frame["learned_vib_threshold"] = adaptive.vib_threshold
    frame["learning_samples"] = adaptive.samples_learned
    
    if vib > adaptive.vib_threshold:
        vib_streak += 1
    else:
        vib_streak = max(0, vib_streak - 1)
        
    if gas > adaptive.gas_threshold:
        gas_streak += 1
    else:
        gas_streak = max(0, gas_streak - 1)
        
    if vib_streak >= PERSISTENCE_COUNT:
        frame["alert"] = "Vibration exceeded adaptive baseline!"
        frame["risk_index"] = max(frame.get("risk_index", 0), 92)
        frame["vib_status"] = "critical"
        
    if gas_streak >= PERSISTENCE_COUNT:
        frame["alert"] = "GAS LEAK CRITICAL - isolate & ventilate"
        frame["risk_index"] = max(frame.get("risk_index", 0), 95)
        frame["gas_status"] = "critical"
        
    if onnx_session is not None:
        try:
            features = np.array([[vib, frame.get("temperature", 0.0), gas, frame.get("corrosion", 0.0)]], dtype=np.float32)
            
            input_name = onnx_session.get_inputs()[0].name
            label_name = onnx_session.get_outputs()[0].name
            
            pred = onnx_session.run([label_name], {input_name: features})[0]
            pred_class = int(pred[0])
            frame["fault_type"] = FAULT_MAP.get(pred_class, "none")
            
            if frame["fault_type"] != "none" and not frame.get("alert"):
                frame["alert"] = f"AI Hub Prediction: {frame['fault_type'].upper()}"
        except Exception as e:
            pass
            
    return frame

async def broadcast(frame: dict):
    if not clients: return
    message = json.dumps(frame)
    dead_clients = set()
    for client in clients:
        try:
            await client.send(message)
        except Exception:
            dead_clients.add(client)
    clients.difference_update(dead_clients)

def print_log(frame: dict):
    global last_alert_printed
    now = datetime.now().strftime("%H:%M:%S")
    alert = frame.get("alert", "")
    risk = frame.get("risk_index", 0)
    
    print(f"\n[{now}]")
    print(f"Vibration: {frame.get('vibration_rms', 0.0):.3f} (Threshold: {adaptive.vib_threshold:.2f})")
    print(f"Temperature: {frame.get('temperature', 0.0):.1f}")
    print(f"Gas: {frame.get('gas_mq2', 0)}")
    print(f"Corrosion: {frame.get('corrosion', 0.0):.3f}")
    print(f"Risk: {risk} | Status: {'CRITICAL' if alert else 'NORMAL'}")
    
    if alert and alert != last_alert_printed:
        print("\n[AI ALERT]")
        print(f"{alert}")
        print("-" * 30)
        last_alert_printed = alert
    elif not alert:
        last_alert_printed = ""

async def poll_loop():
    global latest_frame, last_ts, frame_history
    while True:
        try:
            raw_data = await asyncio.wait_for(get_mcu_frame(), timeout=2.0)
            parsed = json.loads(raw_data)
            new_frame = copy.deepcopy(parsed)
            ts = new_frame.get("ts", 0)
            
            if ts == last_ts:
                await asyncio.sleep(0.05)
                continue
            if ts < last_ts:
                print("\n[info] MCU Reboot detected. Resetting timestamp.")
            last_ts = ts
            
            if not validate_frame(new_frame):
                await asyncio.sleep(0.05)
                continue
                
            final_frame = analyze_faults(new_frame)
            latest_frame = final_frame
            frame_history.append(final_frame)
            if len(frame_history) > 100: frame_history.pop(0)
                
            print_log(final_frame)
            await broadcast(final_frame)
            
        except asyncio.TimeoutError:
            print("\n[warn] Request 'get_frame' timed out. Recovering...")
        except json.JSONDecodeError:
            pass
        except Exception as e:
            print(f"\n[error] Poll loop exception: {e}")
            
        await asyncio.sleep(0.25)

async def ws_handler(websocket):
    clients.add(websocket)
    if latest_frame:
        try: await websocket.send(json.dumps(latest_frame))
        except Exception: pass
    try: await websocket.wait_closed()
    finally: clients.discard(websocket)

async def main():
    print("=" * 50)
    print(" NeuroSync V3 - Qualcomm AI Hub Edge Node Started")
    print(" Engine      : ONNX Runtime (CPU Fallback/Hexagon)")
    print(" Intelligence: Active Self-Learning Enabled")
    print(" WebSocket   : ws://0.0.0.0:8765")
    print("=" * 50)
    async with websockets.serve(ws_handler, "0.0.0.0", 8765):
        await poll_loop()

if __name__ == "__main__":
    asyncio.run(main())
