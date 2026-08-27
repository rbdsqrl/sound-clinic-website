import { useMemo, useRef, useState } from 'react'
import { colors, border, surface } from '../../theme'
import type { AnalyticsBucket } from '../../types'

interface Props {
  buckets: AnalyticsBucket[]
  height?: number
}

const PAD = { top: 16, right: 16, bottom: 30, left: 40 }

/**
 * Goal mastery over time.
 *
 * A period where nothing was logged arrives as `masteryPct: null` and is drawn as a break in
 * the line, never as a drop to zero — the series is split into contiguous runs so the fill and
 * stroke stop at the edge of the gap.
 */
export default function MasteryTrendChart({ buckets, height = 240 }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<number | null>(null)

  const width = Math.max(560, buckets.length * 52)
  const plotW = width - PAD.left - PAD.right
  const plotH = height - PAD.top - PAD.bottom

  const x = (i: number) =>
    buckets.length <= 1 ? PAD.left + plotW / 2 : PAD.left + (i * plotW) / (buckets.length - 1)
  const y = (v: number) => PAD.top + ((100 - v) / 100) * plotH

  /** Contiguous runs of populated buckets — each becomes its own path so gaps stay gaps. */
  const runs = useMemo(() => {
    const out: { i: number; v: number }[][] = []
    let current: { i: number; v: number }[] = []
    buckets.forEach((b, i) => {
      if (b.masteryPct === null) {
        if (current.length) out.push(current)
        current = []
      } else {
        current.push({ i, v: b.masteryPct })
      }
    })
    if (current.length) out.push(current)
    return out
  }, [buckets])

  /** Spans with no data at all, shaded so the break reads as absence rather than a rendering bug. */
  const gaps = useMemo(() => {
    const out: { from: number; to: number }[] = []
    let start: number | null = null
    buckets.forEach((b, i) => {
      if (b.masteryPct === null && start === null) start = i
      if (b.masteryPct !== null && start !== null) {
        out.push({ from: start, to: i - 1 })
        start = null
      }
    })
    if (start !== null) out.push({ from: start, to: buckets.length - 1 })
    return out
  }, [buckets])

  const lastPoint = runs.length ? runs[runs.length - 1][runs[runs.length - 1].length - 1] : null

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect || buckets.length === 0) return
    const px = ((e.clientX - rect.left) / rect.width) * width
    const ratio = (px - PAD.left) / (plotW || 1)
    const idx = Math.round(ratio * (buckets.length - 1))
    setHover(Math.min(buckets.length - 1, Math.max(0, idx)))
  }

  const tick = buckets.length > 14 ? Math.ceil(buckets.length / 8) : 1
  const active = hover !== null ? buckets[hover] : null

  return (
    <div className="relative overflow-x-auto">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Goal mastery from ${buckets[0]?.label ?? ''} to ${buckets[buckets.length - 1]?.label ?? ''}`}
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
        style={{ display: 'block' }}
      >
        {/* Gridlines */}
        {[0, 25, 50, 75, 100].map(v => (
          <g key={v}>
            <line
              x1={PAD.left} x2={width - PAD.right} y1={y(v)} y2={y(v)}
              stroke={border.divider} strokeWidth={1}
            />
            <text
              x={PAD.left - 8} y={y(v) + 3} textAnchor="end"
              fontSize={10} fill={colors.text.dim}
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {v}
            </text>
          </g>
        ))}

        {/* No-data spans */}
        {gaps.map((g, k) => {
          const x0 = g.from === 0 ? PAD.left : x(g.from - 1)
          const x1 = g.to === buckets.length - 1 ? width - PAD.right : x(g.to + 1)
          return (
            <g key={`gap-${k}`}>
              <rect
                x={x0} y={PAD.top} width={Math.max(0, x1 - x0)} height={plotH}
                fill={border.divider} opacity={0.22}
              />
              {x1 - x0 > 54 && (
                <text
                  x={(x0 + x1) / 2} y={PAD.top + plotH / 2}
                  textAnchor="middle" fontSize={10} fill={colors.text.dim}
                >
                  no data
                </text>
              )}
            </g>
          )
        })}

        {/* Area + line, one path per contiguous run */}
        {runs.map((run, k) => {
          const line = run.map((p, j) => `${j === 0 ? 'M' : 'L'}${x(p.i)},${y(p.v)}`).join(' ')
          const area = `${line} L${x(run[run.length - 1].i)},${y(0)} L${x(run[0].i)},${y(0)} Z`
          return (
            <g key={`run-${k}`}>
              <path d={area} fill={colors.accent} opacity={0.12} />
              <path
                d={line} fill="none" stroke={colors.accent} strokeWidth={2}
                strokeLinecap="round" strokeLinejoin="round"
              />
            </g>
          )
        })}

        {/* Emphasised endpoint */}
        {lastPoint && (
          <circle
            cx={x(lastPoint.i)} cy={y(lastPoint.v)} r={5}
            fill={colors.accent} stroke={surface.card} strokeWidth={2}
          />
        )}

        {/* Crosshair */}
        {active && (
          <g pointerEvents="none">
            <line
              x1={x(hover!)} x2={x(hover!)} y1={PAD.top} y2={PAD.top + plotH}
              stroke={colors.text.dim} strokeWidth={1} strokeDasharray="3 3"
            />
            {active.masteryPct !== null && (
              <circle
                cx={x(hover!)} cy={y(active.masteryPct)} r={4.5}
                fill={colors.accent} stroke={surface.card} strokeWidth={2}
              />
            )}
          </g>
        )}

        {/* X labels */}
        {buckets.map((b, i) =>
          i % tick === 0 ? (
            <text
              key={b.periodStart} x={x(i)} y={height - 10}
              textAnchor="middle" fontSize={10} fill={colors.text.dim}
            >
              {b.label}
            </text>
          ) : null
        )}
      </svg>

      {/* Tooltip */}
      {active && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg px-3 py-2 text-xs shadow-lg"
          style={{
            background: surface.card,
            border: border.card,
            color: colors.text.primary,
            left: Math.min(Math.max((x(hover!) / width) * 100, 4), 78) + '%',
            top: 8,
            minWidth: 150,
          }}
        >
          <div className="font-semibold" style={{ color: colors.text.heading }}>{active.label}</div>
          <div className="mt-1 flex justify-between gap-4">
            <span style={{ color: colors.text.muted }}>Mastery</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
              {active.masteryPct === null ? 'Not logged' : `${active.masteryPct}%`}
            </span>
          </div>
          {active.trialsTotal > 0 && (
            <div className="flex justify-between gap-4">
              <span style={{ color: colors.text.muted }}>Trials</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                {active.trialsPassed}/{active.trialsTotal}
              </span>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <span style={{ color: colors.text.muted }}>Sessions</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
              {active.sessionsCompleted} held
              {active.sessionsNoShow > 0 && `, ${active.sessionsNoShow} no-show`}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
