/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        primary: "#4F46E5",
        "primary-dark": "#4338CA",
        "primary-light": "#EEF2FF",
      },
    },
  },
  plugins: [require("@tailwindcss/forms")],
};
