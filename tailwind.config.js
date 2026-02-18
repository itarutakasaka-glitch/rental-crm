/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        primary: "#4ECDC4",
        "primary-dark": "#3AA89E",
      },
    },
  },
  plugins: [require("@tailwindcss/forms")],
};
