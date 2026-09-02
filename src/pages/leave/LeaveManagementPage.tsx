import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarOff, CheckCircle2, XCircle } from 'lucide-react'
import { format } from 'date-fns'
import { leavesApi } from '../../api/leaves'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { PageLoader } from '../../components/ui/Spinner'
import { useToast } from '../../hooks/useToast'
import { getApiError } from '../../lib/apiError'
import { colors, styles, border, surface, palette, paletteStyle } from '../../theme'
import { Avatar } from '../../components/shared/Avatar'
import { LeaveStatusBadge, LEAVE_STATUS_META, LEAVE_TYPE_LABEL } from '../../components/shared/LeaveStatusBadge'
import type { LeaveResponse, LeaveStatus } from '../../types'

// ── Leave row ──────────────────────────────────────────────────────────────────

function LeaveRow({ leave, onReview, reviewing }: {
  leave: LeaveResponse
  onReview: (id: string, action: 'APPROVED' | 'REJECTED') => void
  reviewing: boolean
}) {
  const initials = `${leave.therapistFirstName[0] ?? ''}${leave.therapistLastName[0] ?? ''}`
  const therapistName = `${leave.therapistFirstName} ${leave.therapistLastName}`

  return (
    <div
      className="flex items-center gap-4 px-5 py-4 flex-wrap"
      style={{ borderBottom: `1px solid ${border.divider}` }}
    >
      {/* Avatar */}
      <Avatar initials={initials} name={therapistName} size="lg" />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold" style={{ color: colors.text.primary }}>
            {leave.therapistFirstName} {leave.therapistLastName}
          </p>
          <LeaveStatusBadge status={leave.status} />
          <span className="text-xs px-2 py-0.5 rounded-full" style={paletteStyle('purple', 0.08)}>
            {LEAVE_TYPE_LABEL[leave.leaveType]}
          </span>
        </div>

        <div className="flex items-center gap-3 mt-1 flex-wrap">
          <p className="text-xs font-medium" style={{ color: colors.text.muted }}>
            {format(new Date(leave.leaveDate), 'EEE, dd MMM yyyy')}
          </p>
          {leave.reason && (
            <p className="text-xs" style={{ color: colors.text.dim }}>· {leave.reason}</p>
          )}
        </div>

        {leave.status !== 'PENDING' && leave.reviewedByFirstName && (
          <p className="text-[12.65px] mt-0.5" style={{ color: colors.text.dim }}>
            {leave.status === 'APPROVED' ? 'Approved' : 'Rejected'} by {leave.reviewedByFirstName} {leave.reviewedByLastName}
            {leave.reviewedAt ? ` · ${format(new Date(leave.reviewedAt), 'dd MMM yyyy')}` : ''}
          </p>
        )}
      </div>

      {/* Actions */}
      {leave.status === 'PENDING' && (
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="secondary"
            onClick={() => onReview(leave.id, 'REJECTED')}
            disabled={reviewing}
          >
            <XCircle size={14} /> Reject
          </Button>
          <Button
            onClick={() => onReview(leave.id, 'APPROVED')}
            disabled={reviewing}
          >
            <CheckCircle2 size={14} /> Approve
          </Button>
        </div>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function LeaveManagementPage({ asTab = false }: { asTab?: boolean }) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [filterStatus, setFilterStatus] = useState<LeaveStatus | ''>('PENDING')

  const { data: leaves, isLoading } = useQuery({
    queryKey: ['leaves'],
    queryFn: () => leavesApi.list(),
  })

  const reviewMut = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'APPROVED' | 'REJECTED' }) =>
      leavesApi.review(id, { status: action }),
    onSuccess: (_, { action }) => {
      qc.invalidateQueries({ queryKey: ['leaves'] })
      toast(action === 'APPROVED' ? 'Leave approved' : 'Leave rejected', 'success')
    },
    onError: (err) => toast(getApiError(err, 'Failed to review leave request'), 'error'),
  })

  const filtered = (leaves ?? []).filter(l => !filterStatus || l.status === filterStatus)
  const pendingCount  = (leaves ?? []).filter(l => l.status === 'PENDING').length
  const approvedCount = (leaves ?? []).filter(l => l.status === 'APPROVED').length
  const rejectedCount = (leaves ?? []).filter(l => l.status === 'REJECTED').length

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-6">
      {/* Header */}
      {!asTab && (
        <div>
          <h1 className="text-2xl font-bold" style={{ color: colors.text.heading }}>Leave Requests</h1>
          <p className="mt-1 text-sm" style={{ color: colors.text.dim }}>
            Review and manage therapist leave applications
          </p>
        </div>
      )}

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-3">
        {[
          { label: 'Pending',  count: pendingCount,  p: 'yellow' as const },
          { label: 'Approved', count: approvedCount, p: 'teal'   as const },
          { label: 'Rejected', count: rejectedCount, p: 'slate'  as const },
        ].map(({ label, count, p }) => (
          <div
            key={label}
            className="rounded-xl px-4 py-3 flex flex-col"
            style={{ background: surface.sidebarFooter, border: border.card }}
          >
            <span className="text-xs mb-1" style={{ color: colors.text.dim }}>{label}</span>
            <span className="text-2xl font-bold" style={{ color: palette[p].text }}>{count}</span>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl w-fit" style={{ background: surface.filterStrip, border: border.card }}>
        {(['', 'PENDING', 'APPROVED', 'REJECTED'] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={filterStatus === s ? styles.filterTabActive : styles.filterTabInactive}
          >
            {s === '' ? 'All' : LEAVE_STATUS_META[s].label}
            {s === 'PENDING' && pendingCount > 0 && (
              <span className="ml-1.5 rounded-full px-1.5 py-0.5 text-[11.5px] font-semibold" style={paletteStyle('yellow', 0.15)}>
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Leave list */}
      {filtered.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center py-12 text-center">
            <div className="rounded-2xl p-5 mb-4" style={styles.emptyIcon}><CalendarOff size={32} /></div>
            <p className="text-base font-semibold" style={{ color: colors.text.primary }}>
              {filterStatus ? `No ${LEAVE_STATUS_META[filterStatus as LeaveStatus].label.toLowerCase()} requests` : 'No leave requests yet'}
            </p>
            <p className="mt-1 text-sm" style={{ color: colors.text.muted }}>
              {filterStatus === 'PENDING' ? 'All caught up — no pending requests.' : 'Try a different filter.'}
            </p>
          </div>
        </Card>
      ) : (
        <Card padding={false}>
          {filtered.map(leave => (
            <LeaveRow
              key={leave.id}
              leave={leave}
              onReview={(id, action) => reviewMut.mutate({ id, action })}
              reviewing={reviewMut.isPending}
            />
          ))}
        </Card>
      )}
    </div>
  )
}
