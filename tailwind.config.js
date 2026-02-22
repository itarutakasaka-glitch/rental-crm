/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        primary: "#d4a017",
        "primary-dark": "#b8860b",
        "primary-light": "rgba(212,160,23,0.08)",
      },
      fontFamily: {
        cyber: ["Rajdhani", "Courier New", "monospace"],
      },
    },
  },
  plugins: [require("@tailwindcss/forms")],
};