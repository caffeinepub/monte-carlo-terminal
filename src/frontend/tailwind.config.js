import typography from "@tailwindcss/typography";
import containerQueries from "@tailwindcss/container-queries";
import animate from "tailwindcss-animate";

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["index.html", "src/**/*.{js,ts,jsx,tsx,html,css}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        mono: ['"Geist Mono"', '"JetBrains Mono"', "ui-monospace", "monospace"],
        display: ['"Mona Sans"', '"Geist Mono"', "ui-monospace", "monospace"],
        jetbrains: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      colors: {
        terminal: {
          green: "oklch(var(--terminal-green))",
          "green-dim": "oklch(var(--terminal-green-dim))",
          "green-glow": "oklch(var(--terminal-green-glow))",
          cyan: "oklch(var(--terminal-cyan))",
          amber: "oklch(var(--terminal-amber))",
          red: "oklch(var(--terminal-red))",
          surface: "oklch(var(--terminal-surface))",
          border: "oklch(var(--terminal-border))",
        },
        border: "oklch(var(--border))",
        input: "oklch(var(--input))",
        ring: "oklch(var(--ring) / <alpha-value>)",
        background: "oklch(var(--background))",
        foreground: "oklch(var(--foreground))",
        primary: {
          DEFAULT: "oklch(var(--primary) / <alpha-value>)",
          foreground: "oklch(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "oklch(var(--secondary) / <alpha-value>)",
          foreground: "oklch(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "oklch(var(--destructive) / <alpha-value>)",
          foreground: "oklch(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "oklch(var(--muted) / <alpha-value>)",
          foreground: "oklch(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "oklch(var(--accent) / <alpha-value>)",
          foreground: "oklch(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "oklch(var(--popover))",
          foreground: "oklch(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "oklch(var(--card))",
          foreground: "oklch(var(--card-foreground))",
        },
        chart: {
          1: "oklch(var(--chart-1))",
          2: "oklch(var(--chart-2))",
          3: "oklch(var(--chart-3))",
          4: "oklch(var(--chart-4))",
          5: "oklch(var(--chart-5))",
        },
        sidebar: {
          DEFAULT: "oklch(var(--sidebar))",
          foreground: "oklch(var(--sidebar-foreground))",
          primary: "oklch(var(--sidebar-primary))",
          "primary-foreground": "oklch(var(--sidebar-primary-foreground))",
          accent: "oklch(var(--sidebar-accent))",
          "accent-foreground": "oklch(var(--sidebar-accent-foreground))",
          border: "oklch(var(--sidebar-border))",
          ring: "oklch(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgba(0,0,0,0.05)",
        terminal: "0 0 0 1px oklch(var(--terminal-green) / 0.3), 0 4px 20px oklch(var(--terminal-green) / 0.08)",
        "terminal-hover": "0 0 0 1px oklch(var(--terminal-green) / 0.5), 0 4px 24px oklch(var(--terminal-green) / 0.15)",
        "terminal-active": "0 0 0 1px oklch(var(--terminal-green)), 0 0 20px oklch(var(--terminal-green) / 0.25), inset 0 0 20px oklch(var(--terminal-green) / 0.04)",
        "terminal-card": "0 0 0 1px oklch(var(--terminal-border)), 0 2px 8px rgba(0,0,0,0.4)",
        "terminal-glow": "0 0 20px oklch(var(--terminal-green) / 0.2), 0 0 40px oklch(var(--terminal-green) / 0.08)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [typography, containerQueries, animate],
};
