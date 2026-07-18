# NeuroSync Wiring & Pin Map — Hardware Contract v1.0

> All sensors connect to the **Arduino UNO Q**. This is the physical counterpart
> of the telemetry contract: the STM32 firmware pin assignments **must** match
> this table exactly. Keep it in sync with `sketch/sketch.ino`.

## Power rails (breadboard)

| Rail | Voltage | Source |
|------|---------|--------|
| Top RED | 5V | UNO Q `5V` |
| Top BLUE | GND | UNO Q `GND` |
| Bottom RED | 3.3V | UNO Q `3.3V` (label it "3.3V") |
| Bottom BLUE | GND | jumper from top BLUE rail (tie both GNDs — do not skip) |

Jumper color convention: **RED=5V, ORANGE/WHITE=3.3V, BLACK=GND, GREEN=I²C,
YELLOW=DS18B20, BLUE=analog.**

## Pin map (the contract firmware reads)

| Sensor | Signal | UNO Q pin | Power | Notes |
|--------|--------|-----------|-------|-------|
| MPU6050 #1 (vibration) | I²C | `SDA`/`SCL` (or `A4`/`A5`) | 3.3V | Address **0x68** (AD0 left open) |
| MPU6050 #2 (vibration) | I²C | same `SDA`/`SCL` bus | 3.3V | **AD0 → 3.3V ⇒ address 0x69** (critical — else only one MPU responds) |
| DS18B20 (temperature) | 1-Wire DATA | `D2` | 3.3V | **10 kΩ pull-up DATA→3.3V required** (else reads −127) |
| MQ-2 (flammable gas) | Analog AO | `A0` | **5V heater** | via **10k/10k divider** (see below); DO unused |
| MQ135 (corrosive gas) | Analog AO | `A2` | **5V heater** | via **10k/10k divider**; DO unused |
| Soil moisture (corrosion probe) | Analog AO | `A1` | **3.3V** | direct, **no divider** (3.3V keeps it in ADC range) |
| DIY corrosion probe (optional) | Analog | `A3` | 3.3V | electrode + 10 kΩ to GND; salt-water dip |
| N20 motor #1 (fault injection) | PWM via L293D | `D9` (IN1), IN2→GND | 5V motor | `analogWrite(9, ...)`; **never drive motor from GPIO directly** |
| N20 motor #2 (fault injection) | PWM via L293D | `D10` (IN3), IN4→GND | 5V motor | on a **separate half-size breadboard** (isolate vibration/noise) |

## Firmware-critical consequences

1. **Analog gas sensors are on a 10k/10k voltage divider** → the ADC sees **half**
   the sensor's AO voltage. Firmware must **multiply the raw ADC reading by ~2**
   to reconstruct the sensor value before feeding the telemetry frame / fusion.
   The divider protects the 3.3V ADC from the 5V-referenced AO — never wire AO
   straight to an analog pin.
2. **Soil-moisture probe is on 3.3V, no divider** → read `A1` directly, no ×2.
3. **ADC reference is 3.3V.** Set/confirm ADC resolution in firmware (STM32 can do
   12-bit; Arduino default is 10-bit / 0–1023). Pick one and document the scale.
4. **MQ warm-up:** first 2–3 minutes of gas readings are meaningless (heater
   stabilising). Firmware should expose a `warming_up` flag; the UI shows
   "Sensor warming up…" instead of a fake reading. (Mock server already models this.)
5. **Two MPU6050s share address 0x68 by default** — MPU #2 must have AD0 → 3.3V
   to become 0x69. Test with an I²C scanner before anything else.

## Bring-up test sequence (do in this order)

1. **I²C scan** → expect `0x68` and `0x69`. If only one, SDA/SCL are likely
   swapped — swap the two I²C wires.
2. **DS18B20** (DallasTemperature "Simple" example) → ~25–30 °C; grip probe → rises.
   If −127, the pull-up is missing.
3. **Gas** — `analogRead(A0)` and `analogRead(A2)`; values drift for 2–3 min
   (warm-up), then stabilise. Release lighter gas near MQ-2 (**do not ignite**) →
   `A0` jumps.
4. **Motor / fault injection** — `analogWrite(9, 200)` spins motor #1; tape it near
   MPU6050 #1 → vibration appears in the MPU reading. Fault injection ready.

## Safety

Release lighter gas only, **never ignite**, tiny quantity, once. Indoor venue
with other teams present. If venue staff object, drop the physical gas demo and
use the mock server's `inject gas` — the software path is identical.
