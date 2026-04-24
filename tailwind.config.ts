import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        oops: {
          bg: "#f4f3ee",
          surface: "#eeede6",
          primary: "#c96442",
          "primary-soft": "#e89268",
          accent: "#c98a42",
          danger: "#a53e2a",
          "danger-soft": "#e5c2b8",
          text: "#191817",
          muted: "#8a847a",
          border: "#d8d3c8",
          ink: "#191817",
        },
      },
      fontFamily: {
        sans: ['"Inter"', "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
        serif: ['"Source Serif 4"', '"Iowan Old Style"', "Georgia", '"Times New Roman"', "serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      keyframes: {
        blob: {
          "0%,100%": { transform: "translate(0,0) scale(1)", borderRadius: "60% 40% 50% 50%" },
          "33%": { transform: "translate(8px,-10px) scale(1.05)", borderRadius: "40% 60% 40% 60%" },
          "66%": { transform: "translate(-6px,8px) scale(0.98)", borderRadius: "50% 50% 60% 40%" },
        },
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-3px)" },
        },
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 rgba(194,65,12,.35)" },
          "100%": { boxShadow: "0 0 0 12px rgba(194,65,12,0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        ticker: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
      animation: {
        blob: "blob 6s ease-in-out infinite",
        float: "float 3s ease-in-out infinite",
        "pulse-ring": "pulse-ring 1.6s ease-out infinite",
        shimmer: "shimmer 1.4s linear infinite",
        ticker: "ticker 22s linear infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
