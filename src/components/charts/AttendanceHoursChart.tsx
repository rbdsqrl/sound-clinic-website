import { useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { colors, border, surface, palette, accentAlpha, warningAlpha } from '../../theme'
import { formatTime } from '../../lib/format'

/** Why a day isn't an ordinary working day. */
export type NonWorkingKind = 'weeklyOff' | 'holiday' | 'leave'

export interface AttendanceHoursDay {
  /** "YYYY-MM-DD". */
  date: string
  /** Short x-axis label, e.g. "12 Sep". */
  label: string
  /** Hours between check-in and check-out; null when either is missing. */
  hours: number | null
  checkIn: string | null
  checkOut: string | null
  /** Set on weekly-off days, public holidays and approved leave days. */
  kind: NonWorkingKind | null
  /** Holiday name or leave type, shown in the tooltip. */
  kindNote?: string
}

interface Props {
  days: AttendanceHoursDay[]
  height?: number
}

const PAD = { top: 16, right: 16, bottom: 30, left: 44 }

const KIND_LABEL: Record<NonWorkingKind, string> = { weeklyOff: 'Weekly off', holiday: 'Holiday', leave: 'Leave' }
const KIND_FILL: Record<NonWorkingKind, string> = {
  weeklyOff: `rgba(${palette.slate.raw}, 0.16)`,
  holiday:   warningAlpha(0.16),
  leave:     `rgba(${palette.purple.raw}, 0.16)`,
}
const KIND_SWATCH: Record<NonWorkingKind, string> = {
  weeklyOff: `rgba(${palette.slate.raw}, 0.5)`,
  holiday:   warningAlpha(0.6),
  leave:     `rgba(${palette.purple.raw}, 0.5)`,
}

function formatHours(h: number): string {
  const whole = Math.floor(h)
  const mins = Math.round((h - whole) * 60)
  return mins === 60 ? `${whole + 1}h 00m` : `${whole}h ${String(mins).padStart(2, '0')}m`
}

/**
 * Hours worked per day as a histogram — one bar per calendar day, y-axis in whole hours with a gridline every hour.
 * Weekly-off days, public holidays and approved leave are shaded as full-height bands, so an empty bar reads as
 * "not a working day" rather than "absent". Hover shows the day's check-in/out times and hours.
 */
export default function AttendanceHoursChart({ days, height = 240 }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<number | null>(null)

  const width = Math.max(480, days.length * 44)
  const plotW = width - PAD.left - PAD.right
  const plotH = height - PAD.top - PAD.bottom

  const maxHours = Math.max(0, ...days.map(d => d.hours ?? 0))
  const yMax = Math.max(4, Math.ceil(maxHours))
  const ticks = Array.from({ length: yMax + 1 }, (_, i) => i)

  const band = days.length ? plotW / days.length : plotW
  const x = (i: number) => PAD.left + i * band
  const y = (h: number) => PAD.top + ((yMax - h) / yMax) * plotH

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect || days.length === 0) return
    const px = ((e.clientX - rect.left) / rect.width) * width
    const idx = Math.floor((px - PAD.left) / band)
    setHover(idx >= 0 && idx < days.length ? idx : null)
  }

  if (days.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm" style={{ height, color: colors.text.dim }}>
        No data for this period
      </div>
    )
  }

  const labelEvery = days.length > 14 ? Math.ceil(days.length / 8) : 1
  const active = hover !== null ? days[hover] : null
  const kindsPresent = (['weeklyOff', 'holiday', 'leave'] as NonWorkingKind[]).filter(k => days.some(d => d.kind === k))

  return (
    <div>
      <div className="relative overflow-x-auto">
        <svg
          ref={svgRef}
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`Hours worked per day from ${days[0].label} to ${days[days.length - 1].label}`}
          onMouseMove={handleMove}
          onMouseLeave={() => setHover(null)}
          style={{ display: 'block' }}
        >
          {/* Non-working day bands, behind everything */}
          {days.map((d, i) => d.kind && (
            <rect key={`band-${d.date}`} x={x(i)} y={PAD.top} width={band} height={plotH} style={{ fill: KIND_FILL[d.kind] }} />
          ))}

          {/* One gridline per hour */}
          {ticks.map(v => (
            <g key={v}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(v)} y2={y(v)} stroke={border.divider} strokeWidth={1} />
              <text x={PAD.left - 8} y={y(v) + 3} textAnchor="end" fontSize={10} fill={colors.text.dim}
                style={{ fontVariantNumeric: 'tabular-nums' }}>
                {v}h
              </text>
            </g>
          ))}

          {/* Histogram bars — touching, separated by a hairline in the card colour */}
          {days.map((d, i) => d.hours !== null && d.hours > 0 && (
            <rect
              key={`bar-${d.date}`}
              x={x(i)} y={y(d.hours)} width={band} height={y(0) - y(d.hours)}
              style={{ fill: palette.teal.text, stroke: surface.card, strokeWidth: 1 }}
              opacity={hover === i ? 1 : 0.8}
            />
          ))}

          {/* Hovered day outline */}
          {hover !== null && (
            <rect x={x(hover)} y={PAD.top} width={band} height={plotH} fill="none"
              style={{ stroke: accentAlpha(0.6) }} strokeWidth={1} pointerEvents="none" />
          )}

          {/* X labels */}
          {days.map((d, i) => i % labelEvery === 0 ? (
            <text key={d.date} x={x(i) + band / 2} y={height - 10} textAnchor="middle" fontSize={10} fill={colors.text.dim}>
              {d.label}
            </text>
          ) : null)}
        </svg>

        {/* Tooltip */}
        {active && hover !== null && (
          <div
            className="pointer-events-none absolute z-10 rounded-lg px-3 py-2 text-xs shadow-lg"
            style={{
              background: surface.card, border: border.card, color: colors.text.primary,
              left: Math.min(Math.max(((x(hover) + band / 2) / width) * 100, 4), 78) + '%', top: 8, minWidth: 150,
            }}
          >
            <div className="font-semibold" style={{ color: colors.text.heading }}>
              {format(parseISO(active.date), 'EEE d MMM yyyy')}
            </div>
            {active.kind && (
              <div className="mt-1" style={{ color: colors.text.muted }}>
                {KIND_LABEL[active.kind]}{active.kindNote ? ` · ${active.kindNote}` : ''}
              </div>
            )}
            <div className="mt-1 flex justify-between gap-4">
              <span style={{ color: colors.text.muted }}>Check-in</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{active.checkIn ? formatTime(active.checkIn) : '—'}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span style={{ color: colors.text.muted }}>Check-out</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{active.checkOut ? formatTime(active.checkOut) : '—'}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span style={{ color: colors.text.muted }}>Hours</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                {active.hours !== null ? formatHours(active.hours) : active.checkIn ? 'Not checked out' : active.kind ? '—' : 'Absent'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Legend for the shaded days actually present in this range */}
      {kindsPresent.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 mt-2 text-xs" style={{ color: colors.text.muted }}>
          {kindsPresent.map(k => (
            <span key={k} className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: KIND_SWATCH[k] }} />
              {KIND_LABEL[k]}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
