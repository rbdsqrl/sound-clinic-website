/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  theme.ts  —  TypeScript interface to the CSS custom-property design system.
 *
 *  COLOUR VALUES live in src/index.css under :root (light) and .dark (dark).
 *  This file simply names those variables so components never hard-code strings.
 *
 *  To retheme:  edit the values in index.css — nothing here needs to change.
 *  To add a token: add the CSS var in index.css, then expose it here.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Brand assets ──────────────────────────────────────────────────────────────

// Vite rewrites this import at build time → hashed URL in dist/assets/.
// Never use a raw string path like '/src/assets/logo.png' — it works in dev
// but breaks in production because the file is moved and renamed by the bundler.
import logoSrc from './assets/logo.png'

/** Single source of truth for the brand logo URL.
 *  Import this constant anywhere you need the logo — never hardcode the path. */
export const LOGO_SRC = logoSrc

// ── CSS-variable reference helpers ────────────────────────────────────────────

/** Returns a CSS var reference, e.g. `var(--color-accent)` */
const v = (name: string) => `var(${name})`

/**
 * Generic rgba helper — works with any raw CSS-var string from palette,
 * e.g. `rgba(palette.teal.raw, 0.10)`  →  `rgba(var(--color-accent-raw), 0.10)`
 */
export const rgba = (raw: string, a: number) => `rgba(${raw}, ${a})`

/** Build rgba() using a CSS raw-channel var: rgba(var(--foo-raw), alpha) */
export const accentAlpha    = (a: number) => `rgba(var(--color-accent-raw), ${a})`
export const ctaAlpha       = (a: number) => `rgba(var(--color-cta-raw), ${a})`
export const secondaryAlpha = (a: number) => `rgba(var(--color-secondary-raw), ${a})`
export const borderAlpha    = (a: number) => `rgba(var(--border-raw), ${a})`
export const successAlpha   = (a: number) => `rgba(var(--color-success-raw), ${a})`
export const dangerAlpha    = (a: number) => `rgba(var(--color-danger-raw), ${a})`
export const warningAlpha   = (a: number) => `rgba(var(--color-warning-raw), ${a})`
export const infoAlpha      = (a: number) => `rgba(var(--color-info-raw), ${a})`

// ── Colour tokens ─────────────────────────────────────────────────────────────

export const colors = {
  /** Soft Teal — nav active, links, focus rings, info badges */
  accent:    v('--color-accent'),
  /** Warm Coral — primary CTA buttons */
  cta:       v('--color-cta'),
  /** Sky Blue — highlights, secondary info */
  secondary: v('--color-secondary'),

  /** Dark-surface / page text hierarchy */
  text: {
    heading: v('--text-heading'),
    primary: v('--text-primary'),
    muted:   v('--text-muted'),
    dim:     v('--text-dim'),
    link:    v('--text-link'),
  },

  /** Sidebar / light-UI text (same in light mode, adjusted in dark) */
  textLight: {
    primary: v('--text-sidebar-primary'),
    label:   v('--text-sidebar-label'),
    muted:   v('--text-sidebar-muted'),
  },

  /** Semantic status colours */
  status: {
    success: v('--color-success'),
    warning: v('--color-warning'),
    danger:  v('--color-danger'),
    info:    v('--color-info'),
    error:   v('--color-danger'),    // alias
  },

  /** Role dot colours — static, not mode-dependent */
  role: {
    BUSINESS_OWNER: '#E0A840',   // warm amber
    CLINIC_HEAD:    '#D96060',   // coral-red
    THERAPIST:      '#9864DC',   // soft purple
    DOCTOR:         '#2B80C8',   // blue (matches accent)
    PARENT:         '#DC64A0',   // soft pink
    PATIENT:        '#6B8499',   // slate
  },
} as const

// ── Surface tokens ────────────────────────────────────────────────────────────

export const surface = {
  app:           v('--surface-app'),
  card:          v('--surface-card'),
  sidebar:       v('--surface-sidebar'),
  overlay:       v('--surface-overlay'),
  mobileOverlay: v('--surface-mobile-overlay'),
  mobileHeader:  v('--surface-mobile-header'),
  footer:        v('--surface-footer'),
  filterStrip:   v('--surface-filter-strip'),
  rowHover:      v('--surface-row-hover'),
  /** Subtle teal-tinted panel inside the sidebar footer — auto-adapts */
  sidebarFooter: `rgba(var(--color-accent-raw), 0.05)`,
} as const

