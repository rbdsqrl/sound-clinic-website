import { useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { colors, border, surface, palette, type PaletteKey } from '../../theme'
import type { SessionsTrendPoint } from '../../types'

const STATUS_META: Record<string, { label: string; color: PaletteKey }> = {
  COMPLETED:              { label: 'Completed',            color: 'green' },
  SCHEDULED:              { label: 'Scheduled',             color: 'blue' },
  CANCELLED:              { label: 'Cancelled',             color: 'red' },
  NO_SHOW:                { label: 'No-show',                color: 'pink' },
  PENDING_RESCHEDULE:     { label: 'Pending reschedule',    color: 'amber' },
  CANCELLATION_REQUESTED: { label: 'Cancellation requested', color: 'yellow' },
}
// Stacking order, bottom to top — the outcome that actually happened grounds the bar,
// with the statuses that mean "didn't happen (yet)" built up above it.
const STATUS_ORDER = ['COMPLETED', 'SCHEDULED', 'PENDING_RESCHEDULE', 'CANCELLATION_REQUESTED', 'CANCELLED', 'NO_SHOW']

const PAD = { top: 12, right: 12, bottom: 26, left: 32 }
const SLOT = 30

/** Rounds a max value up to a "nice" gridline-friendly number (4-5 gridlines). */
function niceMax(value: number): number {
  if (value <= 5) return 5
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)))
  const step = magnitude / 2
  return Math.ceil(value / step) * step
}

export default function SessionStatusChart({ points, height = 220 }: { points: SessionsTrendPoint[]; height?: number }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<number | null>(null)

  if (points.length === 0) {
    return (
      <div className="flex items-center justify-center py-10">
        <p className="text-sm" style={{ color: colors.text.dim }}>No sessions in this window.</p>
      </div>
    )
  }

  const totals = points.map(p => Object.values(p.byStatus).reduce((a, b) => a + b, 0))
  const max = niceMax(Math.max(1, ...totals))
  const gridTicks = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(f * max))
  const statusesPresent = STATUS_ORDER.filter(s => points.some(p => (p.byStatus[s] ?? 0) > 0))

  const width = Math.max(480, points.length * SLOT)
  const plotW = width - PAD.left - PAD.right
  const plotH = height - PAD.top - PAD.bottom
  const slot = plotW / points.length
  const barWidth = Math.min(30, slot * 0.6)

  const xCenter = (i: number) => PAD.left + i * slot + slot / 2
  const yFor = (v: number) => PAD.top + (1 - v / max) * plotH

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const px = ((e.clientX - rect.left) / rect.width) * width
    const idx = Math.floor((px - PAD.left) / slot)
    setHover(Math.min(points.length - 1, Math.max(0, idx)))
  }

  const labelStep = points.length > 20 ? Math.ceil(points.length / 10) : points.length > 10 ? 2 : 1

  const hovered = hover !== null ? points[hover] : null
  const hoveredRows = hovered
    ? STATUS_ORDER
        .filter(s => (hovered.byStatus[s] ?? 0) > 0)
        .map(s => ({ status: s, label: STATUS_META[s].label, color: palette[STATUS_META[s].color].text, count: hovered.byStatus[s] }))
    : []
  const hoveredTotal = hoveredRows.reduce((a, r) => a + r.count, 0)

  return (
    <div>
      <div className="relative overflow-x-auto">
        <svg
          ref={svgRef}
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Sessions per day by status"
          onMouseMove={handleMove}
          onMouseLeave={() => setHover(null)}
          style={{ display: 'block' }}
        >
          {/* Gridlines */}
          {gridTicks.map(v => (
            <g key={v}>
              <line x1={PAD.left} x2={width - PAD.right} y1={yFor(v)} y2={yFor(v)} stroke={border.divider} strokeWidth={1} />
              <text x={PAD.left - 8} y={yFor(v) + 3} textAnchor="end" fontSize={10} fill={colors.text.dim}
                style={{ fontVariantNumeric: 'tabular-nums' }}>
                {v}
              </text>
            </g>
          ))}

          {/* Hover column highlight */}
          {hover !== null && (
            <rect
              x={PAD.left + hover * slot} y={PAD.top} width={slot} height={plotH}
              fill={colors.text.dim} opacity={0.06}
            />
          )}

          {/* Stacked bars */}
          {points.map((p, i) => {
            let cumulative = 0
            const isHovered = hover === i
            return (
              <g key={p.date} opacity={hover !== null && !isHovered ? 0.55 : 1} style={{ transition: 'opacity 120ms' }}>
                {STATUS_ORDER.filter(s => (p.byStatus[s] ?? 0) > 0).map(status => {
                  const count = p.byStatus[status]
                  const y0 = yFor(cumulative)
                  cumulative += count
                  const y1 = yFor(cumulative)
                  return (
                    <rect
                      key={status}
                      x={xCenter(i) - barWidth / 2}
                      y={y1}
                      width={barWidth}
                      height={Math.max(1.5, y0 - y1)}
                      fill={palette[STATUS_META[status].color].text}
                    />
                  )
                })}
              </g>
            )
          })}

          {/* X labels */}
          {points.map((p, i) =>
            i % labelStep === 0 ? (
              <text key={p.date} x={xCenter(i)} y={height - 8} textAnchor="middle" fontSize={10} fill={colors.text.dim}>
                {format(parseISO(p.date + 'T00:00:00'), 'd MMM')}
              </text>
            ) : null
          )}
        </svg>

        {/* Tooltip */}
        {hovered && hoveredRows.length > 0 && (
          <div
            className="pointer-events-none absolute z-10 rounded-lg px-3 py-2 text-xs shadow-lg"
            style={{
              background: surface.card, border: border.card, color: colors.text.primary,
              left: Math.min(Math.max((xCenter(hover!) / width) * 100, 8), 78) + '%', top: 4, minWidth: 150,
            }}
          >
            <div className="mb-1 flex items-center justify-between gap-4 font-semibold" style={{ color: colors.text.heading }}>
              <span>{format(parseISO(hovered.date + 'T00:00:00'), 'EEE, d MMM')}</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{hoveredTotal}</span>
            </div>
            {hoveredRows.map(r => (
              <div key={r.status} className="mt-0.5 flex items-center justify-between gap-4">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: r.color }} />
                  <span className="truncate" style={{ color: colors.text.muted }}>{r.label}</span>
                </span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {statusesPresent.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
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
