/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#2F6FDB",
          hover: "#255CC0",
          soft: "#E9F1FF",
        },
      },
      fontFamily: {
        sans: ["Inter", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
};