// ── Border tokens ─────────────────────────────────────────────────────────────

export const border = {
  /** Full border string for cards / panels: `1px solid rgba(...)` */
  card:         v('--border-card'),
  medium:       v('--border-medium'),
  /** Raw colour value only (for borderTop, borderBottom etc.) — auto-switches with mode */
  divider:      v('--border-divider'),
  /** Aliases — all resolve to the same adaptive divider */
  dividerDark:  v('--border-divider'),
  dividerLight: v('--border-sidebar'),
  darker:       v('--border-card'),
  darkSub:      v('--border-card'),
  light:        v('--border-sidebar'),
  /** Modal drag handle colour */
  dragHandle:   v('--border-divider'),
  sidebar:      v('--border-sidebar'),
  drag:         v('--border-drag'),
} as const

// ── Shadow tokens ─────────────────────────────────────────────────────────────

export const shadow = {
  card:          v('--shadow-card'),
  glow:          v('--shadow-glow'),
  glowSm:        v('--shadow-glow-sm'),
  glowLg:        v('--shadow-glow-lg'),
  buttonCta:     v('--shadow-button-cta'),
  buttonAccent:  v('--shadow-button-accent'),
  logo:          v('--shadow-logo'),
  navActive:     v('--shadow-nav-active'),
  modal:         v('--shadow-modal'),
  navDot:        v('--shadow-nav-dot'),
  cardStat:      (extra: string) => `var(--shadow-card), ${extra}`,
} as const

// ── Gradient tokens ───────────────────────────────────────────────────────────

export const gradient = {
  /** Coral — primary CTA button fill */
  buttonCta:     v('--gradient-button-cta'),
  /** Teal — secondary / accent button fill */
  buttonAccent:  v('--gradient-button-accent'),
  logo:          v('--gradient-logo'),
  loginBg:       v('--gradient-login-bg'),
  summary:       v('--gradient-summary'),
} as const

// ── Radius tokens ─────────────────────────────────────────────────────────────

export const radius = {
  xs:   '6px',
  sm:   '8px',
  md:   '12px',
  lg:   '16px',
  xl:   '20px',
  full: '9999px',
} as const

// ── Palette entries (for badges — static, same in both modes) ─────────────────

export type PaletteKey = 'teal' | 'green' | 'red' | 'yellow' | 'blue' | 'purple' | 'slate' | 'pink' | 'amber'

export const palette: Record<PaletteKey, { raw: string; text: string }> = {
  teal:   { raw: 'var(--color-accent-raw)',   text: 'var(--color-accent)' },
  green:  { raw: 'var(--color-success-raw)',  text: 'var(--color-success)' },
  red:    { raw: 'var(--color-danger-raw)',   text: 'var(--color-danger)' },
  yellow: { raw: 'var(--color-warning-raw)',  text: 'var(--color-warning)' },
  blue:   { raw: 'var(--color-info-raw)',     text: 'var(--color-info)' },
  purple: { raw: 'var(--color-purple-raw)',   text: 'rgba(var(--color-purple-raw), 1)' },
  slate:  { raw: 'var(--color-slate-raw)',    text: 'rgba(var(--color-slate-raw), 1)' },
  pink:   { raw: 'var(--color-pink-raw)',     text: 'rgba(var(--color-pink-raw), 1)' },
  amber:  { raw: 'var(--color-amber-raw)',    text: 'rgba(var(--color-amber-raw), 1)' },
}

/** Build a badge/chip CSSProperties from a palette key */
export function paletteStyle(key: PaletteKey, bgAlpha = 0.10, borderAlpha_ = 0.20): React.CSSProperties {
  const p = palette[key]
  return {
    background: `rgba(${p.raw}, ${bgAlpha})`,
    color:       p.text,
    border:      `1px solid rgba(${p.raw}, ${borderAlpha_})`,
  }
}

// ── Pre-built component style objects ─────────────────────────────────────────
//   Import and spread these in JSX style={{}} instead of writing raw values.

