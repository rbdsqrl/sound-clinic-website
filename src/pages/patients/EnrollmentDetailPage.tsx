import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, BookOpen, CalendarDays, Clock } from 'lucide-react'
import { patientsApi } from '../../api/patients'
import { enrollmentsApi } from '../../api/enrollments'
import { SessionList, SessionNotesModal } from './EnrollmentSessions'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageLoader } from '../../components/ui/Spinner'
import { useAuth } from '../../contexts/AuthContext'
import { ROUTES } from '../../lib/routes'
import { colors, accentAlpha, paletteStyle, palette } from '../../theme'
import type { TherapySessionResponse } from '../../types'

const STATUS_VARIANT: Record<string, { label: string; style: React.CSSProperties }> = {
  ACTIVE:    { label: 'Active',    style: paletteStyle('teal', 0.12, 0) },
  COMPLETED: { label: 'Completed', style: paletteStyle('green', 0.12, 0) },
  CANCELLED: { label: 'Cancelled', style: paletteStyle('red', 0.12, 0) },
}

export default function EnrollmentDetailPage() {
  const { patientId, enrollmentId } = useParams<{ patientId: string; enrollmentId: string }>()
  const { user, activeRole } = useAuth()
  const currentRole = activeRole ?? user?.role
  const canUpdateSession = ['THERAPIST', 'DOCTOR', 'ADMIN', 'BUSINESS_OWNER'].includes(currentRole ?? '')

  const [notesState, setNotesState] = useState<{ session: TherapySessionResponse; canEdit: boolean } | null>(null)

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
          <span className="text-[11.5px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide flex-shrink-0" style={status.style}>
            {status.label}
          </span>
        </div>

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
          canDirectlyCancel={['BUSINESS_OWNER', 'ADMIN'].includes(currentRole ?? '')}
          enrollmentId={enrollment.id}
          onClose={() => setNotesState(null)}
        />
      )}
    </div>
  )
}
