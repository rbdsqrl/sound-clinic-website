import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CalendarClock, Wand2 } from 'lucide-react'
import { iepApi } from '../../api/iep'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { PageLoader } from '../../components/ui/Spinner'
import { useToast } from '../../hooks/useToast'
import { getApiError } from '../../lib/apiError'
import { formatDateStr } from '../../lib/format'
import { colors, border, surface, accentAlpha, warningAlpha } from '../../theme'

/**
 * How a plan's goals are spread across the sessions still to come in the therapy it's linked to. The
 * suggestion follows the therapy's real sessions, so it moves when the frequency or dates change — "Apply"
 * then sets each active goal's target date to the suggested one.
 */
export default function GoalPacingPanel({ planId, canApply }: { planId: string; canApply: boolean }) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const { data, isLoading } = useQuery({ queryKey: ['iep-pacing', planId], queryFn: () => iepApi.pacing(planId) })

  const applyMut = useMutation({
    mutationFn: () => iepApi.applyPacing(planId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['iep-pacing', planId] })
      qc.invalidateQueries({ queryKey: ['iep'] })
      toast('Goal target dates updated', 'success')
    },
    onError: (err) => toast(getApiError(err, 'Could not update the goal dates'), 'error'),
  })

  if (isLoading || !data) return <PageLoader />

  if (!data.linked) {
    return (
      <p className="text-xs py-3" style={{ color: colors.text.dim }}>
        Link this plan to an ongoing therapy (in the plan header) to spread its goals across that therapy's sessions.
      </p>
    )
  }

  const active = data.goals.filter(g => g.status !== 'COMPLETED')
  const needsApply = canApply && data.remainingSessions > 0 && active.some(g => g.differsFromSuggested)

  return (
    <div className="mt-4 rounded-xl p-4" style={{ border: `1px solid ${border.divider}`, background: surface.card }}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-sm font-semibold flex items-center gap-1.5" style={{ color: colors.text.heading }}>
            <CalendarClock size={14} /> Goal pacing{data.programName ? ` · ${data.programName}` : ''}
          </p>
          <p className="text-xs mt-0.5" style={{ color: colors.text.muted }}>
            {data.completedSessions} of {data.totalSessions} sessions done
            {data.sessionsPerWeek > 0 ? ` · about ${data.sessionsPerWeek} a week` : ''}
          </p>
        </div>
        {needsApply && (
          <Button size="sm" onClick={() => applyMut.mutate()} loading={applyMut.isPending}>
            <Wand2 size={13} /> Apply suggested dates
          </Button>
        )}
      </div>

      <div
        className="mt-3 rounded-lg px-3 py-2 text-xs flex items-start gap-2"
        style={data.overloaded
          ? { background: warningAlpha(0.10), color: colors.text.primary }
          : { background: accentAlpha(0.06), color: colors.text.primary }}
      >
        {data.overloaded && <AlertTriangle size={13} className="flex-shrink-0 mt-px" style={{ color: colors.status.warning }} />}
        <span>{data.summary}</span>
      </div>

      {active.length > 0 && data.remainingSessions > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs" style={{ minWidth: 520 }}>
            <thead>
              <tr style={{ color: colors.text.dim }}>
                <th className="pb-1.5 pr-3 text-left font-semibold uppercase tracking-wider">Goal</th>
                <th className="pb-1.5 pr-3 text-right font-semibold uppercase tracking-wider">Sessions</th>
                <th className="pb-1.5 pr-3 text-right font-semibold uppercase tracking-wider">Suggested by</th>
                <th className="pb-1.5 text-right font-semibold uppercase tracking-wider">Current target</th>
              </tr>
            </thead>
            <tbody>
              {active.map(g => (
                <tr key={g.goalId} style={{ borderTop: `1px solid ${border.divider}` }}>
                  <td className="py-2 pr-3" style={{ color: colors.text.primary }}>{g.title}</td>
                  <td className="py-2 pr-3 text-right" style={{ color: colors.text.muted, fontVariantNumeric: 'tabular-nums' }}>{g.sessionsBudget ?? '—'}</td>
                  <td className="py-2 pr-3 text-right" style={{ color: colors.text.primary }}>
                    {g.suggestedTargetDate ? formatDateStr(g.suggestedTargetDate) : '—'}
                  </td>
                  <td className="py-2 text-right">
                    <span style={{ color: colors.text.muted }}>{g.currentTargetDate ? formatDateStr(g.currentTargetDate) : 'Not set'}</span>
                    {g.overdue && <span className="ml-1.5"><Badge variant="red">Overdue</Badge></span>}
                    {!g.overdue && g.differsFromSuggested && <span className="ml-1.5"><Badge variant="amber">Differs</Badge></span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
