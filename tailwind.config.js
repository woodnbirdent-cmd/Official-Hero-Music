/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        hero: {
          black: "#000000",
          dark: "#1a1c1f",
          gray: "#494d54",
          surface: "#494d54",
          muted: "#9a9ea4",
          light: "#EEEEEE",
          accent: "#aa9371",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Impact", "Arial Black", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
