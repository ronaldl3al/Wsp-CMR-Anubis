/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        wsp: {
          dark: '#111b21',
          panel: '#202c33',
          border: '#2a3942',
          subtext: '#8696a0',
          bubbleIncoming: '#202c33',
          bubbleOutgoing: '#005c4b',
          green: '#00a884',
          hover: '#222e35',
          active: '#2a3942',
          chatBg: '#0b141a',
          blueTick: '#53bdeb'
        }
      }
    },
  },
  plugins: [],
}
