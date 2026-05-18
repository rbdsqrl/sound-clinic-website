import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2, Users, Stethoscope, Baby, CalendarDays, Clock, CheckCircle2, Circle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { clinicsApi } from '../api/clinics'
import { patientsApi } from '../api/patients'
import { therapySessionsApi } from '../api/therapySessions'
import { usersApi } from '../api/users'
import { StatCard } from '../components/ui/Card'
import { PageLoader } from '../components/ui/Spinner'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { useAuth } from '../contexts/AuthContext'
import { roleBadge } from '../components/ui/Badge'
import { colors, styles, border, palette, rgba, surface, accentAlpha } from '../theme'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/ui/Toast'
import type { TherapySessionResponse } from '../types'

const today = format(new Date(), 'yyyy-MM-dd')

const ROW_HOVER_IN  = (e: React.MouseEvent) => { (e.currentTarget as HTMLElement).style.background = surface.rowHover }
const ROW_HOVER_OUT = (e: React.MouseEvent) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }

function sessionStatusIcon(status: string) {
  if (status === 'COMPLETED') return <CheckCircle2 size={14} style={{ color: '#16a34a' }} />
  if (status === 'CANCELLED' || status === 'NO_SHOW') return <XCircle size={14} style={{ color: '#dc2626' }} />
  if (status === 'PENDING_RESCHEDULE') return <AlertTriangle size={14} style={{ color: '#d97706' }} />
  return <Circle size={14} style={{ color: colors.text.dim }} />
}

function statusColor(status: string): string {
  if (status === 'COMPLETED') return '#16a34a'
  if (status === 'CANCELLED' || status === 'NO_SHOW') return '#dc2626'
  if (status === 'PENDING_RESCHEDULE') return '#d97706'
  return palette.purple.text
}

