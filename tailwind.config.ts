import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        burgundy: { DEFAULT: "#680F24", 50: "#FBF2F4", 100: "#F5E1E6", 200: "#E8B9C4", 300: "#D48A9C", 400: "#B4506A", 500: "#8E2340", 600: "#680F24", 700: "#560C1E", 800: "#4A0810", 900: "#2F050B" },
        lime: { DEFAULT: "#A8E620", 50: "#F6FDE6", 100: "#ECFAC8", 200: "#D9F591", 300: "#C3EE57", 400: "#A8E620", 500: "#8CC514", 600: "#6C9A0E", 700: "#527510", 800: "#425D12", 900: "#384F14" },
        grey: { DEFAULT: "#E8E8E8", 50: "#FAFAFA", 100: "#F4F4F4", 200: "#E8E8E8", 300: "#D4D4D4", 400: "#A3A3A3", 500: "#737373", 600: "#525252", 700: "#404040", 800: "#262626", 900: "#171717" },
      },
      fontFamily: { sans: ["Poppins", "ui-sans-serif", "system-ui", "sans-serif"] },
      boxShadow: { card: "0 1px 2px rgba(23,23,23,.04), 0 8px 24px -12px rgba(104,15,36,.18)" },
      keyframes: { "fade-up": { "0%": { opacity: "0", transform: "translateY(8px)" }, "100%": { opacity: "1", transform: "none" } } },
      animation: { "fade-up": "fade-up .4s ease-out both" },
    },
  },
  plugins: [],
} satisfies Config;
