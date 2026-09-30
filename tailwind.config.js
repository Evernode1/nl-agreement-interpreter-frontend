/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Blue-black "ink" surfaces
        ink: {
          950: "#0B0D13",
          900: "#11141C",
          850: "#161A24",
          800: "#1C212D",
          700: "#283041",
          600: "#3A4459",
        },
        // Warm "paper" text, like a printed agreement
        paper: {
          100: "#F1EDE4",
          200: "#E3DDCE",
          400: "#A9A493",
          500: "#837E70",
          600: "#5E5A4E",
        },
        // Signature-ink accent (primary actions, focus)
        quill: {
          200: "#C9D3FF",
          300: "#A5B6FF",
          400: "#7F95F5",
          500: "#6479DB",
          600: "#4C5DB0",
        },
        // Consistent / paid / completed
        sage: {
          400: "#6CC29B",
          500: "#58AB86",
          600: "#448769",
        },
        // Needs review / undetermined / disputed
        gold: {
          300: "#F0CB7A",
          400: "#E0AE48",
          500: "#BC8D32",
        },
        // Inconsistent / breach / destructive
        seal: {
          400: "#E5715C",
          500: "#D0553F",
          600: "#A94232",
        },
      },
      fontFamily: {
        display: ["'Fraunces'", "serif"],
        sans: ["'Inter'", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "ui-monospace", "monospace"],
      },
      boxShadow: {
        sheet: "0 1px 0 0 rgba(165,182,255,0.07) inset, 0 20px 40px -20px rgba(0,0,0,0.6)",
      },
      backgroundImage: {
        grain: "radial-gradient(circle at 1px 1px, rgba(165,182,255,0.05) 1px, transparent 0)",
      },
    },
  },
  plugins: [],
};
