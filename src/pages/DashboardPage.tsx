import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2, Users, Stethoscope, Baby, CalendarDays, Clock, CheckCircle2, Circle, XCircle, AlertTriangle, RefreshCw, Cake, ListTodo, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { clinicsApi } from '../api/clinics'
import { tasksApi } from '../api/tasks'
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
import type { TherapySessionResponse, TherapySessionStatus, UpcomingBirthdayResponse, TaskResponse, TaskPriority } from '../types'

const today = format(new Date(), 'yyyy-MM-dd')
const PREVIEW = 3

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
  onSessionClick,
}: {
  sessions: TherapySessionResponse[]
  showTherapist: boolean
  onSessionClick?: (s: TherapySessionResponse) => void
}) {
  const [showAll, setShowAll] = useState(false)
  const sectionCard: React.CSSProperties = { ...styles.card, overflow: 'hidden', padding: 0 }

  const rowContent = (s: TherapySessionResponse) => (
    <>
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
    </>
  )

  const rowClass = 'flex items-center gap-4 px-4 sm:px-6 py-3.5 transition-colors w-full text-left'

  return (
    <>
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
            {sessions.slice(0, PREVIEW).map((s, i) => {
              const dividerStyle = i < sessions.slice(0, PREVIEW).length - 1 ? { borderBottom: `1px solid ${border.divider}` } : {}
              return onSessionClick ? (
                <button
                  key={s.id}
                  onClick={() => onSessionClick(s)}
                  className={rowClass}
                  style={dividerStyle}
                  onMouseEnter={ROW_HOVER_IN}
                  onMouseLeave={ROW_HOVER_OUT}
                >
                  {rowContent(s)}
                </button>
              ) : (
                <Link
                  key={s.id}
                  to={`/patients/${s.patientId}`}
                  className={rowClass}
                  style={dividerStyle}
                  onMouseEnter={ROW_HOVER_IN}
                  onMouseLeave={ROW_HOVER_OUT}
                >
                  {rowContent(s)}
                </Link>
              )
            })}
          </div>
        )}

        {sessions.length > PREVIEW && (
          <div className="px-4 sm:px-6 py-2.5 text-center" style={{ borderTop: `1px solid ${border.divider}` }}>
            <button
              onClick={() => setShowAll(true)}
              className="text-xs font-medium"
              style={{ color: colors.accent }}
            >
              View all {sessions.length} sessions
            </button>
          </div>
        )}
      </div>

      {showAll && (
        <Modal open title={`Today's Sessions (${sessions.length})`} onClose={() => setShowAll(false)} size="lg">
          <div className="overflow-y-auto max-h-[70vh] -mx-5 -mb-5">
            {sessions.map((s, i) => {
              const dividerStyle = i < sessions.length - 1 ? { borderBottom: `1px solid ${border.divider}` } : {}
              return onSessionClick ? (
                <button key={s.id} onClick={() => { onSessionClick(s); setShowAll(false) }}
                  className={rowClass} style={dividerStyle}
                  onMouseEnter={ROW_HOVER_IN} onMouseLeave={ROW_HOVER_OUT}>
                  {rowContent(s)}
                </button>
              ) : (
                <Link key={s.id} to={`/patients/${s.patientId}`}
                  className={rowClass} style={dividerStyle}
                  onMouseEnter={ROW_HOVER_IN} onMouseLeave={ROW_HOVER_OUT}>
                  {rowContent(s)}
                </Link>
              )
            })}
          </div>
        </Modal>
      )}
    </>
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
  const [showAll, setShowAll] = useState(false)
  const { toasts, toast, dismiss } = useToast()
  const qc = useQueryClient()

  if (sessions.length === 0) return null

  const rescheduleRow = (s: TherapySessionResponse, i: number, arr: TherapySessionResponse[]) => (
    <div
      key={s.id}
      className="flex items-center gap-4 px-4 sm:px-6 py-3.5"
      style={i < arr.length - 1 ? { borderBottom: `1px solid ${border.divider}` } : {}}
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
  )

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
          {sessions.slice(0, PREVIEW).map((s, i) => rescheduleRow(s, i, sessions.slice(0, PREVIEW)))}
        </div>

        {sessions.length > PREVIEW && (
          <div className="px-4 sm:px-6 py-2.5 text-center" style={{ borderTop: `1px solid ${border.divider}` }}>
            <button
              onClick={() => setShowAll(true)}
              className="text-xs font-medium"
              style={{ color: '#d97706' }}
            >
              View all {sessions.length} sessions
            </button>
          </div>
        )}
      </div>

      {showAll && (
        <Modal open title={`Needs Rescheduling (${sessions.length})`} onClose={() => setShowAll(false)} size="lg">
          <div className="overflow-y-auto max-h-[70vh] -mx-5 -mb-5">
            {sessions.map((s, i) => rescheduleRow(s, i, sessions))}
          </div>
        </Modal>
      )}

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

