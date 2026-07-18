/*
 * NeuroSync — Tier 0 firmware (STM32U585 MCU on the Arduino UNO Q)
 * ================================================================
 * Reads all NeuroSync sensors, computes a vibration RMS + Z-score anomaly
 * signal, and emits a JSON telemetry line over Serial (UART) ~2x/second.
 *
 * The QRB2210 bridge (uno_q/python/main.py) consumes these lines, runs the
 * fusion/risk engine, and forwards the full frozen frame over WebSocket. This
 * sketch also runs standalone: open the Serial Monitor at 115200 baud and you
 * will see the JSON directly — useful for the venue bring-up tests.
 *
 * PIN MAP  (must match docs/wiring.md):
 *   MPU6050 #1  -> I2C, addr 0x68        (asset PUMP-01 vibration)
 *   MPU6050 #2  -> I2C, addr 0x69 (AD0 high)  (asset COMP-01 vibration)
 *   DS18B20     -> D2  (10k pull-up to 3.3V)
 *   MQ-2   AO   -> A0  (10k/10k divider -> multiply reading x2)
 *   MQ135  AO   -> A2  (10k/10k divider -> multiply reading x2)
 *   Soil moist. -> A1  (3.3V direct, no divider)
 *   DIY probe   -> A3  (optional)
 *   Motor #1    -> D9  via L293D  (fault injection)
 *   Motor #2    -> D10 via L293D  (fault injection)
 *
 * Serial commands (fault injection for the live demo):
 *   'a' -> motor #1 ON     'z' -> motor #1 OFF
 *   'b' -> motor #2 ON     'x' -> motor #2 OFF
 *
 * Libraries (install via Arduino IDE Library Manager):
 *   - OneWire
 *   - DallasTemperature
 *   MPU6050 is read via raw I2C registers, so no MPU library is needed.
 */

#include <Wire.h>
#include <OneWire.h>
#include <DallasTemperature.h>

// ----------------------------- Configuration ----------------------------- //
static const uint32_t SERIAL_BAUD      = 115200;
static const uint16_t EMIT_PERIOD_MS   = 500;   // telemetry cadence (~2 Hz)
static const uint32_t WARMUP_MS        = 150000; // MQ heater warm-up (2.5 min)
static const uint8_t  ADC_BITS         = 12;    // STM32 ADC resolution
static const float    GAS_DIVIDER_GAIN = 2.0f;  // 10k/10k halves the voltage

// Pins
static const uint8_t PIN_DS18B20 = 2;
static const uint8_t PIN_MQ2     = A0;
static const uint8_t PIN_MQ135   = A2;
static const uint8_t PIN_SOIL    = A1;
static const uint8_t PIN_PROBE   = A3;
static const uint8_t PIN_MOTOR1  = 9;
static const uint8_t PIN_MOTOR2  = 10;

// MPU6050
static const uint8_t MPU_ADDR_1     = 0x68;
static const uint8_t MPU_ADDR_2     = 0x69;
static const uint8_t MPU_PWR_MGMT_1 = 0x6B;
static const uint8_t MPU_ACCEL_XOUT = 0x3B;
static const float   MPU_LSB_PER_G  = 16384.0f; // +/-2g full scale

// ----------------------------- Sensor state ------------------------------ //
OneWire oneWire(PIN_DS18B20);
DallasTemperature ds18b20(&oneWire);

bool mpu1_ok = false;
bool mpu2_ok = false;

// Per-asset vibration Z-score tracking (EWMA baseline of RMS).
struct VibStat {
  float mean = 0.02f;   // running baseline of the RMS signal (g)
  float var  = 0.0004f; // running variance
  bool  seeded = false;
};
VibStat vib1, vib2;

uint32_t last_emit_ms = 0;

