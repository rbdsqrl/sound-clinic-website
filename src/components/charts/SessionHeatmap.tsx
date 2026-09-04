import { useMemo, useState } from 'react'
import { colors, border, accentAlpha } from '../../theme'
import type { TrendPoint } from '../../types'

const CELL = 11
const GAP = 3
const MONTH_LABEL_H = 16

/**
 * GitHub-style calendar heatmap — one cell per day, coloured by session count, grouped into
 * week columns across the year. Missing days (no session) render as an empty cell, not zero
 * specially highlighted — the same "gap, not zero" convention as the line charts.
 */
export default function SessionHeatmap({ points, year }: { points: TrendPoint[]; year: number }) {
  const [hover, setHover] = useState<string | null>(null)

  const countByDate = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of points) m.set(p.date, p.count)
    return m
  }, [points])

  const maxCount = Math.max(1, ...points.map(p => p.count))

  // Sunday-anchored week columns spanning the requested year.
  const jan1 = new Date(year, 0, 1)
  const startOffset = jan1.getDay()
  const gridStart = new Date(year, 0, 1 - startOffset)
  const dec31 = new Date(year, 11, 31)
  const totalDays = Math.ceil((dec31.getTime() - gridStart.getTime()) / 86400000) + 1
  const weeks = Math.ceil(totalDays / 7)

  const width = weeks * (CELL + GAP)
  const height = MONTH_LABEL_H + 7 * (CELL + GAP)

  const cells: { x: number; y: number; date: string; count: number; inYear: boolean }[] = []
  const monthLabels: { x: number; label: string }[] = []
  let lastMonth = -1

  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < 7; d++) {
      const date = new Date(gridStart)
      date.setDate(gridStart.getDate() + w * 7 + d)
      const inYear = date.getFullYear() === year
      const iso = date.toISOString().slice(0, 10)
      cells.push({ x: w, y: d, date: iso, count: countByDate.get(iso) ?? 0, inYear })
      if (inYear && d === 0 && date.getMonth() !== lastMonth) {
        lastMonth = date.getMonth()
        monthLabels.push({ x: w * (CELL + GAP), label: date.toLocaleString('en', { month: 'short' }) })
      }
    }
  }

  const tint = (count: number, inYear: boolean) => {
    if (!inYear) return 'transparent'
    if (count === 0) return border.divider
    const ratio = Math.min(1, count / maxCount)
    const alpha = 0.18 + ratio * 0.7
    return accentAlpha(alpha)
  }

  const hoveredCell = cells.find(c => c.date === hover)

  return (
    <div className="flex items-start gap-4 flex-wrap">
      <div className="overflow-x-auto">
        <svg width={width} height={height + 4} role="img" aria-label="Sessions per day, across the year">
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
              fill={tint(c.count, c.inYear)}
              stroke={hover === c.date ? colors.accent : 'transparent'}
              strokeWidth={1.5}
              onMouseEnter={() => c.inYear && setHover(c.date)}
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
            {new Date(hoveredCell.date + 'T00:00:00').toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })}
            {' · '}{hoveredCell.count} session{hoveredCell.count !== 1 ? 's' : ''}
          </>
        ) : (
          <span style={{ color: colors.text.dim }}>Hover a day for details</span>
        )}
      </div>
    </div>
  )
}
