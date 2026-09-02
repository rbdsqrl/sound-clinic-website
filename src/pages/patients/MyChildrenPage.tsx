import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Baby, ChevronRight, Clock, RefreshCw, UserCheck, AlertTriangle } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { patientsApi } from '../../api/patients'
import { therapySessionsApi } from '../../api/therapySessions'
import { enrollmentsApi } from '../../api/enrollments'
import { concernsApi } from '../../api/concerns'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageLoader } from '../../components/ui/Spinner'
import { ToastContainer } from '../../components/ui/Toast'
import { Modal } from '../../components/ui/Modal'
import { Select } from '../../components/ui/Select'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../hooks/useToast'
import { getApiError } from '../../lib/apiError'
import { formatTimeStr } from '../../lib/format'
import { colors, border, accentAlpha, palette, paletteStyle } from '../../theme'
import { useTheme } from '../../contexts/ThemeContext'
import { getAvatarColorStyles } from '../../lib/avatarColor'

function RaiseConcernModal({ childId, childName, onClose }: { childId: string; childName: string; onClose: () => void }) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [enrollmentId, setEnrollmentId] = useState('')
  const [description, setDescription] = useState('')

  const { data: enrollments = [], isLoading } = useQuery({
    queryKey: ['enrollments', childId],
    queryFn: () => enrollmentsApi.listForPatient(childId),
  })
  const activeEnrollments = enrollments.filter(e => e.status === 'ACTIVE')

  const raiseMut = useMutation({
    mutationFn: () => concernsApi.raise(enrollmentId, description),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['enrollment-concerns', childId] })
      toast('Concern sent to the clinic', 'success')
      onClose()
    },
    onError: (err) => toast(getApiError(err, 'Failed to send concern'), 'error'),
  })

  return (
    <Modal open onClose={onClose} title={`Raise a concern — ${childName}`}>
      {isLoading ? (
        <p className="text-sm py-4" style={{ color: colors.text.muted }}>Loading programs…</p>
      ) : activeEnrollments.length === 0 ? (
        <p className="text-sm py-4" style={{ color: colors.text.muted }}>
          {childName} has no active program to raise a concern about right now.
        </p>
      ) : (
        <div className="space-y-4">
          <Select
            label="Which program?"
            value={enrollmentId}
            onChange={e => setEnrollmentId(e.target.value)}
            placeholder="Select a program"
            options={activeEnrollments.map(e => ({
              value: e.id,
              label: `${e.programName} — ${e.therapistFirstName} ${e.therapistLastName}`,
            }))}
          />
          <div className="space-y-1">
            <label className="form-label">What's on your mind?</label>
            <textarea
              className="form-input"
              rows={4}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Tell us what's concerning you about this program — the therapist and clinic admins will see this."
            />
          </div>
          <div className="flex items-center gap-2 justify-end">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button
              onClick={() => raiseMut.mutate()}
              disabled={!enrollmentId || !description.trim()}
              loading={raiseMut.isPending}
            >
              Send to clinic
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

function ChildSessions({ childId }: { childId: string }) {
  const qc = useQueryClient()
  const { toasts, toast, dismiss } = useToast()
  const [showAll, setShowAll] = useState(false)

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['child-sessions', childId],
    queryFn: () => therapySessionsApi.list({
      patientId: childId,
      from: format(new Date(), 'yyyy-MM-dd'),
    }),
  })

  const requestMutation = useMutation({
    mutationFn: (sessionId: string) => therapySessionsApi.requestReschedule(sessionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['child-sessions', childId] })
      toast('Reschedule request sent to the clinic', 'success')
    },
    onError: (err) => toast(getApiError(err, 'Failed to send request'), 'error'),
  })

  const upcoming = sessions.filter(s => s.status === 'SCHEDULED' || s.status === 'PENDING_RESCHEDULE')

  // Plan-level allowance, the same on every session of the plan.
  const remaining = upcoming[0]?.parentReschedulesRemaining ?? null
  const noneLeft  = remaining === 0
  const visible   = showAll ? upcoming : upcoming.slice(0, 3)

  return (
    <>
      <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${border.divider}` }}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11.5px] font-medium uppercase tracking-wider" style={{ color: colors.text.dim }}>
            Upcoming Sessions
          </p>
          {remaining !== null && (
            <span className="text-[11.5px]"
              style={{ color: noneLeft ? colors.status.warning : colors.text.dim }}>
              {noneLeft
                ? 'No reschedules left'
                : `${remaining} reschedule${remaining === 1 ? '' : 's'} left`}
            </span>
          )}
        </div>

        {isLoading ? (
          <p className="text-xs py-1" style={{ color: colors.text.muted }}>Loading…</p>
        ) : upcoming.length === 0 ? (
          <p className="text-xs py-1" style={{ color: colors.text.dim }}>No upcoming sessions scheduled.</p>
        ) : (
          <div className="space-y-1.5">
            {visible.map(s => (
              <div
                key={s.id}
                className="flex items-center gap-3 rounded-xl px-3 py-2"
                style={{ background: accentAlpha(0.04), border: `1px solid ${border.divider}` }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="text-xs font-semibold" style={{ color: colors.text.primary }}>
                      {format(parseISO(s.sessionDate), 'EEE, d MMM')}
                    </span>
                    <span className="text-xs flex items-center gap-1" style={{ color: colors.text.muted }}>
                      <Clock size={10} />
                      {formatTimeStr(s.startTime)}
                    </span>
                    <span className="text-xs" style={{ color: colors.text.muted }}>
                      · {s.programName} #{s.sessionNumber}
                    </span>
                    <span className="text-xs" style={{ color: colors.text.dim }}>
                      · {s.therapistFirstName} {s.therapistLastName}
                    </span>
                  </div>
                </div>

                {s.status === 'PENDING_RESCHEDULE' ? (
                  <span
                    className="flex-shrink-0 text-[11.5px] font-semibold px-2 py-0.5 rounded-full"
                    style={paletteStyle('amber', 0.10, 0.15)}
                  >
                    Rescheduling
                  </span>
                ) : (
                  <button
                    onClick={() => requestMutation.mutate(s.id)}
                    disabled={requestMutation.isPending || (noneLeft && !s.parentRescheduleRequested)}
                    title={noneLeft && !s.parentRescheduleRequested
                      ? 'You have used all the reschedules on this therapy plan — contact the clinic'
                      : undefined}
                    className="flex-shrink-0 flex items-center gap-1 text-[12.65px] font-medium px-2 py-1 rounded-lg transition-colors disabled:opacity-50"
                    style={paletteStyle('purple', 0.08, 0.12)}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = `rgba(${palette.purple.raw}, 0.14)`}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = `rgba(${palette.purple.raw}, 0.08)`}
                  >
                    <RefreshCw size={10} /> Reschedule
                  </button>
                )}
              </div>
            ))}

            {upcoming.length > 3 && (
              <button
                onClick={() => setShowAll(v => !v)}
                className="w-full text-center text-xs py-1.5 transition-colors"
                style={{ color: colors.accent }}
              >
                {showAll ? 'Show less' : `+${upcoming.length - 3} more session${upcoming.length - 3 !== 1 ? 's' : ''}`}
              </button>
            )}
          </div>
        )}
      </div>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </>
  )
}

export default function MyChildrenPage() {
  const { theme } = useTheme()
  const { data: children, isLoading } = useQuery({
    queryKey: ['my-children'],
    queryFn: patientsApi.myChildren,
  })
  const [concernFor, setConcernFor] = useState<{ id: string; name: string } | null>(null)

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: colors.text.heading }}>My Children</h1>
        <p className="mt-1 text-sm" style={{ color: colors.text.muted }}>
          Cases you are linked to as a parent or guardian.
        </p>
      </div>

      {!children?.length ? (
        <Card>
          <EmptyState
            icon={<Baby size={32} />}
            title="No children linked"
            description="Ask your clinic administrator to link your account to your child's case record."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {children.map((child) => (
            <Card key={child.id}>
              {/* Compact header row */}
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div
                  className="h-10 w-10 rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0"
                  style={getAvatarColorStyles(`${child.firstName} ${child.lastName}`, theme === 'dark')}
                >
                  {child.firstName[0]}{child.lastName[0]}
                </div>

                {/* Name + meta */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-sm" style={{ color: colors.text.heading }}>
                      {child.firstName} {child.lastName}
                    </p>
                    <div className="flex-shrink-0 flex items-center gap-3">
                      <button
                        onClick={() => setConcernFor({ id: child.id, name: `${child.firstName} ${child.lastName}` })}
                        className="flex items-center gap-1 text-xs font-medium transition-opacity hover:opacity-75"
                        style={{ color: colors.status.warning }}
                      >
                        <AlertTriangle size={12} /> Raise a concern
                      </button>
                      <Link
                        to={`/patients/${child.id}`}
                        className="flex items-center gap-0.5 text-xs font-medium transition-opacity hover:opacity-75"
                        style={{ color: colors.accent }}
                      >
                        View profile <ChevronRight size={13} />
                      </Link>
                    </div>
                  </div>

                  {/* DOB + therapists inline */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs" style={{ color: colors.text.muted }}>
                    {child.dateOfBirth && (
                      <span>Born {format(new Date(child.dateOfBirth), 'MMM d, yyyy')}</span>
                    )}
                    {child.therapists.length > 0 && (
                      <span className="flex items-center gap-1">
                        <UserCheck size={10} style={{ color: colors.text.dim }} />
                        {child.therapists.map(t => `${t.firstName} ${t.lastName}`).join(', ')}
                      </span>
                    )}
                  </div>

                  {/* Conditions as chips */}
                  {child.conditions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {child.conditions.map((c) => (
                        <span
                          key={c.id}
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-[12.65px] font-medium"
                          style={paletteStyle('blue', 0.08, 0.14)}
                        >
                          {c.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Sessions — always visible */}
              <ChildSessions childId={child.id} />
            </Card>
          ))}
        </div>
      )}

      {concernFor && (
        <RaiseConcernModal
          childId={concernFor.id}
          childName={concernFor.name}
          onClose={() => setConcernFor(null)}
        />
      )}
    </div>
  )
}
