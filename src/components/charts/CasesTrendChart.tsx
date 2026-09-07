import { useMemo, useRef, useState } from 'react'
import { colors, border, surface } from '../../theme'

export interface CaseTrendSeries {
  id: string
  name: string
  color: string
  /** One value per period, aligned by index to the `periods` prop — null is "not logged". */
  values: (number | null)[]
}

interface Props {
  periods: { label: string }[]
  series: CaseTrendSeries[]
  /** Fixed axis ceiling for a percentage metric (100), or omit for an auto count-based one. */
  yMax?: number
  valueSuffix?: string
  height?: number
}

const PAD = { top: 16, right: 16, bottom: 30, left: 40 }

/**
 * One line per case, colour-coded, sharing one time axis — the "Cases" tab's overview of
 * every active case at once, as opposed to the single-case drill-in's one-line chart.
 *
 * Each case's progress loads independently (one query per case), so `series` grows as
 * results arrive — this renders whatever it's given rather than waiting for a "totals"
 * shape, which is what lets lines appear one by one instead of blocking on the slowest case.
 */
export default function CasesTrendChart({ periods, series, yMax, valueSuffix = '', height = 280 }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<number | null>(null)

  const resolvedMax = yMax ?? Math.max(
    4,
    ...series.flatMap(s => s.values.filter((v): v is number => v !== null)),
  )

  const width = Math.max(560, periods.length * 52)
  const plotW = width - PAD.left - PAD.right
  const plotH = height - PAD.top - PAD.bottom

  const x = (i: number) =>
    periods.length <= 1 ? PAD.left + plotW / 2 : PAD.left + (i * plotW) / (periods.length - 1)
  const y = (v: number) => PAD.top + (1 - v / resolvedMax) * plotH

  /** Contiguous runs of non-null values per series — a gap in one case's log shouldn't draw
   *  a false line through it, but shouldn't break every other case's line either. */
  const runsBySeries = useMemo(
    () => series.map(s => {
      const out: { i: number; v: number }[][] = []
      let current: { i: number; v: number }[] = []
      s.values.forEach((v, i) => {
        if (v === null) {
          if (current.length) out.push(current)
          current = []
        } else {
          current.push({ i, v })
        }
      })
      if (current.length) out.push(current)
      return out
    }),
    [series],
  )

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect || periods.length === 0) return
    const px = ((e.clientX - rect.left) / rect.width) * width
    const ratio = (px - PAD.left) / (plotW || 1)
    const idx = Math.round(ratio * (periods.length - 1))
    setHover(Math.min(periods.length - 1, Math.max(0, idx)))
  }

  const tick = periods.length > 14 ? Math.ceil(periods.length / 8) : 1

  const ticks = resolvedMax <= 4
    ? Array.from({ length: resolvedMax + 1 }, (_, i) => i)
    : [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(f * resolvedMax))

  const activeRows = hover !== null
    ? series
        .map(s => ({ name: s.name, color: s.color, value: s.values[hover!] }))
        .filter(r => r.value !== null)
        .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
    : []

  if (periods.length === 0 || series.length === 0) {
    return (
      <div className="flex items-center justify-center py-10">
        <p className="text-sm" style={{ color: colors.text.dim }}>No case data in this window yet.</p>
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
        aria-label="Case trend comparison"
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
        style={{ display: 'block' }}
      >
        {/* Gridlines */}
        {ticks.map(v => (
          <g key={v}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(v)} y2={y(v)} stroke={border.divider} strokeWidth={1} />
            <text x={PAD.left - 8} y={y(v) + 3} textAnchor="end" fontSize={10} fill={colors.text.dim}
              style={{ fontVariantNumeric: 'tabular-nums' }}>
              {v}{valueSuffix}
            </text>
          </g>
        ))}

        {/* One path per case */}
        {series.map((s, si) =>
          runsBySeries[si].map((run, ri) => {
            const line = run.map((p, j) => `${j === 0 ? 'M' : 'L'}${x(p.i)},${y(p.v)}`).join(' ')
            return (
              <path key={`${s.id}-${ri}`} d={line} fill="none" stroke={s.color} strokeWidth={2}
                strokeLinecap="round" strokeLinejoin="round" opacity={hover !== null ? 0.35 : 0.9} />
            )
          }),
        )}

        {/* Highlighted points at the hovered period */}
        {hover !== null && series.map(s => {
          const v = s.values[hover]
          if (v === null) return null
          return (
            <circle key={s.id} cx={x(hover)} cy={y(v)} r={4} fill={s.color} stroke={surface.card} strokeWidth={1.5} />
          )
        })}

        {/* Crosshair */}
        {hover !== null && (
          <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH}
            stroke={colors.text.dim} strokeWidth={1} strokeDasharray="3 3" pointerEvents="none" />
        )}

        {/* X labels */}
        {periods.map((p, i) =>
          i % tick === 0 ? (
            <text key={i} x={x(i)} y={height - 10} textAnchor="middle" fontSize={10} fill={colors.text.dim}>
              {p.label}
            </text>
          ) : null
        )}
      </svg>

      {/* Tooltip — every case's value at the hovered period, highest first */}
      {hover !== null && activeRows.length > 0 && (
        <div
          className="pointer-events-none absolute z-10 max-h-56 overflow-y-auto rounded-lg px-3 py-2 text-xs shadow-lg"
          style={{
            background: surface.card, border: border.card, color: colors.text.primary,
            left: Math.min(Math.max((x(hover) / width) * 100, 4), 70) + '%', top: 8, minWidth: 170,
          }}
        >
          <div className="mb-1 font-semibold" style={{ color: colors.text.heading }}>{periods[hover].label}</div>
          {activeRows.map(r => (
            <div key={r.name} className="mt-0.5 flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: r.color }} />
                <span className="truncate">{r.name}</span>
              </span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.value}{valueSuffix}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
