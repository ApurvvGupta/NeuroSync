# NeuroSync Telemetry Frame — Frozen Contract v1.0

> **Single source of truth.** The mock server, the QRB2210 bridge, and the real
> STM32 firmware all emit the *identical* JSON shape. The React dashboard and the
> Kotlin app both consume it. **Nobody invents a new field name.** If you need a
> new signal, add it here first and tell the team (Handbook §4.3).

## The frame

```json
{
  "ts": 1721030400000,          // epoch milliseconds
  "asset_id": "PUMP-01",        // stable asset identifier
  "vibration_rms": 1.24,        // mm/s
  "temperature": 42.1,          // deg C (DS18B20)
  "gas_mq2": 118,               // raw ADC / ppm-equivalent (flammable/smoke)
  "gas_mq135": 96,              // raw ADC / ppm-equivalent (air quality/corrosive)
  "corrosion": 0.12,            // 0-1 probe conductivity index
  "waveform": [0.1, -0.3],      // 60 vibration samples for the chart
  "fault_probability": 0.08,    // 0-1
  "fault_flag": false,          // boolean
  "fault_type": "none",         // none|bearing_wear|imbalance|misalignment
  "severity": 0,                // 0-100 (worst single module)
  "risk_index": 12,             // 0-100 fused (see fusion rules)
  "source": "zscore"            // zscore|cnn
}
```

## Per-module output states (Handbook §3)

These strings are the contract between the fusion logic and the UI. Use them
verbatim so nothing drifts.

### Temperature (§3.3)
`Normal` | `Warning` | `Critical`

### Gas (§3.4)
`Clear` | `Trace Detected` | `Leak Confirmed` | `Critical / Evacuate`

### Corrosion (§3.5)
`Protected` | `Early Corrosion` | `Active Corrosion` | `Critical Thinning Risk`

### Vibration fault-state (§3.2)
`Recovery Required` | `Repair Required` | `Replacement Required`

### Induction motor normal-state grade (§3.1)
`Excellent` (85-100) | `Good` (70-84) | `Fair` (50-69) | escalates below 50

## Risk Index fusion (§3.6)

```
risk = 0.35*gas + 0.25*vibration + 0.20*temperature + 0.20*corrosion
```

- Each module contributes a 0-100 severity sub-score.
- **Critical override (never average away an emergency):** if ANY module is in
  its Critical state, `risk_index >= 90` regardless of the weighted average.
- Risk bands: `0-24 Safe` | `25-49 Watch` | `50-74 Elevated` | `75-89 High` |
  `90-100 Critical`.

The extended fusion output (module states, root cause, recommended action) is
delivered to the UI on a separate `diagnosis` channel — see
`mock_server/fusion.py` for the canonical implementation.
