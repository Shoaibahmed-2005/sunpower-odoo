/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "var(--primary)",
        "primary-fg": "var(--primary-fg)",
        accent: "var(--accent)",
        "accent-fg": "var(--accent-fg)",
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        border: "var(--border)",
        text: "var(--text)",
        muted: "var(--muted)",
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--danger)",
        info: "var(--info)",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        card: "var(--radius-lg)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        pop: "var(--shadow-pop)",
      },
      fontFamily: {
        heading: ["Poppins", "sans-serif"],
        body: ["Noto Sans", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      spacing: {
        sp1: "var(--sp-1)",
        sp2: "var(--sp-2)",
        sp3: "var(--sp-3)",
        sp4: "var(--sp-4)",
        sp5: "var(--sp-5)",
        sp6: "var(--sp-6)",
        sp8: "var(--sp-8)",
      },
      height: {
        control: "var(--control-height)",
        "control-lg": "var(--control-height-lg)",
      },
      minHeight: {
        control: "var(--control-height)",
        "control-lg": "var(--control-height-lg)",
      },
    },
  },
  plugins: [],
};

