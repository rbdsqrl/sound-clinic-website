import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { format } from 'date-fns'
import { enrollmentsApi } from '../../api/enrollments'
import { useToast } from '../../hooks/useToast'
import { getApiError } from '../../lib/apiError'
import { ROUTES } from '../../lib/routes'
import { colors, border, paletteStyle, type PaletteKey } from '../../theme'
import type { RenewalDue, RenewalOutcome } from '../../types'

const ACTIONS: { outcome: RenewalOutcome; label: string; tone: PaletteKey; done: string }[] = [
  { outcome: 'COMPLETED',     label: 'Completed',     tone: 'green', done: 'Marked completed — it stays Active and shows as Completed after its last session; renewal reminders stopped' },
  { outcome: 'DISCONTINUED',  label: 'Discontinued',  tone: 'slate', done: 'Marked discontinued — renewal reminders stopped' },
  { outcome: 'NEEDS_RENEWAL', label: 'Needs Renewal', tone: 'amber', done: 'Marked as needing renewal — parents keep getting reminders until it is renewed' },
]

export function endsLabel(daysLeft: number): { text: string; overdue: boolean } {
  if (daysLeft < 0)  return { text: `Ended ${Math.abs(daysLeft)} day${daysLeft === -1 ? '' : 's'} ago`, overdue: true }
  if (daysLeft === 0) return { text: 'Ends today', overdue: false }
  if (daysLeft === 1) return { text: 'Ends tomorrow', overdue: false }
  return { text: `Ends in ${daysLeft} days`, overdue: false }
}

/** Query-key prefix of the Renewals list, and refresh everything a decision changes. */
export const RENEWALS_KEY = ['enrollments', 'renewals-due'] as const

/** Programs in their last week, each with Completed / Discontinued / Needs Renewal. Acting on a row removes it. */
export function RenewalsList({ items, stacked = false }: { items: RenewalDue[]; stacked?: boolean }) {
  const qc = useQueryClient()
  const { toast } = useToast()

  const mut = useMutation({
    mutationFn: ({ id, outcome }: { id: string; outcome: RenewalOutcome }) => enrollmentsApi.setRenewalOutcome(id, outcome),
    onSuccess: (_, { outcome }) => {
      qc.invalidateQueries({ queryKey: RENEWALS_KEY })
      qc.invalidateQueries({ queryKey: ['dashboard', 'attention-counts'] })
      qc.invalidateQueries({ queryKey: ['enrollments'] })
      toast(ACTIONS.find(a => a.outcome === outcome)!.done, 'success')
    },
    onError: err => toast(getApiError(err, 'Could not save the decision'), 'error'),
  })

  return (
    <div>
      {items.map((r, i) => {
        const ends = endsLabel(r.daysLeft)
        const busy = mut.isPending && mut.variables?.id === r.enrollmentId
        return (
          <div
            key={r.enrollmentId}
            className={`flex flex-col gap-3 px-4 sm:px-6 py-3 ${stacked ? '' : 'lg:flex-row lg:items-center'}`}
            style={i < items.length - 1 ? { borderBottom: `1px solid ${border.divider}` } : undefined}
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <RefreshCw size={14} className="flex-shrink-0" style={{ color: colors.text.dim }} />
              <div className="min-w-0">
                <Link to={ROUTES.enrollment(r.patientId, r.enrollmentId)} className="text-sm font-medium truncate block"
                  style={{ color: colors.text.primary }}>
                  {r.patientFirstName} {r.patientLastName} · {r.programName}
                </Link>
                <p className="text-xs" style={{ color: colors.text.muted }}>
                  {r.therapistFirstName} {r.therapistLastName} ·{' '}
                  <span style={{ color: ends.overdue ? colors.status.danger : colors.status.warning, fontWeight: 600 }}>{ends.text}</span>
                  {' '}({format(new Date(`${r.endDate}T00:00:00`), 'd MMM')}) · {r.sessionsLeft} session{r.sessionsLeft === 1 ? '' : 's'} left
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 flex-shrink-0">
              {ACTIONS.map(a => (
                <button
                  key={a.outcome}
                  type="button"
                  disabled={busy}
                  onClick={() => mut.mutate({ id: r.enrollmentId, outcome: a.outcome })}
                  className="text-[11.5px] font-semibold px-2 py-1 rounded-md whitespace-nowrap transition-opacity disabled:opacity-50"
                  style={paletteStyle(a.tone, 0.12, 0.2)}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
