import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, Clock, CheckCircle2, Circle, XCircle, AlertTriangle, RefreshCw, Cake, ListTodo, ChevronRight, Newspaper, Heart, MessageCircle, Eye, UserPlus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { format, parseISO, subDays, differenceInCalendarDays } from 'date-fns'
import DOMPurify from 'dompurify'
import { clinicsApi } from '../api/clinics'
import { slotsApi } from '../api/appointments'
import { tasksApi } from '../api/tasks'
import { feedApi } from '../api/feed'
import { patientsApi } from '../api/patients'
import { therapySessionsApi } from '../api/therapySessions'
import { usersApi } from '../api/users'
import { invitationsApi } from '../api/invitations'
import { Avatar } from '../components/shared/Avatar'
import ChildrenProgressChart from '../components/charts/ChildrenProgressChart'
import { PageLoader } from '../components/ui/Spinner'
import { PerformanceScoreSlider } from '../components/ui/PerformanceScore'
import { StarRating } from './patients/ReviewMeetings'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { EmptyState } from '../components/ui/EmptyState'
import { useAuth } from '../contexts/AuthContext'
import { roleBadge, sessionStatusLabel } from '../components/ui/Badge'
import { colors, styles, border, palette, rgba, surface, accentAlpha, successAlpha, dangerAlpha, warningAlpha } from '../theme'
import { useToast } from '../hooks/useToast'
import { getApiError } from '../lib/apiError'
import { ToastContainer } from '../components/ui/Toast'
import { ROUTES } from '../lib/routes'
import { isPastDateTime } from '../lib/schedule'
import { formatTimeStr } from '../lib/format'
import AttendanceWidget from './attendance/AttendanceWidget'
import type { TherapySessionResponse, TherapySessionStatus, UpcomingBirthdayResponse, TaskResponse, TaskPriority, RescheduleReason, SlotResponse, DayOfWeek, FeedPostResponse, PatientResponse, StaffMemberResponse, InviteResponse } from '../types'

const today = format(new Date(), 'yyyy-MM-dd')
const PREVIEW = 3

/** Every dashboard tile shares this height so the 2-column grid lines up evenly. */
const TILE_MIN_HEIGHT = 360

const ROW_HOVER_IN  = (e: React.MouseEvent) => { (e.currentTarget as HTMLElement).style.background = surface.rowHover }
const ROW_HOVER_OUT = (e: React.MouseEvent) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }

/** Pulsing placeholder for a dashboard tile while its query is in flight — same footprint as a
 *  real card so the grid doesn't jump when the content swaps in. */
