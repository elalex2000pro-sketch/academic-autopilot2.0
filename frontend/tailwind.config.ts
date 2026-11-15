import type { Config } from "tailwindcss";

/**
 * Paleta del sistema: los diez colores de acento de macOS/iOS con sus escalas
 * claras y oscuras. Las escalas antiguas se remapean aquí para que las páginas
 * heredadas usen los mismos colores sin reescribir cada clase.
 */
const blue = {
  50: "rgb(var(--palette-blue-50) / <alpha-value>)",
  100: "rgb(var(--palette-blue-100) / <alpha-value>)",
  200: "rgb(var(--palette-blue-200) / <alpha-value>)",
  300: "rgb(var(--palette-blue-300) / <alpha-value>)",
  400: "rgb(var(--palette-blue-400) / <alpha-value>)",
  500: "rgb(var(--palette-blue-500) / <alpha-value>)",
  600: "rgb(var(--palette-blue-600) / <alpha-value>)",
  700: "rgb(var(--palette-blue-700) / <alpha-value>)",
  800: "rgb(var(--palette-blue-800) / <alpha-value>)",
  900: "rgb(var(--palette-blue-900) / <alpha-value>)",
  950: "rgb(var(--palette-blue-950) / <alpha-value>)",
};

const purple = {
  50: "rgb(var(--palette-purple-50) / <alpha-value>)",
  100: "rgb(var(--palette-purple-100) / <alpha-value>)",
  200: "rgb(var(--palette-purple-200) / <alpha-value>)",
  300: "rgb(var(--palette-purple-300) / <alpha-value>)",
  400: "rgb(var(--palette-purple-400) / <alpha-value>)",
  500: "rgb(var(--palette-purple-500) / <alpha-value>)",
  600: "rgb(var(--palette-purple-600) / <alpha-value>)",
  700: "rgb(var(--palette-purple-700) / <alpha-value>)",
  800: "rgb(var(--palette-purple-800) / <alpha-value>)",
  900: "rgb(var(--palette-purple-900) / <alpha-value>)",
  950: "rgb(var(--palette-purple-950) / <alpha-value>)",
};

const pink = {
  50: "rgb(var(--palette-pink-50) / <alpha-value>)",
  100: "rgb(var(--palette-pink-100) / <alpha-value>)",
  200: "rgb(var(--palette-pink-200) / <alpha-value>)",
  300: "rgb(var(--palette-pink-300) / <alpha-value>)",
  400: "rgb(var(--palette-pink-400) / <alpha-value>)",
  500: "rgb(var(--palette-pink-500) / <alpha-value>)",
  600: "rgb(var(--palette-pink-600) / <alpha-value>)",
  700: "rgb(var(--palette-pink-700) / <alpha-value>)",
  800: "rgb(var(--palette-pink-800) / <alpha-value>)",
  900: "rgb(var(--palette-pink-900) / <alpha-value>)",
  950: "rgb(var(--palette-pink-950) / <alpha-value>)",
};

const green = {
  50: "rgb(var(--palette-green-50) / <alpha-value>)",
  100: "rgb(var(--palette-green-100) / <alpha-value>)",
  200: "rgb(var(--palette-green-200) / <alpha-value>)",
  300: "rgb(var(--palette-green-300) / <alpha-value>)",
  400: "rgb(var(--palette-green-400) / <alpha-value>)",
  500: "rgb(var(--palette-green-500) / <alpha-value>)",
  600: "rgb(var(--palette-green-600) / <alpha-value>)",
  700: "rgb(var(--palette-green-700) / <alpha-value>)",
  800: "rgb(var(--palette-green-800) / <alpha-value>)",
  900: "rgb(var(--palette-green-900) / <alpha-value>)",
  950: "rgb(var(--palette-green-950) / <alpha-value>)",
};

const orange = {
  50: "rgb(var(--palette-orange-50) / <alpha-value>)",
  100: "rgb(var(--palette-orange-100) / <alpha-value>)",
  200: "rgb(var(--palette-orange-200) / <alpha-value>)",
  300: "rgb(var(--palette-orange-300) / <alpha-value>)",
  400: "rgb(var(--palette-orange-400) / <alpha-value>)",
  500: "rgb(var(--palette-orange-500) / <alpha-value>)",
  600: "rgb(var(--palette-orange-600) / <alpha-value>)",
  700: "rgb(var(--palette-orange-700) / <alpha-value>)",
  800: "rgb(var(--palette-orange-800) / <alpha-value>)",
  900: "rgb(var(--palette-orange-900) / <alpha-value>)",
  950: "rgb(var(--palette-orange-950) / <alpha-value>)",
};

const red = {
  50: "rgb(var(--palette-red-50) / <alpha-value>)",
  100: "rgb(var(--palette-red-100) / <alpha-value>)",
  200: "rgb(var(--palette-red-200) / <alpha-value>)",
  300: "rgb(var(--palette-red-300) / <alpha-value>)",
  400: "rgb(var(--palette-red-400) / <alpha-value>)",
  500: "rgb(var(--palette-red-500) / <alpha-value>)",
  600: "rgb(var(--palette-red-600) / <alpha-value>)",
  700: "rgb(var(--palette-red-700) / <alpha-value>)",
  800: "rgb(var(--palette-red-800) / <alpha-value>)",
  900: "rgb(var(--palette-red-900) / <alpha-value>)",
  950: "rgb(var(--palette-red-950) / <alpha-value>)",
};

