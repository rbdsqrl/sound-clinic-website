import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronRight, BookOpen, CalendarDays, Clock, CheckCircle2, Circle } from 'lucide-react'
import { patientsApi } from '../../api/patients'
import { enrollmentsApi } from '../../api/enrollments'
import { analyticsApi } from '../../api/analytics'
import { SessionList, SessionNotesModal } from './EnrollmentSessions'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageLoader } from '../../components/ui/Spinner'
import { Select } from '../../components/ui/Select'
import { Button } from '../../components/ui/Button'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../hooks/useToast'
import { ROUTES } from '../../lib/routes'
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

const CARE_STATUS_OPTIONS = [
  { value: 'ON_TRACK', label: 'On Track' },
  { value: 'NEEDS_ATTENTION', label: 'Needs Attention' },
  { value: 'REVIEW', label: 'Review' },
  { value: 'PROGRAM_COMPLETED', label: 'Program Completed' },
]

export default function EnrollmentDetailPage() {
  const { patientId, enrollmentId } = useParams<{ patientId: string; enrollmentId: string }>()
  const { user, activeRole } = useAuth()
  const currentRole = activeRole ?? user?.role
  const canUpdateSession = ['THERAPIST', 'DOCTOR', 'CLINIC_HEAD', 'BUSINESS_OWNER'].includes(currentRole ?? '')

  const [notesState, setNotesState] = useState<{ session: TherapySessionResponse; canEdit: boolean } | null>(null)
  const [editingCareStatus, setEditingCareStatus] = useState(false)
  const [careDraft, setCareDraft] = useState<EnrollmentCareStatus>('ON_TRACK')
  const [careNote, setCareNote] = useState('')

  const qc = useQueryClient()
  const { toast } = useToast()

  const careStatusMut = useMutation({
    mutationFn: (payload: { careStatus: EnrollmentCareStatus; note: string }) =>
      enrollmentsApi.updateCareStatus(enrollmentId!, payload.careStatus, payload.note || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['enrollments', patientId] })
      toast('Care status updated', 'success')
      setEditingCareStatus(false)
    },
    onError: () => toast('Failed to update care status', 'error'),
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
      <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto">
        <EmptyState icon={<BookOpen size={24} />} title="Enrollment not found"
          description="This plan may have been removed, or the link is out of date." />
      </div>
    )
  }

  const canUpdate = (currentRole === 'THERAPIST' || currentRole === 'DOCTOR')
    ? user?.id === enrollment.therapistId
    : canUpdateSession

  const canUpdateCareStatus = currentRole === 'THERAPIST'
    ? user?.id === enrollment.therapistId
    : ['CLINIC_HEAD', 'BUSINESS_OWNER'].includes(currentRole ?? '')

  const careStatus = CARE_STATUS_VARIANT[enrollment.careStatus] ?? CARE_STATUS_VARIANT.ON_TRACK

  const progressPct = enrollment.totalSessions > 0
    ? Math.min(100, (enrollment.sessionsCompleted / enrollment.totalSessions) * 100)
    : 0

  const status = STATUS_VARIANT[enrollment.status] ?? STATUS_VARIANT.ACTIVE

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center gap-1.5 text-sm min-w-0" style={{ color: colors.text.dim }}>
        <Link to={ROUTES.patient(patientId!)} className="hover:underline flex-shrink-0">
          {patient ? `${patient.firstName} ${patient.lastName}` : 'Patient'}
        </Link>
        <ChevronRight size={14} className="flex-shrink-0" />
        <span className="truncate" style={{ color: colors.text.primary }}>{enrollment.programName}</span>
      </div>

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
                <button
                  type="button"
                  className="text-xs font-semibold px-2.5 py-1.5 rounded-lg flex-shrink-0"
                  style={{ color: colors.accent, background: accentAlpha(0.10) }}
                  onClick={() => { setCareDraft(enrollment.careStatus); setCareNote(enrollment.careStatusNote ?? ''); setEditingCareStatus(true) }}
                >
                  Update care status
                </button>
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
            {enrollment.startTime.slice(0, 5)} · {enrollment.sessionDurationMinutes}min
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
    </div>
  )
}