function dayLabel(days: number): string {
  if (days === 0) return 'Today!'
  if (days === 1) return 'Tomorrow'
  return `in ${days} days`
}

function dayColor(days: number): string {
  if (days === 0) return '#16a34a'
  if (days <= 7)  return '#d97706'
  return palette.purple.text
}

function UpcomingBirthdays({ birthdays }: { birthdays: UpcomingBirthdayResponse[] }) {
  const [showAll, setShowAll] = useState(false)

  if (birthdays.length === 0) return null

  const sectionCard: React.CSSProperties = { ...styles.card, overflow: 'hidden', padding: 0 }

  const birthdayRow = (b: UpcomingBirthdayResponse, i: number, arr: UpcomingBirthdayResponse[]) => (
    <Link
      key={b.id}
      to={`/patients/${b.id}`}
      className="flex items-center gap-3 px-4 sm:px-6 py-3 transition-colors"
      style={i < arr.length - 1 ? { borderBottom: `1px solid ${border.divider}` } : {}}
      onMouseEnter={ROW_HOVER_IN}
      onMouseLeave={ROW_HOVER_OUT}
    >
      <div
        className="h-8 w-8 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0"
        style={{ background: accentAlpha(0.10), color: colors.accent }}
      >
        {b.firstName[0]}{b.lastName[0]}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: colors.text.primary }}>
          {b.firstName} {b.lastName}
        </p>
        <p className="text-xs" style={{ color: colors.text.muted }}>
          {format(new Date(b.dateOfBirth + 'T00:00:00'), 'MMMM d')}
        </p>
      </div>

      <span
        className="flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full"
        style={{ background: dayColor(b.daysUntil) + '18', color: dayColor(b.daysUntil) }}
      >
        {dayLabel(b.daysUntil)}
      </span>
    </Link>
  )

  return (
    <>
      <div style={sectionCard}>
        <div
          className="px-4 sm:px-6 py-4 flex items-center justify-between"
          style={{ borderBottom: `1px solid ${border.divider}` }}
        >
          <div className="flex items-center gap-2">
            <Cake size={16} style={{ color: colors.accent }} />
            <h2 className="text-base font-semibold" style={{ color: colors.text.primary }}>
              Upcoming Birthdays
            </h2>
            <span
              className="text-xs font-bold min-w-[20px] h-5 rounded-full flex items-center justify-center px-1.5"
              style={{ background: accentAlpha(0.12), color: colors.accent }}
            >
              {birthdays.length}
            </span>
          </div>
          <p className="text-xs" style={{ color: colors.text.muted }}>Next 30 days</p>
        </div>

        <div>
          {birthdays.slice(0, PREVIEW).map((b, i) => birthdayRow(b, i, birthdays.slice(0, PREVIEW)))}
        </div>

        {birthdays.length > PREVIEW && (
          <div className="px-4 sm:px-6 py-2.5 text-center" style={{ borderTop: `1px solid ${border.divider}` }}>
            <button onClick={() => setShowAll(true)} className="text-xs font-medium" style={{ color: colors.accent }}>
              View all {birthdays.length} birthdays
            </button>
          </div>
        )}
      </div>

      {showAll && (
        <Modal open title={`Upcoming Birthdays (${birthdays.length})`} onClose={() => setShowAll(false)} size="lg">
          <div className="overflow-y-auto max-h-[70vh] -mx-5 -mb-5">
            {birthdays.map((b, i) => birthdayRow(b, i, birthdays))}
          </div>
        </Modal>
      )}
    </>
  )
}

