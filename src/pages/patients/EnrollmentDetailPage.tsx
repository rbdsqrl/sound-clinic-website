import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, BookOpen, CalendarDays, Clock, CheckCircle2, Circle } from 'lucide-react'
import { patientsApi } from '../../api/patients'
import { enrollmentsApi } from '../../api/enrollments'
import { analyticsApi } from '../../api/analytics'
import { SessionList, SessionNotesModal } from './EnrollmentSessions'
import { Card } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageLoader } from '../../components/ui/Spinner'
import { Select } from '../../components/ui/Select'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../hooks/useToast'
import { ROUTES } from '../../lib/routes'
import { formatTimeStr } from '../../lib/format'
import { colors, accentAlpha, paletteStyle, palette, border } from '../../theme'
import type { TherapySessionResponse, EnrollmentCareStatus } from '../../types'

const STATUS_VARIANT: Record<string, { label: string; style: React.CSSProperties }> = {
  ACTIVE:    { label: 'Active',    style: paletteStyle('teal', 0.12, 0) },
  COMPLETED: { label: 'Completed', style: paletteStyle('green', 0.12, 0) },
  CANCELLED: { label: 'Cancelled', style: paletteStyle('red', 0.12, 0) },
}

const CARE_STATUS_VARIANT: Record<EnrollmentCareStatus, { label: string; style: React.CSSProperties }> = {
  ON_TRACK:          { label: 'On Track',          style: paletteStyle('green', 0.12, 0) },
  NEEDS_ATTENTION:   { label: 'Needs Attention',   style: paletteStyle('amber', 0.12, 0) },
  REVIEW:            { label: 'Review',            style: paletteStyle('amber', 0.12, 0) },
  PROGRAM_COMPLETED: { label: 'Program Completed', style: paletteStyle('teal', 0.12, 0) },
}

// PROGRAM_COMPLETED is deliberately not offered here — it's a Clinic Head/Office Admin/
// Business Owner-only override, set via the dedicated "Mark as Completed" action below.
const CARE_STATUS_OPTIONS = [
  { value: 'ON_TRACK', label: 'On Track' },
  { value: 'NEEDS_ATTENTION', label: 'Needs Attention' },
  { value: 'REVIEW', label: 'Review' },
]

