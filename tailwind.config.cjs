module.exports = {
  darkMode: 'class', // oder 'media' falls du prefers-color-scheme nutzt
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      screens: {
        // Tablet Portrait/Landscape
        tablet: '768px',   // Start Tablet
        laptop: '1024px',  // Start Laptop/Desktop
        desktop: '1280px', // Größere Desktops
      },
    },
  },
  plugins: [],
}