// ------------------------------ MPU helpers ------------------------------- //
bool mpuWake(uint8_t addr) {
  Wire.beginTransmission(addr);
  Wire.write(MPU_PWR_MGMT_1);
  Wire.write(0x00); // clear sleep bit
  return Wire.endTransmission() == 0;
}

// Reads one accelerometer sample and returns the AC vibration magnitude in g
// (gravity/DC removed via the running mean tracked by caller).
bool mpuReadAccel(uint8_t addr, float &ax, float &ay, float &az) {
  Wire.beginTransmission(addr);
  Wire.write(MPU_ACCEL_XOUT);
  if (Wire.endTransmission(false) != 0) return false;
  if (Wire.requestFrom((int)addr, 6, (int)true) != 6) return false;
  int16_t rx = (Wire.read() << 8) | Wire.read();
  int16_t ry = (Wire.read() << 8) | Wire.read();
  int16_t rz = (Wire.read() << 8) | Wire.read();
  ax = rx / MPU_LSB_PER_G;
  ay = ry / MPU_LSB_PER_G;
  az = rz / MPU_LSB_PER_G;
  return true;
}

// Samples the given MPU over a short window and returns the RMS of the
// acceleration-vector deviation (a vibration index in g). Returns -1 on error.
float sampleVibrationRms(uint8_t addr, uint8_t samples = 64) {
  float sumsq = 0.0f;
  uint8_t got = 0;
  for (uint8_t i = 0; i < samples; i++) {
    float ax, ay, az;
    if (!mpuReadAccel(addr, ax, ay, az)) continue;
    float mag = sqrtf(ax * ax + ay * ay + az * az); // ~1g at rest
    float ac  = mag - 1.0f;                          // remove gravity DC
    sumsq += ac * ac;
    got++;
    delayMicroseconds(300); // ~ few hundred Hz effective sample rate
  }
  if (got == 0) return -1.0f;
  return sqrtf(sumsq / got);
}

// Updates the EWMA baseline and returns a Z-score for the current RMS.
float updateZScore(VibStat &s, float rms) {
  if (!s.seeded) { s.mean = rms; s.seeded = true; }
  float diff = rms - s.mean;
  float z = (s.var > 1e-9f) ? (diff / sqrtf(s.var)) : 0.0f;
  // Only adapt the baseline when the signal looks normal, so a real fault does
  // not silently train itself into "normal".
  if (z < 3.0f) {
    const float alpha = 0.02f;
    s.mean += alpha * diff;
    s.var  += alpha * (diff * diff - s.var);
  }
  return z < 0 ? 0 : z;
}

// ------------------------------ Analog reads ------------------------------ //
// Gas AO passes through a 10k/10k divider, so multiply by the divider gain to
// reconstruct the sensor's real output (docs/wiring.md, consequence #1).
int readGas(uint8_t pin) {
  return (int)(analogRead(pin) * GAS_DIVIDER_GAIN);
}

// Soil-moisture probe is on 3.3V direct (no divider). Normalise 0..1 as a
// conductivity/corrosion index. Higher conductivity (wetter/more corrosive) ->
// higher index. Calibrate the ends during bring-up.
float readCorrosion(uint8_t pin) {
  const float adc_max = (1 << ADC_BITS) - 1;
  float norm = analogRead(pin) / adc_max;
  return norm; // adjust orientation/scaling after a dry+salt-water calibration
}

