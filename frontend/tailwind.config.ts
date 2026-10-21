import type { Config } from "tailwindcss";

/**
 * Escalas apagadas: sustituyen a los colores vivos por defecto para que las
 * páginas antiguas hereden la nueva paleta sin reescribir cada clase.
 */
const brand = {
  50: "#eef5f3",
  100: "#d7e9e5",
  200: "#b0d4cd",
  300: "#84bcb2",
  400: "#55a294",
  500: "#35897a",
  600: "#216e61",
  700: "#1a5850",
  800: "#174740",
  900: "#133a34",
  950: "#08221f",
};

const clay = {
  50: "#fbf2ed",
  100: "#f6e0d5",
  200: "#ebc2b0",
  300: "#dc9d84",
  400: "#c97a5e",
  500: "#b4643a",
  600: "#9c5230",
  700: "#7f4228",
  800: "#673722",
  900: "#552f1f",
  950: "#2e1910",
};

const sage = {
  50: "#f2f6ee",
  100: "#e3ecdb",
  200: "#c7d9b9",
  300: "#a3c08f",
  400: "#7fa468",
  500: "#5f8549",
  600: "#4a6a38",
  700: "#3c562e",
  800: "#324627",
  900: "#2b3c23",
  950: "#141f10",
};

const ochre = {
  50: "#fbf6ea",
  100: "#f6ebcd",
  200: "#ecd59c",
  300: "#dfb967",
  400: "#d09f3f",
  500: "#b9832a",
  600: "#9a6721",
  700: "#7c511e",
  800: "#67431d",
  900: "#57391b",
  950: "#321f0c",
};

const warm = {
  50: "#f7f6f3",
  100: "#eeede8",
  200: "#e2dfd8",
  300: "#cdc9c0",
  400: "#a8a29a",
  500: "#857f76",
  600: "#6a655d",
  700: "#565149",
  800: "#3f3b35",
  900: "#2a2723",
  950: "#1a1815",
};

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1220px" },
    },
    extend: {
      fontFamily: {
        sans: [
          "Segoe UI Variable Text",
          "Segoe UI",
          "system-ui",
          "-apple-system",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        display: [
          "Iowan Old Style",
          "Palatino Linotype",
          "Palatino",
          "Book Antiqua",
          "Georgia",
          "Times New Roman",
          "serif",
        ],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        brand,
        clay,
        sage,
        ochre,
        // Las escalas heredadas apuntan a la paleta nueva.
        indigo: brand,
        blue: brand,
        sky: brand,
        cyan: brand,
        violet: brand,
        purple: brand,
        fuchsia: clay,
        pink: clay,
        rose: clay,
        teal: sage,
        emerald: sage,
        green: sage,
        amber: ochre,
        orange: ochre,
        yellow: ochre,
        slate: warm,
        zinc: warm,
        gray: warm,
        neutral: warm,
        stone: warm,
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "calc(var(--radius) + 2px)",
        "2xl": "calc(var(--radius) + 4px)",
        "3xl": "calc(var(--radius) + 6px)",
      },
      boxShadow: {
        sm: "0 1px 2px -1px rgb(28 26 23 / 0.12), 0 1px 1px -1px rgb(28 26 23 / 0.06)",
        md: "0 2px 6px -2px rgb(28 26 23 / 0.14)",
        lg: "0 8px 24px -12px rgb(28 26 23 / 0.28)",
        xl: "0 18px 40px -24px rgb(28 26 23 / 0.35)",
      },
      keyframes: {
        "pulse-ring": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
      },
      animation: {
        "pulse-ring": "pulse-ring 1.5s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
