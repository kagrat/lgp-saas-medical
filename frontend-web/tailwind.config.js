/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Palette du projet - inspiree de la confiance clinique et discretement
        // du drapeau beninois (vert/or), sans cliche IA (pas de creme/terracotta standard).
        forest: {
          50: "#EEF5F1",
          100: "#D7E8DE",
          300: "#7FB596",
          500: "#2F7A55",
          700: "#1B4D36",
          900: "#0F2E21",
        },
        amber: {
          400: "#E8B23D",
          500: "#D98E04",
          600: "#B57303",
        },
        clay: {
          500: "#C1440E",
          600: "#9C3609",
        },
        paper: "#F4F7F4",
        ink: "#132019",
      },
      fontFamily: {
        display: ["'Fraunces'", "serif"],
        body: ["'Inter'", "sans-serif"],
      },
    },
  },
  plugins: [],
}
