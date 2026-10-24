import type { Config } from "tailwindcss";

/**
 * Paleta del sistema: los diez colores de acento de macOS/iOS con sus escalas
 * claras y oscuras. Las escalas antiguas se remapean aquí para que las páginas
 * heredadas usen los mismos colores sin reescribir cada clase.
 */
const blue = {
  50: "#eef5ff",
  100: "#dbe9ff",
  200: "#b8d4ff",
  300: "#8ebaff",
  400: "#5c9bff",
  500: "#2b7fff",
  600: "#0066ff",
  700: "#0052ad",
  800: "#003f85",
  900: "#002d5e",
  950: "#001a38",
};

const purple = {
  50: "#f9f1fe",
  100: "#f0defc",
  200: "#e0bef9",
  300: "#cc96f3",
  400: "#bd71ea",
  500: "#af52de",
  600: "#9540c0",
  700: "#7a339e",
  800: "#60287c",
  900: "#481d5d",
  950: "#2a0f36",
};

const pink = {
  50: "#ffedf2",
  100: "#ffd9e2",
  200: "#ffb3c6",
  300: "#ff87a6",
  400: "#ff5c88",
  500: "#ff2d55",
  600: "#e01f45",
  700: "#b81737",
  800: "#91122b",
  900: "#6b0d20",
  950: "#3d0712",
};

const green = {
  50: "#ebfaef",
  100: "#d5f4de",
  200: "#a9e8bc",
  300: "#79d997",
  400: "#50cc76",
  500: "#34c759",
  600: "#28a745",
  700: "#1f8536",
  800: "#186829",
  900: "#12501f",
  950: "#082e11",
};

const orange = {
  50: "#fff4e6",
  100: "#ffe7c8",
  200: "#ffcf90",
  300: "#ffb656",
  400: "#ffa427",
  500: "#ff9500",
  600: "#db7c00",
  700: "#b36400",
  800: "#8c4e00",
  900: "#663900",
  950: "#3b2100",
};

const red = {
  50: "#ffeceb",
  100: "#ffd9d6",
  200: "#ffb4ae",
  300: "#ff8a80",
  400: "#ff6257",
  500: "#ff3b30",
  600: "#e02318",
  700: "#b81a12",
  800: "#91140e",
  900: "#6b0f0a",
  950: "#3d0806",
};

/** Grises tiza del tema claro: neutros fríos, sin tinte cálido ni blancos puros. */
const gray = {
  50: "#f7f7f9",
  100: "#efeff2",
  200: "#e1e1e6",
  300: "#c7c7cc",
  400: "#aeaeb2",
  500: "#8e8e93",
  600: "#6e6e73",
  700: "#545458",
  800: "#3a3a3c",
  900: "#242426",
  950: "#141415",
};

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1180px" },
    },
    extend: {
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Text",
          "Inter var",
          "Inter",
          "Segoe UI Variable Text",
          "Segoe UI",
          "system-ui",
          "sans-serif",
        ],
        // Los títulos usan la misma familia: macOS no mezcla serif y sans.
        display: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Display",
          "Inter var",
          "Inter",
          "Segoe UI Variable Display",
          "Segoe UI",
          "system-ui",
          "sans-serif",
        ],
        mono: ["SF Mono", "ui-monospace", "Cascadia Mono", "Consolas", "monospace"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        sidebar: "hsl(var(--sidebar))",
        separator: "hsl(var(--separator))",
        // Nombres nuevos.
        system: {
          blue: "#007aff",
          green: "#34c759",
          indigo: "#5856d6",
          orange: "#ff9500",
          pink: "#ff2d55",
          purple: "#af52de",
          red: "#ff3b30",
          teal: "#30b0c7",
          yellow: "#ffcc00",
          gray: "#8e8e93",
        },
        // Las escalas heredadas apuntan al mismo sistema.
        indigo: blue,
        blue,
        sky: blue,
        cyan: blue,
        violet: purple,
        purple,
        fuchsia: pink,
        pink,
        rose: pink,
        teal: green,
        emerald: green,
        green,
        lime: green,
        amber: orange,
        orange,
        yellow: orange,
        red,
        slate: gray,
        zinc: gray,
        gray,
        neutral: gray,
        stone: gray,
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
        popover: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "6px",
        md: "8px",
        lg: "10px",
        xl: "14px",
        "2xl": "20px",
        "3xl": "28px",
        "4xl": "36px",
      },
      fontSize: {
        "2xs": ["10.5px", "14px"],
      },
      backdropBlur: {
        "4xl": "72px",
      },
      boxShadow: {
        liquid:
          "0 12px 32px -16px rgba(36, 36, 38, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.32)",
        "liquid-soft":
          "0 10px 28px -18px rgba(36, 36, 38, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.28)",
        "liquid-dark": "0 8px 32px 0 rgba(0, 0, 0, 0.38), inset 0 1px 0 rgba(255, 255, 255, 0.035)",
        "liquid-blue": "0 14px 34px -18px rgba(0, 102, 255, 0.75)",
        sm: "0 0 0 0.5px rgb(0 0 0 / 0.05), 0 1px 2px rgb(0 0 0 / 0.06)",
        DEFAULT: "0 0 0 0.5px rgb(0 0 0 / 0.05), 0 1px 3px rgb(0 0 0 / 0.08)",
        md: "0 2px 8px -2px rgb(0 0 0 / 0.12), 0 0 0 0.5px rgb(0 0 0 / 0.04)",
        lg: "0 8px 24px -8px rgb(0 0 0 / 0.18), 0 0 0 0.5px rgb(0 0 0 / 0.04)",
        xl: "0 20px 48px -16px rgb(0 0 0 / 0.24), 0 0 0 0.5px rgb(0 0 0 / 0.05)",
        window:
          "0 0 0 0.5px rgb(0 0 0 / 0.14), 0 1px 2px rgb(0 0 0 / 0.08), 0 12px 32px rgb(0 0 0 / 0.16), 0 32px 64px -16px rgb(0 0 0 / 0.18)",
        pressed: "inset 0 1px 2px rgb(0 0 0 / 0.08)",
        button:
          "inset 0 1px 0 rgb(255 255 255 / 0.18), 0 0 0 0.5px rgb(0 0 0 / 0.08), 0 1px 2px rgb(0 0 0 / 0.12)",
      },
      transitionTimingFunction: {
        mac: "cubic-bezier(0.32, 0.72, 0, 1)",
      },
      keyframes: {
        "pulse-ring": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
        "planner-in": {
          from: { opacity: "0", transform: "translateY(8px) scale(0.995)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "planner-day": {
          from: { opacity: "0", transform: "translateY(3px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "pulse-ring": "pulse-ring 1.5s ease-in-out infinite",
        "planner-in": "planner-in 0.32s cubic-bezier(0.32, 0.72, 0, 1) both",
        "planner-day": "planner-day 0.22s ease-out both",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
