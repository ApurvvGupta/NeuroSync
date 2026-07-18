"""Quick end-to-end check: connect, read a normal frame, inject gas, confirm override."""
import asyncio
import json
import websockets


async def main() -> None:
    async with websockets.connect("ws://localhost:8765") as ws:
        first = json.loads(await ws.recv())
        print("frame keys:", sorted(first.keys()))
        print("normal risk_index:", first["risk_index"], first["diagnosis"]["risk_band"])

        await ws.send(json.dumps({"cmd": "inject", "asset": "PUMP-01", "fault": "fusion"}))
        # Let the ramp climb, then read the latest PUMP-01 frame.
        latest = None
        for _ in range(40):
            frame = json.loads(await ws.recv())
            if frame["asset_id"] == "PUMP-01":
                latest = frame
        print("after fusion inject:", latest["risk_index"], latest["diagnosis"]["risk_band"])
        print("root cause:", latest["diagnosis"]["root_cause"])


asyncio.run(main())
