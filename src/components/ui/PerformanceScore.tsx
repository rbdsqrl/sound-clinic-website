import { colors, surface, border } from '../../theme'

/**
 * Session performance as a 0-100 percentage.
 *
 * The bands exist so the number reads the same way for different therapists — a bare
 * percentage gives nothing to anchor 60 against 70. They are shown beside the figure
 * rather than snapping the slider, so any value in range is still selectable.
 */
const BANDS: { min: number; label: string; tone: 'danger' | 'warning' | 'success' }[] = [
  { min: 90, label: 'Excellent',  tone: 'success' },
  { min: 75, label: 'Good',       tone: 'success' },
  { min: 60, label: 'On track',   tone: 'warning' },
  { min: 40, label: 'Developing', tone: 'warning' },
  { min: 0,  label: 'Needs work', tone: 'danger'  },
]

export function scoreBand(score: number) {
  return BANDS.find(b => score >= b.min) ?? BANDS[BANDS.length - 1]
}

export function scoreColor(score: number): string {
  const tone = scoreBand(score).tone
  return tone === 'success' ? colors.status.success
       : tone === 'warning' ? colors.status.warning
       : colors.status.danger
}

export function scoreLabel(score: number): string {
  return `${score}% · ${scoreBand(score).label}`
}

export function PerformanceScoreSlider({
  value, onChange, disabled = false, required = false,
}: {
  /** null when the therapist has not scored the session */
  value: number | null
  onChange: (value: number | null) => void
  disabled?: boolean
  required?: boolean
}) {
  const active = value !== null
  const shown = value ?? 0
  const tint = active ? scoreColor(shown) : colors.text.dim

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="form-label mb-0">
          Performance Score{required && <span style={{ color: colors.status.danger }}> *</span>}
        </label>
        {active ? (
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold tabular-nums" style={{ color: tint }}>
              {shown}%
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: tint + '22', color: tint }}>
              {scoreBand(shown).label}
            </span>
            {!disabled && (
              <button
                type="button"
                onClick={() => onChange(null)}
                className="text-xs hover:underline"
                style={{ color: colors.text.dim }}
              >
                Clear
              </button>
            )}
          </div>
        ) : (
          <span className="text-xs" style={{ color: colors.text.dim }}>Not scored</span>
        )}
      </div>

      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={shown}
        disabled={disabled}
        onChange={e => onChange(Number(e.target.value))}
        aria-label="Performance score percentage"
        className="w-full score-slider"
        style={{
          // Filled portion up to the handle, track beyond it. The thumb border
          // reads --score-tint so it matches the band colour.
          ['--score-tint' as string]: tint,
          background: `linear-gradient(to right, ${tint} 0%, ${tint} ${shown}%, ${surface.filterStrip} ${shown}%, ${surface.filterStrip} 100%)`,
          opacity: disabled ? 0.6 : 1,
          cursor: disabled ? 'default' : 'pointer',
        }}
      />

      <div className="flex justify-between mt-1 text-[11px]" style={{ color: colors.text.dim }}>
        {[0, 25, 50, 75, 100].map(t => <span key={t}>{t}</span>)}
      </div>
    </div>
  )
}

/** Compact read-only pill, for lists of past sessions. */
export function ScorePill({ score }: { score: number }) {
  const tint = scoreColor(score)
  return (
    <span className="text-[11.5px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: tint + '20', color: tint, border: `1px solid ${tint}33` }}
      title={scoreLabel(score)}>
      {score}%
    </span>
  )
}

/** Kept so callers can style a container consistently with the slider. */
export const scoreBorder = border
