import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarOff, Plus, X } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { format } from 'date-fns'
import { leavesApi } from '../../api/leaves'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { PageLoader } from '../../components/ui/Spinner'
import { useToast } from '../../hooks/useToast'
import { getApiError } from '../../lib/apiError'
import { colors, styles, border, surface, palette, paletteStyle } from '../../theme'
import { LeaveStatusBadge, LEAVE_STATUS_META, LEAVE_TYPE_LABEL } from '../../components/shared/LeaveStatusBadge'
import type { CreateLeaveRequest, LeaveResponse, LeaveStatus } from '../../types'

// ── Leave card ─────────────────────────────────────────────────────────────────

function LeaveCard({ leave, onCancel, cancelling }: {
  leave: LeaveResponse
  onCancel: (id: string) => void
  cancelling: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-4 p-4 rounded-xl" style={{ background: surface.sidebarFooter, border: border.card }}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-sm" style={{ color: colors.text.primary }}>
            {format(new Date(leave.leaveDate), 'EEE, dd MMM yyyy')}
          </p>
          <span className="text-xs px-2 py-0.5 rounded-full" style={paletteStyle('purple', 0.08)}>
            {LEAVE_TYPE_LABEL[leave.leaveType]}
          </span>
          <LeaveStatusBadge status={leave.status} />
        </div>

        {leave.reason && (
          <p className="mt-1 text-xs" style={{ color: colors.text.muted }}>
            {leave.reason}
          </p>
        )}

        {leave.status !== 'PENDING' && leave.reviewedByFirstName && (
          <p className="mt-1 text-xs" style={{ color: colors.text.dim }}>
            {leave.status === 'APPROVED' ? 'Approved' : 'Rejected'} by {leave.reviewedByFirstName} {leave.reviewedByLastName}
            {leave.reviewedAt ? ` · ${format(new Date(leave.reviewedAt), 'dd MMM yyyy')}` : ''}
          </p>
        )}
      </div>

      {leave.status === 'PENDING' && (
        <button
          onClick={() => onCancel(leave.id)}
          disabled={cancelling}
          className="rounded-lg p-1 flex-shrink-0 transition-colors"
          style={{ color: colors.text.dim }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = colors.status.danger}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = colors.text.dim}
          title="Cancel request"
        >
          <X size={15} />
        </button>
      )}
    </div>
  )
}

// ── Apply Leave Modal ──────────────────────────────────────────────────────────


function ApplyModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const { toast } = useToast()
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<CreateLeaveRequest>()

  const mut = useMutation({
    mutationFn: (data: CreateLeaveRequest) => leavesApi.apply(data),
    onSuccess: () => { toast('Leave request submitted', 'success'); reset(); onCreated() },
    onError:   (err) => toast(getApiError(err, 'Failed to submit leave request'), 'error'),
  })

  return (
    <Modal open={open} onClose={onClose} title="Apply for Leave">
      <form onSubmit={handleSubmit(d => mut.mutateAsync(d))} className="space-y-4">
        <Input
          label="Leave Date"
          type="date"
          error={errors.leaveDate?.message}
          {...register('leaveDate', { required: 'Date is required' })}
        />

        <div className="space-y-1">
          <label className="form-label">Leave Type</label>
          <select className="form-input w-full" {...register('leaveType', { required: 'Required' })}>
            <option value="">Select type…</option>
            <option value="FULL_DAY">Full Day</option>
            <option value="HALF_DAY">Half Day</option>
          </select>
          {errors.leaveType && <p className="form-error">{errors.leaveType.message}</p>}
        </div>

        <div className="space-y-1">
          <label className="form-label">Reason <span style={{ color: colors.text.dim }}>(optional)</span></label>
          <textarea
            placeholder="Briefly describe the reason for leave…"
            rows={3}
            className="form-input resize-none"
            {...register('reason')}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting || mut.isPending}>Submit Request</Button>
        </div>
      </form>
    </Modal>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function MyLeavePage({ asTab = false }: { asTab?: boolean }) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [modalOpen, setModalOpen] = useState(false)
  const [filterStatus, setFilterStatus] = useState<LeaveStatus | ''>('')

  const { data: leaves, isLoading } = useQuery({
    queryKey: ['my-leaves'],
    queryFn: () => leavesApi.listMine(),
  })

  const cancelMut = useMutation({
    mutationFn: (id: string) => leavesApi.cancel(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-leaves'] }); toast('Leave request cancelled', 'success') },
    onError:   (err) => toast(getApiError(err, 'Failed to cancel request'), 'error'),
  })

  const filtered = (leaves ?? []).filter(l => !filterStatus || l.status === filterStatus)
  const pendingCount  = (leaves ?? []).filter(l => l.status === 'PENDING').length
  const approvedCount = (leaves ?? []).filter(l => l.status === 'APPROVED').length

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-6">
      {/* Header */}
      {asTab ? (
        <div className="flex justify-end">
          <Button onClick={() => setModalOpen(true)}><Plus size={16} /> Apply for Leave</Button>
        </div>
      ) : (
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: colors.text.heading }}>My Leave</h1>
            <p className="mt-1 text-sm" style={{ color: colors.text.dim }}>
              Apply for time off and track your leave requests
            </p>
          </div>
          <Button onClick={() => setModalOpen(true)}>
            <Plus size={16} /> Apply for Leave
          </Button>
        </div>
      )}

      {/* Summary chips */}
      {leaves && leaves.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {[
            { label: 'Pending',  count: pendingCount,  palette: 'yellow' as const },
            { label: 'Approved', count: approvedCount, palette: 'teal'   as const },
          ].map(({ label, count, palette: p }) => (
            <div key={label} className="rounded-xl px-4 py-2.5 flex items-center gap-3" style={{ background: surface.sidebarFooter, border: border.card }}>
              <span className="text-xs" style={{ color: colors.text.muted }}>{label}</span>
              <span className="text-lg font-bold" style={{ color: palette[p].text }}>{count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Filter */}
      {leaves && leaves.length > 0 && (
        <div className="flex items-center gap-1 p-1 rounded-xl w-fit" style={{ background: surface.filterStrip, border: border.card }}>
          {(['', 'PENDING', 'APPROVED', 'REJECTED'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={filterStatus === s ? styles.filterTabActive : styles.filterTabInactive}
            >
              {s === '' ? 'All' : LEAVE_STATUS_META[s].label}
            </button>
          ))}
        </div>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center py-12 text-center">
            <div className="rounded-2xl p-5 mb-4" style={styles.emptyIcon}><CalendarOff size={32} /></div>
            <p className="text-base font-semibold" style={{ color: colors.text.primary }}>
              {filterStatus ? 'No leaves with this status' : 'No leave requests yet'}
            </p>
            <p className="mt-1 text-sm" style={{ color: colors.text.muted }}>
              {filterStatus ? 'Try a different filter.' : 'Apply for leave using the button above.'}
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(l => (
            <LeaveCard
              key={l.id}
              leave={l}
              onCancel={id => cancelMut.mutate(id)}
              cancelling={cancelMut.isPending}
            />
          ))}
        </div>
      )}

      <ApplyModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={() => { qc.invalidateQueries({ queryKey: ['my-leaves'] }); setModalOpen(false) }}
      />
    </div>
  )
}