function CardSkeleton() {
  const sectionCard: React.CSSProperties = {
    ...styles.card, overflow: 'hidden', padding: 0,
    minHeight: TILE_MIN_HEIGHT, display: 'flex', flexDirection: 'column',
  }
  return (
    <div style={sectionCard} className="animate-pulse">
      <div className="px-4 sm:px-6 py-4 flex items-center gap-2" style={{ borderBottom: `1px solid ${border.divider}` }}>
        <div className="h-4 w-4 rounded-full flex-shrink-0" style={{ background: accentAlpha(0.15) }} />
        <div className="h-3.5 w-28 rounded-full" style={{ background: accentAlpha(0.15) }} />
      </div>
      <div className="flex-1">
        {Array.from({ length: PREVIEW }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-4 sm:px-6 py-3.5"
            style={i < PREVIEW - 1 ? { borderBottom: `1px solid ${border.divider}` } : {}}
          >
            <div className="h-9 w-9 rounded-full flex-shrink-0" style={{ background: accentAlpha(0.10) }} />
            <div className="flex-1 min-w-0 space-y-2">
              <div className="h-3 rounded-full" style={{ width: '60%', background: accentAlpha(0.10) }} />
              <div className="h-2.5 rounded-full" style={{ width: '35%', background: accentAlpha(0.07) }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const JS_TO_DOW: DayOfWeek[] = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY']
const DOW_SHORT: Record<DayOfWeek, string> = {
  MONDAY: 'M', TUESDAY: 'T', WEDNESDAY: 'W', THURSDAY: 'T', FRIDAY: 'F', SATURDAY: 'S', SUNDAY: 'S',
}
const DOW_ORDER: DayOfWeek[] = ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY']

function AvailabilityHint({ slots, date }: { slots: SlotResponse[]; date: string }) {
  const availDays = new Set(slots.map(s => s.dayOfWeek))

  const dateDow = date ? JS_TO_DOW[new Date(date + 'T00:00:00').getDay()] : null
  const matchedSlots = dateDow ? slots.filter(s => s.dayOfWeek === dateDow) : []

  return (
    <div className="space-y-2">
      {/* Weekly availability chip row */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs" style={{ color: colors.text.dim }}>Available:</span>
        <div className="flex gap-1">
          {DOW_ORDER.map(dow => {
            const active = availDays.has(dow)
            return (
              <span key={dow}
                className="h-6 w-6 rounded-full text-[11.5px] font-bold flex items-center justify-center"
                style={{
                  background: active ? (dateDow === dow ? successAlpha(0.12) : accentAlpha(0.12)) : accentAlpha(0.04),
                  color: active ? (dateDow === dow ? colors.status.success : colors.accent) : colors.text.dim,
                  border: dateDow === dow ? `1.5px solid ${active ? colors.status.success : colors.status.danger}` : 'none',
                }}>
                {DOW_SHORT[dow]}
              </span>
            )
          })}
        </div>
      </div>

      {/* Date-specific feedback */}
      {date && (
        matchedSlots.length > 0 ? (
          <div className="flex items-center gap-1.5 text-xs" style={{ color: colors.status.success }}>
            <CheckCircle2 size={12} />
            Available {matchedSlots.map(s => `${formatTimeStr(s.startTime)}–${formatTimeStr(s.endTime)}`).join(', ')}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs" style={{ color: colors.status.warning }}>
            <AlertTriangle size={12} />
            Not scheduled on {dateDow ? dateDow.charAt(0) + dateDow.slice(1).toLowerCase() + 's' : 'this day'}
          </div>
        )
      )}
    </div>
  )
}

function sessionStatusIcon(status: string) {
  if (status === 'COMPLETED') return <CheckCircle2 size={14} style={{ color: colors.status.success }} />
  if (status === 'CANCELLED' || status === 'NO_SHOW') return <XCircle size={14} style={{ color: colors.status.danger }} />
  if (status === 'PENDING_RESCHEDULE') return <AlertTriangle size={14} style={{ color: colors.status.warning }} />
  if (status === 'CANCELLATION_REQUESTED') return <XCircle size={14} style={{ color: colors.status.danger }} />
  return <Circle size={14} style={{ color: colors.text.dim }} />
}

function statusColor(status: string): string {
  if (status === 'COMPLETED') return colors.status.success
  if (status === 'CANCELLED' || status === 'NO_SHOW') return colors.status.danger
  if (status === 'PENDING_RESCHEDULE') return colors.status.warning
  if (status === 'CANCELLATION_REQUESTED') return colors.status.danger
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
  const sectionCard: React.CSSProperties = {
    ...styles.card, overflow: 'hidden', padding: 0,
    minHeight: TILE_MIN_HEIGHT, display: 'flex', flexDirection: 'column',
  }

  // Notes are only actually overdue once the session has finished — while it's
  // still running, "Notes overdue" would just be wrong.
  const isOverdue = (s: TherapySessionResponse) =>
    s.status === 'SCHEDULED' && isPastDateTime(s.sessionDate, s.endTime.slice(0, 5))
  const isOngoing = (s: TherapySessionResponse) =>
    s.status === 'SCHEDULED' && !isOverdue(s) && isPastDateTime(s.sessionDate, s.startTime.slice(0, 5))

  const rowContent = (s: TherapySessionResponse) => (
    <>
      <div className="flex-shrink-0">
        {isOverdue(s)
          ? <AlertTriangle size={14} style={{ color: colors.status.warning }} />
          : isOngoing(s)
            ? <Clock size={14} style={{ color: colors.accent }} />
            : sessionStatusIcon(s.status)}
      </div>

      <div className="flex items-center gap-1 flex-shrink-0 w-32">
        <Clock size={11} style={{ color: colors.text.dim }} />
        <span className="text-xs font-medium tabular-nums" style={{ color: colors.text.muted }}>
          {formatTimeStr(s.startTime)} – {formatTimeStr(s.endTime)}
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
        <span className="text-xs hidden sm:block w-12 text-right tabular-nums flex-shrink-0" style={{ color: colors.text.dim }}>
          {s.sessionNumber}/{s.totalSessions}
        </span>
        <span className="text-[11.5px] font-semibold px-2 py-0.5 rounded-full text-center flex-shrink-0"
          style={{
            minWidth: 108,
            ...(isOverdue(s)
              ? { background: warningAlpha(0.14), color: colors.status.warning }
              : isOngoing(s)
                ? { background: accentAlpha(0.14), color: colors.accent }
                : { background: statusColor(s.status) + '18', color: statusColor(s.status) }),
          }}>
          {isOverdue(s) ? 'Notes overdue' : isOngoing(s) ? 'Ongoing' : sessionStatusLabel(s.status)}
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

        <div className="flex-1">
          {sessions.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-2">
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
                    to={`/patients/${s.patientId}/enrollments/${s.enrollmentId}`}
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
        </div>

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

  // The active therapist is the substitute if chosen, otherwise the original
  const activeTherapistId = substituteId || session.therapistId

  const { data: slots = [] } = useQuery({
    queryKey: ['therapist-slots', activeTherapistId],
    queryFn: () => slotsApi.list(activeTherapistId),
    enabled: !!activeTherapistId,
    staleTime: 5 * 60 * 1000,
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
    onError: (err) => toast(getApiError(err, 'Failed to reschedule session'), 'error'),
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
            Original: {format(new Date(session.sessionDate), 'MMM d, yyyy')} at {formatTimeStr(session.startTime)}
            {' · '}Therapist {session.therapistFirstName} {session.therapistLastName}
          </p>
        </div>

        <p className="text-sm" style={{ color: colors.text.muted }}>
          Set a new date, assign a substitute therapist, or both.
        </p>

        <Select
          label="Substitute therapist (optional)"
          placeholder="Keep original therapist…"
          options={therapistOptions}
          value={substituteId}
          onChange={e => setSubstituteId(e.target.value)}
        />

        <div className="space-y-2">
          <Input
            label="New date (optional)"
            type="date"
            value={newDate}
            onChange={e => setNewDate(e.target.value)}
            min={today}
          />
          {slots.length > 0 && (
            <div className="px-1">
              <AvailabilityHint slots={slots} date={newDate} />
            </div>
          )}
          {slots.length === 0 && (
            <p className="text-xs px-1" style={{ color: colors.text.dim }}>
              No availability slots defined for this therapist.
            </p>
          )}
        </div>

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

function rescheduleReasonBadge(reason: RescheduleReason | null | undefined) {
  if (reason === 'PUBLIC_HOLIDAY') return (
    <span className="text-[11.5px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
      style={{ background: `rgba(${palette.blue.raw}, 0.09)`, color: palette.blue.text }}>Holiday</span>
  )
  if (reason === 'PARENT_REQUEST') return (
    <span className="text-[11.5px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
      style={{ background: `rgba(${palette.purple.raw}, 0.09)`, color: palette.purple.text }}>Parent request</span>
  )
  return (
    <span className="text-[11.5px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
      style={{ background: warningAlpha(0.09), color: colors.status.warning }}>Therapist leave</span>
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

  const rescheduleRow = (s: TherapySessionResponse, i: number, arr: TherapySessionResponse[]) => (
    <div
      key={s.id}
      className="flex items-center gap-4 px-4 sm:px-6 py-3.5"
      style={i < arr.length - 1 ? { borderBottom: `1px solid ${border.divider}` } : {}}
    >
      {/* Date */}
      <div className="flex-shrink-0 w-24 sm:w-28">
        <p className="text-xs font-medium tabular-nums" style={{ color: colors.text.muted }}>
          {format(new Date(s.sessionDate), 'MMM d')}
        </p>
        <p className="text-xs tabular-nums" style={{ color: colors.text.dim }}>
          {formatTimeStr(s.startTime)}
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

      {/* Reason badge + session count */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-xs hidden sm:block" style={{ color: colors.text.dim }}>
          {s.sessionNumber}/{s.totalSessions}
        </span>
        {rescheduleReasonBadge(s.rescheduleReason)}
      </div>

      {/* Action */}
      <button
        onClick={() => setSelected(s)}
        className="flex-shrink-0 flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
        style={{ background: warningAlpha(0.09), color: colors.status.warning }}
      >
        <RefreshCw size={12} /> Reschedule
      </button>
    </div>
  )

  return (
    <>
      <div style={{
        ...styles.card, overflow: 'hidden', padding: 0, borderLeft: `3px solid ${colors.status.warning}`,
        minHeight: TILE_MIN_HEIGHT, display: 'flex', flexDirection: 'column',
      }}>
        <div className="px-4 sm:px-6 py-4 flex items-center justify-between"
          style={{ borderBottom: `1px solid ${border.divider}` }}>
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} style={{ color: colors.status.warning }} />
            <h2 className="text-base font-semibold" style={{ color: colors.text.primary }}>
              Needs Rescheduling
            </h2>
            <span className="text-xs font-bold min-w-[20px] h-5 rounded-full flex items-center justify-center px-1.5"
              style={{ background: warningAlpha(0.09), color: colors.status.warning }}>
              {sessions.length}
            </span>
          </div>
          <p className="text-xs" style={{ color: colors.text.muted }}>Leave · Holiday · Parent request</p>
        </div>

        <div className="flex-1">
          {sessions.length === 0 ? (
            <div className="h-full flex flex-col justify-center">
              <EmptyState
                icon={<AlertTriangle size={22} />}
                title="Nothing to reschedule"
                description="Sessions affected by leave, holidays, or parent requests will show up here."
              />
            </div>
          ) : (
            <div>
              {sessions.slice(0, PREVIEW).map((s, i) => rescheduleRow(s, i, sessions.slice(0, PREVIEW)))}
            </div>
          )}
        </div>

        {sessions.length > PREVIEW && (
          <div className="px-4 sm:px-6 py-2.5 text-center" style={{ borderTop: `1px solid ${border.divider}` }}>
            <button
              onClick={() => setShowAll(true)}
              className="text-xs font-medium"
              style={{ color: colors.status.warning }}
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
            qc.invalidateQueries({ queryKey: ['therapy-sessions-cal'] })
            onRescheduled()
            toast('Session rescheduled', 'success')
          }}
        />
      )}

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </>
  )
}

function PendingSessionNotesPanel({ sessions }: { sessions: TherapySessionResponse[] }) {
  const [showAll, setShowAll] = useState(false)

  const row = (s: TherapySessionResponse, i: number, arr: TherapySessionResponse[]) => (
    <Link
      key={s.id}
      to={ROUTES.enrollment(s.patientId, s.enrollmentId)}
      className="flex items-center gap-4 px-4 sm:px-6 py-3.5 transition-colors"
      style={i < arr.length - 1 ? { borderBottom: `1px solid ${border.divider}` } : {}}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = surface.rowHover}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
    >
      <div className="flex-shrink-0 w-24 sm:w-28">
        <p className="text-xs font-medium tabular-nums" style={{ color: colors.text.muted }}>
          {format(new Date(s.sessionDate), 'MMM d')}
        </p>
        <p className="text-xs tabular-nums" style={{ color: colors.text.dim }}>
          {formatTimeStr(s.startTime)}
        </p>
      </div>

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

      <span
        className="flex-shrink-0 flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg"
        style={{ background: warningAlpha(0.09), color: colors.status.warning }}
      >
        <AlertTriangle size={12} /> Notes overdue
      </span>
    </Link>
  )

  return (
    <>
      <div style={{
        ...styles.card, overflow: 'hidden', padding: 0, borderLeft: `3px solid ${colors.status.warning}`,
        minHeight: TILE_MIN_HEIGHT, display: 'flex', flexDirection: 'column',
      }}>
        <div className="px-4 sm:px-6 py-4 flex items-center justify-between"
          style={{ borderBottom: `1px solid ${border.divider}` }}>
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} style={{ color: colors.status.warning }} />
            <h2 className="text-base font-semibold" style={{ color: colors.text.primary }}>
              Pending Session Notes
            </h2>
            <span className="text-xs font-bold min-w-[20px] h-5 rounded-full flex items-center justify-center px-1.5"
              style={{ background: warningAlpha(0.09), color: colors.status.warning }}>
              {sessions.length}
            </span>
          </div>
          <p className="text-xs" style={{ color: colors.text.muted }}>Sessions past their time, still unmarked</p>
        </div>

        <div className="flex-1">
          <div>
            {sessions.slice(0, PREVIEW).map((s, i) => row(s, i, sessions.slice(0, PREVIEW)))}
          </div>
        </div>

        {sessions.length > PREVIEW && (
          <div className="px-4 sm:px-6 py-2.5 text-center" style={{ borderTop: `1px solid ${border.divider}` }}>
            <button
              onClick={() => setShowAll(true)}
              className="text-xs font-medium"
              style={{ color: colors.status.warning }}
            >
              View all {sessions.length} sessions
            </button>
          </div>
        )}
      </div>

      {showAll && (
        <Modal open title={`Pending Session Notes (${sessions.length})`} onClose={() => setShowAll(false)} size="lg">
          <div className="overflow-y-auto max-h-[70vh] -mx-5 -mb-5">
            {sessions.map((s, i) => row(s, i, sessions))}
          </div>
        </Modal>
      )}
    </>
  )
}

function CancellationRequestsPanel({ sessions, onDone }: {
  sessions: TherapySessionResponse[]
  onDone: () => void
}) {
  const qc = useQueryClient()
  const { toasts, toast, dismiss } = useToast()
  const [showAll, setShowAll] = useState(false)
  const PREVIEW = 3

  const approveMut = useMutation({
    mutationFn: (id: string) => therapySessionsApi.approveCancellation(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions-cancellation-requests'] })
      qc.invalidateQueries({ queryKey: ['therapy-sessions-cal'] })
      toast('Session cancelled', 'success')
      onDone()
    },
    onError: (err) => toast(getApiError(err, 'Failed to approve cancellation'), 'error'),
  })

  const rejectMut = useMutation({
    mutationFn: (id: string) => therapySessionsApi.rejectCancellation(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions-cancellation-requests'] })
      qc.invalidateQueries({ queryKey: ['therapy-sessions-cal'] })
      toast('Cancellation rejected — session restored', 'success')
      onDone()
    },
    onError: (err) => toast(getApiError(err, 'Failed to reject cancellation'), 'error'),
  })

  const row = (s: TherapySessionResponse, i: number, arr: TherapySessionResponse[]) => (
    <div key={s.id} className="px-4 sm:px-6 py-3"
      style={i < arr.length - 1 ? { borderBottom: `1px solid ${border.divider}` } : {}}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium" style={{ color: colors.text.primary }}>
            {s.patientFirstName} {s.patientLastName}
          </p>
          <p className="text-xs mt-0.5" style={{ color: colors.text.muted }}>
            {format(parseISO(s.sessionDate), 'EEE d MMM')} · {formatTimeStr(s.startTime)} · {s.programName}
          </p>
          <p className="text-xs mt-0.5" style={{ color: colors.text.dim }}>
            {s.therapistFirstName} {s.therapistLastName}
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            disabled={approveMut.isPending || rejectMut.isPending}
            onClick={() => approveMut.mutate(s.id)}
            className="text-xs font-semibold px-2.5 py-1.5 rounded-lg disabled:opacity-50"
            style={{ background: dangerAlpha(0.09), color: colors.status.danger }}>
            Approve
          </button>
          <button
            disabled={approveMut.isPending || rejectMut.isPending}
            onClick={() => rejectMut.mutate(s.id)}
            className="text-xs font-semibold px-2.5 py-1.5 rounded-lg disabled:opacity-50"
            style={{ background: successAlpha(0.09), color: colors.status.success }}>
            Reject
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <>
      <div style={{
        ...styles.card, overflow: 'hidden', padding: 0, borderLeft: `3px solid ${colors.status.danger}`,
        minHeight: TILE_MIN_HEIGHT, display: 'flex', flexDirection: 'column',
      }}>
        <div className="px-4 sm:px-6 py-4 flex items-center justify-between"
          style={{ borderBottom: `1px solid ${border.divider}` }}>
          <div className="flex items-center gap-2">
            <XCircle size={16} style={{ color: colors.status.danger }} />
            <h2 className="text-base font-semibold" style={{ color: colors.text.primary }}>
              Cancellation Requests
            </h2>
            <span className="text-xs font-bold min-w-[20px] h-5 rounded-full flex items-center justify-center px-1.5"
              style={{ background: dangerAlpha(0.09), color: colors.status.danger }}>
              {sessions.length}
            </span>
          </div>
          <p className="text-xs" style={{ color: colors.text.muted }}>Awaiting your approval</p>
        </div>

        <div className="flex-1">
          {sessions.length === 0 ? (
            <div className="h-full flex flex-col justify-center">
              <EmptyState
                icon={<XCircle size={22} />}
                title="No cancellation requests"
                description="Requests from therapists to cancel a session will show up here for approval."
              />
            </div>
          ) : (
            <div>
              {sessions.slice(0, PREVIEW).map((s, i) => row(s, i, sessions.slice(0, PREVIEW)))}
            </div>
          )}
        </div>

        {sessions.length > PREVIEW && (
          <div className="px-4 sm:px-6 py-2.5 text-center" style={{ borderTop: `1px solid ${border.divider}` }}>
            <button onClick={() => setShowAll(true)} className="text-xs font-medium" style={{ color: colors.status.danger }}>
              View all {sessions.length} requests
            </button>
          </div>
        )}
      </div>

      {showAll && (
        <Modal open title={`Cancellation Requests (${sessions.length})`} onClose={() => setShowAll(false)} size="lg">
          <div className="overflow-y-auto max-h-[70vh] -mx-5 -mb-5">
            {sessions.map((s, i) => row(s, i, sessions))}
          </div>
        </Modal>
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
  if (days === 0) return colors.status.success
  if (days <= 7)  return colors.status.warning
  return palette.purple.text
}

function joinedLabel(days: number): string {
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days} days ago`
}

/** A ring split into coloured arc segments proportional to each value, with the total centred. */
function StatRing({ segments, size = 92, strokeWidth = 10 }: {
  segments: { value: number; color: string }[]
  size?: number
  strokeWidth?: number
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0)
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius

  let drawn = 0
  const arcs = total === 0 ? [] : segments.map((s, i) => {
    if (s.value === 0) return null
    const dash = (s.value / total) * circumference
    const arc = (
      <circle
        key={i}
        cx={size / 2} cy={size / 2} r={radius}
        fill="none"
        stroke={s.color}
        strokeWidth={strokeWidth}
        strokeDasharray={`${dash} ${circumference - dash}`}
        strokeDashoffset={-drawn}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    )
    drawn += dash
    return arc
  })

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={border.divider} strokeWidth={strokeWidth} />
      {arcs}
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
        fontSize={size * 0.24} fontWeight={700} fill={colors.text.heading}>
        {total}
      </text>
    </svg>
  )
}

/** One ring + legend column, shared by the Cases and Members halves of OrgOverview. */
function StatRingPanel({ title, ring, stats }: {
  title: string
  ring: { value: number; color: string }[]
  stats: { label: string; count: number; color: string }[]
}) {
  const total = ring.reduce((sum, s) => sum + s.value, 0)
  return (
    <div className="p-4 sm:p-6 flex flex-col gap-4 flex-1">
      <p className="text-sm font-medium" style={{ color: colors.text.primary }}>{title}</p>
      <div className="flex items-center gap-5">
        <div className="flex flex-col gap-3">
          {stats.map(s => (
            <div key={s.label} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
              <div>
                <p className="text-xs" style={{ color: colors.text.muted }}>{s.label}</p>
                <p className="text-lg font-bold leading-tight" style={{ color: colors.text.primary }}>{s.count}</p>
              </div>
            </div>
          ))}
        </div>
        <StatRing segments={ring} />
      </div>
      <p className="text-xs" style={{ color: colors.text.muted }}>
        Total <span className="font-semibold" style={{ color: colors.text.primary }}>{total}</span>
      </p>
    </div>
  )
}

/**
 * Cases and Members active/invited counts, as two ring charts sharing one card.
 * Discharged cases (isActive false) and deactivated members are excluded from both
 * rings entirely — they're neither "active" nor "invited," so counting them in either
 * bucket would be misleading.
 */
function OrgOverview({ patients, members, invites }: {
  patients: PatientResponse[]
  members: StaffMemberResponse[]
  invites: InviteResponse[]
}) {
  const activeCases  = patients.filter(p => p.isActive && p.parents.length > 0).length
  const invitedCases = patients.filter(p => p.isActive && p.parents.length === 0).length

  const activeMembers  = members.filter(m => m.isActive).length
  const invitedMembers = invites.filter(i => i.status === 'PENDING').length

  const sectionCard: React.CSSProperties = {
    ...styles.card, padding: 0, overflow: 'hidden',
    minHeight: TILE_MIN_HEIGHT, display: 'flex', flexDirection: 'column',
  }

  return (
    <div style={sectionCard}>
      <div className="px-4 sm:px-6 py-4" style={{ borderBottom: `1px solid ${border.divider}` }}>
        <h2 className="text-base font-semibold" style={{ color: colors.text.primary }}>Organisation Overview</h2>
      </div>
      <div className="flex-1 flex flex-col sm:flex-row">
        <StatRingPanel
          title="Cases"
          ring={[
            { value: activeCases,  color: palette.green.text },
            { value: invitedCases, color: palette.slate.text },
          ]}
          stats={[
            { label: 'Active',      count: activeCases,  color: palette.green.text },
            { label: 'Not Invited', count: invitedCases, color: palette.slate.text },
          ]}
        />
        <StatRingPanel
          title="Members"
          ring={[
            { value: activeMembers,  color: palette.green.text },
            { value: invitedMembers, color: palette.yellow.text },
          ]}
          stats={[
            { label: 'Active',  count: activeMembers,  color: palette.green.text },
            { label: 'Invited', count: invitedMembers, color: palette.yellow.text },
          ]}
        />
      </div>
    </div>
  )
}

/** Cases added within a date range (last 7 days by default), filterable by therapist
 *  and therapy/program — Clinic Head / Office Admin / Business Owner only. */
function RecentlyJoinedChildren({ patients }: { patients: PatientResponse[] }) {
  const [showAll, setShowAll] = useState(false)
  const [from, setFrom] = useState(() => format(subDays(new Date(), 7), 'yyyy-MM-dd'))
  const [to, setTo] = useState(today)
  const [therapistId, setTherapistId] = useState('')
  const [therapyName, setTherapyName] = useState('')

  const therapistOptions = useMemo(() => {
    const byId = new Map<string, string>()
    patients.forEach(p => p.therapists.forEach(t => byId.set(t.id, `${t.firstName} ${t.lastName}`)))
    return [...byId.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [patients])

  const therapyOptions = useMemo(() => {
    const names = new Set<string>()
    patients.forEach(p => p.therapies.forEach(t => names.add(t.name)))
    return [...names].sort().map(name => ({ value: name, label: name }))
  }, [patients])

  const recentlyJoined = patients
    .filter(p => {
      const joinedDate = p.createdAt.slice(0, 10)
      if (from && joinedDate < from) return false
      if (to && joinedDate > to) return false
      if (therapistId && !p.therapists.some(t => t.id === therapistId)) return false
      if (therapyName && !p.therapies.some(t => t.name === therapyName)) return false
      return true
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const hasNonDateFilter = !!therapistId || !!therapyName

  const sectionCard: React.CSSProperties = {
    ...styles.card, overflow: 'hidden', padding: 0,
    minHeight: TILE_MIN_HEIGHT, display: 'flex', flexDirection: 'column',
  }

  const joinedRow = (p: PatientResponse, i: number, arr: PatientResponse[]) => (
    <Link
      key={p.id}
      to={`/patients/${p.id}`}
      className="flex items-center gap-3 px-4 sm:px-6 py-3 transition-colors"
      style={i < arr.length - 1 ? { borderBottom: `1px solid ${border.divider}` } : {}}
      onMouseEnter={ROW_HOVER_IN}
      onMouseLeave={ROW_HOVER_OUT}
    >
      <Avatar
        initials={`${p.firstName[0]}${p.lastName[0] ?? ''}`}
        name={`${p.firstName} ${p.lastName}`}
        bold
      />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: colors.text.primary }}>
          {p.firstName} {p.lastName}
        </p>
        <p className="text-xs" style={{ color: colors.text.muted }}>
          Joined {format(parseISO(p.createdAt), 'MMMM d')}
        </p>
      </div>

      <span
        className="flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full"
        style={{ background: accentAlpha(0.12), color: colors.accent }}
      >
        {joinedLabel(differenceInCalendarDays(new Date(), parseISO(p.createdAt)))}
      </span>
    </Link>
  )

  return (
    <>
      <div style={sectionCard}>
        <div
          className="px-4 sm:px-6 py-4 flex items-center gap-2"
          style={{ borderBottom: `1px solid ${border.divider}` }}
        >
          <UserPlus size={16} style={{ color: colors.accent }} />
          <h2 className="text-base font-semibold" style={{ color: colors.text.primary }}>
            Recently Joined
          </h2>
          <span
            className="text-xs font-bold min-w-[20px] h-5 rounded-full flex items-center justify-center px-1.5"
            style={{ background: accentAlpha(0.12), color: colors.accent }}
          >
            {recentlyJoined.length}
          </span>
        </div>

        <div
          className="px-4 sm:px-6 py-3 flex flex-wrap items-center gap-2"
          style={{ borderBottom: `1px solid ${border.divider}` }}
        >
          <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-[136px]" />
          <span className="text-xs" style={{ color: colors.text.dim }}>to</span>
          <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-[136px]" />
          <Select
            value={therapistId}
            onChange={e => setTherapistId(e.target.value)}
            options={therapistOptions}
            placeholder="All Therapists"
            className="w-[152px]"
          />
          <Select
            value={therapyName}
            onChange={e => setTherapyName(e.target.value)}
            options={therapyOptions}
            placeholder="All Programs"
            className="w-[152px]"
          />
        </div>

        <div className="flex-1">
          {recentlyJoined.length === 0 ? (
            <div className="h-full flex flex-col justify-center">
              <EmptyState
                icon={<UserPlus size={22} />}
                title="No cases found"
                description={hasNonDateFilter
                  ? 'No cases joined in this date range match the selected therapist/program.'
                  : 'Cases joined in this date range will show up here.'}
              />
            </div>
          ) : (
            <div>
              {recentlyJoined.slice(0, PREVIEW).map((p, i) => joinedRow(p, i, recentlyJoined.slice(0, PREVIEW)))}
            </div>
          )}
        </div>

        {recentlyJoined.length > PREVIEW && (
          <div className="px-4 sm:px-6 py-2.5 text-center" style={{ borderTop: `1px solid ${border.divider}` }}>
            <button onClick={() => setShowAll(true)} className="text-xs font-medium" style={{ color: colors.accent }}>
              View all {recentlyJoined.length} cases
            </button>
          </div>
        )}
      </div>

      {showAll && (
        <Modal open title={`Recently Joined (${recentlyJoined.length})`} onClose={() => setShowAll(false)} size="lg">
          <div className="overflow-y-auto max-h-[70vh] -mx-5 -mb-5">
            {recentlyJoined.map((p, i) => joinedRow(p, i, recentlyJoined))}
          </div>
        </Modal>
      )}
    </>
  )
}

function UpcomingBirthdays({ birthdays }: { birthdays: UpcomingBirthdayResponse[] }) {
  const [showAll, setShowAll] = useState(false)

  const sectionCard: React.CSSProperties = {
    ...styles.card, overflow: 'hidden', padding: 0,
    minHeight: TILE_MIN_HEIGHT, display: 'flex', flexDirection: 'column',
  }

  const birthdayRow = (b: UpcomingBirthdayResponse, i: number, arr: UpcomingBirthdayResponse[]) => (
    <Link
      key={b.id}
      to={`/patients/${b.id}`}
      className="flex items-center gap-3 px-4 sm:px-6 py-3 transition-colors"
      style={i < arr.length - 1 ? { borderBottom: `1px solid ${border.divider}` } : {}}
      onMouseEnter={ROW_HOVER_IN}
      onMouseLeave={ROW_HOVER_OUT}
    >
      <Avatar
        initials={`${b.firstName[0]}${b.lastName[0] ?? ''}`}
        name={`${b.firstName} ${b.lastName}`}
        bold
      />

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

        <div className="flex-1">
          {birthdays.length === 0 ? (
            <div className="h-full flex flex-col justify-center">
              <EmptyState
                icon={<Cake size={22} />}
                title="No birthdays coming up"
                description="Cases with a birthday in the next 30 days will show up here."
              />
            </div>
          ) : (
            <div>
              {birthdays.slice(0, PREVIEW).map((b, i) => birthdayRow(b, i, birthdays.slice(0, PREVIEW)))}
            </div>
          )}
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

// ── Session update modal (therapist dashboard shortcut) ───────────────

function SessionUpdateModal({
  session,
  onClose,
}: {
  session: TherapySessionResponse
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { toast } = useToast()

  const parsedRating = session.feedback ? parseInt(session.feedback, 10) : NaN
  const [rating, setRating]             = useState(Number.isNaN(parsedRating) ? 0 : parsedRating)
  const [score, setScore]               = useState<number | null>(session.performanceScore ?? null)
  const [pendingAction, setPendingAction] = useState<TherapySessionStatus | 'REQUEST_CANCEL' | null>(null)

  const saveMut = useMutation({
    mutationFn: async () => {
      if (pendingAction === 'REQUEST_CANCEL') {
        await therapySessionsApi.requestCancellation(session.id)
      } else if (pendingAction) {
        await therapySessionsApi.updateStatus(session.id, { status: pendingAction })
      }
      return therapySessionsApi.updateNotes(session.id, {
        feedback: rating > 0 ? String(rating) : undefined,
        ...(score !== null ? { performanceScore: score } : {}),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['therapy-sessions-cal'] })
      toast(pendingAction === 'REQUEST_CANCEL' ? 'Cancellation request sent' : 'Session saved', 'success')
      onClose()
    },
    onError: (err) => toast(getApiError(err, 'Failed to save'), 'error'),
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
            {formatTimeStr(session.startTime)} · {session.programName} · #{session.sessionNumber}/{session.totalSessions}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[11.5px] font-semibold px-2 py-1 rounded-full"
            style={{ background: statusColor(session.status) + '18', color: statusColor(session.status) }}>
            {session.status.replace(/_/g, ' ')}
          </span>
          <Link
            to={`/patients/${session.patientId}`}
            className="text-[11.5px] font-medium px-2 py-1 rounded-full"
            style={{ background: accentAlpha(0.10), color: colors.accent }}
            onClick={onClose}
          >
            View case →
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {/* Performance score */}
        <PerformanceScoreSlider value={score} onChange={setScore} />

        {/* Rating */}
        <div>
          <label className="form-label">Rating</label>
          <StarRating value={rating} onChange={setRating} />
        </div>
      </div>

      <div className="mt-5 pt-4" style={{ borderTop: `1px solid ${border.divider}` }}>
        {isScheduled && (
          <div className="mb-4">
            <p className="form-label">Mark session as</p>
            <div className="flex gap-2">
              {([
                { value: 'COMPLETED' as TherapySessionStatus, label: 'Completed', color: colors.status.success, alpha: successAlpha },
                { value: 'NO_SHOW'   as TherapySessionStatus, label: 'No Show',   color: colors.status.warning, alpha: warningAlpha },
                { value: 'REQUEST_CANCEL' as const, label: 'Request Cancel', color: colors.status.danger, alpha: dangerAlpha },
              ]).map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPendingAction(prev => prev === opt.value ? null : opt.value)}
                  className="flex-1 text-xs font-semibold py-2.5 rounded-xl border transition-all"
                  style={pendingAction === opt.value
                    ? { background: opt.color, color: '#fff', border: `1px solid ${opt.color}` }
                    : { background: opt.alpha(0.12), color: opt.color, border: `1px solid ${opt.alpha(0.35)}` }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {pendingAction && (
              <p className="text-xs mt-2" style={{ color: colors.text.dim }}>
                Will be {pendingAction === 'REQUEST_CANCEL' ? 'requested for cancellation' : `marked ${pendingAction.replace('_', ' ').toLowerCase()}`} when you save.
              </p>
            )}
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button variant="primary" loading={saveMut.isPending} onClick={() => saveMut.mutate()}>
            Save
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function priorityColor(p: TaskPriority): string {
  if (p === 'HIGH')   return colors.status.danger
  if (p === 'MEDIUM') return colors.status.warning
  return palette.blue.text
}

function dueDateLabel(dueDate: string | null): { label: string; color: string } | null {
  if (!dueDate) return null
  const due  = new Date(dueDate + 'T00:00:00')
  const now  = new Date()
  now.setHours(0, 0, 0, 0)
  const diff = Math.round((due.getTime() - now.getTime()) / 86400000)
  if (diff < 0)  return { label: `${Math.abs(diff)}d overdue`, color: colors.status.danger }
  if (diff === 0) return { label: 'Due today',   color: colors.status.warning }
  if (diff === 1) return { label: 'Due tomorrow', color: colors.status.warning }
  return { label: `Due ${format(due, 'MMM d')}`, color: colors.text.dim }
}

/** My open/in-progress tasks, assigned server-side (not sliced client-side from a full fetch) so
 *  the initial load only pulls PREVIEW rows; "View all" fetches the fuller list on demand. */
function MyTasks({ userId }: { userId: string }) {
  const [showAll, setShowAll] = useState(false)
  const filterParams = { mine: true, status: 'OPEN,IN_PROGRESS' }

  const { data: previewPage, isLoading } = useQuery({
    queryKey: ['tasks', 'dashboard-preview'],
    queryFn: () => tasksApi.search({ size: PREVIEW, ...filterParams }),
    enabled: !!userId,
    staleTime: 60 * 1000,
  })

  const { data: allPage, isLoading: loadingAll } = useQuery({
    queryKey: ['tasks', 'dashboard-all'],
    queryFn: () => tasksApi.search({ size: 200, ...filterParams }),
    enabled: !!userId && showAll,
    staleTime: 60 * 1000,
  })

  if (isLoading) return <CardSkeleton />

  const shown = previewPage?.content ?? []
  const total = previewPage?.totalElements ?? 0
  const all = allPage?.content ?? []
  const sectionCard: React.CSSProperties = {
    ...styles.card, overflow: 'hidden', padding: 0,
    minHeight: TILE_MIN_HEIGHT, display: 'flex', flexDirection: 'column',
  }

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
          <span className="text-[11.5px] font-medium flex-shrink-0" style={{ color: due.color }}>
            {due.label}
          </span>
        )}

        {/* Status chip */}
        <span
          className="text-[11.5px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 hidden sm:block"
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

  const inProgress = all.filter(t => t.status === 'IN_PROGRESS')
  const open = all.filter(t => t.status === 'OPEN')
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
              {total}
            </span>
          </div>
          <Link to="/tasks" className="flex items-center gap-0.5 text-xs transition-colors" style={{ color: colors.accent }}>
            View all <ChevronRight size={12} />
          </Link>
        </div>

        <div className="flex-1">
          {total === 0 ? (
            <div className="h-full flex flex-col justify-center">
              <EmptyState
                icon={<ListTodo size={22} />}
                title="No open tasks"
                description="Tasks assigned to you will show up here."
              />
            </div>
          ) : (
            <div>
              {shown.map((task, i) => taskRow(task, i, shown))}
            </div>
          )}
        </div>

        {total > PREVIEW && (
          <div className="px-4 sm:px-6 py-2.5 text-center" style={{ borderTop: `1px solid ${border.divider}` }}>
            <button onClick={() => setShowAll(true)} className="text-xs font-medium" style={{ color: colors.accent }}>
              View all {total} tasks
            </button>
          </div>
        )}
      </div>

      {showAll && (
        <Modal open title={`My Tasks (${total})`} onClose={() => setShowAll(false)} size="lg">
          <div className="overflow-y-auto max-h-[70vh] -mx-5 -mb-5">
            {loadingAll ? (
              <div className="py-8"><PageLoader /></div>
            ) : (<>
              {hasBothGroups && inProgress.length > 0 && (
                <p className="px-4 sm:px-6 py-2 text-[11.5px] font-semibold uppercase tracking-wide"
                  style={{ color: colors.text.dim, borderBottom: `1px solid ${border.divider}` }}>
                  In Progress
                </p>
              )}
              {inProgress.map((task, i) => taskRow(task, i, inProgress))}
              {hasBothGroups && open.length > 0 && (
                <p className="px-4 sm:px-6 py-2 text-[11.5px] font-semibold uppercase tracking-wide"
                  style={{ color: colors.text.dim, borderTop: inProgress.length > 0 ? `1px solid ${border.divider}` : undefined, borderBottom: `1px solid ${border.divider}` }}>
                  Open
                </p>
              )}
              {open.map((task, i) => taskRow(task, i, open))}
            </>)}
          </div>
        </Modal>
      )}
    </>
  )
}

function htmlToText(html: string): string {
  const div = document.createElement('div')
  div.innerHTML = DOMPurify.sanitize(html)
  return div.textContent?.trim() || ''
}

/** Feed posts, fetched only PREVIEW at a time (not sliced client-side from a full fetch);
 *  "View all" fetches the fuller list on demand. */
function FeedPanel() {
  const { user } = useAuth()
  const [showAll, setShowAll] = useState(false)

  const { data: previewPage, isLoading } = useQuery({
    queryKey: ['feed', 'dashboard-preview'],
    queryFn: () => feedApi.search({ size: PREVIEW }),
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  })

  const { data: allPage, isLoading: loadingAll } = useQuery({
    queryKey: ['feed', 'dashboard-all'],
    queryFn: () => feedApi.search({ size: 100 }),
    enabled: !!user && showAll,
    staleTime: 2 * 60 * 1000,
  })

  if (isLoading) return <CardSkeleton />

  const shown = previewPage?.content ?? []
  const total = previewPage?.totalElements ?? 0
  const all = allPage?.content ?? []
  const sectionCard: React.CSSProperties = {
    ...styles.card, overflow: 'hidden', padding: 0,
    minHeight: TILE_MIN_HEIGHT, display: 'flex', flexDirection: 'column',
  }

  const postRow = (post: FeedPostResponse, i: number, arr: FeedPostResponse[]) => {
    const snippet = post.body ? htmlToText(post.body) : ''
    return (
      <Link
        key={post.id}
        to={ROUTES.feed}
        className="block px-4 sm:px-6 py-3 transition-colors"
        style={i < arr.length - 1 ? { borderBottom: `1px solid ${border.divider}` } : {}}
        onMouseEnter={ROW_HOVER_IN}
        onMouseLeave={ROW_HOVER_OUT}
      >
        <p className="text-sm font-medium" style={{ color: colors.text.primary }}>{post.title}</p>
        {snippet && (
          <p className="text-xs mt-0.5 line-clamp-2" style={{ color: colors.text.muted }}>{snippet}</p>
        )}
        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          <p className="text-xs" style={{ color: colors.text.dim }}>
            {post.authorFirstName} {post.authorLastName} · {format(parseISO(post.createdAt), 'MMM d')}
          </p>
          <span className="flex items-center gap-2.5 text-[11.5px]" style={{ color: colors.text.dim }}>
            <span className="flex items-center gap-1"><Heart size={11} />{post.likeCount}</span>
            <span className="flex items-center gap-1"><MessageCircle size={11} />{post.commentCount}</span>
            <span className="flex items-center gap-1"><Eye size={11} />{post.viewCount}</span>
          </span>
        </div>
      </Link>
    )
  }

  return (
    <>
      <div style={sectionCard}>
        <div className="px-4 sm:px-6 py-4 flex items-center justify-between"
          style={{ borderBottom: `1px solid ${border.divider}` }}>
          <div className="flex items-center gap-2">
            <Newspaper size={16} style={{ color: colors.accent }} />
            <h2 className="text-base font-semibold" style={{ color: colors.text.primary }}>Feed</h2>
            <span className="text-xs font-bold min-w-[20px] h-5 rounded-full flex items-center justify-center px-1.5"
              style={{ background: accentAlpha(0.12), color: colors.accent }}>
              {total}
            </span>
          </div>
          <Link to={ROUTES.feed} className="flex items-center gap-0.5 text-xs transition-colors" style={{ color: colors.accent }}>
            View all <ChevronRight size={12} />
          </Link>
        </div>

        <div className="flex-1">
          {total === 0 ? (
            <div className="h-full flex flex-col justify-center">
              <EmptyState
                icon={<Newspaper size={22} />}
                title="No posts yet"
                description="Clinic updates from Business Owner and Clinic Head will show up here."
              />
            </div>
          ) : (
            <div>
              {shown.map((post, i) => postRow(post, i, shown))}
            </div>
          )}
        </div>

        {total > PREVIEW && (
          <div className="px-4 sm:px-6 py-2.5 text-center" style={{ borderTop: `1px solid ${border.divider}` }}>
            <button onClick={() => setShowAll(true)} className="text-xs font-medium" style={{ color: colors.accent }}>
              View all {total} posts
            </button>
          </div>
        )}
      </div>

      {showAll && (
        <Modal open title={`Feed (${total})`} onClose={() => setShowAll(false)} size="lg">
          <div className="overflow-y-auto max-h-[70vh] -mx-5 -mb-5">
            {loadingAll ? <div className="py-8"><PageLoader /></div> : all.map((post, i) => postRow(post, i, all))}
          </div>
        </Modal>
      )}
    </>
  )
}

export default function DashboardPage() {
  const { user, activeRole } = useAuth()
  const isParentView       = activeRole === 'PARENT'
  // Office Admin sees every session org-wide and can reschedule, same as Business
  // Owner/Clinic Head — they just can't touch session notes/feedback, which stays
  // gated separately by canUpdateSession below.
  const isOwnerOrAdmin     = activeRole === 'BUSINESS_OWNER' || activeRole === 'CLINIC_HEAD' || activeRole === 'OFFICE_ADMIN'
  const isTherapistRole    = activeRole === 'THERAPIST'
  const canReschedule      = isOwnerOrAdmin
  const isStaff            = isOwnerOrAdmin || isTherapistRole
  const canUpdateSession   = isTherapistRole

  const [editingSession, setEditingSession] = useState<TherapySessionResponse | null>(null)

  const { data: clinics,    isLoading: loadingClinics }  = useQuery({ queryKey: ['clinics'],     queryFn: clinicsApi.list,        enabled: isOwnerOrAdmin })
  const { data: patients,   isLoading: loadingPatients }  = useQuery({ queryKey: ['patients'],    queryFn: patientsApi.list,       enabled: isStaff })
  const { data: myChildren, isLoading: loadingChildren }  = useQuery({ queryKey: ['my-children'], queryFn: patientsApi.myChildren, enabled: isParentView })
  // Same queryKey shape as useCalendarBadge (Sidebar) and CalendarPage's 'therapy-sessions-cal'
  // cache — both request today's sessions with identical params, so sharing the key means one
  // network call instead of two whenever the Sidebar and Dashboard are mounted together.
  const { data: todaySessions = [], isLoading: loadingSessions } = useQuery({
    queryKey: ['therapy-sessions-cal', { from: today, to: today }],
    queryFn: () => therapySessionsApi.list({ from: today, to: today }),
    enabled: isStaff,
    staleTime: 2 * 60 * 1000,
  })
  const { data: pendingReschedule = [], isLoading: loadingReschedule, refetch: refetchPending } = useQuery({
    queryKey: ['sessions-pending-reschedule'],
    queryFn: () => therapySessionsApi.list({ status: 'PENDING_RESCHEDULE' }),
    enabled: canReschedule,
    staleTime: 2 * 60 * 1000,
  })
  const { data: cancellationRequests = [], isLoading: loadingCancellation, refetch: refetchCancelRequests } = useQuery({
    queryKey: ['sessions-cancellation-requests'],
    queryFn: () => therapySessionsApi.list({ status: 'CANCELLATION_REQUESTED' }),
    enabled: isOwnerOrAdmin,
    staleTime: 2 * 60 * 1000,
  })
  // Still SCHEDULED but the session's own end time has already passed — nobody
  // marked it complete/missed or wrote it up. Only shows on the assigned
  // Therapist's own dashboard, since they're the one who has to act on it.
  // Scoped to their own caseload via the date-range endpoint — the status-only
  // lookup ignores caller role entirely, so it can't be used here without
  // leaking every other therapist's sessions.
  const { data: scheduledSessions = [], isLoading: loadingScheduled } = useQuery({
    queryKey: ['sessions-scheduled-all', activeRole],
    queryFn: () => therapySessionsApi.list({ from: format(subDays(new Date(), 90), 'yyyy-MM-dd'), to: today }),
    enabled: isTherapistRole,
    staleTime: 2 * 60 * 1000,
  })
  const pendingNotes = scheduledSessions
    .filter(s => s.status === 'SCHEDULED')
    .filter(s => isPastDateTime(s.sessionDate, s.endTime.slice(0, 5)))

  const { data: upcomingBirthdays = [], isLoading: loadingBirthdays } = useQuery({
    queryKey: ['upcoming-birthdays'],
    queryFn: patientsApi.upcomingBirthdays,
    enabled: isStaff,
    staleTime: 60 * 60 * 1000,
  })

  const { data: members = [], isLoading: loadingMembers } = useQuery({
    queryKey: ['members'],
    queryFn: usersApi.listMembers,
    enabled: isOwnerOrAdmin,
    staleTime: 5 * 60 * 1000,
  })
  const { data: invites = [] } = useQuery({
    queryKey: ['invitations'],
    queryFn: invitationsApi.list,
    enabled: isOwnerOrAdmin,
    staleTime: 5 * 60 * 1000,
  })

  const uniqueTherapistIds = new Set(patients?.flatMap(p => p.therapists).map(t => t.id) ?? [])

  void loadingClinics // no card on this page renders from it directly

  // ── Parent dashboard ──────────────────────────────────────────────────────
  if (isParentView) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Avatar initials={`${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`} name={`${user?.firstName ?? ''} ${user?.lastName ?? ''}`} bold />
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold" style={{ color: colors.text.primary }}>
              {user?.firstName} {user?.lastName}
            </span>
            {activeRole && roleBadge(activeRole)}
            <span className="text-xs" style={{ color: colors.text.dim }}>
              {format(new Date(), 'EEE, d MMM yyyy')}
            </span>
          </div>
        </div>

        {loadingChildren ? (
          <CardSkeleton />
        ) : myChildren && myChildren.length > 0 && (
          <div style={{ ...styles.card, padding: 20 }}>
            <h2 className="text-base font-semibold mb-4" style={{ color: colors.text.primary }}>
              Progress — last 30 days
            </h2>
            <ChildrenProgressChart children={myChildren} />
          </div>
        )}

        {loadingChildren ? (
          <CardSkeleton />
        ) : myChildren && myChildren.length > 0 && (
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
                  <Avatar
                    initials={`${child.firstName[0]}${child.lastName[0] ?? ''}`}
                    name={`${child.firstName} ${child.lastName}`}
                    size="lg"
                  />
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

        <FeedPanel />
      </div>
    )
  }

  // ── Staff dashboard ───────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Compact header — name + role + date on the left, attendance check-in/out on the right */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Avatar initials={`${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`} name={`${user?.firstName ?? ''} ${user?.lastName ?? ''}`} bold />
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold" style={{ color: colors.text.primary }}>
              {user?.firstName} {user?.lastName}
            </span>
            {activeRole && roleBadge(activeRole)}
            <span className="text-xs" style={{ color: colors.text.dim }}>
              {format(new Date(), 'EEE, d MMM yyyy')}
            </span>
          </div>
        </div>

        <AttendanceWidget />
      </div>

      {/* Uniform 2-column tile grid. Reschedule/Cancellation are on-demand alerts — they only
          take a slot when there's an active request, and lead the grid when they do. */}
      {(() => {
        const hasReschedule   = canReschedule && pendingReschedule.length > 0
        const hasCancellation = isOwnerOrAdmin && cancellationRequests.length > 0
        const hasPendingNotes = isTherapistRole && pendingNotes.length > 0

        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {canReschedule && (loadingReschedule ? <CardSkeleton /> : hasReschedule && (
              <PendingReschedulePanel
                sessions={pendingReschedule}
                onRescheduled={() => refetchPending()}
              />
            ))}

            {isOwnerOrAdmin && (loadingCancellation ? <CardSkeleton /> : hasCancellation && (
              <CancellationRequestsPanel
                sessions={cancellationRequests}
                onDone={() => refetchCancelRequests()}
              />
            ))}

            {isTherapistRole && (loadingScheduled ? <CardSkeleton /> : hasPendingNotes && (
              <PendingSessionNotesPanel sessions={pendingNotes} />
            ))}

            {loadingSessions ? <CardSkeleton /> : (
              <TodaySessions
                sessions={todaySessions}
                showTherapist={isOwnerOrAdmin}
                onSessionClick={canUpdateSession ? setEditingSession : undefined}
              />
            )}

            <FeedPanel />

            {loadingBirthdays ? <CardSkeleton /> : <UpcomingBirthdays birthdays={upcomingBirthdays} />}
            {isOwnerOrAdmin && (loadingPatients ? <CardSkeleton /> : <RecentlyJoinedChildren patients={patients ?? []} />)}
            {isOwnerOrAdmin && ((loadingPatients || loadingMembers) ? <CardSkeleton /> : <OrgOverview patients={patients ?? []} members={members} invites={invites} />)}
            <MyTasks userId={user?.id ?? ''} />
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
