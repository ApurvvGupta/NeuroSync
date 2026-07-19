NeuroSync — Arduino App Lab package (COMPLETE, with yaml files)
================================================================

FOLDER STRUCTURE (ab poora hai — yahi App Lab expect karta hai):
  neurosync/
    app.yaml              <- app manifest (port 8765 exposed)
    sketch/
      sketch.ino          <- MCU code (sensors + AI logic)
      sketch.yaml         <- board (arduino:zephyr:unoq) + libraries
    python/
      main.py             <- Bridge poll + WebSocket + alerts
      requirements.txt    <- websockets
    dashboard.html        <- browser dashboard (board par nahi jata,
                             laptop/phone browser me kholna hai)

RUN KARNE KE 2 TARIKE:

A) App Lab GUI se:
   1. Poora "neurosync" folder UNO Q par ~/ArduinoApps/ me copy karo
      (scp -r neurosync arduino@<IP>:~/ArduinoApps/)
      YA App Lab me New App bana ke files paste karo — sketch.yaml
      wali libraries App Lab ke Add Library button se add ho jayengi.
   2. My Apps me "NeuroSync" dikhega -> Run dabao.

B) CLI se (SSH terminal par):
   arduino-app-cli app start ~/ArduinoApps/neurosync
   arduino-app-cli app logs  ~/ArduinoApps/neurosync   (alerts yahan)
   arduino-app-cli app stop  ~/ArduinoApps/neurosync

DASHBOARD:
   dashboard.html browser me kholo -> ws://<UNO-Q-IP>:8765 -> Connect
   (IP: UNO Q terminal me `hostname -I`)

NOTE:
   - Pehla run slow hoga (libraries install hoti hain) — normal hai.
   - MQ2 ko 60 s warm-up chahiye.
   - Sketch libraries sketch.yaml me pin ho gayi hain: Arduino_RouterBridge,
     Adafruit MPU6050, OneWire, DallasTemperature.
   - Plain Arduino IDE test: sketch me USE_BRIDGE 0 -> Serial par frames.
