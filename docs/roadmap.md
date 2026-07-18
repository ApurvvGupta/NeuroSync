# NeuroSync — Status & Phase-Wise Roadmap

Snapdragon Multiverse Hackathon · submission deadline **Sun 19 Jul, 1:00 pm**.
Rule of thumb from our handbook: **a working simulated path always beats a broken
real one.** Every phase below has a fallback so the demo never dies.

---

## Where we are (done ✅)

| Area | Artifact | Status |
|------|----------|--------|
| Contracts | `docs/telemetry-frame.md`, `docs/wiring.md`, `docs/models.md` | ✅ frozen |
| Fusion engine | `mock_server/fusion.py` (4-module grading + Risk Index + Critical override) | ✅ tested |
| Mock telemetry | `mock_server/server.py` + `smoke_test.py` (2 assets, fault injection, warm-up) | ✅ tested |
| STM32 firmware | `uno_q/sketch/sketch.ino` (all sensors, Z-score, ×2 divider, motor inject) | ✅ ready to flash (not yet on HW) |
| QRB2210 bridge | `uno_q/python/main.py` (`--demo` + `--serial`, adaptive baselines) | ✅ `--demo` tested |
| Web console | `web/` Next.js 15 — 14 pages, mock + auto-live, builds clean | ✅ runs on :3000 |
| Repo hygiene | `README.md`, MIT `LICENSE` | ✅ |

**Net:** the entire software path works end-to-end on simulated data today. The
demo is already safe. Everything remaining raises the score; nothing remaining is
required for a functioning demo.

---

## Phase 2 — Hardware bring-up  (IN PROGRESS · team)

**Goal:** real sensors streaming JSON from the STM32.
- [ ] Finish wiring per `docs/wiring.md`.
- [ ] Flash `sketch.ino` (install OneWire + DallasTemperature libs first).
- [ ] Test 1: I²C scan → `0x68` + `0x69` (fix AD0→3.3V if MPU2 missing).
- [ ] Test 2: DS18B20 ~25–30 °C (add 10k pull-up if −127).
- [ ] Test 3: gas warm-up ~2–3 min, then values respond to lighter gas (no flame).
- [ ] Test 4: `a` in Serial Monitor spins motor → vibration shows in MPU.
**Owner:** Embedded dev. **Fallback:** none needed — mock covers the demo.
**Done when:** Serial Monitor shows valid JSON frames for PUMP-01 / COMP-01.

## Phase 3 — Real data integration  (NEXT · highest leverage)

**Goal:** the web console shows *live hardware* instead of mock.
- [ ] `pip install -r uno_q/python/requirements.txt` on the QRB2210 (or the PC).
- [ ] Run `python main.py --serial COM<x>` → bridge fuses + rebroadcasts on :8765.
- [ ] Open the web console → topbar flips to "● Live hardware".
- [ ] Verify adaptive baselines calibrate after warm-up (bridge prints them).
**Owner:** Embedded + one software dev. **Fallback:** mock server on :8765.
**Done when:** injecting a physical fault moves the Risk Index on screen.

## Phase 4 — Vibration ML  (CORE model)

**Goal:** the INT8 1D-CNN classifier running on the MCU (`docs/models.md` #1/#2).
- [ ] Collect data in Edge Impulse on the N20 rig: normal / imbalance (weight) /
      misalignment (loose mount). ~10–15 min per class.
- [ ] Train 1D-CNN classifier + GMM anomaly block.
- [ ] Export Arduino/TFLite Micro library; integrate into the sketch alongside
      the Z-score fallback; emit `fault_type` + confidence.
**Owner:** AI/ML dev. **Fallback:** Z-score detector already ships in firmware;
`source` field already reports `zscore` vs `cnn`.
**Done when:** the classifier labels a physically-injected fault correctly.

## Phase 5 — Multi-device depth  (orchestration prize · 100 pts)

Pick what time allows, in this order:
- [ ] **X Elite teacher** on MAFAULDA → distill to the MCU student → show OTA push
      through the bridge. (Strongest orchestration story.)
- [ ] **LLM narration** — Falcon 3B (or Gemma3-1B) via AI Hub Genie +
      onnxruntime-genai on the X Elite NPU; turn a telemetry frame into an
      incident report. **Start the export NOW — it's a multi-GB download.**
- [ ] **Kotlin field app** (OnePlus 15) — subscribe to :8765, show alerts + a
      compact asset view. Puts a 4th device on screen for the prize.
- [ ] **Cloud AI 100 tier** — a batch endpoint that returns a recalibrated
      baseline (can be light/mock). Completes the loop diagram.
**Owner:** split across team. **Fallback:** each item is independent; skip any.
**Done when:** the demo shows data moving between ≥3 devices on screen.

## Phase 6 — Submission & demo prep  (do NOT skip)

- [ ] README: real team names + emails (currently TODO placeholders).
- [ ] Test setup from scratch on a clean machine using the README steps.
- [ ] Push to the public GitHub repo (already cloned as `NeuroSync`).
- [ ] Submit repo link via the Microsoft Form (link given at the venue).
- [ ] Rehearse the 5-min demo **twice**, including the fallback path.
- [ ] Capture real numbers (latency, NPU verified) for the Technical slide.
**Owner:** Lead. **Done when:** form submitted before 1:00 pm Sunday.

---

## Priority if time gets short
1. Phase 6 basics (README team + license + push) — eligibility.
2. Phase 3 (live hardware on the console) — "it's real".
3. Phase 4 (vibration model) — core AI.
4. Phase 5 items — orchestration prize, in the order listed.

Optional web pages (Dataset Manager, AI Training, API Explorer, Team, Docs,
About, Contact) are polish — only after the above.