export const styles = {
  /** Standard glass/panel card */
  card: {
    background:     surface.card,
    border:         border.card,
    borderRadius:   radius.lg,
    backdropFilter: 'var(--card-backdrop)',
    boxShadow:      shadow.card,
  } as React.CSSProperties,

  /** Modal panel */
  modal: {
    background:     surface.card,
    border:         border.medium,
    backdropFilter: 'var(--card-backdrop)',
    boxShadow:      shadow.modal,
  } as React.CSSProperties,

  /** Modal backdrop overlay */
  modalBackdrop: {
    background:     surface.overlay,
    backdropFilter: 'var(--modal-backdrop)',
  } as React.CSSProperties,

  /** Sidebar panel */
  sidebar: {
    background:     surface.sidebar,
    borderRight:    `1px solid ${border.sidebar}`,
    backdropFilter: 'var(--sidebar-backdrop)',
  } as React.CSSProperties,

  /** Mobile top-bar header */
  mobileHeader: {
    background:     surface.mobileHeader,
    borderBottom:   `1px solid ${border.sidebar}`,
    backdropFilter: 'var(--header-backdrop)',
  } as React.CSSProperties,

  /** Coral CTA primary button */
  buttonPrimary: {
    background: gradient.buttonCta,
    color:      '#ffffff',
    boxShadow:  shadow.buttonCta,
    border:     `1px solid ${ctaAlpha(0.25)}`,
  } as React.CSSProperties,

  /** Teal accent button (secondary action) */
  buttonSecondary: {
    background: accentAlpha(0.08),
    color:      colors.accent,
    border:     `1px solid ${accentAlpha(0.20)}`,
  } as React.CSSProperties,

  /** Danger button */
  buttonDanger: {
    background: dangerAlpha(0.10),
    color:      colors.status.danger,
    border:     `1px solid ${dangerAlpha(0.25)}`,
  } as React.CSSProperties,

  /** Ghost / text-only button */
  buttonGhost: {
    background: 'transparent',
    color:      colors.text.muted,
    border:     '1px solid transparent',
  } as React.CSSProperties,

  /** Logo icon badge (teal→sky gradient) */
  logoBadge: {
    background: gradient.logo,
    boxShadow:  shadow.logo,
  } as React.CSSProperties,

  /**
   * Primary tab navigation (underline style).
   * Container must have className="flex border-b" + style={{ borderColor: border.divider }}.
   * Each button must have className="... -mb-px" so the 2px active border overlaps
   * the container's 1px bottom border, producing a clean underline effect.
   */
  tabActive: {
    color:        colors.accent,
    borderBottom: `2px solid ${colors.accent}`,
  } as React.CSSProperties,

  tabInactive: {
    color:        colors.text.muted,
    borderBottom: '2px solid transparent',
  } as React.CSSProperties,

  /** Active nav item */
  navActive: {
    background: accentAlpha(0.10),
    color:      colors.accent,
    border:     `1px solid ${accentAlpha(0.22)}`,
    boxShadow:  shadow.navActive,
  } as React.CSSProperties,

  /** Inactive nav item */
  navInactive: {
    color:  colors.textLight.muted,
    border: '1px solid transparent',
  } as React.CSSProperties,

  /** Empty-state icon container */
  emptyIcon: {
    background: accentAlpha(0.08),
    color:      colors.accent,
  } as React.CSSProperties,

  /** User avatar initials circle */
  avatar: {
    background: accentAlpha(0.12),
    color:      colors.accent,
  } as React.CSSProperties,

  /** Active role chip in role-switcher */
  roleChipActive: {
    background: accentAlpha(0.08),
    color:      colors.accent,
    border:     `1px solid ${accentAlpha(0.22)}`,
  } as React.CSSProperties,

  /** "active" label inside role chip */
  roleActiveBadge: {
    background: accentAlpha(0.14),
    color:      colors.accent,
  } as React.CSSProperties,

  /**
   * Filter chips — sub-filtering within a section.
   * Both states have a visible border; active gets an accent tint.
   * Use className="rounded-full px-3 py-1.5 text-xs font-medium transition-all".
   */
  filterTabActive: {
    background: accentAlpha(0.09),
    color:      colors.accent,
    border:     `1px solid ${accentAlpha(0.28)}`,
  } as React.CSSProperties,

  filterTabInactive: {
    background: 'transparent',
    color:      colors.text.muted,
    border:     `1px solid ${borderAlpha(0.14)}`,
  } as React.CSSProperties,

  /** Appointment time block */
  timeBlock: {
    background: accentAlpha(0.07),
    border:     `1px solid ${accentAlpha(0.12)}`,
  } as React.CSSProperties,

  /** Slot count badge on therapist card */
  slotBadge: {
    background: accentAlpha(0.08),
    color:      colors.accent,
    border:     `1px solid ${accentAlpha(0.20)}`,
  } as React.CSSProperties,
} as const
