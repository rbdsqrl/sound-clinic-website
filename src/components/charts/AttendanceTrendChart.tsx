import { useRef, useState } from 'react'
import { colors, border, surface } from '../../theme'

export interface AttendanceTrendPoint {
  /** "YYYY-MM-DD" — used as the React key and for the tooltip date line. */
  date: string
  /** Short x-axis label, e.g. "12 Sep". */
  label: string
  /** null renders as a gap in the line (e.g. an absent day), never a drop to zero. */
  value: number | null
}

interface Props {
  points: AttendanceTrendPoint[]
  height?: number
  /** Shown in the tooltip next to the value, e.g. "Hours" or "Check-in". */
  valueLabel: string
  formatValue: (v: number) => string
  /** Y-axis tick values. Defaults to 5 evenly-spaced ticks across the data's own min/max. */
  yTicks?: number[]
  accentColor?: string
  /** Reserved width for y-axis labels. Widen this for longer labels (e.g. "12:53 AM") so they
   * don't clip against the left edge — the default only comfortably fits short ones like "0.7h". */
  padLeft?: number
}

const PAD = { top: 16, right: 16, bottom: 30 }

/** Small inline SVG line chart — same shape as MasteryTrendChart, generalised to any numeric range. */
export default function AttendanceTrendChart({ points, height = 200, valueLabel, formatValue, yTicks, accentColor = colors.accent, padLeft = 44 }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  const pad = { ...PAD, left: padLeft }

  const width = Math.max(480, points.length * 44)
  const plotW = width - pad.left - pad.right
  const plotH = height - pad.top - pad.bottom

  const values = points.map(p => p.value).filter((v): v is number => v !== null)
  const dataMin = values.length ? Math.min(...values) : 0
  const dataMax = values.length ? Math.max(...values) : 1
  // Pad the range a little so points don't sit flush against the top/bottom edge.
  const span = dataMax - dataMin || 1
  const yMin = dataMin - span * 0.15
  const yMax = dataMax + span * 0.15
  const ticks = yTicks ?? Array.from({ length: 5 }, (_, i) => Math.round((yMin + (span * 1.3 * i) / 4) * 10) / 10)

  const x = (i: number) => points.length <= 1 ? pad.left + plotW / 2 : pad.left + (i * plotW) / (points.length - 1)
  const y = (v: number) => pad.top + ((yMax - v) / (yMax - yMin || 1)) * plotH

  const runs: { i: number; v: number }[][] = []
  let current: { i: number; v: number }[] = []
  points.forEach((p, i) => {
    if (p.value === null) {
      if (current.length) runs.push(current)
      current = []
    } else {
      current.push({ i, v: p.value })
    }
  })
  if (current.length) runs.push(current)

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect || points.length === 0) return
    const px = ((e.clientX - rect.left) / rect.width) * width
    const ratio = (px - pad.left) / (plotW || 1)
    const idx = Math.round(ratio * (points.length - 1))
    setHover(Math.min(points.length - 1, Math.max(0, idx)))
  }

  const tick = points.length > 14 ? Math.ceil(points.length / 8) : 1
  const active = hover !== null ? points[hover] : null

  // No real values anywhere (every day absent) — bail before the y-axis math below, which
  // otherwise falls back to a meaningless 0-1 range and can format nonsense tick labels.
  if (points.length === 0 || values.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm" style={{ height, color: colors.text.dim }}>
        No data for this period
      </div>
    )
  }

  return (
    <div className="relative overflow-x-auto">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${valueLabel} from ${points[0]?.label ?? ''} to ${points[points.length - 1]?.label ?? ''}`}
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
        style={{ display: 'block' }}
      >
        {/* Gridlines */}
        {ticks.map(v => (
          <g key={v}>
            <line x1={pad.left} x2={width - pad.right} y1={y(v)} y2={y(v)} stroke={border.divider} strokeWidth={1} />
            <text x={pad.left - 8} y={y(v) + 3} textAnchor="end" fontSize={10} fill={colors.text.dim}
              style={{ fontVariantNumeric: 'tabular-nums' }}>
              {formatValue(v)}
            </text>
          </g>
        ))}

        {/* Area + line, one path per contiguous run so absent gaps stay gaps */}
        {runs.map((run, k) => {
          const line = run.map((p, j) => `${j === 0 ? 'M' : 'L'}${x(p.i)},${y(p.v)}`).join(' ')
          const area = `${line} L${x(run[run.length - 1].i)},${y(yMin)} L${x(run[0].i)},${y(yMin)} Z`
          return (
            <g key={`run-${k}`}>
              <path d={area} fill={accentColor} opacity={0.12} />
              <path d={line} fill="none" stroke={accentColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              {run.map(p => (
                <circle key={p.i} cx={x(p.i)} cy={y(p.v)} r={2.5} fill={accentColor} />
              ))}
            </g>
          )
        })}

        {/* Crosshair */}
        {active && (
          <g pointerEvents="none">
            <line x1={x(hover!)} x2={x(hover!)} y1={pad.top} y2={pad.top + plotH}
              stroke={colors.text.dim} strokeWidth={1} strokeDasharray="3 3" />
            {active.value !== null && (
              <circle cx={x(hover!)} cy={y(active.value)} r={4.5} fill={accentColor} stroke={surface.card} strokeWidth={2} />
            )}
          </g>
        )}

        {/* X labels */}
        {points.map((p, i) =>
          i % tick === 0 ? (
            <text key={p.date} x={x(i)} y={height - 10} textAnchor="middle" fontSize={10} fill={colors.text.dim}>
              {p.label}
            </text>
          ) : null
        )}
      </svg>

      {/* Tooltip */}
      {active && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg px-3 py-2 text-xs shadow-lg"
          style={{
            background: surface.card, border: border.card, color: colors.text.primary,
            left: Math.min(Math.max((x(hover!) / width) * 100, 4), 78) + '%', top: 8, minWidth: 130,
          }}
        >
          <div className="font-semibold" style={{ color: colors.text.heading }}>{active.date}</div>
          <div className="mt-1 flex justify-between gap-4">
            <span style={{ color: colors.text.muted }}>{valueLabel}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
              {active.value === null ? 'Absent' : formatValue(active.value)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
