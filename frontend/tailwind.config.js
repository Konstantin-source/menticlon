/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: "#060d09",
          card: "rgba(15, 26, 19, 0.75)",
          cardBorder: "rgba(52, 211, 153, 0.12)",
          glowEmerald: "rgba(52, 211, 153, 0.2)",
          glowGreen: "rgba(16, 185, 129, 0.2)",
          glowPurple: "rgba(16, 185, 129, 0.2)", // alias for backward compatibility
          glowTeal: "rgba(52, 211, 153, 0.2)",   // alias for backward compatibility
          emerald: "#10b981",
          mint: "#34d399",
          forest: "#059669",
          lime: "#84cc16",
          neon: "#22c55e",
          violet: "#10b981", // mapped to emerald
          fuchsia: "#22c55e",// mapped to neon green
          teal: "#34d399",   // mapped to mint green
          rose: "#f43f5e",   // error rose
          amber: "#f59e0b",
        }
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'scale-in': 'scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        }
      }
    },
  },
  plugins: [],
}
