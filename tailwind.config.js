/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      animation: {
        'pulse-custom': 'pulse-custom 1.5s infinite',
      },
      keyframes: {
        'pulse-custom': {
          '0%': {
            boxShadow: '0 0 0 0 rgba(234, 67, 53, 0.7)',
          },
          '70%': {
            boxShadow: '0 0 0 10px rgba(234, 67, 53, 0)',
          },
          '100%': {
            boxShadow: '0 0 0 0 rgba(234, 67, 53, 0)',
          },
        },
      },
    },
  },
  plugins: [],
}