import { useMemo, useState } from 'react'
import { colors, border, accentAlpha } from '../../theme'
import { formatDateStr } from '../../lib/format'
import type { TrendPoint } from '../../types'

const CELL = 11
const GAP = 3
const MONTH_LABEL_H = 16

/**
 * GitHub-style calendar heatmap — one cell per day, coloured by session count, grouped into
 * week columns across the given date range. Missing days (no session) render as an empty cell,
 * not zero specially highlighted — the same "gap, not zero" convention as the line charts.
 */
export default function SessionHeatmap({ points, from, to }: { points: TrendPoint[]; from: string; to: string }) {
  const [hover, setHover] = useState<string | null>(null)

  const countByDate = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of points) m.set(p.date, p.count)
    return m
  }, [points])

  const maxCount = Math.max(1, ...points.map(p => p.count))

  // Sunday-anchored week columns spanning [from, to] — parsed as local dates (not UTC) so the
  // range's edges land on the calendar days the caller actually meant.
  const rangeStart = new Date(`${from}T00:00:00`)
  const rangeEnd = new Date(`${to}T00:00:00`)
  const startOffset = rangeStart.getDay()
  const gridStart = new Date(rangeStart)
  gridStart.setDate(rangeStart.getDate() - startOffset)
  const totalDays = Math.ceil((rangeEnd.getTime() - gridStart.getTime()) / 86400000) + 1
  const weeks = Math.ceil(totalDays / 7)

  const width = weeks * (CELL + GAP)
  const height = MONTH_LABEL_H + 7 * (CELL + GAP)

  const cells: { x: number; y: number; date: string; count: number; inRange: boolean }[] = []
  const monthLabels: { x: number; label: string }[] = []
  let lastMonth = -1

  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < 7; d++) {
      const date = new Date(gridStart)
      date.setDate(gridStart.getDate() + w * 7 + d)
      const inRange = date >= rangeStart && date <= rangeEnd
      const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      cells.push({ x: w, y: d, date: iso, count: countByDate.get(iso) ?? 0, inRange })
      if (inRange && d === 0 && date.getMonth() !== lastMonth) {
        lastMonth = date.getMonth()
        monthLabels.push({ x: w * (CELL + GAP), label: date.toLocaleString('en', { month: 'short' }) })
      }
    }
  }

  const tint = (count: number, inRange: boolean) => {
    if (!inRange) return 'transparent'
    if (count === 0) return border.divider
    const ratio = Math.min(1, count / maxCount)
    const alpha = 0.18 + ratio * 0.7
    return accentAlpha(alpha)
  }

  const hoveredCell = cells.find(c => c.date === hover)

  return (
    <div className="flex items-start gap-4 flex-wrap">
      <div className="overflow-x-auto">
        <svg width={width} height={height + 4} role="img" aria-label="Sessions per day, across the selected range">
          {monthLabels.map((m, i) => (
            <text key={i} x={m.x} y={11} fontSize={10} fill={colors.text.dim}>{m.label}</text>
          ))}
          {cells.map((c, i) => (
            <rect
              key={i}
              x={c.x * (CELL + GAP)}
              y={MONTH_LABEL_H + c.y * (CELL + GAP)}
              width={CELL}
              height={CELL}
              rx={2}
              fill={tint(c.count, c.inRange)}
              stroke={hover === c.date ? colors.accent : 'transparent'}
              strokeWidth={1.5}
              onMouseEnter={() => c.inRange && setHover(c.date)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </svg>
      </div>
      {/* Fixed-width side panel, always mounted, so hovering cells only swaps its text instead
          of mounting/unmounting a line below the grid — that used to shift the layout and made
          the label flicker as the mouse moved across cells. */}
      <div className="flex-shrink-0 min-w-[150px] text-xs pt-1" style={{ color: colors.text.muted }}>
        {hoveredCell ? (
          <>
            {formatDateStr(hoveredCell.date)}
            {' · '}{hoveredCell.count} session{hoveredCell.count !== 1 ? 's' : ''}
          </>
        ) : (
          <span style={{ color: colors.text.dim }}>Hover a day for details</span>
        )}
      </div>
    </div>
  )
}
