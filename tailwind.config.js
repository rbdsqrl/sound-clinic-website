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
      // ── Type scale ─────────────────────────────────────────────────────────
      // Tailwind's default scale, every size (and its line height) multiplied by
      // 1.2 for readability. Overriding here rather than bumping the root
      // font-size keeps rem-based spacing and layout untouched — only text grows.
      fontSize: {
        xs:    ['0.9rem',  { lineHeight: '1.2rem' }],  // 12px → 14.4px
        sm:    ['1.05rem', { lineHeight: '1.5rem' }],  // 14px → 16.8px
        base:  ['1.2rem',  { lineHeight: '1.8rem' }],  // 16px → 19.2px
        lg:    ['1.35rem', { lineHeight: '2.1rem' }],  // 18px → 21.6px
        xl:    ['1.5rem',  { lineHeight: '2.1rem' }],  // 20px → 24px
        '2xl': ['1.8rem',  { lineHeight: '2.4rem' }],  // 24px → 28.8px
        '3xl': ['2.25rem', { lineHeight: '2.7rem' }],  // 30px → 36px
        '4xl': ['2.7rem',  { lineHeight: '3rem'   }],  // 36px → 43.2px
        '5xl': ['3.6rem',  { lineHeight: '1'      }],  // 48px → 57.6px
        '6xl': ['4.5rem',  { lineHeight: '1'      }],  // 60px → 72px
        '7xl': ['5.4rem',  { lineHeight: '1'      }],  // 72px → 86.4px
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
