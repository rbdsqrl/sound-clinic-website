import { colors, border } from '../../theme'
import type { AnalyticsBucket } from '../../types'

interface Props {
  buckets: AnalyticsBucket[]
}

type Outcome = { key: string; label: string; color: string; count: (b: AnalyticsBucket) => number }

/**
 * Attendance context, sat next to the mastery trend on purpose: a flat line during a run of
 * no-shows is an attendance problem, not a clinical one, and the two charts have to be read
 * together to tell those apart.
 */
export default function OutcomeRibbon({ buckets }: Props) {
  const outcomes: Outcome[] = [
    { key: 'completed',   label: 'Completed',   color: colors.accent,        count: b => b.sessionsCompleted },
    { key: 'noShow',      label: 'No-show',     color: colors.status.danger, count: b => b.sessionsNoShow },
    { key: 'cancelled',   label: 'Cancelled',   color: colors.status.warning, count: b => b.sessionsCancelled },
    { key: 'rescheduled', label: 'Rescheduled', color: border.divider,       count: b => b.sessionsRescheduled },
  ]

  const max = Math.max(
    1,
    ...buckets.map(b => b.sessionsCompleted + b.sessionsNoShow + b.sessionsCancelled + b.sessionsRescheduled)
  )

  const barW = 22
  const gap = 6
  const height = 96
  const width = Math.max(280, buckets.length * (barW + gap))

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <svg width={width} height={height + 20} role="img" aria-label="Session outcomes per period" style={{ display: 'block' }}>
          {buckets.map((b, i) => {
            const x = i * (barW + gap)
            let yCursor = height
            return (
              <g key={b.periodStart}>
                {outcomes.map(o => {
                  const n = o.count(b)
                  if (n === 0) return null
                  const h = (n / max) * (height - 4)
                  yCursor -= h
                  return (
                    <rect
                      key={o.key}
                      x={x} y={yCursor} width={barW} height={Math.max(0, h - 2)}
                      rx={3} fill={o.color}
                    >
                      <title>{`${b.label} — ${n} ${o.label.toLowerCase()}`}</title>
                    </rect>
                  )
                })}
                {yCursor === height && (
                  <rect
                    x={x} y={height - 3} width={barW} height={3} rx={1.5}
                    fill={border.divider} opacity={0.5}
                  >
                    <title>{`${b.label} — no sessions`}</title>
                  </rect>
                )}
                <text
                  x={x + barW / 2} y={height + 14}
                  textAnchor="middle" fontSize={9} fill={colors.text.dim}
                >
                  {buckets.length <= 16 ? b.label : ''}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs" style={{ color: colors.text.muted }}>
        {outcomes.map(o => (
          <span key={o.key} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ background: o.color, border: o.key === 'rescheduled' ? border.card : undefined }}
            />
            {o.label}
          </span>
        ))}
      </div>
    </div>
  )
}
