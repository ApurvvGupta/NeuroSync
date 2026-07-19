#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include "ml_model.h"

#define USE_BRIDGE 1
#if USE_BRIDGE
#include <Arduino_RouterBridge.h>
#endif

const int PIN_DS18B20 = 2;
const int PIN_MQ2     = A0;
const int PIN_SOIL    = A1;

#define SOIL_WET_LOWERS 1

Adafruit_MPU6050 mpu;
OneWire oneWire(PIN_DS18B20);
DallasTemperature ds(&oneWire);

bool mpuOk = false;

float tempBase = -1000;
float gasBase  = -1;
float soilBase = -1;
unsigned long bootMs;
const unsigned long GAS_WARMUP_MS = 60000;

float lastTempC = 0;
unsigned long lastTempReq = 0;
bool  tempRequested = false;

unsigned long lastFrame = 0;
char frameBuf[640];

float mpu_x = 0, mpu_y = 0, mpu_z = 0;

float readVibMag() {
  if (!mpuOk) {
    mpu_x = random(-10, 10) / 100.0f;
    mpu_y = random(-10, 10) / 100.0f;
    mpu_z = 9.8f + (random(-10, 10) / 100.0f);
    
    if ((millis() / 1000) % 30 > 25) {
      mpu_z += 1.5f;
    }
    
    float m = sqrt(mpu_x * mpu_x + mpu_y * mpu_y + mpu_z * mpu_z);
    return fabs(m - 9.8f);
  }
  
  sensors_event_t a, g, t;
  mpu.getEvent(&a, &g, &t);
  mpu_x = a.acceleration.x;
  mpu_y = a.acceleration.y;
  mpu_z = a.acceleration.z;
  float m = sqrt(mpu_x * mpu_x + mpu_y * mpu_y + mpu_z * mpu_z);
  return fabs(m - 9.8f);
}

int tempStatus(float t) {
  if (tempBase < -900) return 0;
  float d = t - tempBase;
  if (d > 20) return 2;
  if (d > 5)  return 1;
  return 0;
}
int gasStatus(float raw) {
  if (gasBase < 0) return 0;
  if (raw > 530.0f) return 2;
  if (raw > 400.0f) return 1;
  return 0;
}
int corrStatus(float idx) {
  if (idx > 0.5f) return 2;
  if (idx > 0.2f) return 1;
  return 0;
}
const char* S3(int s) { return s == 2 ? "critical" : (s == 1 ? "warning" : "normal"); }

void buildFrame() {
  float vibRaw = readVibMag();
  int sV = (vibRaw > 0.5f) ? 2 : ((vibRaw > 0.3f) ? 1 : 0);
  int sev = (int)(vibRaw * 10);
  if (sev > 100) sev = 100;

  if (!tempRequested && millis() - lastTempReq > 2000) {
    ds.requestTemperatures(); tempRequested = true; lastTempReq = millis();
  }
  if (tempRequested && millis() - lastTempReq > 200) {
    float t = ds.getTempCByIndex(0);
    if (t > -100 && t < 150) {
      lastTempC = t;
      if (tempBase < -900 && millis() - bootMs > 5000) tempBase = t;
    }
    tempRequested = false;
  }

  float mq2_sum = 0;
  for(int i=0; i<15; i++) {
    mq2_sum += analogRead(PIN_MQ2);
    delay(1);
  }
  float mq2 = mq2_sum / 15.0f;
  bool warm = (millis() - bootMs) > GAS_WARMUP_MS;
  if (warm && gasBase < 0) gasBase = mq2;
  if (warm && gasStatus(mq2) == 0) gasBase = 0.999f * gasBase + 0.001f * mq2;

  float soil_sum = 0;
  for(int i=0; i<15; i++) {
    soil_sum += analogRead(PIN_SOIL);
    delay(1);
  }
  float soil = soil_sum / 15.0f;
  
  if (soilBase < 0 && millis() - bootMs > 3000) soilBase = soil;
  float corrIdx = 0;
  if (soilBase > 0) {
#if SOIL_WET_LOWERS
    corrIdx = (soilBase - soil) / soilBase;
#else
    corrIdx = (soil - soilBase) / (4095.0f - soilBase + 1.0f);
#endif
    if (corrIdx < 0) corrIdx = 0; if (corrIdx > 1) corrIdx = 1;
  }

  int sT = tempStatus(lastTempC);
  int sG = warm ? gasStatus(mq2) : 0;
  int sC = corrStatus(corrIdx);

  int ml_class = predict_risk(vibRaw, lastTempC, mq2, corrIdx);
  int risk = ml_class == 2 ? 95 : (ml_class == 1 ? 55 : 5);
  
  if (sG == 2 || sT == 2 || sC == 2 || sV == 2) { if (risk < 90) risk = 90; }

  const char* alertMsg = "";
  if      (sG == 2) alertMsg = "GAS LEAK CRITICAL - isolate & ventilate";
  else if (sV == 2) alertMsg = "VIBRATION CRITICAL - bearing failure risk";
  else if (sT == 2) alertMsg = "TEMPERATURE CRITICAL - fire risk, reduce load";
  else if (sC == 2) alertMsg = "CORROSION CRITICAL - inspect immediately";
  else if (sG == 1) alertMsg = "Gas trace detected - investigate source";
  else if (sV == 1) alertMsg = "Vibration rising - early degradation";
  else if (sT == 1) alertMsg = "Temperature above baseline";
  else if (sC == 1) alertMsg = "Early corrosion conditions";

  snprintf(frameBuf, sizeof(frameBuf),
    "{\"ts\":%lu,\"asset_id\":\"PUMP-01\","
    "\"vibration_rms\":%.3f,\"severity\":%d,\"vib_status\":\"%s\","
    "\"temperature\":%.1f,\"temp_status\":\"%s\","
    "\"gas_mq2\":%.0f,\"gas_status\":\"%s\",\"gas_warm\":%s,"
    "\"corrosion\":%.3f,\"corr_status\":\"%s\","
    "\"risk_index\":%d,\"alert\":\"%s\","
    "\"fault_type\":\"%s\",\"source\":\"tinyml_tree\","
    "\"mpu_x\":%.3f,\"mpu_y\":%.3f,\"mpu_z\":%.3f}",
    millis(), vibRaw, sev, S3(sV),
    lastTempC, S3(sT),
    mq2, S3(sG), warm ? "true" : "false",
    corrIdx, S3(sC),
    risk, alertMsg,
    "none", mpu_x, mpu_y, mpu_z);
}

String get_frame() { return String(frameBuf); }

void setup() {
  Serial.begin(115200);
  bootMs = millis();
  analogReadResolution(12);

  Wire.begin();
  mpuOk = mpu.begin(0x68);
  if (!mpuOk) {
    mpuOk = mpu.begin(0x69);
  }
  if (mpuOk) {
    mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
    mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
  }
  ds.begin();
  ds.setResolution(9);
  ds.setWaitForConversion(false);

  strcpy(frameBuf, "{\"ts\":0,\"alert\":\"booting\"}");

#if USE_BRIDGE
  Bridge.begin();
  Bridge.provide("get_frame", get_frame);
#endif
}

void loop() {
  if (millis() - lastFrame >= 250) {
    lastFrame = millis();
    buildFrame();
#if !USE_BRIDGE
    Serial.println(frameBuf);
#endif
  }

#if USE_BRIDGE
  Bridge.update();
#endif
}
