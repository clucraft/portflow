/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ['JetBrains Mono', 'Consolas', 'Monaco', 'monospace'],
        sans: ['JetBrains Mono', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Charcoal background tones
        surface: {
          900: '#121214', // Main background
          800: '#1a1a1e', // Card/elevated surfaces
          700: '#222226', // Hover states
          600: '#2a2a30', // Borders
        },
        // Primary accent - Cyan (telecom/connectivity)
        primary: {
          50: '#ecfeff',
          100: '#cffafe',
          200: '#a5f3fc',
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
          700: '#0e7490',
          800: '#155e75',
          900: '#164e63',
        },
        // Workflow stage colors
        stage: {
          gray: '#6b7280',      // estimate
          cyan: '#06b6d4',      // estimate_accepted
          red: '#ef4444',       // verizon_*
          amber: '#f59e0b',     // porting_*
          purple: '#a855f7',    // user_config
          green: '#22c55e',     // completed
        },
      },
    },
  },
  plugins: [],
}
