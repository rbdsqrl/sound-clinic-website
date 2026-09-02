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
      // 1.15 for readability. Overriding here rather than bumping the root
      // font-size keeps rem-based spacing and layout untouched — only text grows.
      // `sm` (the standard "content/body" size — see DESIGN.md §8) is pinned to
      // 13.5px directly rather than the 1.15x formula, per product request; the
      // Sidebar nav menu explicitly opts back out to the old 16.1px (Sidebar.tsx).
      fontSize: {
        xs:    ['0.8625rem',  { lineHeight: '1.15rem'   }],  // 12px → 13.8px
        sm:    ['0.84375rem', { lineHeight: '1.2rem'    }],  // → 13.5px
        base:  ['1.15rem',    { lineHeight: '1.725rem'  }],  // 16px → 18.4px
        lg:    ['1.29375rem', { lineHeight: '2.0125rem' }],  // 18px → 20.7px
        xl:    ['1.4375rem',  { lineHeight: '2.0125rem' }],  // 20px → 23px
        '2xl': ['1.725rem',   { lineHeight: '2.3rem'    }],  // 24px → 27.6px
        '3xl': ['2.15625rem', { lineHeight: '2.5875rem' }],  // 30px → 34.5px
        '4xl': ['2.5875rem',  { lineHeight: '2.875rem'  }],  // 36px → 41.4px
        '5xl': ['3.45rem',    { lineHeight: '1'         }],  // 48px → 55.2px
        '6xl': ['4.3125rem',  { lineHeight: '1'         }],  // 60px → 69px
        '7xl': ['5.175rem',   { lineHeight: '1'         }],  // 72px → 82.8px
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
