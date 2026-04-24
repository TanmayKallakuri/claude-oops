import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        oops: {
          bg: "#fef7f0",
          surface: "#ffffff",
          primary: "#c2410c",
          "primary-soft": "#fed7aa",
          accent: "#fbbf24",
          danger: "#b91c1c",
          "danger-soft": "#fecaca",
          text: "#1a0f08",
          muted: "#9a5a3a",
          border: "#f3e8d9",
        },
      },
      fontFamily: {
        sans: ['"Inter"', "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
        serif: ['"Instrument Serif"', "ui-serif", "Georgia", "serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        oops: "0 1px 3px rgba(180,83,9,.08)",
        "oops-lift": "0 8px 20px rgba(180,83,9,.12)",
        "oops-ring": "0 0 0 3px rgba(194,65,12,.25)",
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
