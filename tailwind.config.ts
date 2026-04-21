import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: "class",
  theme: {
    extend: {
      borderRadius: {
        DEFAULT: "4px",
        sm: "4px",
        md: "4px",
        lg: "4px",
        xl: "4px",
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        panel: "var(--panel)",
        border: "var(--border)",
        muted: "var(--muted)",
        "muted-foreground": "var(--muted-foreground)",
        accent: "var(--accent)",
        "accent-foreground": "var(--accent-foreground)",
        "cliff-red": "var(--cliff-red)",
        "cliff-amber": "var(--cliff-amber)",
        "cliff-green": "var(--cliff-green)",
        "dla-green": "var(--dla-green)",
        "dla-amber": "var(--dla-amber)",
        "dla-red": "var(--dla-red)",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "Inter", "Segoe UI", "sans-serif"],
        mono: ["var(--font-financial)", "JetBrains Mono", "IBM Plex Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      spacing: {
        1.5: "0.375rem",
      },
    },
  },
}

export default config
