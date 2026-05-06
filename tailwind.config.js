/**
 * tailwind.config.js
 *
 * All colour/shadow values here should stay in sync with src/theme.ts.
 * These tokens power Tailwind utility classes (bg-primary-*, text-primary-*, etc.)
 * that appear in JSX className strings. Inline `style={{}}` values live in theme.ts.
 */

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ── Primary accent — soft teal ───────────────────────────────────────
        primary: {
          50:  '#c8c098',
          100: '#d4f2f0',
          200: '#a8e5e2',
          300: '#7dd7d3',
          400: '#5ABFBB',
          500: '#4FB6B2',   // ← main accent  (theme.ts: colors.accent)
          600: '#3A9E9A',
          700: '#2d8480',
          800: '#226260',
          900: '#174240',
        },
        // ── Neutral surface scale (both modes) ──────────────────────────────
        surface: {
          50:  '#b8b691',
          100: '#a8e8d6',
          200: '#89a7b9',
          700: '#18202E',
          800: '#141E30',
          900: '#0E1625',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      // ── Glow shadows (match shadow.* in theme.ts) ──────────────────────────
      boxShadow: {
        'glow':    '0 0 20px rgba(79, 182, 178, 0.22)',
        'glow-sm': '0 0 10px rgba(79, 182, 178, 0.14)',
        'glow-lg': '0 0 40px rgba(79, 182, 178, 0.28)',
      },
      // ── Background helpers ─────────────────────────────────────────────────
      backgroundImage: {
        'grid-light': 'linear-gradient(rgba(79,182,178,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(79,182,178,0.06) 1px, transparent 1px)',
      },
      backgroundSize: {
        'grid': '40px 40px',
      },
    },
  },
  plugins: [],
}
