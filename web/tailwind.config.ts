import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#070b12",
        panel: "rgba(255,255,255,0.04)",
        border: "rgba(255,255,255,0.08)",
        brand: {
          blue: "#3b82f6",
          cyan: "#22d3ee",
          purple: "#a855f7",
        },
        risk: {
          safe: "#2ecc71",
          watch: "#9bd64a",
          elevated: "#f1c40f",
          high: "#f39c12",
          critical: "#ef4444",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg,#3b82f6 0%,#22d3ee 50%,#a855f7 100%)",
      },
      keyframes: {
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-10px)" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
        pulseGlow: {
          "0%,100%": { opacity: "0.5" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        shimmer: "shimmer 1.6s infinite",
        pulseGlow: "pulseGlow 2.5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
