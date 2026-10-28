import { useState, useMemo, useRef, useLayoutEffect, useEffect, type ReactNode } from 'react'
import { useQuery, keepPreviousData, useQueries, useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, CheckCircle2, XCircle, AlertTriangle, RefreshCw, Cake, ListTodo, ChevronRight, Newspaper, Heart, MessageCircle, MessageSquareWarning, Eye, UserPlus, SlidersHorizontal, Repeat, ClipboardList, IndianRupee } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { format, parseISO, subDays, addDays, differenceInCalendarDays } from 'date-fns'
import DOMPurify from 'dompurify'
import { dashboardApi } from '../api/dashboard'
import { slotsApi } from '../api/appointments'
import { tasksApi } from '../api/tasks'
import { enrollmentsApi } from '../api/enrollments'
import { RenewalsList, RENEWALS_KEY } from '../components/shared/RenewalsList'
import { feedApi } from '../api/feed'
import { patientsApi } from '../api/patients'
import { therapySessionsApi } from '../api/therapySessions'
import { subscriptionsApi } from '../api/subscriptions'
import { concernsApi } from '../api/concerns'
import { usersApi } from '../api/users'
import { sharedMediaApi } from '../api/sharedMedia'
import { Avatar } from '../components/shared/Avatar'
import { ResolveConcernModal } from '../components/shared/ResolveConcernModal'
import { MockRazorpayModal } from '../components/subscriptions/MockRazorpayModal'
import { PageLoader, Spinner } from '../components/ui/Spinner'
import { SessionDrawerLoader } from '../components/shared/SessionDrawerLoader'
import {
  SharedMediaDetailModal, ReadStatus, UnreadDot, useMarkSharedMediaRead, fileKind, isUnreadForViewer,
} from '../components/shared/SharedMediaDetail'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { describeServerProblem } from '../lib/queryRetry'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { EmptyState } from '../components/ui/EmptyState'
import { useAuth } from '../contexts/AuthContext'
import { roleBadge, sessionStatusLabel } from '../components/ui/Badge'
import { colors, styles, border, palette, rgba, surface, accentAlpha, successAlpha, dangerAlpha, warningAlpha } from '../theme'
import { getApiError } from '../lib/apiError'
import { useToast } from '../hooks/useToast'
import { ROUTES } from '../lib/routes'
import { isPastDateTime } from '../lib/schedule'
import { formatTimeStr, formatDateStr, formatDateTimeStr } from '../lib/format'
import AttendanceWidget from './attendance/AttendanceWidget'
import type { TherapySessionResponse, TherapySessionSummary, TherapySessionStatus, UpcomingBirthdayResponse, TaskResponse, TaskPriority, RescheduleReason, SlotResponse, DayOfWeek, FeedPostResponse, PatientResponse, OrgOverviewResponse, ConcernResponse, SubscriptionResponse, SharedMediaResponse } from '../types'

function formatINR(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

const today = format(new Date(), 'yyyy-MM-dd')
const PREVIEW = 3

/** Every dashboard tile shares this height so the 2-column grid lines up evenly. */
const TILE_MIN_HEIGHT = 360

/** Most rows a card will ever stack below its PREVIEW rows when it has room to spare. */
const MAX_EXTRA_ROWS = 12

/** Rows past PREVIEW that appear only in space the card already has (stretched to a taller
 *  neighbour in the grid, or its minimum height). It takes no height of its own (flex-basis 0),
 *  so it can never make a card taller or reflow the grid; any row that does not fit completely
 *  is hidden instead of being cut in half. */
function SpareRows({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const fit = () => {
    const el = ref.current
    if (!el) return
    const limit = el.clientHeight
    Array.from(el.children).forEach(c => {
      const row = c as HTMLElement
      row.style.visibility = row.offsetTop + row.offsetHeight <= limit ? '' : 'hidden'
    })
  }
  useLayoutEffect(fit)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={ref} style={{ flex: '1 1 0', minHeight: 0, overflow: 'hidden', position: 'relative' }}>
      {children}
    </div>
  )
}

/** First PREVIEW rows always render; further rows fill whatever space is left in the card. */
function PreviewRows<T>({ items, renderRow }: {
  items: T[]
  renderRow: (item: T, i: number, arr: T[]) => ReactNode
}) {
  const head = items.slice(0, PREVIEW)
  const extra = items.slice(PREVIEW, PREVIEW + MAX_EXTRA_ROWS)
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div>{head.map((it, i) => renderRow(it, i, head))}</div>
      {extra.length > 0 && (
        <SpareRows>
          {extra.map((it, i) => (
            <div key={i} style={{ borderTop: `1px solid ${border.divider}` }}>
              {renderRow(it, 0, [it])}
            </div>
          ))}
        </SpareRows>
      )}
    </div>
  )
}

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
  sessions: TherapySessionSummary[]
  showTherapist: boolean
  onSessionClick?: (s: TherapySessionSummary) => void
}) {
  const [showAll, setShowAll] = useState(false)
  // Nothing today — no card at all rather than an empty one.
  if (sessions.length === 0) return null
  const sectionCard: React.CSSProperties = {
    ...styles.card, overflow: 'hidden', padding: 0,
    minHeight: TILE_MIN_HEIGHT, display: 'flex', flexDirection: 'column',
  }

  // Notes are only actually overdue once the session has finished — while it's
  // still running, "Notes overdue" would just be wrong.
  const isOverdue = (s: TherapySessionSummary) =>
    s.status === 'SCHEDULED' && isPastDateTime(s.sessionDate, s.endTime.slice(0, 5))
  const isOngoing = (s: TherapySessionSummary) =>
    s.status === 'SCHEDULED' && !isOverdue(s) && isPastDateTime(s.sessionDate, s.startTime.slice(0, 5))

  const rowContent = (s: TherapySessionSummary) => (
    <>
      <span className="text-[11px] font-medium tabular-nums flex-shrink-0 w-12" style={{ color: colors.text.muted }}>
        {formatTimeStr(s.startTime)}
      </span>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: colors.text.primary }}>
          {s.programName}
        </p>
        <p className="text-[11px] truncate" style={{ color: colors.text.muted }}>
          {s.patientFirstName} {s.patientLastName}
          {showTherapist && (
            <span style={{ color: colors.text.dim }}>
              {' · '}{s.therapistFirstName} {s.therapistLastName}
            </span>
          )}
        </p>
      </div>

      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full text-center flex-shrink-0 whitespace-nowrap"
        style={
          isOverdue(s)
            ? { background: warningAlpha(0.14), color: colors.status.warning }
            : isOngoing(s)
              ? { background: accentAlpha(0.14), color: colors.accent }
              : { background: statusColor(s.status) + '18', color: statusColor(s.status) }
        }>
        {isOverdue(s) ? 'Notes overdue' : isOngoing(s) ? 'Ongoing' : sessionStatusLabel(s.status)}
      </span>
    </>
  )

  const rowClass = 'flex items-start gap-4 px-4 sm:px-6 py-3.5 transition-colors w-full text-left'

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

        <div className="flex-1 flex flex-col">
          {sessions.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2">
              <CalendarDays size={28} style={{ color: colors.text.dim }} />
              <p className="text-sm" style={{ color: colors.text.muted }}>No sessions scheduled for today</p>
            </div>
          ) : (
            <PreviewRows
              items={sessions}
              renderRow={(s, i, arr) => {
                const dividerStyle = i < arr.length - 1 ? { borderBottom: `1px solid ${border.divider}` } : {}
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
              }}
            />
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

/** Parent dashboard's "Upcoming Sessions" tile — next few sessions across all of the parent's
 *  children, sorted soonest-first. Unlike TodaySessions (one calendar day, time-only rows), rows
 *  here span multiple days so each one shows its date too. */
function UpcomingSessions({ sessions, onSessionClick }: {
  sessions: TherapySessionResponse[]
  onSessionClick: (s: TherapySessionResponse) => void
}) {
  if (sessions.length === 0) return null
  const sectionCard: React.CSSProperties = { ...styles.card, overflow: 'hidden', padding: 0 }

  const row = (s: TherapySessionResponse, i: number, arr: TherapySessionResponse[]) => (
    <button
      type="button"
      key={s.id}
      onClick={() => onSessionClick(s)}
      className="flex items-center gap-4 px-4 sm:px-6 py-3.5 transition-colors w-full text-left"
      style={i < arr.length - 1 ? { borderBottom: `1px solid ${border.divider}` } : {}}
      onMouseEnter={ROW_HOVER_IN}
      onMouseLeave={ROW_HOVER_OUT}
    >
      <div className="flex-shrink-0 w-14 sm:w-16">
        <p className="text-xs font-medium tabular-nums" style={{ color: colors.text.muted }}>
          {format(parseISO(s.sessionDate), 'MMM d')}
        </p>
        <p className="text-xs tabular-nums" style={{ color: colors.text.dim }}>
          {formatTimeStr(s.startTime)}
        </p>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: colors.text.primary }}>
          {s.programName}
        </p>
        <p className="text-xs truncate" style={{ color: colors.text.muted }}>
          {s.patientFirstName} {s.patientLastName}
          <span style={{ color: colors.text.dim }}>
            {' · '}{s.therapistFirstName} {s.therapistLastName}
          </span>
        </p>
      </div>

      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full text-center flex-shrink-0 whitespace-nowrap"
        style={{ background: statusColor(s.status) + '18', color: statusColor(s.status) }}>
        {sessionStatusLabel(s.status)}
      </span>
    </button>
  )

  return (
    <div style={sectionCard}>
      <div className="px-4 sm:px-6 py-4 flex items-center justify-between"
        style={{ borderBottom: `1px solid ${border.divider}` }}>
        <div className="flex items-center gap-2">
          <CalendarDays size={16} style={{ color: colors.accent }} />
          <h2 className="text-base font-semibold" style={{ color: colors.text.primary }}>
            Upcoming Sessions
          </h2>
        </div>
        <Link to="/calendar" className="text-xs transition-colors" style={{ color: colors.accent }}>
          Open calendar →
        </Link>
      </div>

      {sessions.length === 0 ? (
        <div className="py-10 flex flex-col items-center justify-center gap-2">
          <CalendarDays size={28} style={{ color: colors.text.dim }} />
          <p className="text-sm" style={{ color: colors.text.muted }}>No upcoming sessions scheduled</p>
        </div>
      ) : (
        <div>{sessions.map((s, i) => row(s, i, sessions))}</div>
      )}
    </div>
  )
}

