/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        brand: {
          morning: '#F59E0B',
          breaks: '#06B6D4',
          kettlebell: '#EF4444',
          success: '#10B981',
          missed: '#F43F5E',
        }
      }
    },
  },
  plugins: [],
}
