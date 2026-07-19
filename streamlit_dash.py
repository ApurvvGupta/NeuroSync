import streamlit as st
import json
import websocket
import time
import pandas as pd
import plotly.express as px
import requests

st.set_page_config(layout="wide", page_title="NeuroSync SCADA", page_icon="🛢️")

st.markdown("""
<style>
.typewriter { font-family: 'Courier New', Courier, monospace; color: #F59E0B; }
.block-container { padding-top: 1rem !important; }
</style>
""", unsafe_allow_html=True)

if 'history' not in st.session_state:
    st.session_state.history = pd.DataFrame(columns=['Time', 'Vibration (Mag)', 'Adaptive Limit', 'X', 'Y', 'Z', 'Fault'])
if 'llm_report' not in st.session_state:
    st.session_state.llm_report = "System stabilized. Monitoring normal parameters."
if 'llm_source' not in st.session_state:
    st.session_state.llm_source = "IDLE"
if 'last_alert' not in st.session_state:
    st.session_state.last_alert = ""

def generate_maintenance_report(fault_type, vib, temp, gas, model_name):
    prompt = f"""
    You are an AI Maintenance Copilot for an Oil & Gas Pipeline system.
    CRITICAL FAULT DETECTED: {fault_type}.
    Current Telemetry: Vibration: {vib:.2f} m/s2, Temp: {temp:.1f}C, Gas: {gas}.
    Provide a strict, professional 3-step emergency protocol to secure the pipeline. Do not use markdown headers, just plain text bullets. Keep it under 50 words.
    """
    try:
        res = requests.post('http://localhost:11434/api/generate', json={
            "model": model_name, "prompt": prompt, "stream": False
        }, timeout=10)
        return res.json()['response']
    except requests.exceptions.RequestException:
        return "ERROR: Edge AI engine offline. Execute manual emergency shut-off immediately."

try:
    st.image("assets/banner.jpg", use_container_width=True)
except:
    pass

st.title("🛢️ NeuroSync Pipeline Command Center")

with st.sidebar:
    st.header("⚙️ Controls")
    run_dashboard = st.checkbox("🟢 Live Telemetry Connection", value=True)
    st.markdown("---")
    llm_model = st.selectbox("Active LLM Engine", ["gemma", "llama3", "mistral"], index=0)
    st.write("**Location:** Sector 7G Pipeline")

if not run_dashboard:
    st.warning("⏸️ Dashboard is paused. Check 'Live Telemetry Connection' to resume.")
    st.stop()

data = None
try:
    ws = websocket.WebSocket()
    ws.connect("ws://127.0.0.1:8765", timeout=1.0)
    ws.settimeout(1.0)
    msg = ws.recv()
    data = json.loads(msg)
    ws.close()
except Exception as e:
    st.error(f"🔌 Cannot reach MPU Engine (main.py): {e}")
    time.sleep(2)
    st.rerun()

if not data:
    st.warning("Waiting for sensor data...")
    time.sleep(1)
    st.rerun()

vib_raw = data.get('vibration_rms', 0.0)
learned_thresh = data.get('learned_vib_threshold', 2.0)
samples = data.get('learning_samples', 0)
fault = data.get('fault_type', 'normal')
alert = data.get('alert', '')
temp = data.get('temperature', 0.0)
gas = data.get('gas_mq2', 0.0)
corr = data.get('corrosion', 0.0)
mpu_x = data.get('mpu_x', 0.0)
mpu_y = data.get('mpu_y', 0.0)
mpu_z = data.get('mpu_z', 0.0)

if alert and alert != st.session_state.last_alert:
    st.session_state.llm_source = "THINKING..."
    st.session_state.llm_report = f"Analyzing {fault.upper()} anomaly and querying GenAI pipeline..."
    st.session_state.last_alert = alert

elif not alert and st.session_state.llm_source != "IDLE":
    st.session_state.llm_source = "IDLE"
    st.session_state.llm_report = "System stabilized. Monitoring normal parameters."
    st.session_state.last_alert = ""

if st.session_state.llm_source == "THINKING...":
    st.session_state.llm_report = generate_maintenance_report(fault, vib_raw, temp, gas, llm_model)
    st.session_state.llm_source = f"TRUE NPU EXECUTED ({llm_model.upper()})"

now = pd.Timestamp.now()
new_row = pd.DataFrame({
    'Time': [now], 'Vibration (Mag)': [vib_raw], 
    'Adaptive Limit': [learned_thresh],
    'X': [mpu_x], 'Y': [mpu_y], 'Z': [mpu_z], 'Fault': [fault]
})
st.session_state.history = pd.concat([st.session_state.history, new_row]).tail(100)

if alert:
    st.error(f"🚨 **{alert}** | Fault Classification: **{fault.upper()}**")

st.markdown("### ▰ LEVEL 1: MCU Node (STM32U585) — Edge AI")
with st.container():
    c1, c2, c3, c4 = st.columns(4)
    with c1:
        v_delta = vib_raw - learned_thresh if vib_raw > learned_thresh else 0
        st.metric(label="⚡ Vibration (Mag)", value=f"{vib_raw:.2f} m/s²", delta=f"{v_delta:.2f} limit", delta_color="inverse")
        st.caption(f"Raw: X:{mpu_x:.1f} | Y:{mpu_y:.1f} | Z:{mpu_z:.1f}")
    with c2:
        t_delta = "CRITICAL" if data.get('temp_status')=='critical' else "NORMAL"
        st.metric(label="🌡️ Temp (DS18B20)", value=f"{temp:.1f} °C", delta=t_delta, delta_color="inverse")
    with c3:
        gval = "WARMUP" if not data.get('gas_warm', True) else f"{gas}"
        st.metric(label="☁️ Gas (MQ2)", value=gval, delta=data.get('gas_status', 'normal').upper(), delta_color="inverse")
    with c4:
        st.metric(label="🧪 Corrosion Index", value=f"{corr:.3f}", delta=data.get('corr_status', 'normal').upper(), delta_color="inverse")

st.markdown("### ▰ LEVEL 2 & 3: Qualcomm Hexagon & GenAI Copilot")
c2_a, c2_b = st.columns(2)
with c2_a:
    with st.container(border=True):
        st.subheader("Adaptive Edge ONNX Model")
        st.write(f"**Current Status**: {fault.upper()}")
        st.metric(label="Dynamic Limit", value=f"{learned_thresh:.2f}", delta=f"Samples Learned: {samples}", delta_color="off")
        st.progress(min(1.0, samples / 200.0))

with c2_b:
    with st.container(border=True):
        st.subheader(f"GenAI Copilot ({st.session_state.llm_source})")
        st.markdown(f"<div class='typewriter'>{st.session_state.llm_report}</div>", unsafe_allow_html=True)

st.markdown("### ▰ LIVE TELEMETRY")
fig = px.line(st.session_state.history, x='Time', y=['Vibration (Mag)', 'Adaptive Limit', 'X', 'Y', 'Z'],
              color_discrete_sequence=['#F59E0B', '#ef4444', '#334155', '#475569', '#94a3b8'])
fig.update_layout(plot_bgcolor='rgba(0,0,0,0)', paper_bgcolor='rgba(0,0,0,0)', margin=dict(l=10, r=10, t=30, b=10), legend_title_text='')
st.plotly_chart(fig, use_container_width=True)

time.sleep(0.5)
st.rerun()