function TodaySessions({
  sessions,
  showTherapist,
}: {
  sessions: TherapySessionResponse[]
  showTherapist: boolean
}) {
  const sectionCard: React.CSSProperties = { ...styles.card, overflow: 'hidden', padding: 0 }

  return (
    <div style={sectionCard}>
      <div className="px-4 sm:px-6 py-4 flex items-center justify-between"
        style={{ borderBottom: `1px solid ${border.divider}` }}>
        <div className="flex items-center gap-2">
          <CalendarDays size={16} style={{ color: colors.accent }} />
          <h2 className="text-base font-semibold" style={{ color: colors.text.primary }}>
            Today's Sessions
          </h2>
          <span className="text-xs font-bold min-w-[20px] h-5 rounded-full flex items-center justify-center px-1.5"
            style={{ background: accentAlpha(0.12), color: colors.accent }}>
            {sessions.length}
          </span>
        </div>
        <Link to="/calendar" className="text-xs transition-colors" style={{ color: colors.accent }}>
          Open calendar →
        </Link>
      </div>

      {sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-2">
          <CalendarDays size={28} style={{ color: colors.text.dim }} />
          <p className="text-sm" style={{ color: colors.text.muted }}>No sessions scheduled for today</p>
        </div>
      ) : (
        <div>
          {sessions.map((s, i) => (
            <Link
              key={s.id}
              to={`/patients/${s.patientId}`}
              className="flex items-center gap-4 px-4 sm:px-6 py-3.5 transition-colors"
              style={i < sessions.length - 1 ? { borderBottom: `1px solid ${border.divider}` } : {}}
              onMouseEnter={ROW_HOVER_IN}
              onMouseLeave={ROW_HOVER_OUT}
            >
              <div className="flex-shrink-0">{sessionStatusIcon(s.status)}</div>

              <div className="flex items-center gap-1 flex-shrink-0 w-24">
                <Clock size={11} style={{ color: colors.text.dim }} />
                <span className="text-xs font-medium tabular-nums" style={{ color: colors.text.muted }}>
                  {s.startTime.slice(0, 5)} – {s.endTime.slice(0, 5)}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate" style={{ color: colors.text.primary }}>
                  {s.patientFirstName} {s.patientLastName}
                </p>
                <p className="text-xs truncate" style={{ color: colors.text.muted }}>
                  {s.programName}
                  {showTherapist && (
                    <span style={{ color: colors.text.dim }}>
                      {' · '}{s.therapistFirstName} {s.therapistLastName}
                    </span>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs hidden sm:block" style={{ color: colors.text.dim }}>
                  #{s.sessionNumber}/{s.totalSessions}
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: statusColor(s.status) + '18', color: statusColor(s.status) }}>
                  {s.status.replace(/_/g, ' ')}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function RescheduleModal({
  session,
  onClose,
  onDone,
}: {
  session: TherapySessionResponse
  onClose: () => void
  onDone: () => void
}) {
  const [newDate, setNewDate] = useState('')
  const [substituteId, setSubstituteId] = useState('')
  const { toast } = useToast()
  const { data: therapists = [] } = useQuery({
    queryKey: ['therapists'],
    queryFn: () => usersApi.listTherapists(),
  })

  const therapistOptions = therapists
    .filter(t => t.id !== session.therapistId)
    .map(t => ({ value: t.id, label: `${t.firstName} ${t.lastName}` }))

  const mutation = useMutation({
    mutationFn: () => therapySessionsApi.reschedule(session.id, {
      newDate: newDate || undefined,
      substituteTherapistId: substituteId || undefined,
    }),
    onSuccess: () => { onDone() },
    onError: () => toast('Failed to reschedule session', 'error'),
  })

  const canSubmit = newDate || substituteId

  return (
    <Modal open onClose={onClose} title="Reschedule session">
      <div className="space-y-4">
        <div className="rounded-xl p-3 text-sm" style={{ background: accentAlpha(0.07), color: colors.text.muted }}>
          <p className="font-medium" style={{ color: colors.text.primary }}>
            {session.patientFirstName} {session.patientLastName}
          </p>
          <p>{session.programName} · Session #{session.sessionNumber}</p>
          <p>
            Original: {format(new Date(session.sessionDate), 'MMM d, yyyy')} at {session.startTime.slice(0, 5)}
            {' · '}{session.therapistFirstName} {session.therapistLastName}
          </p>
        </div>

        <p className="text-sm" style={{ color: colors.text.muted }}>
          Set a new date, assign a substitute therapist, or both.
        </p>

        <Input
          label="New date (optional)"
          type="date"
          value={newDate}
          onChange={e => setNewDate(e.target.value)}
          min={today}
        />

        <Select
          label="Substitute therapist (optional)"
          placeholder="Keep original therapist…"
          options={therapistOptions}
          value={substituteId}
          onChange={e => setSubstituteId(e.target.value)}
        />

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
            disabled={!canSubmit}
          >
            <RefreshCw size={14} /> Reschedule
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function PendingReschedulePanel({ sessions, onRescheduled }: {
  sessions: TherapySessionResponse[]
  onRescheduled: () => void
}) {
  const [selected, setSelected] = useState<TherapySessionResponse | null>(null)
  const { toasts, toast, dismiss } = useToast()
  const qc = useQueryClient()

  if (sessions.length === 0) return null

  return (
    <>
      <div style={{ ...styles.card, overflow: 'hidden', padding: 0, borderLeft: `3px solid #d97706` }}>
        <div className="px-4 sm:px-6 py-4 flex items-center justify-between"
          style={{ borderBottom: `1px solid ${border.divider}` }}>
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} style={{ color: '#d97706' }} />
            <h2 className="text-base font-semibold" style={{ color: colors.text.primary }}>
              Needs Rescheduling
            </h2>
            <span className="text-xs font-bold min-w-[20px] h-5 rounded-full flex items-center justify-center px-1.5"
              style={{ background: '#d9770618', color: '#d97706' }}>
              {sessions.length}
            </span>
          </div>
          <p className="text-xs" style={{ color: colors.text.muted }}>Therapist on approved leave</p>
        </div>

        <div>
          {sessions.map((s, i) => (
            <div
              key={s.id}
              className="flex items-center gap-4 px-4 sm:px-6 py-3.5"
              style={i < sessions.length - 1 ? { borderBottom: `1px solid ${border.divider}` } : {}}
            >
              {/* Date */}
              <div className="flex-shrink-0 w-20 sm:w-24">
                <p className="text-xs font-medium tabular-nums" style={{ color: colors.text.muted }}>
                  {format(new Date(s.sessionDate), 'MMM d')}
                </p>
                <p className="text-xs tabular-nums" style={{ color: colors.text.dim }}>
                  {s.startTime.slice(0, 5)}
                </p>
              </div>

              {/* Patient + program */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate" style={{ color: colors.text.primary }}>
                  {s.patientFirstName} {s.patientLastName}
                </p>
                <p className="text-xs truncate" style={{ color: colors.text.muted }}>
                  {s.programName}
                  <span style={{ color: colors.text.dim }}>
                    {' · '}{s.therapistFirstName} {s.therapistLastName}
                  </span>
                </p>
              </div>

              {/* Session count */}
              <span className="text-xs flex-shrink-0 hidden sm:block" style={{ color: colors.text.dim }}>
                #{s.sessionNumber}/{s.totalSessions}
              </span>

              {/* Action */}
              <button
                onClick={() => setSelected(s)}
                className="flex-shrink-0 flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                style={{ background: '#d9770618', color: '#d97706' }}
              >
                <RefreshCw size={12} /> Reschedule
              </button>
            </div>
          ))}
        </div>
      </div>

      {selected && (
        <RescheduleModal
          session={selected}
          onClose={() => setSelected(null)}
          onDone={() => {
            setSelected(null)
            qc.invalidateQueries({ queryKey: ['sessions-pending-reschedule'] })
            qc.invalidateQueries({ queryKey: ['therapy-sessions-today'] })
            onRescheduled()
            toast('Session rescheduled', 'success')
          }}
        />
      )}

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </>
  )
}

export default function DashboardPage() {
  const { user, activeRole } = useAuth()
  const isParentView       = activeRole === 'PARENT'
  const isOwnerOrAdmin     = activeRole === 'BUSINESS_OWNER' || activeRole === 'ADMIN'
  const canReschedule      = isOwnerOrAdmin || activeRole === 'OFFICE_ADMIN'
  const isStaff            = isOwnerOrAdmin || activeRole === 'THERAPIST' || activeRole === 'DOCTOR' || activeRole === 'OFFICE_ADMIN'

  const { data: clinics,    isLoading: loadingClinics }  = useQuery({ queryKey: ['clinics'],     queryFn: clinicsApi.list,        enabled: isOwnerOrAdmin })
  const { data: patients,   isLoading: loadingPatients }  = useQuery({ queryKey: ['patients'],    queryFn: patientsApi.list,       enabled: isStaff })
  const { data: myChildren, isLoading: loadingChildren }  = useQuery({ queryKey: ['my-children'], queryFn: patientsApi.myChildren, enabled: isParentView })
  const { data: todaySessions = [], isLoading: loadingSessions } = useQuery({
    queryKey: ['therapy-sessions-today'],
    queryFn: () => therapySessionsApi.list({ from: today, to: today }),
    enabled: isStaff,
    staleTime: 2 * 60 * 1000,
  })
  const { data: pendingReschedule = [], refetch: refetchPending } = useQuery({
    queryKey: ['sessions-pending-reschedule'],
    queryFn: () => therapySessionsApi.list({ status: 'PENDING_RESCHEDULE' }),
    enabled: canReschedule,
    staleTime: 2 * 60 * 1000,
  })

  const uniqueTherapistIds = new Set(patients?.flatMap(p => p.therapists).map(t => t.id) ?? [])

  if (loadingClinics || loadingPatients || loadingChildren || loadingSessions) return <PageLoader />

  // ── Parent dashboard ──────────────────────────────────────────────────────
  if (isParentView) {
    return (
      <div className="space-y-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold" style={{ color: colors.text.heading }}>
              Welcome back, {user?.firstName}
            </h1>
            {activeRole && roleBadge(activeRole)}
          </div>
          <p className="mt-1 text-sm" style={{ color: colors.text.dim }}>Here's a summary for your children.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Children"           value={myChildren?.length ?? 0}                                                   icon={<Baby size={22} />}        color="purple" />
          <StatCard label="Conditions"          value={myChildren?.reduce((s, c) => s + c.conditions.length, 0) ?? 0}             icon={<Users size={22} />}       color="blue" />
          <StatCard label="Assigned Therapists" value={new Set(myChildren?.flatMap(c => c.therapists.map(t => t.id)) ?? []).size} icon={<Stethoscope size={22} />} color="green" />
        </div>

        {myChildren && myChildren.length > 0 && (
          <div style={{ ...styles.card, overflow: 'hidden', padding: 0 }}>
            <div className="px-6 py-4 flex items-center justify-between"
              style={{ borderBottom: `1px solid ${border.divider}` }}>
              <h2 className="text-base font-semibold" style={{ color: colors.text.primary }}>My Children</h2>
              <Link to="/my-children" className="text-xs transition-colors" style={{ color: colors.accent }}>View all →</Link>
            </div>
            <div>
              {myChildren.map((child, i) => (
                <Link
                  key={child.id}
                  to={`/patients/${child.id}`}
                  className="flex items-center gap-4 px-6 py-3 transition-colors"
                  style={i < myChildren.length - 1 ? { borderBottom: `1px solid ${border.divider}` } : {}}
                  onMouseEnter={ROW_HOVER_IN}
                  onMouseLeave={ROW_HOVER_OUT}
                >
                  <div
                    className="h-9 w-9 rounded-full text-sm font-semibold flex items-center justify-center flex-shrink-0"
                    style={{ background: rgba(palette.purple.raw, 0.10), color: palette.purple.text }}
                  >
                    {child.firstName[0]}{child.lastName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium" style={{ color: colors.text.primary }}>{child.firstName} {child.lastName}</p>
                    <p className="text-xs" style={{ color: colors.text.dim }}>
                      {child.dateOfBirth ? format(new Date(child.dateOfBirth), 'MMM d, yyyy') : 'No DOB'}
                      {child.conditions.length > 0 && ` · ${child.conditions.length} condition${child.conditions.length !== 1 ? 's' : ''}`}
                    </p>
                  </div>
                  <p className="text-xs" style={{ color: colors.text.dim }}>
                    {child.therapists.length} therapist{child.therapists.length !== 1 ? 's' : ''}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Staff dashboard ───────────────────────────────────────────────────────
  const completedToday = todaySessions.filter(s => s.status === 'COMPLETED').length

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold" style={{ color: colors.text.heading }}>
            Welcome back, {user?.firstName}
          </h1>
          {activeRole && roleBadge(activeRole)}
        </div>
        <p className="mt-1 text-sm" style={{ color: colors.text.dim }}>
          {format(new Date(), 'EEEE, d MMMM yyyy')}
        </p>
      </div>

      {isOwnerOrAdmin ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Clinics"          value={clinics?.length ?? 0}        icon={<Building2 size={22} />}    color="teal" />
          <StatCard label="Patients"         value={patients?.length ?? 0}       icon={<Users size={22} />}        color="blue" />
          <StatCard label="Therapists"       value={uniqueTherapistIds.size}     icon={<Stethoscope size={22} />}  color="green" />
          <StatCard label="Sessions Today"   value={todaySessions.length}        icon={<CalendarDays size={22} />} color="purple" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <StatCard label="Sessions Today"   value={todaySessions.length}        icon={<CalendarDays size={22} />} color="purple" />
          <StatCard label="Completed"        value={completedToday}              icon={<CheckCircle2 size={22} />} color="green" />
          <StatCard label="Remaining"        value={todaySessions.filter(s => s.status === 'SCHEDULED').length} icon={<Clock size={22} />} color="blue" />
        </div>
      )}

      {canReschedule && (
        <PendingReschedulePanel
          sessions={pendingReschedule}
          onRescheduled={() => refetchPending()}
        />
      )}

      <TodaySessions sessions={todaySessions} showTherapist={isOwnerOrAdmin} />
    </div>
  )
}
