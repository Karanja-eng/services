/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class", // Must be 'class', not 'media'
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      keyframes: {
        hit: {
          '0%': { transform: 'rotate(0deg)' },
          '30%': { transform: 'rotate(-30deg)' },
          '60%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(0deg)' },
        }
      },
      animation: {
        hit: 'hit 0.6s infinite',
      }
    },
  },
  plugins: [],
};
