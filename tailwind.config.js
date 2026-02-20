/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        primary: "#2979FF",
        "primary-dark": "#1565C0",
        "primary-light": "#E3F2FD",
      },
    },
  },
  plugins: [require("@tailwindcss/forms")],
};
