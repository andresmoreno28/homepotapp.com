/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/templates/**/*.eta',
    './index.html',
    './compare/**/*.html',
    './guides/**/*.html',
    './resources/**/*.html',
    './from-splitwise/**/*.html',
    './es/**/*.html',
    './fr/**/*.html',
    './de/**/*.html',
    './pt/**/*.html',
    './privacy/index.html',
    './terms/index.html',
    './support/index.html',
  ],
  theme: {
    extend: {
      colors: {
        cream: '#F4F1DE',
        darkBlue: '#3D405B',
        terracotta: '#E07A5F',
        sage: '#81B29A',
        yellowSoft: '#F2CC8F',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
