import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev server on 5173; the dashboard connects to the telemetry WebSocket
// (mock_server or the QRB2210 bridge) at ws://localhost:8765 by default.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, host: true },
});
