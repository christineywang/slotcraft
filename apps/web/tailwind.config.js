/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1A2332",
        stone: {
          DEFAULT: "#E8ECEF",
          wash: "#D9E2E8",
        },
        teal: {
          DEFAULT: "#0F6E6B",
          soft: "#1A8A86",
          muted: "#C5E4E2",
        },
        coral: {
          DEFAULT: "#C45C48",
          soft: "#E8B4AB",
        },
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "Georgia", "serif"],
        sans: ["var(--font-plex)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        panel: "0 12px 40px rgba(26, 35, 50, 0.12)",
      },
      keyframes: {
        "spring-in": {
          "0%": { transform: "scale(0.92)", opacity: "0" },
          "70%": { transform: "scale(1.03)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "slide-in": {
          "0%": { transform: "translateX(100%)", opacity: "0.6" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "25%": { transform: "translateX(-4px)" },
          "75%": { transform: "translateX(4px)" },
        },
        "coral-flash": {
          "0%": { boxShadow: "0 0 0 0 rgba(196, 92, 72, 0.55)" },
          "100%": { boxShadow: "0 0 0 8px rgba(196, 92, 72, 0)" },
        },
      },
      animation: {
        "spring-in": "spring-in 200ms ease-out",
        "slide-in": "slide-in 220ms ease-out",
        shake: "shake 320ms ease-in-out",
        "coral-flash": "coral-flash 600ms ease-out",
      },
    },
  },
  plugins: [],
};