// ── Session update modal (therapist / doctor dashboard shortcut) ───────────────

const SCORE_LABELS = ['Needs Work', 'Developing', 'On Track', 'Good', 'Excellent']

function scoreColor(score: number): string {
  if (score <= 2) return '#dc2626'
  if (score === 3) return '#d97706'
  return '#16a34a'
}

function SessionUpdateModal({
  session,
  onClose,
}: {
  session: TherapySessionResponse
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { toast } = useToast()

  const [feedback, setFeedback] = useState(session.feedback ?? '')
  const [notes, setNotes]       = useState(session.notes ?? '')
  const [score, setScore]       = useState<number | null>(session.performanceScore ?? null)

  const notesMut = useMutation({
    mutationFn: () => therapySessionsApi.updateNotes(session.id, {
      feedback: feedback || undefined,
      notes:    notes    || undefined,
      ...(score !== null ? { performanceScore: score } : {}),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['therapy-sessions-today'] })
      toast('Session saved', 'success')
      onClose()
    },
    onError: () => toast('Failed to save', 'error'),
  })

  const statusMut = useMutation({
    mutationFn: (status: TherapySessionStatus) =>
      therapySessionsApi.updateStatus(session.id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['therapy-sessions-today'] })
      toast('Session updated', 'success')
      onClose()
    },
    onError: () => toast('Failed to update session', 'error'),
  })

  const isScheduled = session.status === 'SCHEDULED'

  return (
    <Modal open title={`Session #${session.sessionNumber}`} onClose={onClose} size="lg">
      {/* Info strip */}
      <div className="flex items-center justify-between gap-3 mb-5 p-3 rounded-xl"
        style={{ background: accentAlpha(0.05) }}>
        <div>
          <p className="text-sm font-semibold" style={{ color: colors.text.heading }}>
            {session.patientFirstName} {session.patientLastName}
          </p>
          <p className="text-xs mt-0.5" style={{ color: colors.text.muted }}>
            {session.startTime.slice(0, 5)} · {session.programName} · #{session.sessionNumber}/{session.totalSessions}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] font-semibold px-2 py-1 rounded-full"
            style={{ background: statusColor(session.status) + '18', color: statusColor(session.status) }}>
            {session.status.replace(/_/g, ' ')}
          </span>
          <Link
            to={`/patients/${session.patientId}`}
            className="text-[10px] font-medium px-2 py-1 rounded-full"
            style={{ background: accentAlpha(0.10), color: colors.accent }}
            onClick={onClose}
          >
            View patient →
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {/* Status buttons — only for scheduled sessions */}
        {isScheduled && (
          <div>
            <p className="form-label">Mark session as</p>
            <div className="flex gap-2">
              {([
                { value: 'COMPLETED' as TherapySessionStatus, label: 'Completed', color: '#16a34a' },
                { value: 'NO_SHOW'   as TherapySessionStatus, label: 'No Show',   color: '#d97706' },
                { value: 'CANCELLED' as TherapySessionStatus, label: 'Cancelled', color: '#dc2626' },
              ]).map(opt => (
                <button
                  key={opt.value}
                  disabled={statusMut.isPending}
                  onClick={() => statusMut.mutate(opt.value)}
                  className="flex-1 text-xs font-semibold py-2.5 rounded-xl transition-opacity disabled:opacity-50"
                  style={{ background: opt.color + '18', color: opt.color }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Performance score */}
        <div>
          <label className="form-label">Performance Score</label>
          <div className="flex gap-2">
            {SCORE_LABELS.map((label, i) => {
              const val    = i + 1
              const active = score === val
              return (
                <button
                  key={val}
                  type="button"
                  onClick={() => setScore(active ? null : val)}
                  className="flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl text-[10px] font-semibold transition-colors"
                  style={{
                    background: active ? scoreColor(val) + '22' : surface.filterStrip,
                    color:      active ? scoreColor(val) : colors.text.muted,
                    border:     `1.5px solid ${active ? scoreColor(val) : 'transparent'}`,
                  }}
                >
                  <span className="text-sm font-bold">{val}</span>
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Feedback */}
        <div>
          <label className="form-label">Feedback</label>
          <textarea
            className="form-input w-full resize-none"
            rows={2}
            placeholder="Add session feedback…"
            value={feedback}
            onChange={e => setFeedback(e.target.value)}
          />
        </div>

        {/* Notes */}
        <div>
          <label className="form-label">Notes</label>
          <textarea
            className="form-input w-full resize-none"
            rows={2}
            placeholder="Any additional notes…"
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>
      </div>

      <div className="flex gap-2 justify-end mt-5 pt-4" style={{ borderTop: `1px solid ${border.divider}` }}>
        <Button variant="ghost" onClick={onClose}>Close</Button>
        <Button variant="primary" loading={notesMut.isPending} onClick={() => notesMut.mutate()}>
          Save
        </Button>
      </div>
    </Modal>
  )
}

function priorityColor(p: TaskPriority): string {
  if (p === 'HIGH')   return '#dc2626'
  if (p === 'MEDIUM') return '#d97706'
  return palette.blue.text
}

function dueDateLabel(dueDate: string | null): { label: string; color: string } | null {
  if (!dueDate) return null
  const due  = new Date(dueDate + 'T00:00:00')
  const now  = new Date()
  now.setHours(0, 0, 0, 0)
  const diff = Math.round((due.getTime() - now.getTime()) / 86400000)
  if (diff < 0)  return { label: `${Math.abs(diff)}d overdue`, color: '#dc2626' }
  if (diff === 0) return { label: 'Due today',   color: '#d97706' }
  if (diff === 1) return { label: 'Due tomorrow', color: '#d97706' }
  return { label: `Due ${format(due, 'MMM d')}`, color: colors.text.dim }
}

function MyTasks({ tasks, userId }: { tasks: TaskResponse[]; userId: string }) {
  const [showAll, setShowAll] = useState(false)

  const active = tasks.filter(
    t => (t.status === 'OPEN' || t.status === 'IN_PROGRESS') &&
         t.assignees.some(a => a.id === userId)
  )

  if (active.length === 0) return null

  const shown = active.slice(0, PREVIEW)
  const sectionCard: React.CSSProperties = { ...styles.card, overflow: 'hidden', padding: 0 }

  const taskRow = (task: TaskResponse, i: number, arr: TaskResponse[]) => {
    const due = dueDateLabel(task.dueDate)
    return (
      <Link
        key={task.id}
        to="/tasks"
        className="flex items-center gap-3 px-4 sm:px-6 py-3 transition-colors"
        style={i < arr.length - 1 ? { borderBottom: `1px solid ${border.divider}` } : {}}
        onMouseEnter={ROW_HOVER_IN}
        onMouseLeave={ROW_HOVER_OUT}
      >
        {/* Priority dot */}
        <div
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: priorityColor(task.priority) }}
        />

        {/* Title + assigner */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: colors.text.primary }}>
            {task.title}
          </p>
          <p className="text-xs truncate" style={{ color: colors.text.muted }}>
            From {task.assignedByFirstName} {task.assignedByLastName}
          </p>
        </div>

        {/* Due date */}
        {due && (
          <span className="text-[10px] font-medium flex-shrink-0" style={{ color: due.color }}>
            {due.label}
          </span>
        )}

        {/* Status chip */}
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 hidden sm:block"
          style={
            task.status === 'IN_PROGRESS'
              ? { background: accentAlpha(0.12), color: colors.accent }
              : { background: surface.filterStrip, color: colors.text.muted }
          }
        >
          {task.status === 'IN_PROGRESS' ? 'In progress' : 'Open'}
        </span>
      </Link>
    )
  }

  const inProgress = active.filter(t => t.status === 'IN_PROGRESS')
  const open = active.filter(t => t.status === 'OPEN')
  const hasBothGroups = inProgress.length > 0 && open.length > 0

  return (
    <>
      <div style={sectionCard}>
        <div className="px-4 sm:px-6 py-4 flex items-center justify-between"
          style={{ borderBottom: `1px solid ${border.divider}` }}>
          <div className="flex items-center gap-2">
            <ListTodo size={16} style={{ color: colors.accent }} />
            <h2 className="text-base font-semibold" style={{ color: colors.text.primary }}>My Tasks</h2>
            <span className="text-xs font-bold min-w-[20px] h-5 rounded-full flex items-center justify-center px-1.5"
              style={{ background: accentAlpha(0.12), color: colors.accent }}>
              {active.length}
            </span>
          </div>
          <Link to="/tasks" className="flex items-center gap-0.5 text-xs transition-colors" style={{ color: colors.accent }}>
            View all <ChevronRight size={12} />
          </Link>
        </div>

        <div>
          {shown.map((task, i) => taskRow(task, i, shown))}
        </div>

        {active.length > PREVIEW && (
          <div className="px-4 sm:px-6 py-2.5 text-center" style={{ borderTop: `1px solid ${border.divider}` }}>
            <button onClick={() => setShowAll(true)} className="text-xs font-medium" style={{ color: colors.accent }}>
              View all {active.length} tasks
            </button>
          </div>
        )}
      </div>

      {showAll && (
        <Modal open title={`My Tasks (${active.length})`} onClose={() => setShowAll(false)} size="lg">
          <div className="overflow-y-auto max-h-[70vh] -mx-5 -mb-5">
            {hasBothGroups && inProgress.length > 0 && (
              <p className="px-4 sm:px-6 py-2 text-[10px] font-semibold uppercase tracking-wide"
                style={{ color: colors.text.dim, borderBottom: `1px solid ${border.divider}` }}>
                In Progress
              </p>
            )}
            {inProgress.map((task, i) => taskRow(task, i, inProgress))}
            {hasBothGroups && open.length > 0 && (
              <p className="px-4 sm:px-6 py-2 text-[10px] font-semibold uppercase tracking-wide"
                style={{ color: colors.text.dim, borderTop: inProgress.length > 0 ? `1px solid ${border.divider}` : undefined, borderBottom: `1px solid ${border.divider}` }}>
                Open
              </p>
            )}
            {open.map((task, i) => taskRow(task, i, open))}
          </div>
        </Modal>
      )}
    </>
  )
}

export default function DashboardPage() {
  const { user, activeRole } = useAuth()
  const isParentView       = activeRole === 'PARENT'
  const isOwnerOrAdmin     = activeRole === 'BUSINESS_OWNER' || activeRole === 'ADMIN'
  const canReschedule      = isOwnerOrAdmin || activeRole === 'OFFICE_ADMIN'
  const isStaff            = isOwnerOrAdmin || activeRole === 'THERAPIST' || activeRole === 'DOCTOR' || activeRole === 'OFFICE_ADMIN'
  const canUpdateSession   = activeRole === 'THERAPIST' || activeRole === 'DOCTOR'

  const [editingSession, setEditingSession] = useState<TherapySessionResponse | null>(null)

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

  const { data: upcomingBirthdays = [] } = useQuery({
    queryKey: ['upcoming-birthdays'],
    queryFn: patientsApi.upcomingBirthdays,
    enabled: isStaff,
    staleTime: 60 * 60 * 1000,
  })

  const { data: myTasksAll = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: tasksApi.list,
    enabled: isStaff,
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

      {(() => {
        const myActiveTasks = myTasksAll.filter(
          t => (t.status === 'OPEN' || t.status === 'IN_PROGRESS') &&
               t.assignees.some(a => a.id === (user?.id ?? ''))
        )
        const hasSidebar = upcomingBirthdays.length > 0 || myActiveTasks.length > 0

        return (
          <div className={hasSidebar ? 'grid grid-cols-1 lg:grid-cols-3 gap-6 items-start' : ''}>
            <div className={hasSidebar ? 'lg:col-span-2' : ''}>
              <TodaySessions
                sessions={todaySessions}
                showTherapist={isOwnerOrAdmin}
                onSessionClick={canUpdateSession ? setEditingSession : undefined}
              />
            </div>

            {hasSidebar && (
              <div className="flex flex-col gap-6">
                <UpcomingBirthdays birthdays={upcomingBirthdays} />
                <MyTasks tasks={myTasksAll} userId={user?.id ?? ''} />
              </div>
            )}
          </div>
        )
      })()}

      {editingSession && (
        <SessionUpdateModal
          session={editingSession}
          onClose={() => setEditingSession(null)}
        />
      )}
    </div>
  )
}