/** Parent dashboard's "Pending Payments" tile — fans out one subscriptions query per child
 *  (same per-child pattern MyChildrenPage.tsx already uses for sessions/enrollments), filtered
 *  to plans that still owe money, with a "Pay Now" button reusing the shared MockRazorpayModal. */
function PendingPayments({
  myChildren,
  onPay,
}: {
  myChildren: PatientResponse[]
  onPay: (sub: SubscriptionResponse) => void
}) {
  const results = useQueries({
    queries: myChildren.map(child => ({
      queryKey: ['child-subscriptions', child.id],
      queryFn: () => subscriptionsApi.listForPatient(child.id),
      staleTime: 60 * 1000,
    })),
  })

  const rows = myChildren.flatMap((child, i) => {
    const subs = results[i]?.data ?? []
    return subs
      .filter(s => s.status === 'ACTIVE' && s.paymentStatus !== 'PAID')
      .map(sub => ({ child, sub }))
  })

  if (rows.length === 0) return null

  return (
    <div style={{ ...styles.card, overflow: 'hidden', padding: 0 }}>
      <div className="px-4 sm:px-6 py-4 flex items-center gap-2" style={{ borderBottom: `1px solid ${border.divider}` }}>
        <IndianRupee size={16} style={{ color: colors.accent }} />
        <h2 className="text-base font-semibold" style={{ color: colors.text.primary }}>Pending Payments</h2>
      </div>
      <div>
        {rows.map(({ child, sub }, i) => (
          <div
            key={sub.id}
            className="flex items-center gap-4 px-4 sm:px-6 py-3.5"
            style={i < rows.length - 1 ? { borderBottom: `1px solid ${border.divider}` } : {}}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: colors.text.primary }}>
                {child.firstName} {child.lastName} — {sub.programName}
              </p>
              <p className="text-xs" style={{ color: colors.text.dim }}>
                {sub.paymentStatus === 'PARTIAL'
                  ? `${formatINR(sub.amountPaid)} of ${formatINR(sub.totalAmount)} paid`
                  : `${formatINR(sub.totalAmount)} due`}
              </p>
            </div>
            <button
              onClick={() => onPay(sub)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold flex-shrink-0"
              style={{ color: '#fff', background: colors.accent }}
            >
              <IndianRupee size={12} /> Pay Now
            </button>
          </div>
        ))}
      </div>
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
  const [formError, setFormError] = useState<string | null>(null)

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
    onError: (err) => setFormError(getApiError(err, 'Failed to reschedule session')),
  })

  const canSubmit = newDate || substituteId

  return (
    <Modal open onClose={onClose} title="Reschedule session" error={formError}>
      <div className="space-y-4">
        <div className="rounded-xl p-3 text-sm" style={{ background: accentAlpha(0.07), color: colors.text.muted }}>
          <p className="font-medium" style={{ color: colors.text.primary }}>
            {session.patientFirstName} {session.patientLastName}
          </p>
          <p>{session.programName} · Session #{session.sessionNumber}</p>
          <p>
            Original: {formatDateStr(session.sessionDate)} at {formatTimeStr(session.startTime)}
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
            onClick={() => { setFormError(null); mutation.mutate() }}
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

function rescheduleReasonColor(reason: RescheduleReason | null | undefined) {
  if (reason === 'PUBLIC_HOLIDAY') return palette.blue.text
  if (reason === 'PARENT_REQUEST') return palette.purple.text
  return colors.status.warning
}

/** "Therapist leave · Sep 5 – Sep 12" when the leave spans a range, else the plain reason. */
function rescheduleReasonLabel(s: TherapySessionResponse) {
  if (s.rescheduleReason === 'PUBLIC_HOLIDAY') return 'Public holiday'
  if (s.rescheduleReason === 'PARENT_REQUEST') return 'Parent request'
  if (s.rescheduleReason === 'THERAPIST_LEAVE') {
    if (s.rescheduleLeaveStartDate && s.rescheduleLeaveEndDate) {
      const start = format(new Date(s.rescheduleLeaveStartDate), 'MMM d')
      if (s.rescheduleLeaveStartDate === s.rescheduleLeaveEndDate) return `Therapist leave · ${start}`
      return `Therapist leave · ${start} – ${format(new Date(s.rescheduleLeaveEndDate), 'MMM d')}`
    }
    return 'Therapist leave'
  }
  return 'Needs rescheduling'
}

function PendingReschedulePanel({ sessions, onRescheduled }: {
  sessions: TherapySessionResponse[]
  onRescheduled: () => void
}) {
  const [selected, setSelected] = useState<TherapySessionResponse | null>(null)
  const [showAll, setShowAll] = useState(false)
  const { toast } = useToast()
  const qc = useQueryClient()
  const navigate = useNavigate()

  // Sessions bumped by the same therapist's leave, over the same range, are usually better
  // handled as one bulk case reassignment (hand the whole caseload to a substitute for the
  // leave window) than by rescheduling each session's time slot one at a time — the therapist
  // themselves is still unavailable either way. Group them so we can offer that shortcut.
  //
  // Only sessions still ahead of us qualify — a substitute reassignment is forward-looking, so
  // it can't help a session whose date has already gone by unaddressed. That one just needs a
  // new date picked by hand, same as a Public Holiday / Parent Request session.
  const today = format(new Date(), 'yyyy-MM-dd')
  const isFutureLeaveSession = (s: TherapySessionResponse) =>
    s.rescheduleReason === 'THERAPIST_LEAVE' && !!s.rescheduleLeaveStartDate && !!s.rescheduleLeaveEndDate
      && s.sessionDate >= today

  const leaveGroups = useMemo(() => {
    const byKey = new Map<string, { therapistId: string; therapistName: string; start: string; end: string; sessions: TherapySessionResponse[] }>()
    for (const s of sessions) {
      if (!isFutureLeaveSession(s)) continue
      const key = `${s.therapistId}|${s.rescheduleLeaveStartDate}|${s.rescheduleLeaveEndDate}`
      const existing = byKey.get(key)
      if (existing) {
        existing.sessions.push(s)
      } else {
        byKey.set(key, {
          therapistId: s.therapistId,
          therapistName: `${s.therapistFirstName} ${s.therapistLastName}`,
          start: s.rescheduleLeaveStartDate!,
          end: s.rescheduleLeaveEndDate!,
          sessions: [s],
        })
      }
    }
    return [...byKey.values()]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, today])

  // Leave-caused sessions are fully represented by the reassign banners above — listing them
  // again below as individual "Reschedule" rows would just be the same sessions shown twice. A
  // past-dated leave session doesn't fall back here either: nobody actioned it in time, a bulk
  // reassignment can't retroactively help it, and a nightly sweep (MissedRescheduleCancelJob)
  // auto-cancels it rather than leaving it to clutter this card indefinitely — recovering one is
  // a deliberate new booking from the patient's case, not something surfaced here.
  const otherSessions = useMemo(
    () => sessions.filter(s => s.rescheduleReason !== 'THERAPIST_LEAVE'),
    [sessions]
  )

  // Nothing actionable to show (e.g. only leave sessions that have no leave dates to group by) —
  // render no card at all rather than an empty "Nothing to reschedule" one.
  if (otherSessions.length === 0 && leaveGroups.length === 0) return null

  const goReassign = (group: (typeof leaveGroups)[number]) => {
    const patientIds = [...new Set(group.sessions.map(s => s.patientId))]
    const rangeLabel = group.start === group.end
      ? format(new Date(group.start), 'MMM d')
      : `${format(new Date(group.start), 'MMM d')} – ${format(new Date(group.end), 'MMM d')}`

    // The reassignment window must be forward-looking (its endDate has to be after today) even
    // when the leave itself already started, or already finished, before the admin gets around
    // to actioning the flagged sessions — clamp forward rather than sending the leave's raw
    // dates and hitting "End date must be in the future". The reason text still cites the
    // leave's real dates for context.
    //
    // ReassignmentRevertJob hands the batch back at 00:10 on endDate itself (endDate <= today),
    // not the day after — so a substitute only actually covers through endDate-1. To have them
    // cover the leave's real last day, endDate here needs to be one day past it.
    const today = format(new Date(), 'yyyy-MM-dd')
    const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd')
    const dayAfterLeaveEnds = format(addDays(parseISO(group.end), 1), 'yyyy-MM-dd')
    const startDate = group.start < today ? today : group.start
    const endDate = dayAfterLeaveEnds <= today ? tomorrow : dayAfterLeaveEnds

    navigate(ROUTES.member(group.therapistId), {
      state: {
        prefillReassignment: {
          patientIds,
          type: 'TEMPORARY' as const,
          startDate,
          endDate,
          reason: `Covering ${group.therapistName}'s leave (${rangeLabel})`,
        },
      },
    })
  }

  const rescheduleRow = (s: TherapySessionResponse, i: number, arr: TherapySessionResponse[]) => (
    <div
      key={s.id}
      className="flex items-center gap-3 px-4 sm:px-6 py-3.5"
      style={{
        ...(i < arr.length - 1 ? { borderBottom: `1px solid ${border.divider}` } : {}),
        transform: 'translateZ(0)',
      }}
    >
      {/* Date */}
      <div className="flex-shrink-0 w-14 sm:w-16">
        <p className="text-xs font-medium tabular-nums" style={{ color: colors.text.muted }}>
          {format(new Date(s.sessionDate), 'MMM d')}
        </p>
        <p className="text-xs tabular-nums" style={{ color: colors.text.dim }}>
          {formatTimeStr(s.startTime)}
        </p>
      </div>

      {/* Patient + program + reason — three lines, matching Today's Sessions' compact style.
          A plain colored line rather than a badge, since a badge's chrome doesn't fit this
          card's column width (a sm: breakpoint doesn't help there — it tracks viewport width,
          not this column's, which can be much narrower on a multi-column dashboard grid). */}
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
        <p className="text-[11px] font-medium truncate mt-0.5" style={{ color: rescheduleReasonColor(s.rescheduleReason) }}>
          {rescheduleReasonLabel(s)}
        </p>
      </div>

      {/* Action */}
      <button
        onClick={() => setSelected(s)}
        aria-label="Reschedule"
        title="Reschedule"
        className="flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-lg transition-colors"
        style={{ background: warningAlpha(0.09), color: colors.status.warning }}
      >
        <RefreshCw size={13} />
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
        </div>

        {leaveGroups.length > 0 && (
          <div className="px-4 sm:px-6 py-2.5 flex flex-col gap-1.5" style={{ borderBottom: `1px solid ${border.divider}` }}>
            {leaveGroups.map(g => (
              <button
                key={`${g.therapistId}-${g.start}-${g.end}`}
                onClick={() => goReassign(g)}
                className="flex items-center gap-2 text-left text-xs rounded-lg px-2.5 py-2 transition-colors"
                style={{ background: accentAlpha(0.07), color: colors.text.primary }}
              >
                <Repeat size={13} className="flex-shrink-0" style={{ color: colors.accent }} />
                <span className="flex-1 min-w-0">
                  {g.sessions.length} session{g.sessions.length > 1 ? 's' : ''} affected by {g.therapistName}'s leave — reassign these cases instead
                </span>
                <ChevronRight size={13} className="flex-shrink-0" style={{ color: colors.accent }} />
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 flex flex-col">
          {otherSessions.length === 0 ? (
            leaveGroups.length === 0 && (
              <div className="flex-1 flex flex-col justify-center">
                <EmptyState
                  icon={<AlertTriangle size={22} />}
                  title="Nothing to reschedule"
                  description="Sessions affected by leave, holidays, or parent requests will show up here."
                />
              </div>
            )
          ) : (
            <PreviewRows items={otherSessions} renderRow={rescheduleRow} />
          )}
        </div>

        {otherSessions.length > PREVIEW && (
          <div className="px-4 sm:px-6 py-2.5 text-center" style={{ borderTop: `1px solid ${border.divider}` }}>
            <button
              onClick={() => setShowAll(true)}
              className="text-xs font-medium"
              style={{ color: colors.status.warning }}
            >
              View all {otherSessions.length} sessions
            </button>
          </div>
        )}
      </div>

      {showAll && (
        <Modal open title={`Needs Rescheduling (${otherSessions.length})`} onClose={() => setShowAll(false)} size="lg">
          <div className="overflow-y-auto max-h-[70vh] -mx-5 -mb-5">
            {otherSessions.map((s, i) => rescheduleRow(s, i, otherSessions))}
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
    </>
  )
}

/** `sessions` is just the preview; `count` is the full total. The rest load only when "View all"
 *  is opened. */
/** Notes and files shared in a child's Media & Notes tab, surfaced on the dashboard of whoever they were
 *  shared *with*: a parent sees what the care team posted about their children; an assigned therapist
 *  sees what the children's families posted. Unread ones carry a dot; opening one marks it read. */
function SharedNotesPanel({ role, items, unreadCount }: {
  role: 'PARENT' | 'THERAPIST'
  items: SharedMediaResponse[]
  unreadCount: number
}) {
  const { user } = useAuth()
  const [selected, setSelected] = useState<SharedMediaResponse | null>(null)
  const [showAll, setShowAll] = useState(false)
  const markRead = useMarkSharedMediaRead(updated =>
    setSelected(cur => (cur && cur.id === updated.id ? { ...cur, readAt: updated.readAt, readById: updated.readById, readByName: updated.readByName } : cur)))

  const open = (item: SharedMediaResponse) => {
    setShowAll(false)
    setSelected(item)
    if (isUnreadForViewer(item, role, user?.id)) markRead.mutate(item)
  }

  const row = (item: SharedMediaResponse, i: number, arr: SharedMediaResponse[]) => {
    const unread = isUnreadForViewer(item, role, user?.id)
    const preview = item.note ?? (item.fileName ? `${fileKind(item.contentType) === 'video' ? 'Video' : fileKind(item.contentType) === 'image' ? 'Image' : 'Document'}: ${item.fileName}` : '')
    return (
      <button
        type="button"
        key={item.id}
        onClick={() => open(item)}
        className="flex items-start gap-3 px-4 sm:px-6 py-3.5 transition-colors w-full text-left"
        style={{
          ...(i < arr.length - 1 ? { borderBottom: `1px solid ${border.divider}` } : {}),
          background: unread ? accentAlpha(0.14) : 'transparent',
          boxShadow: unread ? `inset 3px 0 0 ${colors.accent}` : undefined,
          transform: 'translateZ(0)',
        }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = surface.rowHover}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = unread ? accentAlpha(0.14) : 'transparent'}
      >
        <span className="w-2.5 flex-shrink-0 pt-1.5">{unread && <UnreadDot />}</span>
        <div className="flex-1 min-w-0">
          <p className={`text-sm truncate ${unread ? 'font-semibold' : 'font-medium'}`} style={{ color: colors.text.primary }}>
            {item.patientName}
            <span className="font-normal" style={{ color: colors.text.dim }}>{' · '}{item.uploadedByName}</span>
          </p>
          <p className="text-xs truncate" style={{ color: colors.text.muted }}>{preview}</p>
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            <span className="text-[11px] tabular-nums" style={{ color: colors.text.dim }}>{formatDateTimeStr(item.createdAt)}</span>
            <ReadStatus item={item} />
          </div>
        </div>
      </button>
    )
  }

  const title = role === 'PARENT' ? 'From the Care Team' : 'Notes from Families'

  return (
    <>
      <div style={{
        ...styles.card, overflow: 'hidden', padding: 0, borderLeft: `3px solid ${colors.accent}`,
        minHeight: TILE_MIN_HEIGHT, display: 'flex', flexDirection: 'column',
      }}>
        <div className="px-4 sm:px-6 py-4 flex items-center justify-between"
          style={{ borderBottom: `1px solid ${border.divider}` }}>
          <div className="flex items-center gap-2">
            <MessageCircle size={16} style={{ color: colors.accent }} />
            <h2 className="text-base font-semibold" style={{ color: colors.text.primary }}>{title}</h2>
            {unreadCount > 0 && (
              <span className="text-xs font-bold min-w-[20px] h-5 rounded-full flex items-center justify-center px-1.5"
                style={{ background: accentAlpha(0.12), color: colors.accent }}>
                {unreadCount} new
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          <PreviewRows items={items} renderRow={row} />
        </div>

        {items.length > PREVIEW && (
          <div className="px-4 sm:px-6 py-2.5 text-center" style={{ borderTop: `1px solid ${border.divider}` }}>
            <button onClick={() => setShowAll(true)} className="text-xs font-medium" style={{ color: colors.accent }}>
              View all {items.length}
            </button>
          </div>
        )}
      </div>

      {showAll && (
        <Modal open title={title} onClose={() => setShowAll(false)} size="lg">
          <div className="overflow-y-auto max-h-[70vh] -mx-5 -mb-5">
            {items.map((it, i) => row(it, i, items))}
          </div>
        </Modal>
      )}

      {selected && <SharedMediaDetailModal item={selected} onClose={() => setSelected(null)} />}
    </>
  )
}

function PendingSessionNotesPanel({ count, sessions, onSessionClick }: {
  count: number
  sessions: TherapySessionSummary[]
  /** Opens the session drawer, so notes can be added without leaving the dashboard. */
  onSessionClick: (s: TherapySessionSummary) => void
}) {
  const [showAll, setShowAll] = useState(false)
  const { data: all, isLoading: loadingAll } = useQuery({
    queryKey: ['therapy-sessions-cal', 'overdue-notes', 'all'],
    queryFn: () => therapySessionsApi.overdueNotes(),
    enabled: showAll,
  })

  const row = (s: TherapySessionSummary, i: number, arr: TherapySessionSummary[]) => (
    <button
      type="button"
      key={s.id}
      onClick={() => { setShowAll(false); onSessionClick(s) }}
      className="flex items-center gap-4 px-4 sm:px-6 py-3.5 transition-colors w-full text-left"
      style={{
        ...(i < arr.length - 1 ? { borderBottom: `1px solid ${border.divider}` } : {}),
        transform: 'translateZ(0)',
      }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = surface.rowHover}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
    >
      <div className="flex-shrink-0 w-14 sm:w-16">
        <p className="text-xs font-medium tabular-nums" style={{ color: colors.text.muted }}>
          {format(new Date(s.sessionDate), 'MMM d')}
        </p>
        <p className="text-xs tabular-nums" style={{ color: colors.text.dim }}>
          {formatTimeStr(s.startTime)}
        </p>
      </div>

      {/* Three lines, like the Needs Rescheduling rows — a plain coloured line rather than a pill, since a
          pill's width squeezed the child's name and program down to "Diya …" / "Spee…" in this narrow column. */}
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
        <p className="text-[11px] font-medium truncate mt-0.5 flex items-center gap-1" style={{ color: colors.status.warning }}>
          <AlertTriangle size={11} className="flex-shrink-0" /> Notes overdue
        </p>
      </div>
    </button>
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
              Action Needed
            </h2>
            <span className="text-xs font-bold min-w-[20px] h-5 rounded-full flex items-center justify-center px-1.5"
              style={{ background: warningAlpha(0.09), color: colors.status.warning }}>
              {count}
            </span>
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          <PreviewRows items={sessions} renderRow={row} />
        </div>

        {count > PREVIEW && (
          <div className="px-4 sm:px-6 py-2.5 text-center" style={{ borderTop: `1px solid ${border.divider}` }}>
            <button
              onClick={() => setShowAll(true)}
              className="text-xs font-medium"
              style={{ color: colors.status.warning }}
            >
              View all {count} sessions
            </button>
          </div>
        )}
      </div>

      {showAll && (
        <Modal open title={`Action Needed (${count})`} onClose={() => setShowAll(false)} size="lg">
          <div className="overflow-y-auto max-h-[70vh] -mx-5 -mb-5">
            {loadingAll || !all
              ? <div className="py-10 flex justify-center"><Spinner /></div>
              : all.sessions.map((s, i) => row(s, i, all.sessions))}
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
  const { toast } = useToast()
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
      style={{
        ...(i < arr.length - 1 ? { borderBottom: `1px solid ${border.divider}` } : {}),
        transform: 'translateZ(0)',
      }}>
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

        <div className="flex-1 flex flex-col">
          {sessions.length === 0 ? (
            <div className="flex-1 flex flex-col justify-center">
              <EmptyState
                icon={<XCircle size={22} />}
                title="No cancellation requests"
                description="Requests from therapists to cancel a session will show up here for approval."
              />
            </div>
          ) : (
            <PreviewRows items={sessions} renderRow={row} />
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
    </>
  )
}

function ConcernsPanel({ concerns, canAct, onDone }: {
  concerns: ConcernResponse[]
  canAct: boolean
  onDone: () => void
}) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [showAll, setShowAll] = useState(false)
  const [resolving, setResolving] = useState<ConcernResponse | null>(null)
  const PREVIEW = 3

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['enrollment-concerns-open'] })
    qc.invalidateQueries({ queryKey: ['enrollment-concerns'] })
  }

  const ackMut = useMutation({
    mutationFn: (id: string) => concernsApi.acknowledge(id),
    onSuccess: () => {
      invalidate()
      toast('Concern acknowledged', 'success')
      onDone()
    },
    onError: (err) => toast(getApiError(err, 'Failed to acknowledge'), 'error'),
  })

  const row = (c: ConcernResponse, i: number, arr: ConcernResponse[]) => (
    <div key={c.id} className="px-4 sm:px-6 py-3"
      style={{
        ...(i < arr.length - 1 ? { borderBottom: `1px solid ${border.divider}` } : {}),
        transform: 'translateZ(0)',
      }}>
      <div className="flex items-start justify-between gap-3">
        <button
          onClick={() => navigate(ROUTES.patient(c.patientId))}
          className="flex-1 min-w-0 text-left"
        >
          <p className="text-sm font-medium" style={{ color: colors.text.primary }}>
            {c.patientFirstName} {c.patientLastName}
          </p>
          <p className="text-xs mt-0.5 truncate" style={{ color: colors.text.muted }}>
            {c.programName}
          </p>
          <p className="text-xs mt-1 line-clamp-2" style={{ color: colors.text.dim }}>
            {c.description}
          </p>
          <p className="text-[11px] mt-1" style={{ color: colors.text.dim }}>
            Raised {formatDateStr(c.raisedAt)} · {c.status === 'ACKNOWLEDGED' ? 'Acknowledged' : 'Open'}
          </p>
        </button>
        {canAct && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {c.status === 'OPEN' && (
              <button
                disabled={ackMut.isPending}
                onClick={() => ackMut.mutate(c.id)}
                className="text-xs font-semibold px-2.5 py-1.5 rounded-lg disabled:opacity-50"
                style={{ background: accentAlpha(0.10), color: colors.accent }}>
                Acknowledge
              </button>
            )}
            <button
              onClick={() => setResolving(c)}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg"
              style={{ background: successAlpha(0.10), color: colors.status.success }}>
              Resolve
            </button>
          </div>
        )}
      </div>
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
            <MessageSquareWarning size={16} style={{ color: colors.status.warning }} />
            <h2 className="text-base font-semibold" style={{ color: colors.text.primary }}>
              Parent Concerns
            </h2>
            <span className="text-xs font-bold min-w-[20px] h-5 rounded-full flex items-center justify-center px-1.5"
              style={{ background: warningAlpha(0.09), color: colors.status.warning }}>
              {concerns.length}
            </span>
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          {concerns.length === 0 ? (
            <div className="flex-1 flex flex-col justify-center">
              <EmptyState
                icon={<MessageSquareWarning size={22} />}
                title="No open concerns"
                description="Concerns parents raise about a program will show up here."
              />
            </div>
          ) : (
            <PreviewRows items={concerns} renderRow={row} />
          )}
        </div>

        {concerns.length > PREVIEW && (
          <div className="px-4 sm:px-6 py-2.5 text-center" style={{ borderTop: `1px solid ${border.divider}` }}>
            <button onClick={() => setShowAll(true)} className="text-xs font-medium" style={{ color: colors.status.warning }}>
              View all {concerns.length} concerns
            </button>
          </div>
        )}
      </div>

      {showAll && (
        <Modal open title={`Parent Concerns (${concerns.length})`} onClose={() => setShowAll(false)} size="lg">
          <div className="overflow-y-auto max-h-[70vh] -mx-5 -mb-5">
            {concerns.map((c, i) => row(c, i, concerns))}
          </div>
        </Modal>
      )}

      {resolving && (
        <ResolveConcernModal
          concern={resolving}
          onClose={() => setResolving(null)}
          onResolved={() => {
            setResolving(null)
            invalidate()
            toast('Concern resolved', 'success')
            onDone()
          }}
        />
      )}
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
function StatRingPanel({ title, ring, stats, divider }: {
  title: string
  ring: { value: number; color: string }[]
  stats: { label: string; count: number; color: string }[]
  divider?: boolean
}) {
  const total = ring.reduce((sum, s) => sum + s.value, 0)
  return (
    <div
      className="p-4 sm:p-6 flex flex-col gap-4 flex-1"
      style={divider ? { borderTop: `1px solid ${border.divider}` } : undefined}
    >
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
function OrgOverview({ counts }: { counts: OrgOverviewResponse }) {
  const { activeCases, inactiveCases, activeMembers, invitedMembers } = counts

  const sectionCard: React.CSSProperties = {
    ...styles.card, padding: 0, overflow: 'hidden',
    minHeight: TILE_MIN_HEIGHT, display: 'flex', flexDirection: 'column',
  }

  return (
    <div style={sectionCard}>
      <div className="px-4 sm:px-6 py-4" style={{ borderBottom: `1px solid ${border.divider}` }}>
        <h2 className="text-base font-semibold" style={{ color: colors.text.primary }}>Organisation Overview</h2>
      </div>
      <div className="flex-1 flex flex-col">
        <StatRingPanel
          title="Cases"
          ring={[
            { value: activeCases,   color: palette.green.text },
            { value: inactiveCases, color: palette.slate.text },
          ]}
          stats={[
            { label: 'Active',   count: activeCases,   color: palette.green.text },
            { label: 'Inactive', count: inactiveCases, color: palette.slate.text },
          ]}
        />
        <StatRingPanel
          title="Members"
          divider
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
function RecentlyJoinedChildren() {
  const [showAll, setShowAll] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const defaultFrom = format(subDays(new Date(), 7), 'yyyy-MM-dd')
  const [from, setFrom] = useState(defaultFrom)
  const [to, setTo] = useState(today)
  const [therapistId, setTherapistId] = useState('')
  const [therapyName, setTherapyName] = useState('')

  // The date window is applied in SQL, so only cases that joined in it are loaded.
  const { data: patients = [], isLoading } = useQuery({
    queryKey: ['patients', 'joined', from, to],
    queryFn: () => patientsApi.listJoined(from, to),
    placeholderData: keepPreviousData,   // no skeleton flash while a date is being changed
  })

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
      if (!p.isActive) return false
      const joinedDate = p.createdAt.slice(0, 10)
      if (from && joinedDate < from) return false
      if (to && joinedDate > to) return false
      if (therapistId && !p.therapists.some(t => t.id === therapistId)) return false
      if (therapyName && !p.therapies.some(t => t.name === therapyName)) return false
      return true
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const hasNonDateFilter = !!therapistId || !!therapyName
  const filtersActive = hasNonDateFilter || from !== defaultFrom || to !== today
  const activeFilterCount =
    (from !== defaultFrom || to !== today ? 1 : 0) + (therapistId ? 1 : 0) + (therapyName ? 1 : 0)
  const resetFilters = () => { setFrom(defaultFrom); setTo(today); setTherapistId(''); setTherapyName('') }
  // Nobody joined in the default window — hide the card, but never while a filter is set, or the filters would vanish with it.
  if (!isLoading && recentlyJoined.length === 0 && !filtersActive) return null

  const sectionCard: React.CSSProperties = {
    ...styles.card, overflow: 'hidden', padding: 0,
    minHeight: TILE_MIN_HEIGHT, display: 'flex', flexDirection: 'column',
  }

  const joinedRow = (p: PatientResponse, i: number, arr: PatientResponse[]) => (
    <Link
      key={p.id}
      to={`/patients/${p.id}`}
      className="flex items-center gap-3 px-4 sm:px-6 py-3 transition-colors"
      style={{
        ...(i < arr.length - 1 ? { borderBottom: `1px solid ${border.divider}` } : {}),
        transform: 'translateZ(0)',
      }}
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

  if (isLoading) return <CardSkeleton />

  return (
    <>
      <div style={sectionCard}>
        <div
          className="px-4 sm:px-6 py-4 flex items-center justify-between gap-2"
          style={{ borderBottom: `1px solid ${border.divider}` }}
        >
          <div className="flex items-center gap-2">
            <UserPlus size={16} style={{ color: colors.accent }} />
            <h2 className="text-base font-semibold whitespace-nowrap" style={{ color: colors.text.primary }}>
              Recently Joined
            </h2>
            <span
              className="text-xs font-bold min-w-[20px] h-5 rounded-full flex items-center justify-center px-1.5"
              style={{ background: accentAlpha(0.12), color: colors.accent }}
            >
              {recentlyJoined.length}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFilters(true)}
              aria-label="Filters"
              title="Filters"
              className="h-8 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
              style={{
                width: filtersActive ? undefined : 32,
                padding: filtersActive ? '0 8px' : 0,
                color: filtersActive ? colors.accent : colors.text.muted,
                background: filtersActive ? accentAlpha(0.12) : 'transparent',
              }}
            >
              <SlidersHorizontal size={16} />
              {filtersActive && <span className="text-xs font-bold">{activeFilterCount}</span>}
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          {recentlyJoined.length === 0 ? (
            <div className="flex-1 flex flex-col justify-center">
              <EmptyState
                icon={<UserPlus size={22} />}
                title="No cases found"
                description={hasNonDateFilter
                  ? 'No cases joined in this date range match the selected therapist/program.'
                  : 'Cases joined in this date range will show up here.'}
              />
            </div>
          ) : (
            <PreviewRows items={recentlyJoined} renderRow={joinedRow} />
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

      {showFilters && (
        <Modal
          open
          title="Filter Recently Joined"
          onClose={() => setShowFilters(false)}
          size="sm"
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={resetFilters} disabled={!filtersActive}>Reset</Button>
              <Button onClick={() => setShowFilters(false)}>Done</Button>
            </div>
          }
        >
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" label="From" value={from} onChange={e => setFrom(e.target.value)} />
              <Input type="date" label="To" value={to} onChange={e => setTo(e.target.value)} />
            </div>
            <Select
              value={therapistId}
              onChange={e => setTherapistId(e.target.value)}
              options={therapistOptions}
              placeholder="All Therapists"
            />
            <Select
              value={therapyName}
              onChange={e => setTherapyName(e.target.value)}
              options={therapyOptions}
              placeholder="All Programs"
            />
          </div>
        </Modal>
      )}

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
  if (birthdays.length === 0) return null

  const sectionCard: React.CSSProperties = {
    ...styles.card, overflow: 'hidden', padding: 0,
    minHeight: TILE_MIN_HEIGHT, display: 'flex', flexDirection: 'column',
  }

  const birthdayRow = (b: UpcomingBirthdayResponse, i: number, arr: UpcomingBirthdayResponse[]) => (
    <Link
      key={b.id}
      to={`/patients/${b.id}`}
      className="flex items-center gap-3 px-4 sm:px-6 py-3 transition-colors"
      style={{
        ...(i < arr.length - 1 ? { borderBottom: `1px solid ${border.divider}` } : {}),
        transform: 'translateZ(0)',
      }}
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
          <div className="flex items-center gap-3">
            <p className="text-xs" style={{ color: colors.text.muted }}>Next 30 days</p>
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          {birthdays.length === 0 ? (
            <div className="flex-1 flex flex-col justify-center">
              <EmptyState
                icon={<Cake size={22} />}
                title="No birthdays coming up"
              />
            </div>
          ) : (
            <PreviewRows items={birthdays} renderRow={birthdayRow} />
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

// ── Session drawer ────────────────────────────────────────────────────

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

/** Programs in their last week waiting for a Completed / Discontinued / Needs Renewal decision — admin roles.
 *  Sits beside My Tasks; the same list lives on the Tasks page's Renewals tab. */
function RenewalsPanel({ count }: { count: number }) {
  const [showAll, setShowAll] = useState(false)
  const { data: items = [], isLoading } = useQuery({
    queryKey: RENEWALS_KEY,
    queryFn: enrollmentsApi.renewalsDue,
    enabled: count > 0,
    staleTime: 60 * 1000,
  })
  if (count === 0) return null
  if (isLoading) return <CardSkeleton />

  const shown = items.slice(0, PREVIEW)
  return (
    <>
      <div style={{ ...styles.card, overflow: 'hidden', padding: 0 }}>
        <div className="px-4 sm:px-6 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${border.divider}` }}>
          <div className="flex items-center gap-2">
            <RefreshCw size={16} style={{ color: colors.accent }} />
            <h2 className="text-base font-semibold" style={{ color: colors.text.primary }}>Renewals</h2>
            <span className="text-xs font-bold min-w-[20px] h-5 rounded-full flex items-center justify-center px-1.5"
              style={{ background: accentAlpha(0.12), color: colors.accent }}>
              {items.length}
            </span>
          </div>
          <Link to="/tasks?tab=renewals" className="text-xs transition-colors" style={{ color: colors.accent }}>Open in Tasks →</Link>
        </div>
        <RenewalsList items={shown} stacked />
        {items.length > PREVIEW && (
          <div className="px-4 sm:px-6 py-2.5 text-center" style={{ borderTop: `1px solid ${border.divider}` }}>
            <button onClick={() => setShowAll(true)} className="text-xs font-medium" style={{ color: colors.accent }}>
              View all {items.length} programs
            </button>
          </div>
        )}
      </div>
      {showAll && (
        <Modal open title={`Renewals (${items.length})`} onClose={() => setShowAll(false)} size="lg">
          <div className="overflow-y-auto max-h-[70vh] -mx-5 -mb-5"><RenewalsList items={items} stacked /></div>
        </Modal>
      )}
    </>
  )
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
  if (total === 0) return null
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
        style={{
          ...(i < arr.length - 1 ? { borderBottom: `1px solid ${border.divider}` } : {}),
          transform: 'translateZ(0)',
        }}
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
  if (total === 0) return null
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
        style={{
          ...(i < arr.length - 1 ? { borderBottom: `1px solid ${border.divider}` } : {}),
          transform: 'translateZ(0)',
        }}
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

/** Staff-only Minutes of Meeting panel — mirrors FeedPanel's structure exactly, but pulls from
 *  the separate MoM listing endpoint so it never mixes with the regular Feed section. */
function MomPanel() {
  const { user } = useAuth()
  const [showAll, setShowAll] = useState(false)

  const { data: previewPage, isLoading } = useQuery({
    queryKey: ['feed-mom', 'dashboard-preview'],
    queryFn: () => feedApi.listMom({ size: PREVIEW }),
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  })

  const { data: allPage, isLoading: loadingAll } = useQuery({
    queryKey: ['feed-mom', 'dashboard-all'],
    queryFn: () => feedApi.listMom({ size: 100 }),
    enabled: !!user && showAll,
    staleTime: 2 * 60 * 1000,
  })

  if (isLoading) return <CardSkeleton />

  const shown = previewPage?.content ?? []
  const total = previewPage?.totalElements ?? 0
  if (total === 0) return null
  const all = allPage?.content ?? []
  const sectionCard: React.CSSProperties = {
    ...styles.card, overflow: 'hidden', padding: 0,
    minHeight: TILE_MIN_HEIGHT, display: 'flex', flexDirection: 'column',
  }

  const momRow = (post: FeedPostResponse, i: number, arr: FeedPostResponse[]) => {
    const snippet = post.body ? htmlToText(post.body) : ''
    return (
      <Link
        key={post.id}
        to={`${ROUTES.feed}?tab=mom`}
        className="block px-4 sm:px-6 py-3 transition-colors"
        style={{
          ...(i < arr.length - 1 ? { borderBottom: `1px solid ${border.divider}` } : {}),
          transform: 'translateZ(0)',
        }}
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
          {post.attendees.length > 0 && (
            <span className="text-[11.5px]" style={{ color: colors.text.dim }}>
              {post.attendees.length} attendee{post.attendees.length === 1 ? '' : 's'}
            </span>
          )}
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
            <ClipboardList size={16} style={{ color: colors.accent }} />
            <h2 className="text-base font-semibold" style={{ color: colors.text.primary }}>Minutes of Meeting</h2>
            <span className="text-xs font-bold min-w-[20px] h-5 rounded-full flex items-center justify-center px-1.5"
              style={{ background: accentAlpha(0.12), color: colors.accent }}>
              {total}
            </span>
          </div>
        </div>

        <div className="flex-1">
          {total === 0 ? (
            <div className="h-full flex flex-col justify-center">
              <EmptyState
                icon={<ClipboardList size={22} />}
                title="No meeting minutes yet"
                description="Minutes recorded by staff will show up here."
              />
            </div>
          ) : (
            <div>
              {shown.map((post, i) => momRow(post, i, shown))}
            </div>
          )}
        </div>

        {total > PREVIEW && (
          <div className="px-4 sm:px-6 py-2.5 text-center" style={{ borderTop: `1px solid ${border.divider}` }}>
            <button onClick={() => setShowAll(true)} className="text-xs font-medium" style={{ color: colors.accent }}>
              View all {total} entries
            </button>
          </div>
        )}
      </div>

      {showAll && (
        <Modal open title={`Minutes of Meeting (${total})`} onClose={() => setShowAll(false)} size="lg">
          <div className="overflow-y-auto max-h-[70vh] -mx-5 -mb-5">
            {loadingAll ? <div className="py-8"><PageLoader /></div> : all.map((post, i) => momRow(post, i, all))}
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
  // Office Admin can see concerns (Admin-tier visibility) but the backend reserves
  // acknowledge/resolve for Business Owner/Clinic Head/Therapist — matches the Case
  // details page's ConcernsBanner canAct gating.
  const canActOnConcerns   = activeRole === 'BUSINESS_OWNER' || activeRole === 'CLINIC_HEAD'

  // Just the id — the session drawer fetches the full session (notes, rating, totals) when it opens.
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [mockPayTarget, setMockPayTarget] = useState<SubscriptionResponse | null>(null)
  const qc = useQueryClient()

  // Only RecentlyJoinedChildren (Admin Roles) renders from this list — the Organisation Overview
  // counts come from their own endpoint — so it isn't fetched at all for therapists.
  const { data: myChildren, isLoading: loadingChildren }  = useQuery({ queryKey: ['my-children'], queryFn: patientsApi.myChildren, enabled: isParentView })
  // Notes/files shared in a child's Media & Notes tab with whoever is viewing: a parent's from the care
  // team, an assigned therapist's from families. Nobody else gets this card.
  const { data: sharedInbox } = useQuery({
    queryKey: ['shared-media-inbox'],
    queryFn: sharedMediaApi.inbox,
    enabled: isParentView || isTherapistRole,
    staleTime: 60 * 1000,
  })
  // Next few sessions across all of this parent's children — widened to a 90-day window since
  // sessions can run weekly or less often, then trimmed client-side to the soonest 3 still live
  // (skips CANCELLED/COMPLETED/NO_SHOW; the backend already sorts ascending by date then time).
  const { data: upcomingSessionsRaw = [], isLoading: loadingUpcoming } = useQuery({
    queryKey: ['therapy-sessions-cal', { from: today, to: format(addDays(new Date(), 90), 'yyyy-MM-dd') }],
    queryFn: () => therapySessionsApi.list({ from: today, to: format(addDays(new Date(), 90), 'yyyy-MM-dd') }),
    enabled: isParentView,
    staleTime: 2 * 60 * 1000,
  })
  const upcomingSessions = upcomingSessionsRaw
    .filter(s => s.status !== 'CANCELLED' && s.status !== 'COMPLETED' && s.status !== 'NO_SHOW')
    .slice(0, PREVIEW)
  // Slim rows (names + times) — enough to draw the card and the Sidebar's calendar badge, which
  // shares this key so one call serves both. The key sits under 'therapy-sessions-cal' so the
  // existing invalidations after a session changes refresh it too.
  const { data: todaySessions = [], isLoading: loadingSessions, isError: sessionsFailed, error: sessionsError, refetch: refetchSessions } = useQuery({
    queryKey: ['therapy-sessions-cal', 'summary', today],
    queryFn: () => therapySessionsApi.summary(today, today),
    enabled: isStaff,
    staleTime: 2 * 60 * 1000,
  })
  // The three needs-attention cards are usually empty, so ask for their counts first (one tiny
  // call) and fetch a list only when its count is above zero.
  const { data: attention } = useQuery({
    queryKey: ['dashboard', 'attention-counts'],
    queryFn: dashboardApi.attentionCounts,
    enabled: isOwnerOrAdmin,
    staleTime: 2 * 60 * 1000,
  })
  const { data: pendingReschedule = [], isLoading: loadingReschedule, refetch: refetchPendingList } = useQuery({
    queryKey: ['sessions-pending-reschedule'],
    queryFn: () => therapySessionsApi.list({ status: 'PENDING_RESCHEDULE' }),
    enabled: canReschedule && (attention?.pendingReschedule ?? 0) > 0,
    staleTime: 2 * 60 * 1000,
  })
  const { data: cancellationRequests = [], isLoading: loadingCancellation, refetch: refetchCancelList } = useQuery({
    queryKey: ['sessions-cancellation-requests'],
    queryFn: () => therapySessionsApi.list({ status: 'CANCELLATION_REQUESTED' }),
    enabled: isOwnerOrAdmin && (attention?.cancellationRequests ?? 0) > 0,
    staleTime: 2 * 60 * 1000,
  })
  // Parent-raised concerns, org-wide — Admin Roles only (Business Owner / Clinic Head /
  // Office Admin). Therapists already see concerns on their own patients' Case details page.
  const { data: openConcerns = [], isLoading: loadingConcerns, refetch: refetchConcernsList } = useQuery({
    queryKey: ['enrollment-concerns-open'],
    queryFn: () => concernsApi.list({ status: 'OPEN' }),
    enabled: isOwnerOrAdmin && (attention?.openConcerns ?? 0) > 0,
    staleTime: 2 * 60 * 1000,
  })
  // After a card's action, refresh its list and the counts that decide whether the card shows.
  const refreshAttention = () => qc.invalidateQueries({ queryKey: ['dashboard', 'attention-counts'] })
  const refetchPending       = () => { refetchPendingList();  refreshAttention() }
  const refetchCancelRequests = () => { refetchCancelList();   refreshAttention() }
  const refetchConcerns      = () => { refetchConcernsList(); refreshAttention() }

  // Still SCHEDULED but the session's own end time has already passed — nobody marked it
  // complete/missed or wrote it up. Only the assigned Therapist's own dashboard shows it, since
  // they're the one who has to act. The server decides "passed" on the organisation's clock and
  // returns the total plus just the preview rows; "View all" loads the rest on demand.
  const { data: overdueNotes, isLoading: loadingScheduled } = useQuery({
    queryKey: ['therapy-sessions-cal', 'overdue-notes', 'preview'],
    queryFn: () => therapySessionsApi.overdueNotes(PREVIEW),
    enabled: isTherapistRole,
    staleTime: 2 * 60 * 1000,
  })

  const { data: upcomingBirthdays = [], isLoading: loadingBirthdays } = useQuery({
    queryKey: ['upcoming-birthdays'],
    queryFn: patientsApi.upcomingBirthdays,
    enabled: isStaff,
    staleTime: 60 * 60 * 1000,
  })

  // Four counts from one tiny endpoint — this used to download every member (size 1000), every
  // invitation, and re-use the full patient list just to count rows for two rings.
  const { data: orgOverview, isLoading: loadingOrgOverview } = useQuery({
    queryKey: ['dashboard', 'org-overview'],
    queryFn: dashboardApi.orgOverview,
    enabled: isOwnerOrAdmin,
    staleTime: 2 * 60 * 1000,
  })

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
            {activeRole && roleBadge(activeRole, activeRole === user?.role ? user?.customRole : undefined)}
            <span className="text-xs" style={{ color: colors.text.dim }}>
              {formatDateStr(new Date())}
            </span>
          </div>
        </div>

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
                  style={{
                    ...(i < myChildren.length - 1 ? { borderBottom: `1px solid ${border.divider}` } : {}),
                    transform: 'translateZ(0)',
                  }}
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
                      {child.dateOfBirth ? formatDateStr(child.dateOfBirth) : 'No DOB'}
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

        {!loadingChildren && myChildren && myChildren.length > 0 && (
          <PendingPayments myChildren={myChildren} onPay={sub => setMockPayTarget(sub)} />
        )}

        {sharedInbox && sharedInbox.items.length > 0 && (
          <SharedNotesPanel role="PARENT" items={sharedInbox.items} unreadCount={sharedInbox.unreadCount} />
        )}

        {loadingUpcoming ? <CardSkeleton /> : <UpcomingSessions sessions={upcomingSessions} onSessionClick={s => setEditingSessionId(s.id)} />}

        <FeedPanel />

        {mockPayTarget && (
          <MockRazorpayModal
            subscription={mockPayTarget}
            onClose={() => setMockPayTarget(null)}
            onSaved={() => {
              qc.invalidateQueries({ queryKey: ['child-subscriptions'] })
              qc.invalidateQueries({ queryKey: ['therapy-sessions-cal'] })
            }}
          />
        )}
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
            {activeRole && roleBadge(activeRole, activeRole === user?.role ? user?.customRole : undefined)}
            <span className="text-xs" style={{ color: colors.text.dim }}>
              {formatDateStr(new Date())}
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
        const hasPendingNotes = isTherapistRole && (overdueNotes?.count ?? 0) > 0
        const hasConcerns     = isOwnerOrAdmin && openConcerns.length > 0

        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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

            {isOwnerOrAdmin && (loadingConcerns ? <CardSkeleton /> : hasConcerns && (
              <ConcernsPanel
                concerns={openConcerns}
                canAct={canActOnConcerns}
                onDone={() => refetchConcerns()}
              />
            ))}

            {isTherapistRole && (loadingScheduled ? <CardSkeleton /> : hasPendingNotes && (
              <PendingSessionNotesPanel count={overdueNotes?.count ?? 0} sessions={overdueNotes?.sessions ?? []}
                onSessionClick={s => setEditingSessionId(s.id)} />
            ))}

            {isTherapistRole && sharedInbox && sharedInbox.items.length > 0 && (
              <SharedNotesPanel role="THERAPIST" items={sharedInbox.items} unreadCount={sharedInbox.unreadCount} />
            )}

            {loadingSessions ? <CardSkeleton /> : sessionsFailed ? (
              <div style={{ ...styles.card, minHeight: TILE_MIN_HEIGHT }} className="flex flex-col items-center justify-center gap-3 p-6 text-center">
                <CalendarDays size={28} style={{ color: colors.text.dim }} />
                <p className="text-sm" style={{ color: colors.text.muted }}>{describeServerProblem(sessionsError).headline} — today's sessions couldn't be loaded, they aren't missing.</p>
                <Button size="sm" variant="secondary" onClick={() => refetchSessions()}>Retry</Button>
              </div>
            ) : (
              <TodaySessions
                sessions={todaySessions}
                showTherapist={isOwnerOrAdmin}
                onSessionClick={(s) => setEditingSessionId(s.id)}
              />
            )}

            <FeedPanel />
            {isStaff && <MomPanel />}

            {isOwnerOrAdmin && <RenewalsPanel count={attention?.renewalsDue ?? 0} />}
            <MyTasks userId={user?.id ?? ''} />

            {loadingBirthdays ? <CardSkeleton /> : <UpcomingBirthdays birthdays={upcomingBirthdays} />}
            {isOwnerOrAdmin && <RecentlyJoinedChildren />}
            {isOwnerOrAdmin && (loadingOrgOverview || !orgOverview ? <CardSkeleton /> : <OrgOverview counts={orgOverview} />)}
          </div>
        )
      })()}

      {editingSessionId && (
        <SessionDrawerLoader
          sessionId={editingSessionId}
          onClose={() => setEditingSessionId(null)}
        />
      )}
    </div>
  )
}
