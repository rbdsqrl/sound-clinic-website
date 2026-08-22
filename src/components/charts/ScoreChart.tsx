import { useMemo, useState } from 'react'
import { colors, border, surface } from '../../theme'
import { scoreColor } from '../ui/PerformanceScore'

const PAD = { top: 16, right: 16, bottom: 30, left: 40 }

export interface ScorePoint {
  label: string
  /** 0-100, or null when nothing was scored in that period. */
  value: number | null
  /** Shown under the label in the tooltip. */
  meta?: string
}

/**
 * Session performance, 0-100.
 *
 * Two readings of the same data: `line` for the bucketed average over the chosen
 * granularity, `bars` for the raw score of each session. A period with nothing scored
 * arrives as null and is drawn as a gap, never as zero — a therapist who did not score
 * a session has not recorded a bad one.
 */
export default function ScoreChart({
  points, variant = 'line', height = 240,
}: {
  points: ScorePoint[]
  variant?: 'line' | 'bars'
  height?: number
}) {
  const [hover, setHover] = useState<number | null>(null)

  const width = Math.max(560, points.length * (variant === 'bars' ? 44 : 52))
  const plotW = width - PAD.left - PAD.right
  const plotH = height - PAD.top - PAD.bottom

  // Bars are centred inside their own band so the first one does not straddle the axis;
  // the line uses the full width so its end points sit on the edges.
  const x = (i: number) => {
    if (points.length <= 1) return PAD.left + plotW / 2
    return variant === 'bars'
      ? PAD.left + ((i + 0.5) * plotW) / points.length
      : PAD.left + (i * plotW) / (points.length - 1)
  }
  const y = (v: number) => PAD.top + ((100 - v) / 100) * plotH

  /** Contiguous runs of scored points, so gaps stay gaps. */
  const runs = useMemo(() => {
    const out: { i: number; v: number }[][] = []
    let cur: { i: number; v: number }[] = []
    points.forEach((p, i) => {
      if (p.value === null) { if (cur.length) out.push(cur); cur = [] }
      else cur.push({ i, v: p.value })
    })
    if (cur.length) out.push(cur)
    return out
  }, [points])

  const scored = points.filter(p => p.value !== null).length
  if (scored === 0) {
    return (
      <p className="py-8 text-center text-sm" style={{ color: colors.text.dim }}>
        No sessions scored in this window.
      </p>
    )
  }

  const barW = variant === 'bars'
    ? Math.max(6, Math.min(26, plotW / Math.max(points.length, 1) - 8))
    : 0

  return (
    <div className="overflow-x-auto">
      <svg width={width} height={height} role="img"
        aria-label="Session performance score over time">
        {/* Gridlines at the band boundaries, so a reader can place a value without counting */}
        {[0, 40, 60, 75, 90, 100].map(v => (
          <g key={v}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(v)} y2={y(v)}
              stroke={border.divider} strokeWidth={1} />
            <text x={PAD.left - 6} y={y(v) + 3} textAnchor="end"
              fontSize={10} fill={colors.text.dim}>{v}</text>
          </g>
        ))}

        {variant === 'line' ? (
          runs.map((run, ri) => {
            const d = run.map((p, k) => `${k === 0 ? 'M' : 'L'} ${x(p.i)} ${y(p.v)}`).join(' ')
            return (
              <g key={ri}>
                <path d={d} fill="none" stroke={colors.accent} strokeWidth={2}
                  strokeLinejoin="round" strokeLinecap="round" />
                {run.map(p => (
                  <circle key={p.i} cx={x(p.i)} cy={y(p.v)} r={hover === p.i ? 5 : 3.5}
                    fill={surface.card} stroke={colors.accent} strokeWidth={2} />
                ))}
              </g>
            )
          })
        ) : (
          points.map((p, i) => p.value === null ? null : (
            <rect key={i}
              x={x(i) - barW / 2}
              y={y(p.value)}
              width={barW}
              height={plotH + PAD.top - y(p.value)}
              rx={3}
              fill={scoreColor(p.value)}
              opacity={hover === null || hover === i ? 0.9 : 0.45}
            />
          ))
        )}

        {/* Hover targets — full-height columns so the pointer does not have to find the mark */}
        {points.map((p, i) => (
          <rect key={`h${i}`} x={x(i) - plotW / Math.max(points.length, 1) / 2}
            y={PAD.top} width={Math.max(plotW / Math.max(points.length, 1), 8)} height={plotH}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)} />
        ))}

        {/* X labels — thinned so they never collide */}
        {points.map((p, i) => {
          const step = Math.ceil(points.length / 12)
          if (i % step !== 0 && i !== points.length - 1) return null
          return (
            <text key={`l${i}`} x={x(i)} y={height - 10} textAnchor="middle"
              fontSize={10} fill={colors.text.dim}>{p.label}</text>
          )
        })}

        {hover !== null && points[hover].value !== null && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH}
              stroke={colors.accent} strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
            <text x={x(hover)} y={PAD.top - 4} textAnchor="middle"
              fontSize={11} fontWeight={700} fill={colors.text.heading}>
              {points[hover].value}%{points[hover].meta ? ` · ${points[hover].meta}` : ''}
            </text>
          </g>
        )}
      </svg>
    </div>
  )
}
