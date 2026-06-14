import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      borderRadius: { lg: "0.75rem", xl: "1rem", "2xl": "1.25rem", "3xl": "1.5rem" },
      boxShadow: { soft: "0 10px 30px rgba(0,0,0,0.06)" },
    },
  },
  plugins: [],
};

export default config;