export default function EnrollmentDetailPage() {
  const { patientId, enrollmentId } = useParams<{ patientId: string; enrollmentId: string }>()
  const { user, activeRole } = useAuth()
  const currentRole = activeRole ?? user?.role
  const canUpdateSession = ['THERAPIST', 'CLINIC_HEAD', 'BUSINESS_OWNER', 'OFFICE_ADMIN'].includes(currentRole ?? '')
  const canRescheduleSession = ['BUSINESS_OWNER', 'CLINIC_HEAD', 'OFFICE_ADMIN'].includes(currentRole ?? '')

  const [notesState, setNotesState] = useState<{ session: TherapySessionResponse; canEdit: boolean } | null>(null)
  const [editingCareStatus, setEditingCareStatus] = useState(false)
  const [careDraft, setCareDraft] = useState<EnrollmentCareStatus>('ON_TRACK')
  const [careNote, setCareNote] = useState('')
  const [confirmingComplete, setConfirmingComplete] = useState(false)
  const [completeNote, setCompleteNote] = useState('')
  const [completeGoalMastery, setCompleteGoalMastery] = useState('')
  const [completeParentSatisfaction, setCompleteParentSatisfaction] = useState('')
  const [completeTherapistSignoff, setCompleteTherapistSignoff] = useState(false)
  const [confirmingReactivate, setConfirmingReactivate] = useState(false)
  const [completeError, setCompleteError] = useState<string | null>(null)
  const [reactivateError, setReactivateError] = useState<string | null>(null)

  const qc = useQueryClient()
  const { toast } = useToast()

  useEffect(() => { if (confirmingComplete) setCompleteError(null) }, [confirmingComplete])
  useEffect(() => { if (confirmingReactivate) setReactivateError(null) }, [confirmingReactivate])

  const careStatusMut = useMutation({
    mutationFn: (payload: { careStatus: EnrollmentCareStatus; note: string }) =>
      enrollmentsApi.updateCareStatus(enrollmentId!, payload.careStatus, { note: payload.note || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['enrollments', patientId] })
      toast('Care status updated', 'success')
      setEditingCareStatus(false)
    },
    onError: () => toast('Failed to update care status', 'error'),
  })

  // Separate from careStatusMut so its own toast/modal don't get tangled with the
  // regular care-status editor — this is the Clinic Head/Office Admin/Business Owner-only
  // override that completes a program regardless of how many sessions were attended, and
  // optionally backfills the discharge success criteria that will otherwise never arrive.
  const markCompleteMut = useMutation({
    mutationFn: (payload: {
      note: string
      manualGoalMasteryPct?: number
      manualParentSatisfactionPct?: number
      therapistSignedOff: boolean
    }) =>
      enrollmentsApi.updateCareStatus(enrollmentId!, 'PROGRAM_COMPLETED', {
        note: payload.note || undefined,
        manualGoalMasteryPct: payload.manualGoalMasteryPct,
        manualParentSatisfactionPct: payload.manualParentSatisfactionPct,
        therapistSignedOff: payload.therapistSignedOff || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['enrollments', patientId] })
      qc.invalidateQueries({ queryKey: ['success-criteria', enrollmentId] })
      qc.invalidateQueries({ queryKey: ['sessions', 'enrollment', enrollmentId] })
      toast('Program marked completed', 'success')
      setConfirmingComplete(false)
      setCompleteNote('')
      setCompleteGoalMastery('')
      setCompleteParentSatisfaction('')
      setCompleteTherapistSignoff(false)
    },
    onError: () => setCompleteError('Failed to mark program completed'),
  })

  const reactivateMut = useMutation({
    mutationFn: () => enrollmentsApi.reactivate(enrollmentId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['enrollments', patientId] })
      qc.invalidateQueries({ queryKey: ['success-criteria', enrollmentId] })
      qc.invalidateQueries({ queryKey: ['sessions', 'enrollment', enrollmentId] })
      toast('Program reactivated', 'success')
      setConfirmingReactivate(false)
    },
    onError: () => setReactivateError('Failed to reactivate program'),
  })

  const signoffMut = useMutation({
    mutationFn: () => enrollmentsApi.therapistSignoff(enrollmentId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['enrollments', patientId] })
      qc.invalidateQueries({ queryKey: ['success-criteria', enrollmentId] })
      toast('Sign-off recorded', 'success')
    },
    onError: () => toast('Failed to record sign-off', 'error'),
  })

  const { data: successCriteria } = useQuery({
    queryKey: ['success-criteria', enrollmentId],
    queryFn: () => analyticsApi.successCriteria(enrollmentId!),
    enabled: !!enrollmentId,
  })

  const { data: patient } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: () => patientsApi.get(patientId!),
    enabled: !!patientId,
  })

  const { data: enrollments, isLoading } = useQuery({
    queryKey: ['enrollments', patientId],
    queryFn: () => enrollmentsApi.listForPatient(patientId!),
    enabled: !!patientId,
  })

  const enrollment = enrollments?.find(e => e.id === enrollmentId)

  if (isLoading) return <PageLoader />

  if (!enrollment) {
    return (
      <div className="max-w-xl mx-auto">
        <EmptyState icon={<BookOpen size={24} />} title="Enrollment not found"
          description="This plan may have been removed, or the link is out of date." />
      </div>
    )
  }

  const canUpdate = currentRole === 'THERAPIST'
    ? user?.id === enrollment.therapistId
    : canUpdateSession

  // A Parent can't edit a session's report, but can open a completed one read-only.
  const canViewSessions = currentRole === 'PARENT'

  const isAdminTier = ['CLINIC_HEAD', 'BUSINESS_OWNER', 'OFFICE_ADMIN'].includes(currentRole ?? '')

  const canUpdateCareStatus = currentRole === 'THERAPIST'
    ? user?.id === enrollment.therapistId
    : isAdminTier

  const careStatus = CARE_STATUS_VARIANT[enrollment.careStatus] ?? CARE_STATUS_VARIANT.ON_TRACK

  const progressPct = enrollment.totalSessions > 0
    ? Math.min(100, (enrollment.sessionsCompleted / enrollment.totalSessions) * 100)
    : 0

  const status = STATUS_VARIANT[enrollment.status] ?? STATUS_VARIANT.ACTIVE

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <Link
        to={ROUTES.patient(patientId!)}
        className="inline-flex items-center gap-1 text-sm transition-colors"
        style={{ color: colors.text.muted }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = colors.accent}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = colors.text.muted}
      >
        <ArrowLeft size={14} /> Back to {patient ? `${patient.firstName} ${patient.lastName}` : 'Case'}
      </Link>

      <Card>
        <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: accentAlpha(0.10) }}>
              <BookOpen size={15} style={{ color: colors.accent }} />
            </div>
            <div className="min-w-0">
              <p className="text-base font-semibold truncate" style={{ color: colors.text.heading }}>{enrollment.programName}</p>
              <p className="text-xs mt-0.5 truncate" style={{ color: colors.text.muted }}>
                {enrollment.therapistFirstName} {enrollment.therapistLastName}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <span className="text-[11.5px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide" style={status.style}>
              {status.label}
            </span>
            {enrollment.status === 'ACTIVE' && (
              <span className="text-[11.5px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide" style={careStatus.style}>
                {careStatus.label}
              </span>
            )}
          </div>
        </div>

        {enrollment.status === 'ACTIVE' && canUpdateCareStatus && (
          <div className="mb-4 pb-4 border-b" style={{ borderColor: border.divider }}>
            {!editingCareStatus ? (
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  {enrollment.careStatusNote && (
                    <p className="text-xs" style={{ color: colors.text.muted }}>{enrollment.careStatusNote}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {isAdminTier && (
                    <button
                      type="button"
                      className="text-xs font-semibold px-2.5 py-1.5 rounded-lg"
                      style={{ color: palette.green.text, background: paletteStyle('green', 0.10).background }}
                      onClick={() => setConfirmingComplete(true)}
                    >
                      Mark as Completed
                    </button>
                  )}
                  <button
                    type="button"
                    className="text-xs font-semibold px-2.5 py-1.5 rounded-lg"
                    style={{ color: colors.accent, background: accentAlpha(0.10) }}
                    onClick={() => { setCareDraft(enrollment.careStatus); setCareNote(enrollment.careStatusNote ?? ''); setEditingCareStatus(true) }}
                  >
                    Update care status
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <Select
                  label="Care status"
                  options={CARE_STATUS_OPTIONS}
                  value={careDraft}
                  onChange={e => setCareDraft(e.target.value as EnrollmentCareStatus)}
                />
                <div className="space-y-1">
                  <label className="form-label">Note (optional)</label>
                  <textarea
                    className="form-input"
                    rows={2}
                    value={careNote}
                    onChange={e => setCareNote(e.target.value)}
                    placeholder="What should staff know?"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => careStatusMut.mutate({ careStatus: careDraft, note: careNote })}
                    loading={careStatusMut.isPending}
                  >
                    Save
                  </Button>
                  <Button variant="ghost" onClick={() => setEditingCareStatus(false)}>Cancel</Button>
                </div>
              </div>
            )}
          </div>
        )}

        {enrollment.status === 'COMPLETED' && !enrollment.dischargedInRecordId && isAdminTier && (
          <div className="mb-4 pb-4 border-b flex items-center justify-between gap-3 flex-wrap" style={{ borderColor: border.divider }}>
            <p className="text-xs" style={{ color: colors.text.muted }}>
              This program was completed via the "Mark as Completed" override.
            </p>
            <button
              type="button"
              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg flex-shrink-0"
              style={{ color: colors.accent, background: accentAlpha(0.10) }}
              onClick={() => setConfirmingReactivate(true)}
            >
              Reactivate Program
            </button>
          </div>
        )}

        {(enrollment.careStatus === 'REVIEW' || enrollment.careStatus === 'PROGRAM_COMPLETED') && successCriteria && (
          <div className="mb-4 pb-4 border-b space-y-2" style={{ borderColor: border.divider }}>
            <p className="text-[11.5px] uppercase tracking-wider font-semibold" style={{ color: colors.text.dim }}>
              Discharge readiness
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="rounded-lg p-2.5" style={{ background: accentAlpha(0.05) }}>
                <p className="text-[11px]" style={{ color: colors.text.dim }}>Goal mastery</p>
                <p className="text-sm font-semibold" style={{ color: successCriteria.goalMasteryMet ? palette.green.text : colors.text.primary }}>
                  {successCriteria.goalMasteryPct !== null ? `${successCriteria.goalMasteryPct}%` : 'No data'}
                </p>
              </div>
              <div className="rounded-lg p-2.5" style={{ background: accentAlpha(0.05) }}>
                <p className="text-[11px]" style={{ color: colors.text.dim }}>Parent satisfaction</p>
                <p className="text-sm font-semibold" style={{ color: successCriteria.parentSatisfactionMet ? palette.green.text : colors.text.primary }}>
                  {successCriteria.parentSatisfactionPct !== null ? `${Math.round(successCriteria.parentSatisfactionPct)}%` : 'No data'}
                </p>
              </div>
              <div className="rounded-lg p-2.5 flex items-center justify-between" style={{ background: accentAlpha(0.05) }}>
                <div>
                  <p className="text-[11px]" style={{ color: colors.text.dim }}>Therapist sign-off</p>
                  <p className="text-sm font-semibold flex items-center gap-1" style={{ color: successCriteria.therapistSignedOff ? palette.green.text : colors.text.primary }}>
                    {successCriteria.therapistSignedOff
                      ? <><CheckCircle2 size={13} /> Confirmed</>
                      : <><Circle size={13} /> Pending</>}
                  </p>
                </div>
                {!successCriteria.therapistSignedOff && currentRole === 'THERAPIST' && user?.id === enrollment.therapistId && (
                  <button
                    onClick={() => signoffMut.mutate()}
                    disabled={signoffMut.isPending}
                    className="text-[11.5px] font-semibold px-2 py-1 rounded-lg flex-shrink-0"
                    style={{ color: colors.accent, background: accentAlpha(0.10) }}
                  >
                    Confirm
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="mb-4">
          <div className="flex items-end justify-between mb-2">
            <div>
              <p className="leading-none" style={{ color: colors.text.heading }}>
                <span className="text-3xl font-bold">{enrollment.sessionsCompleted}</span>
                <span className="text-lg font-medium ml-1.5" style={{ color: colors.text.muted }}>
                  / {enrollment.totalSessions}
                </span>
              </p>
              <p className="text-[11.5px] uppercase tracking-wider mt-1.5" style={{ color: colors.text.dim }}>
                sessions completed
              </p>
            </div>
            <p className="text-2xl font-bold leading-none mb-0.5"
              style={{ color: progressPct >= 100 ? palette.green.text : progressPct > 0 ? colors.accent : colors.text.dim }}>
              {Math.round(progressPct)}%
            </p>
          </div>
          <div className="h-2.5 rounded-full overflow-hidden" style={{ background: accentAlpha(0.10) }}>
            <div className="h-full rounded-full transition-all"
              style={{
                width: `${progressPct}%`,
                background: progressPct >= 100 ? palette.green.text : colors.accent,
                minWidth: enrollment.sessionsCompleted > 0 ? '6px' : '0',
              }} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" style={{ color: colors.text.muted }}>
          <span className="flex items-center gap-1.5">
            <CalendarDays size={11} style={{ color: colors.text.dim }} />
            {enrollment.startDate}{enrollment.endDate ? ` – ${enrollment.endDate}` : ''}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock size={11} style={{ color: colors.text.dim }} />
            {formatTimeStr(enrollment.startTime)} · {enrollment.sessionDurationMinutes}min
          </span>
        </div>
      </Card>

      <Card padding={false}>
        <div className="px-4 pt-4 pb-1">
          <h2 className="text-sm font-semibold" style={{ color: colors.text.heading }}>Sessions</h2>
        </div>
        <SessionList
          enrollmentId={enrollment.id}
          canUpdate={canUpdate}
          canReschedule={canRescheduleSession}
          canView={canViewSessions}
          hidePayment={currentRole === 'THERAPIST'}
          onOpenNotes={(s) => setNotesState({ session: s, canEdit: canUpdate })}
        />
      </Card>

      {notesState && (
        <SessionNotesModal
          session={notesState.session}
          canEdit={notesState.canEdit}
          canDirectlyCancel={['BUSINESS_OWNER', 'CLINIC_HEAD'].includes(currentRole ?? '')}
          enrollmentId={enrollment.id}
          onClose={() => setNotesState(null)}
        />
      )}

      <Modal open={confirmingComplete} onClose={() => setConfirmingComplete(false)} title="Mark Program Completed" error={completeError}>
        <div className="space-y-4">
          <p className="text-sm" style={{ color: colors.text.primary }}>
            {enrollment.sessionsCompleted < enrollment.totalSessions
              ? `This program has only ${enrollment.sessionsCompleted} of ${enrollment.totalSessions} sessions completed. Marking it completed now overrides that, closes the program early, and cancels its remaining upcoming sessions.`
              : 'This marks the program completed, closes it, and cancels any remaining upcoming sessions.'}
          </p>

          <p className="text-xs" style={{ color: colors.text.muted }}>
            Goal mastery and parent satisfaction are normally calculated from ongoing session/review
            data, which a program closed early won't have. Fill them in by hand if you have them —
            leave either blank to leave that criterion showing "No data".
          </p>

          <div className="grid grid-cols-2 gap-3">
            <Input
              type="number" min={0} max={100} step={1}
              label="Goal Mastery %"
              placeholder="e.g. 85"
              value={completeGoalMastery}
              onChange={e => setCompleteGoalMastery(e.target.value)}
            />
            <Input
              type="number" min={0} max={100} step={1}
              label="Parent Satisfaction %"
              placeholder="e.g. 80"
              value={completeParentSatisfaction}
              onChange={e => setCompleteParentSatisfaction(e.target.value)}
            />
          </div>

          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox" className="h-4 w-4" style={{ accentColor: colors.accent }}
              checked={completeTherapistSignoff}
              onChange={e => setCompleteTherapistSignoff(e.target.checked)}
            />
            <span className="text-sm" style={{ color: colors.text.primary }}>
              Record therapist sign-off on this program's goals
            </span>
          </label>

          <div className="space-y-1">
            <label className="form-label">Note (optional)</label>
            <textarea
              className="form-input"
              rows={2}
              value={completeNote}
              onChange={e => setCompleteNote(e.target.value)}
              placeholder="Why is this being marked completed now?"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => markCompleteMut.mutate({
                note: completeNote,
                manualGoalMasteryPct: completeGoalMastery === '' ? undefined : Number(completeGoalMastery),
                manualParentSatisfactionPct: completeParentSatisfaction === '' ? undefined : Number(completeParentSatisfaction),
                therapistSignedOff: completeTherapistSignoff,
              })}
              loading={markCompleteMut.isPending}
            >
              Mark as Completed
            </Button>
            <Button variant="ghost" onClick={() => setConfirmingComplete(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>

      <Modal open={confirmingReactivate} onClose={() => setConfirmingReactivate(false)} title="Reactivate Program" error={reactivateError}>
        <div className="space-y-4">
          <p className="text-sm" style={{ color: colors.text.primary }}>
            This sets the program back to Active with care status On Track, clears any manually
            entered goal mastery/parent satisfaction values, and restores to Scheduled the sessions
            that were cancelled when it was marked completed.
          </p>
          <div className="flex items-center gap-2">
            <Button onClick={() => reactivateMut.mutate()} loading={reactivateMut.isPending}>
              Reactivate Program
            </Button>
            <Button variant="ghost" onClick={() => setConfirmingReactivate(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
