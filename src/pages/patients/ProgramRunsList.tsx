import { format, parseISO } from 'date-fns'
import { colors, border, surface } from '../../theme'
import type { EnrollmentRun } from '../../types'

/** "Original run" for the first run, "Renewal 1", "Renewal 2"… for the ones added since. */
export const runLabel = (number: number) => (number === 1 ? 'Original run' : `Renewal ${number - 1}`)

const nice = (d: string) => format(parseISO(d), 'd MMM yyyy')

/**
 * A program's runs — the original and each renewal — with the dates and size of each. Shown only once the
 * program has been renewed; a single run is already what the program's own start–end dates say.
 */
export function ProgramRunsList({ runs }: { runs: EnrollmentRun[] | undefined }) {
  if (!runs || runs.length < 2) return null
  return (
    <div className="mb-4 rounded-xl px-3 py-2" style={{ background: surface.filterStrip, border: `1px solid ${border.divider}` }}>
      <p className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: colors.text.dim }}>Program runs</p>
      {runs.map(r => (
        <div key={r.number} className="flex items-center justify-between gap-3 py-1 text-xs">
          <span className="font-medium" style={{ color: colors.text.primary }}>{runLabel(r.number)}</span>
          <span className="tabular-nums" style={{ color: colors.text.muted }}>
            {nice(r.startDate)} – {nice(r.endDate)} · {r.sessionCount} session{r.sessionCount === 1 ? '' : 's'}
          </span>
        </div>
      ))}
    </div>
  )
}
