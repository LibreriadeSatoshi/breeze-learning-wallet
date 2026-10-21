import type { Config } from "tailwindcss";

const v = (name: string) => `var(--${name})`;

// Colors, type, radii and shadows replace Tailwind's defaults so only ISMOS
// tokens are available. Semantic colors switch with the theme in globals.css.
const config: Config = {
  darkMode: ["selector", '[data-theme="hacker"]'],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    colors: {
      transparent: "transparent",
      current: "currentColor",
      inherit: "inherit",
      mauveine: { DEFAULT: v("mauveine"), 200: v("mauveine-200"), 300: v("mauveine-300") },
      indigo: v("indigo"),
      paper: v("paper"),
      ink: v("ink"),
      madder: { DEFAULT: v("madder"), 800: v("madder-800") },
      weld: v("weld"),
      logwood: {
        DEFAULT: v("logwood"),
        50: v("logwood-50"),
        100: v("logwood-100"),
        200: v("logwood-200"),
        300: v("logwood-300"),
        400: v("logwood-400"),
        500: v("logwood-500"),
        600: v("logwood-600"),
        700: v("logwood-700"),
        800: v("logwood-800"),
        900: v("logwood-900"),
        950: v("logwood"),
      },
      surface: v("surface"),
      raised: v("surface-raised"),
      fg: { DEFAULT: v("text"), muted: v("text-muted") },
      heading: v("text-heading"),
      hairline: v("hairline"),
      strong: v("border-strong"),
      input: v("border-input"),
      overlay: { DEFAULT: v("overlay"), edge: v("overlay-edge") },
      link: { DEFAULT: v("link"), hover: v("link-hover") },
      alert: v("alert"),
      bar: v("bar"),
      track: v("track"),
      action: { DEFAULT: v("action"), fg: v("on-action") },
      highlight: { DEFAULT: v("highlight"), fg: v("on-highlight") },
      focus: v("focus"),
      info: { DEFAULT: v("status-info"), bg: v("status-info-bg") },
      success: v("status-success"),
      warning: { DEFAULT: v("status-warning"), bg: v("status-warning-bg") },
      error: v("status-error"),
      scrim: v("scrim"),
    },
    fontFamily: {
      serif: ["var(--font-serif)", "Georgia", "serif"],
      sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      mono: ["var(--font-mono)", "ui-monospace", "Menlo", "monospace"],
      wordmark: ["var(--font-wordmark)", "sans-serif"],
    },
    fontSize: {
      display: ["48px", { lineHeight: "52px", fontWeight: "400" }],
      h1: ["36px", { lineHeight: "42px", fontWeight: "400" }],
      h2: ["28px", { lineHeight: "34px", fontWeight: "400" }],
      h3: ["21px", { lineHeight: "28px", fontWeight: "500" }],
      lead: ["19px", "30px"],
      body: ["17px", "28px"],
      "body-sm": ["15px", { lineHeight: "24px", fontWeight: "500" }],
      caption: ["13px", { lineHeight: "20px", fontWeight: "500" }],
      label: ["11px", { lineHeight: "16px", fontWeight: "500" }],
    },
    fontWeight: {
      normal: "400",
      medium: "500",
      semibold: "600",
    },
    letterSpacing: {
      normal: "0",
      label: "0.14em",
      wordmark: "0.04em",
      address: "0.4em",
    },
    borderRadius: {
      none: "0",
      DEFAULT: "4px",
      modal: "8px",
      full: "9999px",
    },
    boxShadow: {
      none: "none",
      float: v("shadow-float"),
      modal: v("shadow-modal"),
    },
    extend: {
      borderWidth: {
        1.5: "1.5px",
        6: "6px",
      },
      height: {
        bar: "6px",
        control: "44px",
        field: "48px",
      },
      minHeight: {
        control: "44px",
        field: "48px",
      },
      maxWidth: {
        reading: "680px",
        content: "1200px",
      },
      zIndex: {
        sticky: "100",
        dropdown: "200",
        modal: "400",
        toast: "500",
      },
      transitionDuration: {
        fast: "120ms",
        base: "200ms",
        slow: "280ms",
      },
    },
  },
  plugins: [],
};
export default config;
