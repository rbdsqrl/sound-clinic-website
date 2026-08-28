import type { ReactNode } from 'react'
import { colors, border, surface, radius } from '../../theme'
import { Spinner } from '../../components/ui/Spinner'

/** Consistent in-place loading indicator for a panel/section still waiting on its query. */
export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8">
      <Spinner size="sm" />
      <span className="text-xs" style={{ color: colors.text.dim }}>{label}</span>
    </div>
  )
}

/** Compact KPI tile. `hint` carries the qualifier the number needs to be read honestly. */
export function Tile({ label, value, hint, tone = 'neutral' }: {
  label: string
  value: ReactNode
  hint?: ReactNode
  tone?: 'neutral' | 'good' | 'warn'
}) {
  const hintColor =
    tone === 'good' ? colors.status.success
    : tone === 'warn' ? colors.status.warning
    : colors.text.muted

  return (
    <div className="p-4" style={{ background: surface.card, border: border.card, borderRadius: radius.md }}>
      <p className="text-xs uppercase tracking-wider" style={{ color: colors.text.dim }}>{label}</p>
      <p className="mt-1.5 text-2xl font-bold leading-none" style={{ color: colors.text.heading, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </p>
      {hint && <p className="mt-1.5 text-xs" style={{ color: hintColor, fontVariantNumeric: 'tabular-nums' }}>{hint}</p>}
    </div>
  )
}

export function Panel({ title, subtitle, action, children }: {
  title: string
  subtitle?: ReactNode
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section
      className="p-4 md:p-5"
      style={{ background: surface.card, border: border.card, borderRadius: radius.md }}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold" style={{ color: colors.text.heading }}>{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs" style={{ color: colors.text.dim }}>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

/** Renders a metric that may legitimately be absent, without inventing a zero. */
export function Metric({ value, suffix = '', empty = 'No data' }: {
  value: number | null
  suffix?: string
  empty?: string
}) {
  if (value === null) return <span style={{ color: colors.text.dim }}>{empty}</span>
  return <>{value}{suffix}</>
}

export function Delta({ pts }: { pts: number | null }) {
  if (pts === null) return <span style={{ color: colors.text.dim }}>—</span>
  if (pts === 0) return <span style={{ color: colors.text.muted }}>No change</span>
  const up = pts > 0
  return (
    <span style={{ color: up ? colors.status.success : colors.status.danger }}>
      {up ? '▲' : '▼'} {Math.abs(pts)} pts
    </span>
  )
}
