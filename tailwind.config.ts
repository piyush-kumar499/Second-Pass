import type { Config } from "tailwindcss";

// The palette is deliberately warm and printed, not glossy: cream paper,
// pencil-dark ink, pine green ink stamps and a highlighter yellow.
// `indigo` and `stone` are re-mapped so older class names keep working
// while the whole app moves to the notebook look.
const pine = {
  50: "#eef3f0",
  100: "#dce8e2",
  200: "#bcd3c9",
  300: "#93b5a7",
  400: "#648f7f",
  500: "#3f7263",
  600: "#1f4f40",
  700: "#193f34",
  800: "#142f27",
  900: "#0f241e",
};

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#f8f3e8",
        "paper-deep": "#efe6d3",
        card: "#fffdf7",
        ink: "#211e18",
        "ink-soft": "#5b5344",
        line: "#d8cbb2",
        highlight: "#f5c95b",
        pine,
        clay: "#a94a33",
        indigo: pine,
        stone: {
          50: "#faf7f0",
          100: "#f3ede0",
          200: "#e5dbc8",
          300: "#d0c3a9",
          400: "#a8997d",
          500: "#857660",
          600: "#6a5d4a",
          700: "#52483a",
          800: "#3c352b",
          900: "#2a251e",
        },
      },
      fontFamily: {
        serif: [
          '"Iowan Old Style"',
          '"Palatino Linotype"',
          "Palatino",
          '"Book Antiqua"',
          "Georgia",
          "Cambria",
          '"Times New Roman"',
          "serif",
        ],
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          '"Segoe UI"',
          "Roboto",
          '"Helvetica Neue"',
          "Arial",
          "sans-serif",
        ],
        mono: ['ui-monospace', "SFMono-Regular", "Menlo", "Consolas", '"Liberation Mono"', "monospace"],
      },
      boxShadow: {
        paper: "3px 3px 0 rgba(33, 30, 24, 0.07)",
        "paper-sm": "2px 2px 0 rgba(33, 30, 24, 0.08)",
        button: "2px 2px 0 #c9b98f",
      },
    },
  },
  plugins: [],
};

export default config;
