import { colors, surface } from '../../theme'

interface Props {
  values: (number | null)[]
  /** Shared floor/ceiling so several sparklines can be compared against each other. */
  min?: number
  max?: number
  width?: number
  height?: number
  stroke?: string
  label?: string
}

/**
 * A bare trend line. Nulls break the path rather than joining across, matching the main chart —
 * a sparkline that silently bridges a gap is the most common way these mislead.
 */
export default function Sparkline({
  values, min = 0, max = 100, width = 150, height = 44, stroke, label,
}: Props) {
  const pad = 5
  const colour = stroke ?? colors.accent
  const span = Math.max(1, max - min)

  const x = (i: number) =>
    values.length <= 1 ? width / 2 : pad + (i * (width - 2 * pad)) / (values.length - 1)
  const y = (v: number) =>
    pad + ((max - Math.min(max, Math.max(min, v))) / span) * (height - 2 * pad)

  const runs: { i: number; v: number }[][] = []
  let current: { i: number; v: number }[] = []
  values.forEach((v, i) => {
    if (v === null) {
      if (current.length) runs.push(current)
      current = []
    } else {
      current.push({ i, v })
    }
  })
  if (current.length) runs.push(current)

  const last = runs.length ? runs[runs.length - 1][runs[runs.length - 1].length - 1] : null

  return (
    <svg
      width={width} height={height} viewBox={`0 0 ${width} ${height}`}
      role="img" aria-label={label ?? 'Trend'} style={{ display: 'block', overflow: 'visible' }}
    >
      {runs.map((run, k) => (
        <polyline
          key={k}
          points={run.map(p => `${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')}
          fill="none" stroke={colour} strokeWidth={2}
          strokeLinecap="round" strokeLinejoin="round"
        />
      ))}
      {last && (
        <circle
          cx={x(last.i)} cy={y(last.v)} r={3.5}
          fill={colour} stroke={surface.card} strokeWidth={2}
        />
      )}
    </svg>
  )
}