// ------------------------------- Telemetry -------------------------------- //
// Emits one JSON line for an asset. `owns_env` = this asset carries the shared
// gas/temp/corrosion zone sensors (only PUMP-01 does; COMP-01 is vibration-only).
void emitFrame(const char *asset_id, float rms, float z, float temp_c,
               bool owns_env, bool warming_up) {
  bool fault = (z >= 3.0f);
  int severity = (int)constrain(z / 10.0f * 100.0f, 0, 100);

  Serial.print("{\"asset_id\":\""); Serial.print(asset_id);
  Serial.print("\",\"ts_ms\":");    Serial.print(millis());
  Serial.print(",\"vibration_rms\":"); Serial.print(rms, 4);
  Serial.print(",\"z_score\":");       Serial.print(z, 2);

  if (owns_env) {
    Serial.print(",\"temperature\":"); Serial.print(temp_c, 2);
    if (warming_up) {
      Serial.print(",\"gas_mq2\":null,\"gas_mq135\":null");
    } else {
      Serial.print(",\"gas_mq2\":");   Serial.print(readGas(PIN_MQ2));
      Serial.print(",\"gas_mq135\":"); Serial.print(readGas(PIN_MQ135));
    }
    Serial.print(",\"corrosion\":");   Serial.print(readCorrosion(PIN_SOIL), 3);
  }

  Serial.print(",\"fault_flag\":"); Serial.print(fault ? "true" : "false");
  Serial.print(",\"severity\":");   Serial.print(severity);
  Serial.print(",\"source\":\"zscore\"");
  Serial.print(",\"warming_up\":"); Serial.print(warming_up ? "true" : "false");
  Serial.println("}");
}

// ------------------------ Fault-injection motor cmds ---------------------- //
void handleSerialCommands() {
  while (Serial.available()) {
    switch (Serial.read()) {
      case 'a': analogWrite(PIN_MOTOR1, 220); break; // motor 1 on
      case 'z': analogWrite(PIN_MOTOR1, 0);   break; // motor 1 off
      case 'b': analogWrite(PIN_MOTOR2, 220); break; // motor 2 on
      case 'x': analogWrite(PIN_MOTOR2, 0);   break; // motor 2 off
      default: break;
    }
  }
}

// --------------------------------- Setup ---------------------------------- //
void setup() {
  Serial.begin(SERIAL_BAUD);
  Wire.begin();
#if defined(analogReadResolution)
  analogReadResolution(ADC_BITS);
#endif
  pinMode(PIN_MOTOR1, OUTPUT);
  pinMode(PIN_MOTOR2, OUTPUT);
  analogWrite(PIN_MOTOR1, 0);
  analogWrite(PIN_MOTOR2, 0);

  mpu1_ok = mpuWake(MPU_ADDR_1);
  mpu2_ok = mpuWake(MPU_ADDR_2);
  ds18b20.begin();

  // Startup banner (not JSON) so the bring-up operator sees sensor status.
  Serial.print("# NeuroSync Tier0 up | MPU1(0x68)=");
  Serial.print(mpu1_ok ? "OK" : "MISSING");
  Serial.print(" MPU2(0x69)=");
  Serial.println(mpu2_ok ? "OK" : "MISSING (check AD0->3.3V)");
}

// --------------------------------- Loop ----------------------------------- //
void loop() {
  handleSerialCommands();

  uint32_t now = millis();
  if (now - last_emit_ms < EMIT_PERIOD_MS) return;
  last_emit_ms = now;

  bool warming_up = now < WARMUP_MS;

  // Shared zone temperature (DS18B20).
  ds18b20.requestTemperatures();
  float temp_c = ds18b20.getTempCByIndex(0);
  if (temp_c <= -100.0f) temp_c = NAN; // -127 => pull-up/wiring issue

  // Asset PUMP-01 (MPU #1) — carries the environmental zone sensors.
  if (mpu1_ok) {
    float rms = sampleVibrationRms(MPU_ADDR_1);
    if (rms >= 0) {
      float z = updateZScore(vib1, rms);
      emitFrame("PUMP-01", rms, z, temp_c, /*owns_env=*/true, warming_up);
    }
  }

  // Asset COMP-01 (MPU #2) — vibration only.
  if (mpu2_ok) {
    float rms = sampleVibrationRms(MPU_ADDR_2);
    if (rms >= 0) {
      float z = updateZScore(vib2, rms);
      emitFrame("COMP-01", rms, z, temp_c, /*owns_env=*/false, warming_up);
    }
  }
}
