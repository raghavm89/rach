import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Marketing site colors
        "primary-blue": "#2563EB",
        "primary-purple": "#8260F6",
        "accent-cyan": "#3BE1EA",
        "accent-sky": "#A8D5EB",
        // Theme-aware neutrals (flip in .dark — see globals.css)
        "neutral-border": "rgb(var(--c-border) / <alpha-value>)",
        "bg-primary": "rgb(var(--c-surface) / <alpha-value>)",
        "bg-secondary": "rgb(var(--c-bg) / <alpha-value>)",
        "bg-dark": "#0A0A0F",
        // Theme-aware "ink": black in light, near-white in dark. Flips the
        // black/opacity design language (text-black, border-black, bg-black/5…).
        black: "rgb(var(--c-ink) / <alpha-value>)",
        // Fixed dark surface for solid primary buttons/bubbles (never inverts;
        // keeps its paired text-white readable in both themes).
        "ink-solid": "rgb(var(--c-ink-solid) / <alpha-value>)",
        "text-primary": "rgb(var(--c-text) / <alpha-value>)",
        "text-secondary": "rgb(var(--c-text-2) / <alpha-value>)",
        "text-muted": "rgb(var(--c-text-muted) / <alpha-value>)",
        "text-on-dark": "#F5F5F5",

        // Homepage rebrand palette (warm + single blue)
        page: "#FAFAF9",
        band: "#F4F3EE",
        surface: "#FFFFFF",
        ink: "#0B0B0C",
        "ink-2": "#6B7280",
        "ink-3": "#9CA3AF",
        line: "#ECECE8",
        "line-2": "#E3E3DE",
        row: "#F4F4F1",
        accent: "#2563EB",
        "accent-weak": "#EFF4FE",
        "accent-line": "#DCE7FB",
        mem: "#93B4F0",
        ok: "#15803D",
        "ok-bg": "#E8F5EC",
        "ok-line": "#CDEAD6",
        wait: "#B45309",
        "wait-bg": "#FBF1DE",
        "wait-line": "#F1DFB8",

        // Dashboard surfaces (theme-aware)
        "surface-app": "rgb(var(--c-app) / <alpha-value>)",
        "surface-card": "rgb(var(--c-surface) / <alpha-value>)",
        "surface-hover": "rgb(var(--c-surface-hover) / <alpha-value>)",
        "surface-active": "rgb(var(--c-surface-active) / <alpha-value>)",
        "surface-sidebar": "#0F172A",
        "surface-sidebar-hover": "#1E293B",

        // Dashboard text (theme-aware)
        "dash-heading": "rgb(var(--c-heading) / <alpha-value>)",
        "dash-body": "rgb(var(--c-body) / <alpha-value>)",
        "dash-muted": "rgb(var(--c-muted2) / <alpha-value>)",
        "dash-disabled": "rgb(var(--c-disabled) / <alpha-value>)",
        "dash-sidebar": "#CBD5E1",
        "dash-sidebar-active": "#FFFFFF",

        // Status colors
        "status-success": "#10B981",
        "status-success-bg": "#ECFDF5",
        "status-warning": "#F59E0B",
        "status-warning-bg": "#FEF3C7",
        "status-danger": "#EF4444",
        "status-danger-bg": "#FEE2E2",
        "status-info": "#3B82F6",
        "status-info-bg": "#DBEAFE",
        "status-neutral": "#6B7280",
        "status-neutral-bg": "#F3F4F6",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      boxShadow: {
        well: "0 1px 2px rgba(16,24,40,.04), 0 18px 40px -12px rgba(16,24,40,.16)",
        "well-sm": "0 1px 2px rgba(16,24,40,.05), 0 10px 24px -10px rgba(16,24,40,.12)",
      },
      maxWidth: {
        site: "1200px",
      },
      animation: {
        marquee: "marquee 30s linear infinite",
        rise: "rise 0.8s cubic-bezier(0.16,1,0.3,1) forwards",
        pop: "pop 0.9s cubic-bezier(0.16,1,0.3,1) forwards",
        pulse2: "pulse2 2.4s ease-in-out infinite",
        blink: "blink 1.1s steps(2) infinite",
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        rise: {
          from: { opacity: "0", transform: "translateY(14px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        pop: {
          from: { opacity: "0", transform: "translateY(20px) scale(0.985)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        pulse2: {
          "0%,100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.45", transform: "scale(0.8)" },
        },
        blink: {
          "50%": { opacity: "0" },
        },
      },
    },
  },
  plugins: [
    require("@tailwindcss/typography"),
  ],
};
export default config;