/** Grises pizarra suaves del tema claro: fríos, mate, sin tintes cálidos ni blancos puros. */
const gray = {
  50: "rgb(var(--palette-gray-50) / <alpha-value>)",
  100: "rgb(var(--palette-gray-100) / <alpha-value>)",
  200: "rgb(var(--palette-gray-200) / <alpha-value>)",
  300: "rgb(var(--palette-gray-300) / <alpha-value>)",
  400: "rgb(var(--palette-gray-400) / <alpha-value>)",
  500: "rgb(var(--palette-gray-500) / <alpha-value>)",
  600: "rgb(var(--palette-gray-600) / <alpha-value>)",
  700: "rgb(var(--palette-gray-700) / <alpha-value>)",
  800: "rgb(var(--palette-gray-800) / <alpha-value>)",
  900: "rgb(var(--palette-gray-900) / <alpha-value>)",
  950: "rgb(var(--palette-gray-950) / <alpha-value>)",
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
      fontFamily: { sans: ["var(--font-body)"], display: ["var(--font-display)"], mono: ["var(--font-mono)"] },
      colors: {
        "literal-111114": "rgb(var(--literal-111114) / <alpha-value>)",
        "literal-2a2a30": "rgb(var(--literal-2a2a30) / <alpha-value>)",
        "literal-3f3852": "rgb(var(--literal-3f3852) / <alpha-value>)",
        "text-on-selection": "rgb(var(--text-on-selection) / <alpha-value>)",
        "surface-inverse": "rgb(var(--surface-inverse) / <alpha-value>)",
        "selection-soft": "rgb(var(--selection-soft) / <alpha-value>)",
        "literal-f4f4f7": "rgb(var(--literal-f4f4f7) / <alpha-value>)",
        "literal-0c0c0f": "rgb(var(--literal-0c0c0f) / <alpha-value>)",
        "literal-2a2a31": "rgb(var(--literal-2a2a31) / <alpha-value>)",
        "literal-0b0f18": "rgb(var(--literal-0b0f18) / <alpha-value>)",
        "literal-ff5f57": "rgb(var(--literal-ff5f57) / <alpha-value>)",
        "literal-febc2e": "rgb(var(--literal-febc2e) / <alpha-value>)",
        "literal-28c840": "rgb(var(--literal-28c840) / <alpha-value>)",
        white: "rgb(var(--palette-white) / <alpha-value>)",
        black: "rgb(var(--palette-black) / <alpha-value>)",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        sidebar: "hsl(var(--sidebar))",
        separator: "hsl(var(--separator))",
        // Nombres nuevos.
        system: {
          blue: "rgb(var(--palette-system-blue) / <alpha-value>)",
          green: "rgb(var(--palette-system-green) / <alpha-value>)",
          indigo: "rgb(var(--palette-system-indigo) / <alpha-value>)",
          orange: "rgb(var(--palette-system-orange) / <alpha-value>)",
          pink: "rgb(var(--palette-system-pink) / <alpha-value>)",
          purple: "rgb(var(--palette-system-purple) / <alpha-value>)",
          red: "rgb(var(--palette-system-red) / <alpha-value>)",
          teal: "rgb(var(--palette-system-teal) / <alpha-value>)",
          yellow: "rgb(var(--palette-system-yellow) / <alpha-value>)",
          gray: "rgb(var(--palette-system-gray) / <alpha-value>)",
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
  "sm": "var(--radius-sm)",
  "DEFAULT": "var(--radius-default)",
  "md": "var(--radius-md)",
  "lg": "var(--radius-lg)",
  "xl": "var(--radius-xl)",
  "2xl": "var(--radius-2xl)",
  "3xl": "var(--radius-3xl)",
  "4xl": "var(--radius-4xl)",
  "full": "var(--radius-full)"
},
      fontSize: {
        "2xs": ["10.5px", "14px"],
      },
      backdropBlur: {
  "none": "var(--blur-none)",
  "sm": "var(--blur-sm)",
  "DEFAULT": "var(--blur-default)",
  "md": "var(--blur-md)",
  "lg": "var(--blur-lg)",
  "xl": "var(--blur-xl)",
  "2xl": "var(--blur-2xl)",
  "3xl": "var(--blur-3xl)",
  "4xl": "var(--blur-4xl)"
},
      boxShadow: {
  "liquid": "var(--shadow-liquid)",
  "liquid-soft": "var(--shadow-liquid-soft)",
  "glass": "var(--shadow-glass)",
  "glass-soft": "var(--shadow-glass-soft)",
  "liquid-dark": "var(--shadow-liquid-dark)",
  "liquid-blue": "var(--shadow-liquid-blue)",
  "sm": "var(--shadow-sm)",
  "DEFAULT": "var(--shadow-default)",
  "md": "var(--shadow-md)",
  "lg": "var(--shadow-lg)",
  "xl": "var(--shadow-xl)",
  "window": "var(--shadow-window)",
  "pressed": "var(--shadow-pressed)",
  "button": "var(--shadow-button)"
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
