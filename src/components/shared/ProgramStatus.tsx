import { useMutation, useQueryClient } from '@tanstack/react-query'
import { enrollmentsApi } from '../../api/enrollments'
import { Badge } from '../ui/Badge'
import { Select } from '../ui/Select'
import { useToast } from '../../hooks/useToast'
import { getApiError } from '../../lib/apiError'
import { monthName } from '../../lib/sessionMonths'
import { colors, type PaletteKey } from '../../theme'
import type { EnrollmentResponse, ProgramStatus } from '../../types'

export const PROGRAM_STATUS_META: Record<ProgramStatus, { label: string; variant: PaletteKey }> = {
  ACTIVE:                 { label: 'Active',                  variant: 'green' },
  RENEWAL_DUE:            { label: 'Renewal Due',             variant: 'amber' },
  COMPLETED_DISCONTINUED: { label: 'Completed / Discontinued', variant: 'slate' },
}

const OPTIONS = (Object.keys(PROGRAM_STATUS_META) as ProgramStatus[])
  .map(value => ({ value, label: PROGRAM_STATUS_META[value].label }))

export function ProgramStatusBadge({ status }: { status: ProgramStatus }) {
  const meta = PROGRAM_STATUS_META[status] ?? PROGRAM_STATUS_META.ACTIVE
  return <Badge variant={meta.variant}>{meta.label}</Badge>
}

/** "October 5/20" — the current month's own count, the same figure for parents, therapists and admins. */
export function monthCountLabel(e: Pick<EnrollmentResponse, 'currentMonth' | 'currentMonthCompleted' | 'currentMonthTotal'>) {
  return `${monthName(e.currentMonth)} ${e.currentMonthCompleted}/${e.currentMonthTotal}`
}

/** Admin control to mark a program Active / Renewal Due / Completed-Discontinued. */
export function ProgramStatusControl({ enrollment }: { enrollment: EnrollmentResponse }) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const mut = useMutation({
    mutationFn: (status: ProgramStatus) => enrollmentsApi.setProgramStatus(enrollment.id, status),
    onSuccess: (_, status) => {
      qc.invalidateQueries({ queryKey: ['enrollments', enrollment.patientId] })
      toast(status === 'COMPLETED_DISCONTINUED'
        ? 'Program marked completed — renewal reminders stopped'
        : 'Program status updated', 'success')
    },
    onError: err => toast(getApiError(err, 'Could not update the program status'), 'error'),
  })

  return (
    <div className="max-w-xs">
      <Select
        label="Program status"
        options={OPTIONS}
        value={enrollment.programStatus}
        disabled={mut.isPending}
        onChange={e => mut.mutate(e.target.value as ProgramStatus)}
      />
      <p className="text-[11.5px] mt-1" style={{ color: colors.text.dim }}>
        Only programs marked Renewal Due get renewal reminders: parents are emailed twice a day from 3 days before the
        program ends, until it is renewed or marked Completed / Discontinued.
      </p>
    </div>
  )
}
