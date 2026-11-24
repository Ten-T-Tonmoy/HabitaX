/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: { extend: { colors: { ink: "#172033", muted: "#64748b", canvas: "#f5f7fb", brand: "#5267e8" } } },
  plugins: []
};
