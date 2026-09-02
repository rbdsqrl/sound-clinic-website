import { useMemo, useRef, useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { format, subDays } from 'date-fns'
import { analyticsApi } from '../../api/analytics'
import { colors, border, surface, palette, rgba, type PaletteKey } from '../../theme'
import { Spinner } from '../ui/Spinner'
import { EmptyState } from '../ui/EmptyState'
import { TrendingUp } from 'lucide-react'
import type { AnalyticsBucket } from '../../types'

interface ChildSummary { id: string; firstName: string; lastName: string }

interface Props {
  children: ChildSummary[]
}

const PAD = { top: 16, right: 16, bottom: 30, left: 40 }
const DAYS = 30
const COLOR_CYCLE: PaletteKey[] = ['teal', 'purple', 'blue', 'pink', 'green', 'amber', 'red', 'slate']

/**
 * Goal mastery over the last 30 days, one line per child, overlaid on the same axes —
 * a parent with more than one child can compare progress at a glance, or isolate one
 * child by toggling the others off in the legend.
 */
export default function ChildrenProgressChart({ children }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  const [hidden, setHidden] = useState<Set<string>>(new Set())

  const from = format(subDays(new Date(), DAYS - 1), 'yyyy-MM-dd')
  const to   = format(new Date(), 'yyyy-MM-dd')

  const results = useQueries({
    queries: children.map(c => ({
      queryKey: ['analytics-progress-30d', c.id, from, to],
      queryFn: () => analyticsApi.patientProgress(c.id, { granularity: 'DAILY', from, to }),
      staleTime: 5 * 60 * 1000,
    })),
  })

  const isLoading = results.some(r => r.isLoading)
  // Every child shares the same date range/granularity, so any successful series
  // defines the shared x-axis — buckets line up 1:1 across children by index.
  const buckets: AnalyticsBucket[] = results.find(r => r.data)?.data?.buckets ?? []

  const series = useMemo(
    () => children.map((c, i) => ({
      child: c,
      color: COLOR_CYCLE[i % COLOR_CYCLE.length],
      buckets: results[i]?.data?.buckets ?? [],
    })),
    [children, results]
  )

  const width = Math.max(560, buckets.length * 26)
  const plotW = width - PAD.left - PAD.right
  const plotH = 240 - PAD.top - PAD.bottom
  const height = 240

  const x = (i: number) =>
    buckets.length <= 1 ? PAD.left + plotW / 2 : PAD.left + (i * plotW) / (buckets.length - 1)
  const y = (v: number) => PAD.top + ((100 - v) / 100) * plotH

  /** Contiguous runs of populated buckets for one child's series — gaps stay gaps. */
  const runsFor = (childBuckets: AnalyticsBucket[]) => {
    const out: { i: number; v: number }[][] = []
    let current: { i: number; v: number }[] = []
    childBuckets.forEach((b, i) => {
      if (b.masteryPct === null) {
        if (current.length) out.push(current)
        current = []
      } else {
        current.push({ i, v: b.masteryPct })
      }
    })
    if (current.length) out.push(current)
    return out
  }

  const toggle = (childId: string) => {
    setHidden(prev => {
      const next = new Set(prev)
      next.has(childId) ? next.delete(childId) : next.add(childId)
      return next
    })
  }

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect || buckets.length === 0) return
    const px = ((e.clientX - rect.left) / rect.width) * width
    const ratio = (px - PAD.left) / (plotW || 1)
    const idx = Math.round(ratio * (buckets.length - 1))
    setHover(Math.min(buckets.length - 1, Math.max(0, idx)))
  }

  const tick = buckets.length > 14 ? Math.ceil(buckets.length / 8) : 1
  const visibleSeries = series.filter(s => !hidden.has(s.child.id))
  const hasAnyData = series.some(s => s.buckets.some(b => b.masteryPct !== null))

  if (isLoading) {
    return (
      <div className="flex items-center justify-center" style={{ height: 240 }}>
        <Spinner />
      </div>
    )
  }

  if (buckets.length === 0 || !hasAnyData) {
    return (
      <EmptyState
        icon={<TrendingUp size={22} />}
        title="No progress logged yet"
        description="Goal mastery will show up here once therapy sessions are logged for your children."
      />
    )
  }

  return (
    <div>
      {/* Legend — click a child to toggle their line */}
      {children.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {series.map(s => {
            const isHidden = hidden.has(s.child.id)
            const c = palette[s.color]
            return (
              <button
                key={s.child.id}
                type="button"
                onClick={() => toggle(s.child.id)}
                className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-opacity"
                style={{
                  background: isHidden ? 'transparent' : rgba(c.raw, 0.10),
                  border: `1px solid ${isHidden ? border.divider : rgba(c.raw, 0.25)}`,
                  color: isHidden ? colors.text.dim : c.text,
                  opacity: isHidden ? 0.6 : 1,
                }}
              >
                <span className="h-2 w-2 rounded-full flex-shrink-0"
                  style={{ background: isHidden ? colors.text.dim : c.text }} />
                {s.child.firstName} {s.child.lastName}
              </button>
            )
          })}
        </div>
      )}

      <div className="relative overflow-x-auto">
        <svg
          ref={svgRef}
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`Goal mastery over the last ${DAYS} days`}
          onMouseMove={handleMove}
          onMouseLeave={() => setHover(null)}
          style={{ display: 'block' }}
        >
          {/* Gridlines */}
          {[0, 25, 50, 75, 100].map(v => (
            <g key={v}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(v)} y2={y(v)} stroke={border.divider} strokeWidth={1} />
              <text x={PAD.left - 8} y={y(v) + 3} textAnchor="end" fontSize={10} fill={colors.text.dim}
                style={{ fontVariantNumeric: 'tabular-nums' }}>
                {v}
              </text>
            </g>
          ))}

          {/* One line per visible child, no fill — overlapping areas would just be noise */}
          {visibleSeries.map(s => {
            const runs = runsFor(s.buckets)
            const c = palette[s.color]
            return (
              <g key={s.child.id}>
                {runs.map((run, k) => (
                  <path
                    key={k}
                    d={run.map((p, j) => `${j === 0 ? 'M' : 'L'}${x(p.i)},${y(p.v)}`).join(' ')}
                    fill="none" stroke={c.text} strokeWidth={2}
                    strokeLinecap="round" strokeLinejoin="round"
                  />
                ))}
                {runs.length > 0 && (() => {
                  const last = runs[runs.length - 1][runs[runs.length - 1].length - 1]
                  return (
                    <circle cx={x(last.i)} cy={y(last.v)} r={4} fill={c.text} stroke={surface.card} strokeWidth={2} />
                  )
                })()}
              </g>
            )
          })}

          {/* Crosshair */}
          {hover !== null && (
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH}
              stroke={colors.text.dim} strokeWidth={1} strokeDasharray="3 3" pointerEvents="none" />
          )}

          {/* X labels */}
          {buckets.map((b, i) =>
            i % tick === 0 ? (
              <text key={b.periodStart} x={x(i)} y={height - 10} textAnchor="middle" fontSize={10} fill={colors.text.dim}>
                {b.label}
              </text>
            ) : null
          )}
        </svg>

        {/* Tooltip — one row per visible child at the hovered day */}
        {hover !== null && (
          <div
            className="pointer-events-none absolute z-10 rounded-lg px-3 py-2 text-xs shadow-lg"
            style={{
              background: surface.card, border: border.card, color: colors.text.primary,
              left: Math.min(Math.max((x(hover) / width) * 100, 4), 74) + '%', top: 8, minWidth: 160,
            }}
          >
            <div className="font-semibold mb-1" style={{ color: colors.text.heading }}>{buckets[hover]?.label}</div>
            {visibleSeries.map(s => {
              const v = s.buckets[hover]?.masteryPct
              const c = palette[s.color]
              return (
                <div key={s.child.id} className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-1.5 truncate" style={{ color: colors.text.muted }}>
                    <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: c.text }} />
                    {s.child.firstName}
                  </span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {v === null || v === undefined ? '—' : `${v}%`}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
