import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { colors, palette, border, type PaletteKey } from '../../theme'
import type { SessionsTrendPoint } from '../../types'

const STATUS_META: Record<string, { label: string; color: PaletteKey }> = {
  COMPLETED:              { label: 'Completed',            color: 'green' },
  SCHEDULED:              { label: 'Scheduled',             color: 'blue' },
  CANCELLED:              { label: 'Cancelled',             color: 'red' },
  NO_SHOW:                { label: 'No-show',                color: 'pink' },
  PENDING_RESCHEDULE:     { label: 'Pending reschedule',    color: 'amber' },
  CANCELLATION_REQUESTED: { label: 'Cancellation requested', color: 'yellow' },
}
const STATUS_ORDER = Object.keys(STATUS_META)

const CHART_H = 200
const BAR_GAP = 10

/** Rounds a max value up to a "nice" gridline-friendly number (4-5 gridlines). */
function niceMax(value: number): number {
  if (value <= 5) return 5
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)))
  const step = magnitude / 2
  return Math.ceil(value / step) * step
}

export default function SessionStatusChart({ points }: { points: SessionsTrendPoint[] }) {
  const [hover, setHover] = useState<{ date: string; status: string } | null>(null)

  const totals = points.map(p => Object.values(p.byStatus).reduce((a, b) => a + b, 0))
  const max = niceMax(Math.max(1, ...totals))
  const gridlines = 4
  const statusesPresent = STATUS_ORDER.filter(s => points.some(p => (p.byStatus[s] ?? 0) > 0))

  if (points.length === 0) {
    return <p className="py-8 text-center text-sm" style={{ color: colors.text.dim }}>No sessions in this window.</p>
  }

  return (
    <div>
      <div className="flex gap-3">
        {/* Y axis */}
        <div className="flex flex-col justify-between text-right text-xs flex-shrink-0" style={{ height: CHART_H, color: colors.text.dim }}>
          {Array.from({ length: gridlines + 1 }, (_, i) => (
            <span key={i}>{Math.round(max - (max / gridlines) * i)}</span>
          ))}
        </div>

        {/* Bars */}
        <div className="relative flex-1 flex items-end" style={{ height: CHART_H }}>
          {/* Gridlines */}
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
            {Array.from({ length: gridlines + 1 }, (_, i) => (
              <div key={i} className="w-full" style={{ borderTop: `1px solid ${border.divider}` }} />
            ))}
          </div>

          <div className="relative flex flex-1 items-end h-full" style={{ gap: BAR_GAP }}>
            {points.map(p => {
              const dayTotal = Object.values(p.byStatus).reduce((a, b) => a + b, 0)
              return (
                <div key={p.date} className="flex-1 flex flex-col items-center justify-end h-full min-w-0">
                  <div className="w-full flex flex-col justify-end" style={{ height: CHART_H, maxWidth: 32 }}>
                    {STATUS_ORDER.filter(s => (p.byStatus[s] ?? 0) > 0).reverse().map((status, i, arr) => {
                      const count = p.byStatus[status]
                      const h = (count / max) * CHART_H
                      const isTop = i === arr.length - 1
                      const isHovered = hover?.date === p.date && hover?.status === status
                      return (
                        <div
                          key={status}
                          onMouseEnter={() => setHover({ date: p.date, status })}
                          onMouseLeave={() => setHover(null)}
                          style={{
                            height: Math.max(2, h),
                            background: `rgba(${palette[STATUS_META[status].color].raw}, ${isHovered ? 1 : 0.75})`,
                            borderTopLeftRadius: isTop ? 4 : 0,
                            borderTopRightRadius: isTop ? 4 : 0,
                            cursor: 'default',
                            transition: 'opacity 100ms',
                          }}
                          title={`${STATUS_META[status].label}: ${count}`}
                        />
                      )
                    })}
                  </div>
                  <span className="mt-2 text-xs whitespace-nowrap" style={{ color: colors.text.dim }}>
                    {format(parseISO(p.date + 'T00:00:00'), 'd MMM')}
                  </span>
                  <span className="text-[11px] font-medium" style={{ color: colors.text.muted }}>
                    {hover?.date === p.date ? `${STATUS_META[hover.status].label}: ${p.byStatus[hover.status]}` : dayTotal}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {statusesPresent.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5">
          {statusesPresent.map(s => (
            <span key={s} className="flex items-center gap-1.5 text-xs" style={{ color: colors.text.muted }}>
              <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: palette[STATUS_META[s].color].text }} />
              {STATUS_META[s].label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
