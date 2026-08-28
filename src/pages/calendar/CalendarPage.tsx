import { useState, useMemo, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft, ChevronRight, X, CalendarDays, Phone,
  CalendarOff, Clock, ExternalLink, Users, Bell, BellOff,
  Activity, CheckCircle2, Zap, Save, Sun, MessageSquare, MapPin, Plus,
} from 'lucide-react'
import {
  format, parseISO, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isToday, addMinutes,
  startOfWeek as getWeekStart,
} from 'date-fns'
import { useAuth } from '../../contexts/AuthContext'
import { hasRole } from '../../types'
import { inquiriesApi } from '../../api/inquiries'
import { leavesApi } from '../../api/leaves'
import { therapySessionsApi } from '../../api/therapySessions'
import { publicHolidaysApi } from '../../api/publicHolidays'
import { ActionModal, hasNextAction } from '../inquiries/ActionModal'
import { PageLoader } from '../../components/ui/Spinner'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Button } from '../../components/ui/Button'
import { getApiError } from '../../lib/apiError'
import { colors, styles, border, surface, accentAlpha, dangerAlpha, warningAlpha, palette, paletteStyle, type PaletteKey } from '../../theme'
import { sessionStatusLabel, labelFromEnum, roleBadge } from '../../components/ui/Badge'
import { reviewMeetingsApi } from '../../api/reviewMeetings'
import { meetingsApi } from '../../api/meetings'
import { patientsApi } from '../../api/patients'
import { enrollmentsApi } from '../../api/enrollments'
import { usersApi } from '../../api/users'
import { SessionNotesModal } from '../patients/EnrollmentSessions'
import AdHocSessionModal from './AdHocSessionModal'
import type { InquiryResponse, LeaveResponse, TherapySessionResponse, TherapySessionStatus, UpdateSessionNotesRequest, PublicHolidayResponse, ReviewMeetingResponse, MeetingResponse, MeetingParticipant, AssignableUser, UserResponse, PatientResponse, EnrollmentResponse } from '../../types'
import type { SlotSelection } from './types'
import { ROUTES } from '../../lib/routes'

// ── Event model ───────────────────────────────────────────────────────────────

type EventKind = 'consultation' | 'leave' | 'session' | 'holiday' | 'review' | 'meeting'

interface CalendarEvent {
  id: string
  date: string        // 'yyyy-MM-dd'
  time?: string       // 'HH:mm' — timed events only
  kind: EventKind
  title: string
  subtitle?: string
  status?: string
  isAllDay: boolean
  raw: InquiryResponse | LeaveResponse | TherapySessionResponse | PublicHolidayResponse | ReviewMeetingResponse | MeetingResponse
}

// ── Visual config per kind ────────────────────────────────────────────────────

function kindStyle(kind: EventKind, status?: string): React.CSSProperties {
  if (kind === 'consultation') {
    return { background: '#2B80C818', color: '#2B80C8' }
  }
  if (kind === 'holiday') {
    return { background: '#F59E0B20', color: '#B45309' }
  }
  if (kind === 'review') {
    if (status === 'CANCELLED') return { background: '#88888818', color: '#888', borderLeft: '3px solid #888' }
    if (status === 'COMPLETED') return { background: '#10b98118', color: '#059669', borderLeft: '3px solid #059669' }
    return {
      background: `rgba(${palette.teal.raw}, 0.12)`,
      color: palette.teal.text,
      borderLeft: `3px solid ${palette.teal.text}`,
    }
  }
  if (kind === 'meeting') {
    if (status === 'CANCELLED') return { background: '#88888818', color: '#888', borderLeft: '3px solid #888' }
    return {
      background: `rgba(${palette.pink.raw}, 0.12)`,
      color: palette.pink.text,
      borderLeft: `3px solid ${palette.pink.text}`,
    }
  }
  if (kind === 'session') {
    if (status === 'PENDING_RESCHEDULE')    return { background: '#F59E0B18', color: '#B45309' }
    if (status === 'CANCELLATION_REQUESTED') return { background: '#EF444418', color: '#dc2626' }
    if (status === 'CANCELLED')             return { background: '#88888818', color: '#888' }
    if (status === 'NO_SHOW')               return { background: '#f9731620', color: '#ea580c' }
    if (status === 'COMPLETED')             return { background: '#10b98118', color: '#059669' }
    return { background: `rgba(${palette.purple.raw}, 0.1)`, color: palette.purple.text }
  }
  // leave — approved = red, pending = amber, rejected = muted
  if (status === 'APPROVED') return { background: '#E05C5C18', color: '#E05C5C' }
  if (status === 'REJECTED') return { background: '#88888818', color: '#888' }
  return { background: '#F59E0B18', color: '#F59E0B' } // PENDING
}

function kindDot(kind: EventKind, status?: string): string {
  if (kind === 'consultation') return '#2B80C8'
  if (kind === 'holiday')      return '#B45309'
  if (kind === 'review') {
    if (status === 'CANCELLED') return '#888'
    if (status === 'COMPLETED') return '#10b981'
    return palette.teal.text
  }
  if (kind === 'meeting') {
    return status === 'CANCELLED' ? '#888' : palette.pink.text
  }
  if (kind === 'session') {
    if (status === 'PENDING_RESCHEDULE')    return '#B45309'
    if (status === 'CANCELLATION_REQUESTED') return '#dc2626'
    if (status === 'CANCELLED')             return '#888'
    if (status === 'NO_SHOW')               return '#f97316'
    if (status === 'COMPLETED')             return '#10b981'
    return palette.purple.text
  }
  if (status === 'APPROVED')   return '#E05C5C'
  if (status === 'REJECTED')   return '#888'
  return '#F59E0B'
}

// ── Data transformation ───────────────────────────────────────────────────────

function toConsultationEvent(i: InquiryResponse): CalendarEvent | null {
  if (!i.appointmentDate) return null
  const parsed = parseISO(i.appointmentDate)
  return {
    id: `consultation-${i.id}`,
    date: format(parsed, 'yyyy-MM-dd'),
    time: format(parsed, 'HH:mm'),
    kind: 'consultation',
    title: i.name,
    subtitle: i.reason ?? undefined,
    status: i.status,
    isAllDay: false,
    raw: i,
  }
}

function toLeaveEvent(l: LeaveResponse): CalendarEvent {
  return {
    id: `leave-${l.id}`,
    date: l.leaveDate,
    kind: 'leave',
    title: `${l.therapistFirstName} ${l.therapistLastName}`,
    subtitle: l.leaveType === 'HALF_DAY' ? 'Half Day' : 'Full Day',
    status: l.status,
    isAllDay: true,
    raw: l,
  }
}

function toSessionEvent(s: TherapySessionResponse): CalendarEvent {
  return {
    id: `session-${s.id}`,
    date: s.sessionDate,
    time: s.startTime.substring(0, 5), // "HH:mm" from "HH:mm:ss"
    kind: 'session',
    title: s.programName,
    // An ad-hoc session sits outside the generated block, so "#13 of 12" would read as
    // an error. Label it instead, and note when it is an extra rather than a paid one.
    subtitle: s.adHoc
      ? `${s.therapistFirstName} ${s.therapistLastName} · Ad-hoc${s.countsTowardPlan ? '' : ' (extra)'}`
      : `${s.therapistFirstName} ${s.therapistLastName} · Session ${s.sessionNumber}/${s.totalSessions}`,
    status: s.status,
    isAllDay: false,
    raw: s,
  }
}

function toReviewEvent(m: ReviewMeetingResponse): CalendarEvent {
  return {
    id: `review-${m.id}`,
    date: m.meetingDate,
    time: m.startTime.substring(0, 5),
    kind: 'review',
    title: `Review — ${m.patientName}`,
    subtitle: `${m.therapistName} · Review ${m.meetingNumber}`,
    status: m.status,
    isAllDay: false,
    raw: m,
  }
}

/** Attendee list shared by review meetings and general meetings. */
function ParticipantList({ participants }: { participants: MeetingParticipant[] }) {
  if (participants.length === 0) return null
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider mb-1.5"
        style={{ color: colors.text.muted }}>
        Participants ({participants.length})
      </p>
      <div className="flex flex-col gap-1">
        {participants.map(p => (
          <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg px-3 py-2"
            style={{ background: surface.rowHover }}>
            <span className="min-w-0 flex flex-col">
              <span className="text-sm truncate" style={{ color: colors.text.primary }}>
                {p.firstName} {p.lastName}
              </span>
              {p.isOrganiser && (
                <span className="text-xs" style={{ color: colors.text.dim }}>organiser</span>
              )}
            </span>
            <span className="flex-shrink-0">{roleBadge(p.role)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function toMeetingEvent(m: MeetingResponse): CalendarEvent {
  const names = m.participants.map(p => p.firstName).join(', ')
  return {
    id: `meeting-${m.id}`,
    date: m.meetingDate,
    time: m.startTime.substring(0, 5),
    kind: 'meeting',
    title: m.title,
    subtitle: `${m.participants.length} participant${m.participants.length === 1 ? '' : 's'} · ${names}`,
    status: m.status,
    isAllDay: false,
    raw: m,
  }
}

function toHolidayEvent(h: PublicHolidayResponse): CalendarEvent {
  return {
    id: `holiday-${h.id}`,
    date: h.holidayDate,
    kind: 'holiday',
    title: h.name,
    isAllDay: true,
    raw: h,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function eventsOnDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  const key = format(day, 'yyyy-MM-dd')
  return events.filter(e => e.date === key)
}

function timedEventsAtHour(events: CalendarEvent[], day: Date, hour: number): CalendarEvent[] {
  const key = format(day, 'yyyy-MM-dd')
  return events.filter(e =>
    !e.isAllDay && e.date === key &&
    e.time != null && parseInt(e.time.split(':')[0]) === hour
  )
}

function allDayEventsOnDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  const key = format(day, 'yyyy-MM-dd')
  return events.filter(e => e.isAllDay && e.date === key)
}

/** Which staff-column(s) an event belongs to — used by the per-therapist Staff view. */
function eventOwnerIds(ev: CalendarEvent): string[] {
  if (ev.kind === 'session') return [(ev.raw as TherapySessionResponse).therapistId]
  if (ev.kind === 'leave')   return [(ev.raw as LeaveResponse).therapistId]
  if (ev.kind === 'review')  return [(ev.raw as ReviewMeetingResponse).therapistId]
  if (ev.kind === 'meeting') return (ev.raw as MeetingResponse).participants.map(p => p.id)
  return [] // consultations and holidays aren't owned by a specific therapist
}

// Distinct colors cycled by column position — 'red'/'yellow' are reserved for status
// (danger/warning) elsewhere, so they're left out here to avoid reading as an alert.
const THERAPIST_PALETTE_KEYS: PaletteKey[] = ['teal', 'purple', 'blue', 'pink', 'green', 'amber', 'slate']

function therapistChipStyle(ev: CalendarEvent, columns: StaffColumn[]): React.CSSProperties | undefined {
  const ownerId = eventOwnerIds(ev)[0]
  if (!ownerId) return undefined
  const idx = columns.findIndex(c => c.id === ownerId)
  if (idx < 0) return undefined
  return paletteStyle(THERAPIST_PALETTE_KEYS[idx % THERAPIST_PALETTE_KEYS.length], 0.14, 0.35)
}

function upcomingEvents(events: CalendarEvent[], limit = 40): CalendarEvent[] {
  const todayKey = format(new Date(), 'yyyy-MM-dd')
  return events
    .filter(e => e.date >= todayKey)
    .sort((a, b) => {
      const dateComp = a.date.localeCompare(b.date)
      if (dateComp !== 0) return dateComp
      // all-day first within same date, then by time
      if (a.isAllDay !== b.isAllDay) return a.isAllDay ? -1 : 1
      return (a.time ?? '').localeCompare(b.time ?? '')
    })
    .slice(0, limit)
}

function upcomingDateLabel(dateKey: string): string {
  const todayKey    = format(new Date(), 'yyyy-MM-dd')
  const tomorrowKey = format(addDays(new Date(), 1), 'yyyy-MM-dd')
  if (dateKey === todayKey)    return 'Today'
  if (dateKey === tomorrowKey) return 'Tomorrow'
  return format(parseISO(dateKey + 'T00:00:00'), 'EEE, d MMM')
}

// ── Event chip ────────────────────────────────────────────────────────────────

function EventChip({
  event, onClick, compact = false, colorOverride,
}: { event: CalendarEvent; onClick: () => void; compact?: boolean; colorOverride?: React.CSSProperties }) {
  const s = colorOverride ?? kindStyle(event.kind, event.status)
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick() }}
      className="w-full text-left rounded-md px-1.5 py-0.5 truncate transition-opacity hover:opacity-75"
      style={{ ...s, fontSize: compact ? 11.5 : 12.65, fontWeight: 600 }}>
      {!compact && event.isAllDay && <CalendarOff size={9} className="inline mr-1 opacity-70" />}
      <span className="truncate">{event.title}</span>
      {!compact && !event.isAllDay && event.time && (
        <span className="ml-1 opacity-60 font-normal">{event.time}</span>
      )}
    </button>
  )
}

// ── Current time ──────────────────────────────────────────────────────────────

/** Minutes since midnight, ticking each minute so the marker creeps down the grid. */
function useNowMinutes() {
  const [mins, setMins] = useState(() => {
    const d = new Date()
    return d.getHours() * 60 + d.getMinutes()
  })
  useEffect(() => {
    const id = setInterval(() => {
      const d = new Date()
      setMins(d.getHours() * 60 + d.getMinutes())
    }, 60 * 1000)
    return () => clearInterval(id)
  }, [])
  return mins
}

/**
 * The red line across today, at the current time.
 *
 * Rendered inside the hour cell it falls in and offset by the minutes within that
 * hour, so it stays correct whatever height the row has grown to.
 */
function NowLine({ minutes, innerRef }: {
  minutes: number
  innerRef?: React.Ref<HTMLDivElement>
}) {
  return (
    <div
      ref={innerRef}
      className="pointer-events-none absolute left-0 right-0 z-10 flex items-center"
      style={{ top: `${(minutes % 60) / 60 * 100}%` }}
      aria-hidden
    >
      <span className="block h-2 w-2 rounded-full flex-shrink-0"
        style={{ background: colors.status.danger, marginLeft: -3 }} />
      <span className="block h-px flex-1" style={{ background: colors.status.danger }} />
    </div>
  )
}

// ── Drag-to-select a time slot ────────────────────────────────────────────────

/**
 * Click-and-drag across hour cells to pick a range.
 *
 * The drag is pinned to the column it started on — dragging sideways would otherwise
 * select a rectangle, which is not a thing you can book. For a plain day/week grid the
 * column is just the day; the per-therapist Staff Day view has several columns sharing
 * the same day, so it passes a `key` that also encodes which therapist's column it is.
 */
function useSlotDrag(onPick: (sel: SlotSelection) => void) {
  const [anchor, setAnchor] = useState<{ key: string; date: string; hour: number } | null>(null)
  const [hover, setHover]   = useState<number | null>(null)

  useEffect(() => {
    if (!anchor) return
    function finish() {
      const endHour = hover ?? anchor!.hour
      const lo = Math.min(anchor!.hour, endHour)
      const hi = Math.max(anchor!.hour, endHour)
      const hhmm = (h: number) => `${String(h).padStart(2, '0')}:00`
      // The grid is hour-granular; the chooser lets the user tune it from here.
      onPick({ date: anchor!.date, start: hhmm(lo), end: hhmm(hi + 1) })
      setAnchor(null)
      setHover(null)
    }
    window.addEventListener('mouseup', finish)
    return () => window.removeEventListener('mouseup', finish)
  }, [anchor, hover, onPick])

  /** `key` pins the drag to one column; `date` (defaults to `key`) is what gets booked. */
  function cellProps(key: string, hour: number, date: string = key) {
    const active = anchor?.key === key
      && hour >= Math.min(anchor.hour, hover ?? anchor.hour)
      && hour <= Math.max(anchor.hour, hover ?? anchor.hour)
    return {
      onMouseDown: (e: React.MouseEvent) => {
        // Let a click on an event chip open it rather than starting a drag.
        if ((e.target as HTMLElement).closest('button')) return
        e.preventDefault()
        setAnchor({ key, date, hour })
        setHover(hour)
      },
      onMouseEnter: () => { if (anchor?.key === key) setHover(hour) },
      style: active ? { background: accentAlpha(0.14) } : undefined,
      selected: active,
    }
  }

  return { cellProps, dragging: anchor !== null }
}

// ── Month View ────────────────────────────────────────────────────────────────

function MonthView({
  current, events, onSelect, holidayDates, colorFn, onDayClick,
}: {
  current: Date; events: CalendarEvent[]; onSelect: (e: CalendarEvent) => void; holidayDates: Set<string>
  /** Overrides the default kind-based chip color — used by the Staff month view to color by therapist. */
  colorFn?: (ev: CalendarEvent) => React.CSSProperties | undefined
  /** Drill into a day — clicking the cell background or "+N more" (not an event chip, which opens that event instead). */
  onDayClick?: (day: Date) => void
}) {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(current), { weekStartsOn: 1 }),
    end:   endOfWeek(endOfMonth(current),     { weekStartsOn: 1 }),
  })
  const dayHeaders = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="grid grid-cols-7 border-b" style={{ borderColor: border.divider }}>
        {dayHeaders.map(d => (
          <div key={d} className="py-2 text-center text-xs font-semibold uppercase tracking-wide min-w-0"
            style={{ color: colors.text.muted }}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 flex-1" style={{ gridAutoRows: '1fr' }}>
        {days.map((day, idx) => {
          const dayKey     = format(day, 'yyyy-MM-dd')
          const dayEvents  = eventsOnDay(events, day)
          const inMonth    = isSameMonth(day, current)
          const todayDay   = isToday(day)
          const isHoliday  = holidayDates.has(dayKey)
          const isLastRow  = idx >= days.length - 7
          const isLastCol  = (idx + 1) % 7 === 0

          // Sort: holidays first, then other all-day, then timed
          const sorted = [...dayEvents].sort((a, b) => {
            if (a.kind === 'holiday' && b.kind !== 'holiday') return -1
            if (b.kind === 'holiday' && a.kind !== 'holiday') return 1
            return (b.isAllDay ? 1 : 0) - (a.isAllDay ? 1 : 0)
          })

          return (
            <div key={day.toISOString()}
              className="flex flex-col p-1 min-h-[90px] min-w-0"
              onClick={onDayClick ? () => onDayClick(day) : undefined}
              onMouseEnter={onDayClick ? e => { (e.currentTarget as HTMLElement).style.background = accentAlpha(0.05) } : undefined}
              onMouseLeave={onDayClick ? e => { (e.currentTarget as HTMLElement).style.background = isHoliday ? '#FEF3C720' : '' } : undefined}
              style={{
                borderRight: !isLastCol ? `1px solid ${border.divider}` : 'none',
                borderBottom: !isLastRow ? `1px solid ${border.divider}` : 'none',
                opacity: inMonth ? 1 : 0.4,
                background: isHoliday ? '#FEF3C720' : undefined,
                cursor: onDayClick ? 'pointer' : undefined,
              }}>
              <div className="flex justify-end mb-1">
                <span className="text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full"
                  style={{
                    background: todayDay ? colors.accent : 'transparent',
                    color: todayDay ? '#fff' : inMonth ? colors.text.primary : colors.text.muted,
                    fontWeight: todayDay ? 700 : 500,
                  }}>
                  {format(day, 'd')}
                </span>
              </div>
              <div className="flex flex-col gap-0.5 flex-1 overflow-hidden min-w-0">
                {sorted.slice(0, 2).map(ev => (
                  <EventChip key={ev.id} event={ev} onClick={() => onSelect(ev)} compact colorOverride={colorFn?.(ev)} />
                ))}
                {sorted.length > 2 && (
                  <p className="text-[11.5px] pl-1" style={{ color: colors.text.muted }}>
                    +{sorted.length - 2} more
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Week View ─────────────────────────────────────────────────────────────────

function WeekView({
  current, events, onSelect, holidayDates, onSlotSelect, colorFn,
}: {
  current: Date; events: CalendarEvent[]; onSelect: (e: CalendarEvent) => void
  holidayDates: Set<string>
  /** Drag across hour cells to pick a slot. Omitted for roles that cannot book. */
  onSlotSelect?: (sel: SlotSelection) => void
  /** Overrides the default kind-based chip color — used by the Staff week view to color by therapist. */
  colorFn?: (ev: CalendarEvent) => React.CSSProperties | undefined
}) {
  const { cellProps } = useSlotDrag(onSlotSelect ?? (() => {}))
  const nowMins = useNowMinutes()
  const nowRef  = useRef<HTMLDivElement>(null)
  // 24 rows is a tall grid, so land the user on the current time rather than midnight.
  useEffect(() => { nowRef.current?.scrollIntoView({ block: 'center' }) }, [])
  const todayKey = format(new Date(), 'yyyy-MM-dd')
  const ws   = getWeekStart(current, { weekStartsOn: 1 })
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i))
  const HOURS = Array.from({ length: 24 }, (_, i) => i) // full day, 12 AM – 11 PM

  const hasAnyAllDay = days.some(d => allDayEventsOnDay(events, d).length > 0)

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-auto">
      {/* Day headers */}
      <div className="grid sticky top-0 z-10 border-b"
        style={{ gridTemplateColumns: '64px repeat(7, 1fr)', borderColor: border.divider, background: surface.card }}>
        <div />
        {days.map(day => {
          const dayKey    = format(day, 'yyyy-MM-dd')
          const isHoliday = holidayDates.has(dayKey)
          return (
            <div key={day.toISOString()} className="py-2 text-center border-l min-w-0"
              style={{ borderColor: border.divider, background: isHoliday ? '#FEF3C730' : undefined }}>
              <p className="text-xs font-semibold truncate px-1" style={{ color: isHoliday ? '#B45309' : colors.text.muted }}>
                {format(day, 'EEE')}
                {isHoliday && <Sun size={9} className="inline ml-1 opacity-80" />}
              </p>
              <div className="text-sm font-bold mx-auto mt-0.5 w-7 h-7 rounded-full flex items-center justify-center"
                style={{
                  background: isToday(day) ? colors.accent : 'transparent',
                  color: isToday(day) ? '#fff' : colors.text.primary,
                }}>
                {format(day, 'd')}
              </div>
            </div>
          )
        })}
      </div>

      {/* All-day row (leaves) */}
      {hasAnyAllDay && (
        <div className="grid border-b sticky z-10"
          style={{ gridTemplateColumns: '64px repeat(7, 1fr)', borderColor: border.divider, background: surface.card, top: 73 }}>
          <div className="px-1 pt-1 text-right">
            <span className="text-[10.35px] uppercase tracking-wide" style={{ color: colors.text.muted }}>All day</span>
          </div>
          {days.map(day => {
            const leaves = allDayEventsOnDay(events, day)
            return (
              <div key={day.toISOString()} className="border-l p-1 flex flex-col gap-0.5 min-h-[28px] min-w-0"
                style={{ borderColor: border.divider }}>
                {leaves.map(ev => (
                  <EventChip key={ev.id} event={ev} onClick={() => onSelect(ev)} colorOverride={colorFn?.(ev)} />
                ))}
              </div>
            )
          })}
        </div>
      )}

      {/* Hour rows */}
      <div className="flex-1">
        {HOURS.map(hour => (
          <div key={hour} className="grid border-b"
            style={{ gridTemplateColumns: '64px repeat(7, 1fr)', borderColor: border.divider, minHeight: 56 }}>
            <div className="px-2 pt-1 text-right">
              <span className="text-xs whitespace-nowrap tabular-nums" style={{ color: colors.text.muted }}>
                {hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
              </span>
            </div>
            {days.map(day => {
              const timed    = timedEventsAtHour(events, day, hour)
              const dayKeyH  = format(day, 'yyyy-MM-dd')
              const isHolCol = holidayDates.has(dayKeyH)
              const drag     = onSlotSelect ? cellProps(dayKeyH, hour) : null
              return (
                <div key={day.toISOString()} className="border-l p-1 flex flex-col gap-0.5 relative min-w-0"
                  onMouseDown={drag?.onMouseDown}
                  onMouseEnter={drag?.onMouseEnter}
                  style={{
                    borderColor: border.divider,
                    background: drag?.selected ? accentAlpha(0.14)
                              : isHolCol ? '#FFFBEB30' : undefined,
                    cursor: onSlotSelect ? 'cell' : undefined,
                    userSelect: 'none',
                  }}>
                  {dayKeyH === todayKey && Math.floor(nowMins / 60) === hour && (
                    <NowLine minutes={nowMins} innerRef={nowRef} />
                  )}
                  {[...timed].sort((a, b) => (a.time ?? '').localeCompare(b.time ?? '')).slice(0, 3).map(ev => (
                    <EventChip key={ev.id} event={ev} onClick={() => onSelect(ev)} colorOverride={colorFn?.(ev)} />
                  ))}
                  {timed.length > 3 && (
                    <p className="text-[11.5px] pl-1" style={{ color: colors.text.muted }}>
                      +{timed.length - 3} more
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Day View ──────────────────────────────────────────────────────────────────

function DayView({
  current, events, onSelect, holidayDates, onSlotSelect,
}: {
  current: Date; events: CalendarEvent[]; onSelect: (e: CalendarEvent) => void
  holidayDates: Set<string>
  /** Drag across hour cells to pick a slot. Omitted for roles that cannot book. */
  onSlotSelect?: (sel: SlotSelection) => void
}) {
  const { cellProps } = useSlotDrag(onSlotSelect ?? (() => {}))
  const nowMins = useNowMinutes()
  const nowRef  = useRef<HTMLDivElement>(null)
  useEffect(() => { nowRef.current?.scrollIntoView({ block: 'center' }) }, [])
  const showsToday = format(new Date(), 'yyyy-MM-dd') === format(current, 'yyyy-MM-dd')
  const dayKey    = format(current, 'yyyy-MM-dd')
  const isHoliday = holidayDates.has(dayKey)
  const HOURS     = Array.from({ length: 24 }, (_, i) => i) // full day, 12 AM – 11 PM

  const allDayEvs = allDayEventsOnDay(events, current)

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-auto">

      {/* Day header */}
      <div className="sticky top-0 z-10 flex items-stretch border-b flex-shrink-0"
        style={{ borderColor: border.divider, background: isHoliday ? '#FEF3C740' : surface.card }}>
        <div className="w-16 flex-shrink-0" />
        <div className="flex-1 py-3 text-center border-l" style={{ borderColor: border.divider }}>
          <p className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: isHoliday ? '#B45309' : colors.text.muted }}>
            {format(current, 'EEEE')}
            {isHoliday && <Sun size={10} className="inline ml-1 opacity-80" />}
          </p>
          <div className="text-2xl font-bold mx-auto mt-1 w-11 h-11 rounded-full flex items-center justify-center"
            style={{
              background: isToday(current) ? colors.accent : 'transparent',
              color: isToday(current) ? '#fff' : colors.text.primary,
            }}>
            {format(current, 'd')}
          </div>
          <p className="text-xs mt-1" style={{ color: colors.text.muted }}>
            {format(current, 'MMMM yyyy')}
          </p>
        </div>
      </div>

      {/* Holiday banner */}
      {isHoliday && (() => {
        const holiday = events.find(e => e.kind === 'holiday' && e.date === dayKey)
        return holiday ? (
          <button onClick={() => onSelect(holiday)}
            className="flex items-center gap-2 px-4 py-2 w-full text-left flex-shrink-0 transition-opacity hover:opacity-80"
            style={{ background: '#FEF3C760', borderBottom: `1px solid #F59E0B40` }}>
            <Sun size={13} style={{ color: '#B45309' }} />
            <span className="text-xs font-semibold" style={{ color: '#B45309' }}>
              Public Holiday — {holiday.title}
            </span>
          </button>
        ) : null
      })()}

      {/* All-day events */}
      {allDayEvs.filter(e => e.kind !== 'holiday').length > 0 && (
        <div className="flex border-b flex-shrink-0"
          style={{ borderColor: border.divider, background: surface.card }}>
          <div className="w-16 flex-shrink-0 px-2 pt-1.5 text-right">
            <span className="text-[10.35px] uppercase tracking-wide" style={{ color: colors.text.muted }}>All day</span>
          </div>
          <div className="flex-1 border-l p-2 flex flex-col gap-1 min-h-[32px]"
            style={{ borderColor: border.divider }}>
            {allDayEvs.filter(e => e.kind !== 'holiday').map(ev => (
              <EventChip key={ev.id} event={ev} onClick={() => onSelect(ev)} />
            ))}
          </div>
        </div>
      )}

      {/* Hour rows */}
      <div className="flex-1">
        {HOURS.map(hour => {
          const timed = timedEventsAtHour(events, current, hour)
          return (
            <div key={hour} className="flex border-b"
              style={{ borderColor: border.divider, minHeight: 64,
                       background: isHoliday ? '#FFFBEB30' : undefined }}>
              {/* Time label */}
              <div className="w-16 flex-shrink-0 px-3 pt-2 text-right">
                <span className="text-xs whitespace-nowrap tabular-nums" style={{ color: colors.text.muted }}>
                  {hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                </span>
              </div>
              {/* Events */}
              <div className="flex-1 border-l p-2 flex flex-col gap-1.5 relative"
                onMouseDown={onSlotSelect ? cellProps(dayKey, hour).onMouseDown : undefined}
                onMouseEnter={onSlotSelect ? cellProps(dayKey, hour).onMouseEnter : undefined}
                style={{
                  borderColor: border.divider,
                  background: onSlotSelect && cellProps(dayKey, hour).selected
                    ? accentAlpha(0.14) : undefined,
                  cursor: onSlotSelect ? 'cell' : undefined,
                  userSelect: 'none',
                }}>
                {showsToday && Math.floor(nowMins / 60) === hour && (
                  <NowLine minutes={nowMins} innerRef={nowRef} />
                )}
                {[...timed].sort((a, b) => (a.time ?? '').localeCompare(b.time ?? '')).slice(0, 3).map(ev => {
                  const s = kindStyle(ev.kind, ev.status)
                  const rawSess = ev.kind === 'session' ? (ev.raw as TherapySessionResponse) : null
                  return (
                    <button key={ev.id} onClick={() => onSelect(ev)}
                      className="w-full text-left rounded-xl px-3 py-2.5 transition-opacity hover:opacity-80"
                      style={{ ...s, minHeight: 52 }}>
                      <p className="text-xs font-semibold leading-tight">{ev.title}</p>
                      <p className="text-[12.65px] mt-0.5 opacity-75">
                        {ev.time}
                        {rawSess && ` – ${rawSess.endTime.substring(0, 5)}`}
                      </p>
                      {ev.subtitle && (
                        <p className="text-[12.65px] mt-0.5 opacity-70 truncate">{ev.subtitle}</p>
                      )}
                      {rawSess?.status && rawSess.status !== 'SCHEDULED' && (
                        <span className="inline-block mt-1 text-[11.5px] font-semibold px-1.5 py-0.5 rounded-full"
                          style={{ background: 'rgba(0,0,0,0.08)' }}>
                          {sessionStatusLabel(rawSess.status)}
                        </span>
                      )}
                    </button>
                  )
                })}
                {timed.length > 3 && (
                  <p className="text-[11.5px] pl-1" style={{ color: colors.text.muted }}>
                    +{timed.length - 3} other events
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Staff (per-therapist) Day View ──────────────────────────────────────────

interface StaffColumn {
  id: string
  firstName: string
  lastName: string
  label: string
}

function StaffDayView({
  current, events, columns, onSelect, holidayDates, onSlotSelect,
}: {
  current: Date; events: CalendarEvent[]; columns: StaffColumn[]
  onSelect: (e: CalendarEvent) => void
  holidayDates: Set<string>
  /** Drag across hour cells to pick a slot. Omitted for roles that cannot book. */
  onSlotSelect?: (sel: SlotSelection) => void
}) {
  const nowMins = useNowMinutes()
  const nowRef  = useRef<HTMLDivElement>(null)
  useEffect(() => { nowRef.current?.scrollIntoView({ block: 'center' }) }, [])
  const showsToday = format(new Date(), 'yyyy-MM-dd') === format(current, 'yyyy-MM-dd')
  const dayKey    = format(current, 'yyyy-MM-dd')
  const isHoliday = holidayDates.has(dayKey)
  const HOURS     = Array.from({ length: 24 }, (_, i) => i)

  const dayEvents = eventsOnDay(events, current)
  const gridCols  = `64px repeat(${columns.length}, minmax(200px, 1fr))`
  const { cellProps } = useSlotDrag(onSlotSelect ?? (() => {}))

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-auto">
      {/* Column headers */}
      <div className="grid sticky top-0 z-10 border-b"
        style={{ gridTemplateColumns: gridCols, borderColor: border.divider, background: surface.card }}>
        <div />
        {columns.map(col => (
          <div key={col.id} className="py-2 px-1 text-center border-l flex flex-col items-center gap-1 min-w-0"
            style={{ borderColor: border.divider }}>
            <div className="h-7 w-7 rounded-full text-xs font-bold flex items-center justify-center"
              style={{ background: accentAlpha(0.12), color: colors.accent }}>
              {col.firstName[0]}{col.lastName[0] ?? ''}
            </div>
            <p className="text-xs font-semibold truncate w-full" style={{ color: colors.text.primary }}>
              {col.label}
            </p>
          </div>
        ))}
      </div>

      {/* All-day row (leave) */}
      <div className="grid border-b sticky z-10"
        style={{ gridTemplateColumns: gridCols, borderColor: border.divider, background: surface.card, top: 73 }}>
        <div className="px-1 pt-1 text-right">
          <span className="text-[10.35px] uppercase tracking-wide" style={{ color: colors.text.muted }}>All day</span>
        </div>
        {columns.map(col => {
          const allDay = dayEvents.filter(e => e.isAllDay && eventOwnerIds(e).includes(col.id))
          return (
            <div key={col.id} className="border-l p-1 flex flex-col gap-0.5 min-h-[28px] min-w-0"
              style={{ borderColor: border.divider }}>
              {allDay.map(ev => (
                <EventChip key={ev.id} event={ev} onClick={() => onSelect(ev)} />
              ))}
            </div>
          )
        })}
      </div>

      {/* Hour rows */}
      <div className="flex-1">
        {HOURS.map(hour => (
          <div key={hour} className="grid border-b"
            style={{ gridTemplateColumns: gridCols, borderColor: border.divider, minHeight: 56,
                     background: isHoliday ? '#FFFBEB30' : undefined }}>
            <div className="px-2 pt-1 text-right">
              <span className="text-xs whitespace-nowrap tabular-nums" style={{ color: colors.text.muted }}>
                {hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
              </span>
            </div>
            {columns.map(col => {
              const timed = dayEvents.filter(e =>
                !e.isAllDay && e.time != null && parseInt(e.time.split(':')[0]) === hour &&
                eventOwnerIds(e).includes(col.id)
              )
              const sorted = [...timed].sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
              const drag   = onSlotSelect ? cellProps(`${dayKey}::${col.id}`, hour, dayKey) : null
              return (
                <div key={col.id} className="border-l p-1 flex flex-col gap-0.5 relative min-w-0"
                  onMouseDown={drag?.onMouseDown}
                  onMouseEnter={drag?.onMouseEnter}
                  style={{
                    borderColor: border.divider,
                    background: drag?.selected ? accentAlpha(0.14) : undefined,
                    cursor: onSlotSelect ? 'cell' : undefined,
                    userSelect: 'none',
                  }}>
                  {showsToday && col === columns[0] && Math.floor(nowMins / 60) === hour && (
                    <NowLine minutes={nowMins} innerRef={nowRef} />
                  )}
                  {sorted.slice(0, 2).map(ev => (
                    <EventChip key={ev.id} event={ev} onClick={() => onSelect(ev)} />
                  ))}
                  {sorted.length > 2 && (
                    <p className="text-[11.5px] pl-1" style={{ color: colors.text.muted }}>
                      +{sorted.length - 2} other events
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Upcoming panel ────────────────────────────────────────────────────────────

function UpcomingPanel({
  events, onSelect,
}: { events: CalendarEvent[]; onSelect: (e: CalendarEvent) => void }) {
  const upcoming = upcomingEvents(events)

  // Group into [{dateKey, events[]}] preserving sort order
  const groups: { dateKey: string; label: string; items: CalendarEvent[] }[] = []
  for (const ev of upcoming) {
    const last = groups[groups.length - 1]
    if (last && last.dateKey === ev.date) {
      last.items.push(ev)
    } else {
      groups.push({ dateKey: ev.date, label: upcomingDateLabel(ev.date), items: [ev] })
    }
  }

  return (
    <div className="w-60 flex flex-col flex-1 min-h-0 gap-3 overflow-y-auto">
      <p className="text-xs font-semibold uppercase tracking-wider flex-shrink-0"
        style={{ color: colors.text.muted }}>
        Upcoming
      </p>

      {groups.length === 0 ? (
        <p className="text-sm" style={{ color: colors.text.muted }}>Nothing scheduled</p>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map(group => (
            <div key={group.dateKey}>
              {/* Date header */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[12.65px] font-bold uppercase tracking-wide flex-shrink-0"
                  style={{ color: group.label === 'Today' ? colors.accent : colors.text.muted }}>
                  {group.label}
                </span>
                <div className="flex-1 h-px" style={{ background: border.divider }} />
              </div>

              {/* Event cards */}
              <div className="flex flex-col gap-1.5">
                {group.items.map(ev => {
                  const dot = kindDot(ev.kind, ev.status)
                  return (
                    <button key={ev.id} onClick={() => onSelect(ev)}
                      className="text-left rounded-xl p-2.5 w-full transition-colors"
                      style={{ background: surface.rowHover }}
                      onMouseEnter={e => (e.currentTarget.style.background = accentAlpha(0.07))}
                      onMouseLeave={e => (e.currentTarget.style.background = surface.rowHover)}>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dot }} />
                        <p className="text-xs font-semibold truncate flex-1"
                          style={{ color: colors.text.primary }}>
                          {ev.title}
                        </p>
                      </div>
                      {ev.subtitle && (
                        <p className="text-xs truncate mt-0.5 pl-4" style={{ color: colors.text.muted }}>
                          {ev.subtitle}
                        </p>
                      )}
                      {!ev.isAllDay && ev.time && (
                        <p className="text-xs mt-0.5 pl-4 flex items-center gap-1" style={{ color: dot }}>
                          <Clock size={9} />{ev.time}
                        </p>
                      )}
                      {ev.isAllDay && (
                        <p className="text-xs mt-0.5 pl-4" style={{ color: dot, opacity: 0.75 }}>
                          All day
                        </p>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── What to put in a dragged slot ─────────────────────────────────────────────

function SlotChoiceModal({
  slot, onClose, onPick,
}: {
  slot: SlotSelection
  onClose: () => void
  /** Hands back the slot as tuned here, not as originally dragged. */
  onPick: (what: 'meeting' | 'session', tuned: SlotSelection) => void
}) {
  // The grid only drags in whole hours, so the real start and end are set here.
  const [date, setDate]   = useState(slot.date)
  const [start, setStart] = useState(slot.start)
  const [end, setEnd]     = useState(slot.end)
  const [error, setError] = useState('')

  const minutes = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }
  const durationMins = minutes(end) - minutes(start)
  const valid = durationMins > 0

  function choose(what: 'meeting' | 'session') {
    if (!valid) { setError('End time must be after the start time'); return }
    onPick(what, { date, start, end })
  }

  function nudgeEnd(mins: number) {
    const total = Math.max(minutes(start) + 15, minutes(end) + mins)
    const capped = Math.min(total, 23 * 60 + 45)
    setEnd(`${String(Math.floor(capped / 60)).padStart(2, '0')}:${String(capped % 60).padStart(2, '0')}`)
    setError('')
  }

  const options: { key: 'meeting' | 'session'; label: string; hint: string; icon: React.ElementType }[] = [
    { key: 'session', label: 'Therapy session', hint: 'A one-off session for a patient on a plan', icon: Activity },
    { key: 'meeting', label: 'Meeting',         hint: 'With staff and parents you choose',        icon: Users },
  ]

  return (
    <Modal open title="Book this slot" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="form-label">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="form-input w-full" />
          </div>
          <div>
            <label className="form-label">Starts</label>
            <input type="time" step={900} value={start}
              onChange={e => { setStart(e.target.value); setError('') }}
              className="form-input w-full" />
          </div>
          <div>
            <label className="form-label">Ends</label>
            <input type="time" step={900} value={end}
              onChange={e => { setEnd(e.target.value); setError('') }}
              className="form-input w-full" />
          </div>
        </div>

        {/* Quick nudges — the common case is trimming an hour-aligned drag */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs" style={{ color: colors.text.dim }}>
            {valid
              ? `${Math.floor(durationMins / 60) ? `${Math.floor(durationMins / 60)}h ` : ''}${durationMins % 60 ? `${durationMins % 60}m` : ''}`.trim()
              : 'Invalid range'}
          </span>
          {[-30, -15, +15, +30].map(m => (
            <button key={m} type="button" onClick={() => nudgeEnd(m)}
              className="text-xs px-2 py-1 rounded-lg font-medium"
              style={{ background: surface.filterStrip, color: colors.text.muted }}>
              {m > 0 ? `+${m}` : m}m
            </button>
          ))}
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="flex flex-col gap-2">
          {options.map(o => {
            const Icon = o.icon
            return (
              <button
                key={o.key}
                type="button"
                onClick={() => choose(o.key)}
                disabled={!valid}
                className="flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-colors disabled:opacity-50"
                style={{ background: surface.filterStrip, border: `1.5px solid transparent` }}
                onMouseEnter={e => { if (valid) e.currentTarget.style.background = accentAlpha(0.08) }}
                onMouseLeave={e => (e.currentTarget.style.background = surface.filterStrip)}
              >
                <Icon size={18} style={{ color: colors.accent }} />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold" style={{ color: colors.text.primary }}>
                    {o.label}
                  </span>
                  <span className="block text-xs" style={{ color: colors.text.dim }}>{o.hint}</span>
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </Modal>
  )
}

// ── Schedule a meeting ────────────────────────────────────────────────────────

function NewMeetingModal({
  onClose, onDone, initial,
}: {
  onClose: () => void
  onDone: () => void
  /** Prefilled when the modal was opened by dragging a slot on the calendar. */
  initial?: SlotSelection
}) {
  const pad = (h: number) => `${String(h).padStart(2, '0')}:00`
  const [title, setTitle]         = useState('')
  const [description, setDesc]    = useState('')
  const [date, setDate]           = useState(initial?.date ?? format(new Date(), 'yyyy-MM-dd'))
  const [startTime, setStartTime] = useState(initial?.start ?? '10:00')
  const [endTime, setEndTime]     = useState(initial?.end ?? '10:30')
  const [location, setLocation]   = useState('')
  const [picked, setPicked]       = useState<string[]>([])
  const [search, setSearch]       = useState('')
  const [error, setError]         = useState('')

  // Parents are included: a meeting about a child usually needs one in the room.
  const { data: people = [] } = useQuery({
    queryKey: ['assignable', 'with-parents'],
    queryFn:  () => usersApi.listAssignable(true),
  })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return people
    return people.filter((u: AssignableUser) =>
      `${u.firstName} ${u.lastName}`.toLowerCase().includes(q))
  }, [people, search])

  const mut = useMutation({
    mutationFn: () => meetingsApi.create({
      title: title.trim(),
      description: description.trim() || undefined,
      meetingDate: date,
      startTime,
      endTime,
      location: location.trim() || undefined,
      participantIds: picked,
    }),
    onSuccess: onDone,
    onError: (err: unknown) => setError(getApiError(err, 'Could not schedule the meeting')),
  })

  function submit() {
    if (!title.trim())       { setError('Give the meeting a title'); return }
    if (picked.length === 0) { setError('Pick at least one participant'); return }
    if (endTime <= startTime) { setError('End time must be after the start time'); return }
    setError('')
    mut.mutate()
  }

  return (
    <Modal open title="Schedule a meeting" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <Input label="Title" value={title} onChange={e => setTitle(e.target.value)}
          placeholder="Case discussion — Aarav Sharma" />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="form-label">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="form-input w-full" />
          </div>
          <div>
            <label className="form-label">Starts</label>
            <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
              className="form-input w-full" />
          </div>
          <div>
            <label className="form-label">Ends</label>
            <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
              className="form-input w-full" />
          </div>
        </div>

        <Input label="Location (optional)" value={location} onChange={e => setLocation(e.target.value)}
          placeholder="Main Clinic — Room 2" />

        <div>
          <label className="form-label">Notes (optional)</label>
          <textarea value={description} onChange={e => setDesc(e.target.value)} rows={2}
            className="form-input w-full" placeholder="What the meeting is for" />
        </div>

        {/* Participants */}
        <div>
          <label className="form-label">
            Participants{picked.length > 0 ? ` (${picked.length} selected)` : ''}
          </label>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search staff and parents…"
            className="form-input w-full mb-2"
          />
          <div className="max-h-52 overflow-y-auto rounded-xl"
            style={{ border: border.card }}>
            {filtered.length === 0 ? (
              <p className="text-xs p-3" style={{ color: colors.text.dim }}>No one matches that search.</p>
            ) : filtered.map((u: AssignableUser) => {
              const on = picked.includes(u.id)
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setPicked(prev =>
                    on ? prev.filter(id => id !== u.id) : [...prev, u.id])}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left transition-colors"
                  style={{ background: on ? accentAlpha(0.08) : 'transparent' }}
                >
                  <span className="text-sm truncate" style={{ color: colors.text.primary }}>
                    {u.firstName} {u.lastName}
                  </span>
                  <span className="flex items-center gap-2 flex-shrink-0">
                    {roleBadge(u.role)}
                    {on && <CheckCircle2 size={15} style={{ color: colors.accent }} />}
                  </span>
                </button>
              )
            })}
          </div>
          <p className="text-xs mt-1.5" style={{ color: colors.text.dim }}>
            You are added automatically as the organiser.
          </p>
        </div>

        {error && <p className="form-error">{error}</p>}
      </div>

      <div className="flex gap-2 justify-end mt-6 pt-4" style={{ borderTop: `1px solid ${border.divider}` }}>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" loading={mut.isPending} onClick={submit}>
          Schedule &amp; send invites
        </Button>
      </div>
    </Modal>
  )
}

// ── Move a planned session ────────────────────────────────────────────────────

function RescheduleSessionModal({
  session, onClose, onDone,
}: {
  session: TherapySessionResponse
  onClose: () => void
  onDone: () => void
}) {
  const [date, setDate]       = useState(session.sessionDate)
  const [time, setTime]       = useState(session.startTime.substring(0, 5))
  const [therapistId, setTherapistId] = useState('')
  const [reason, setReason]   = useState('')
  const [error, setError]     = useState('')

  const { data: therapists = [] } = useQuery({
    queryKey: ['therapists'],
    queryFn:  () => usersApi.listTherapists(),
  })

  const mut = useMutation({
    mutationFn: () => therapySessionsApi.reschedule(session.id, {
      newDate: date !== session.sessionDate ? date : undefined,
      newStartTime: time !== session.startTime.substring(0, 5) ? time : undefined,
      substituteTherapistId: therapistId || undefined,
      reason: reason.trim() || undefined,
    }),
    onSuccess: onDone,
    onError: (err: unknown) => setError(getApiError(err, 'Could not reschedule the session')),
  })

  const unchanged = date === session.sessionDate
    && time === session.startTime.substring(0, 5)
    && !therapistId

  return (
    <Modal open title="Reschedule session" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="rounded-xl px-3 py-2.5 text-sm"
          style={{ background: surface.rowHover, color: colors.text.muted }}>
          Currently{' '}
          <span style={{ color: colors.text.primary, fontWeight: 600 }}>
            {format(parseISO(session.sessionDate + 'T00:00:00'), 'EEE, d MMM yyyy')}
            {' at '}{session.startTime.substring(0, 5)}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="form-label">New date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="form-input w-full" />
          </div>
          <div>
            <label className="form-label">New time</label>
            <input type="time" value={time} onChange={e => setTime(e.target.value)}
              className="form-input w-full" />
          </div>
        </div>
        <p className="text-xs -mt-2" style={{ color: colors.text.dim }}>
          The session keeps its current length.
        </p>

        <Select
          label="Different therapist (optional)"
          value={therapistId}
          onChange={e => setTherapistId(e.target.value)}
          placeholder="Keep the current therapist"
          options={therapists
            .filter((t: UserResponse) => t.id !== session.therapistId)
            .map((t: UserResponse) => ({ value: t.id, label: `${t.firstName} ${t.lastName}` }))}
        />

        <Input
          label="Reason (optional)"
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Therapist is at a conference that morning"
        />

        <p className="text-xs" style={{ color: colors.text.dim }}>
          The family and the therapist are emailed the new time. If you swap the therapist, the one
          coming off the session is told as well.
        </p>

        {error && <p className="form-error">{error}</p>}
      </div>

      <div className="flex gap-2 justify-end mt-6 pt-4" style={{ borderTop: `1px solid ${border.divider}` }}>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button
          variant="primary"
          loading={mut.isPending}
          onClick={() => {
            if (unchanged) { setError('Change the date, the time, or the therapist'); return }
            setError('')
            mut.mutate()
          }}
        >
          Reschedule &amp; notify
        </Button>
      </div>
    </Modal>
  )
}

// ── Event detail drawer ───────────────────────────────────────────────────────

// Status options for admin/owner (can directly cancel)
// A therapy session gets the same Session Notes modal used on the Patient → Therapy tab
// (Performance Score, Rating, Progress Report, checklist, Attachments, Mark-as), rather than
// the lighter drawer used for every other calendar event kind. This wrapper adds the two
// actions that only make sense from the calendar — reschedule, and approving/rejecting a
// pending cancellation — as optional props on the shared modal.
function SessionEventModal({
  session, canAccessNotes, canManageAll, canReschedule, onClose,
}: {
  session: TherapySessionResponse
  canAccessNotes: boolean
  canManageAll: boolean
  canReschedule: boolean
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [rescheduleOpen, setRescheduleOpen] = useState(false)

  const invalidateAndClose = () => {
    qc.invalidateQueries({ queryKey: ['therapy-sessions-cal'] })
    qc.invalidateQueries({ queryKey: ['therapy-sessions-enrollment'] })
    onClose()
  }

  const approveCancellationMut = useMutation({
    mutationFn: () => therapySessionsApi.approveCancellation(session.id),
    onSuccess: invalidateAndClose,
  })
  const rejectCancellationMut = useMutation({
    mutationFn: () => therapySessionsApi.rejectCancellation(session.id),
    onSuccess: invalidateAndClose,
  })

  const cancellationRequested = canManageAll && session.status === 'CANCELLATION_REQUESTED'

  return (
    <>
      <SessionNotesModal
        session={session}
        canEdit={canAccessNotes}
        canDirectlyCancel={canManageAll}
        enrollmentId={session.enrollmentId}
        onClose={onClose}
        onReschedule={canReschedule && session.status === 'SCHEDULED' ? () => setRescheduleOpen(true) : undefined}
        cancellationRequested={cancellationRequested}
        onApproveCancellation={cancellationRequested ? () => approveCancellationMut.mutate() : undefined}
        onRejectCancellation={cancellationRequested ? () => rejectCancellationMut.mutate() : undefined}
      />
      {rescheduleOpen && (
        <RescheduleSessionModal
          session={session}
          onClose={() => setRescheduleOpen(false)}
          onDone={() => { setRescheduleOpen(false); invalidateAndClose() }}
        />
      )}
    </>
  )
}

function EventDetailDrawer({
  event, onClose, canGoToInquiries, canManageAll, canCreateMeetings, onLogOutcome,
}: {
  event: CalendarEvent
  onClose: () => void
  canGoToInquiries: boolean
  canManageAll: boolean
  /** Staff can cancel a meeting; parents and patients only attend one. */
  canCreateMeetings: boolean
  onLogOutcome?: (inquiry: InquiryResponse) => void
}) {
  const navigate  = useNavigate()
  const qc        = useQueryClient()
  const s         = kindStyle(event.kind, event.status)

  const isConsultation = event.kind === 'consultation'
  const isSession      = event.kind === 'session'
  const isHolidayEv    = event.kind === 'holiday'
  const isReview       = event.kind === 'review'
  const isMeeting      = event.kind === 'meeting'
  const rawInquiry     = event.raw as InquiryResponse
  const rawLeave       = event.raw as LeaveResponse
  const rawSession     = event.raw as TherapySessionResponse
  const rawReview      = event.raw as ReviewMeetingResponse
  const rawMeeting     = event.raw as MeetingResponse

  const cancelMeetingMut = useMutation({
    mutationFn: (reason: string) => meetingsApi.cancel(rawMeeting.id, reason || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meetings'] })
      onClose()
    },
  })

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 lg:hidden" onClick={onClose}
        style={{ background: 'rgba(0,0,0,0.3)' }} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full z-50 w-full sm:w-80 flex flex-col shadow-2xl"
        style={{ background: surface.card, borderLeft: `1px solid ${border.card}` }}>

        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b flex-shrink-0"
          style={{ borderColor: border.divider }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={s}>
              {isConsultation ? <CalendarDays size={17} /> : isSession ? <Activity size={17} /> : isHolidayEv ? <Sun size={17} /> : isReview ? <MessageSquare size={17} /> : isMeeting ? <Users size={17} /> : <CalendarOff size={17} />}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-0.5"
                style={{ color: s.color as string }}>
                {isConsultation ? 'Consultation' : isSession ? 'Therapy Session' : isHolidayEv ? 'Public Holiday' : isReview ? 'Review Meeting' : isMeeting ? 'Meeting' : 'Leave'}
              </p>
              <p className="font-semibold text-sm" style={{ color: colors.text.primary }}>
                {event.title}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg flex-shrink-0"
            style={{ color: colors.text.muted }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">

          {/* Date + time */}
          <div className="flex flex-col gap-1">
            <Row icon={<CalendarDays size={14} />}
              label={format(parseISO(event.date + 'T00:00:00'), 'EEEE, d MMMM yyyy')} />
            {event.time && !isSession && (
              <Row icon={<Clock size={14} />} label={event.time} />
            )}
            {isSession && (
              <Row icon={<Clock size={14} />}
                label={`${rawSession.startTime.substring(0, 5)} – ${rawSession.endTime.substring(0, 5)}`} />
            )}
            {event.subtitle && !isSession && !isMeeting && (
              <Row icon={isConsultation ? <Clock size={14} /> : isReview ? <Users size={14} /> : <CalendarOff size={14} />}
                label={event.subtitle} />
            )}
          </div>

          <div style={{ height: 1, background: border.divider }} />

          {/* Consultation-specific */}
          {isConsultation && (
            <>
              {rawInquiry.phone && (
                <Row icon={<Phone size={14} />}>
                  <a href={`tel:${rawInquiry.phone}`} className="text-sm font-medium"
                    style={{ color: colors.accent }}>{rawInquiry.phone}</a>
                </Row>
              )}
              {rawInquiry.reason && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-1.5"
                    style={{ color: colors.text.muted }}>Reason</p>
                  <p className="text-sm rounded-xl px-3 py-2.5"
                    style={{ color: colors.text.primary, background: surface.rowHover }}>
                    {rawInquiry.reason}
                  </p>
                </div>
              )}
              {rawInquiry.status && (
                <Row icon={<Users size={14} />}
                  label={`Status: ${labelFromEnum(rawInquiry.status)}`} />
              )}
            </>
          )}

          {/* Review-meeting-specific */}
          {isReview && (
            <>
              <Row icon={<Clock size={14} />}
                label={`${rawReview.startTime.substring(0, 5)} – ${rawReview.endTime.substring(0, 5)}`} />
              <ParticipantList participants={rawReview.participants ?? []} />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-1.5"
                  style={{ color: colors.text.muted }}>Feedback</p>
                <p className="text-sm rounded-xl px-3 py-2.5"
                  style={{ color: colors.text.primary, background: surface.rowHover }}>
                  {rawReview.therapistFeedbackAt && rawReview.parentFeedbackAt
                    ? 'Both sides have shared their feedback.'
                    : rawReview.therapistFeedbackAt
                      ? 'The therapist has shared feedback.'
                      : rawReview.parentFeedbackAt
                        ? 'The parent has shared feedback.'
                        : 'No feedback shared yet.'}
                </p>
              </div>
              <button
                onClick={() => { onClose(); navigate(`${ROUTES.patients}/${rawReview.patientId}`) }}
                className="w-full py-2.5 rounded-xl text-sm font-semibold"
                style={{ color: '#fff', background: colors.accent }}>
                Open patient
              </button>
            </>
          )}

          {/* Meeting-specific */}
          {isMeeting && (
            <>
              <Row icon={<Clock size={14} />}
                label={`${rawMeeting.startTime.substring(0, 5)} – ${rawMeeting.endTime.substring(0, 5)}`} />
              {rawMeeting.location && (
                <Row icon={<MapPin size={14} />} label={rawMeeting.location} />
              )}
              <ParticipantList participants={rawMeeting.participants ?? []} />
              {rawMeeting.description && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-1.5"
                    style={{ color: colors.text.muted }}>Notes</p>
                  <p className="text-sm rounded-xl px-3 py-2.5 whitespace-pre-wrap"
                    style={{ color: colors.text.primary, background: surface.rowHover }}>
                    {rawMeeting.description}
                  </p>
                </div>
              )}
              {canCreateMeetings && rawMeeting.status === 'SCHEDULED' && (
                <button
                  onClick={() => {
                    const reason = window.prompt('Reason for cancelling this meeting?')
                    if (reason !== null) cancelMeetingMut.mutate(reason)
                  }}
                  disabled={cancelMeetingMut.isPending}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
                  style={{ color: colors.status.danger, background: dangerAlpha(0.08) }}>
                  Cancel meeting
                </button>
              )}
            </>
          )}

          {/* Holiday-specific */}
          {isHolidayEv && (
            <div className="rounded-xl px-3 py-3 text-sm"
              style={{ background: '#FEF3C740', color: '#B45309', border: '1px solid #F59E0B40' }}>
              No sessions are scheduled on this day. Any sessions that would have fallen here were automatically moved to the next available date.
            </div>
          )}

          {/* Leave-specific */}
          {!isConsultation && !isSession && !isHolidayEv && !isReview && !isMeeting && (
            <>
              <Row icon={<Users size={14} />}
                label={`${rawLeave.therapistFirstName} ${rawLeave.therapistLastName}`} />
              {rawLeave.status && (
                <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold self-start"
                  style={kindStyle('leave', rawLeave.status)}>
                  {rawLeave.status}
                </div>
              )}
              {rawLeave.reason && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-1.5"
                    style={{ color: colors.text.muted }}>Reason</p>
                  <p className="text-sm rounded-xl px-3 py-2.5"
                    style={{ color: colors.text.primary, background: surface.rowHover }}>
                    {rawLeave.reason}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!isHolidayEv && canGoToInquiries && isConsultation && (
          <div className="p-5 border-t flex-shrink-0 flex flex-col gap-2" style={{ borderColor: border.divider }}>
            {onLogOutcome && hasNextAction(rawInquiry.status) && (
              <button
                onClick={() => { onClose(); onLogOutcome(rawInquiry) }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                style={{ background: colors.accent, color: '#fff' }}>
                <Zap size={14} /> Log Outcome
              </button>
            )}
            <button
              onClick={() => { onClose(); navigate(ROUTES.inquiries) }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors"
              style={{ background: accentAlpha(0.1), color: colors.accent }}>
              Go to Inquiries <ExternalLink size={14} />
            </button>
          </div>
        )}
      </div>
    </>
  )
}

function Row({
  icon, label, children,
}: { icon: React.ReactNode; label?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span style={{ color: colors.text.muted }}>{icon}</span>
      {label
        ? <span className="text-sm" style={{ color: colors.text.primary }}>{label}</span>
        : children}
    </div>
  )
}

function ProgramSessionsPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{ background: accentAlpha(0.1) }}>
        <CalendarDays size={26} style={{ color: colors.accent }} />
      </div>
      <p className="font-semibold text-base" style={{ color: colors.text.primary }}>
        Program sessions coming soon
      </p>
      <p className="text-sm max-w-xs" style={{ color: colors.text.muted }}>
        Once therapy programs are set up, your scheduled sessions will appear here automatically.
      </p>
    </div>
  )
}

// ── Main CalendarPage ─────────────────────────────────────────────────────────

type ViewMode = 'month' | 'week' | 'day' | 'staff'

export default function CalendarPage() {
  const { user, activeRole }  = useAuth()
  const navigate = useNavigate()
  const [view,         setView]         = useState<ViewMode>('day')
  const [current,      setCurrent]      = useState(new Date())
  const [selected,     setSelected]     = useState<CalendarEvent | null>(null)
  const [actionTarget, setActionTarget] = useState<InquiryResponse | null>(null)

  const currentRole = activeRole ?? user?.role
  const canSeeInquiries  = !!user && (
    hasRole(user, 'BUSINESS_OWNER') || hasRole(user, 'CLINIC_HEAD')
  )
  const canSeeLeaves     = !!user && !hasRole(user, 'PARENT') && !hasRole(user, 'PATIENT')
  const canSeeSessions   = !!user && !hasRole(user, 'PATIENT')
  const canUpdateSession = !!user && (
    hasRole(user, 'THERAPIST') || hasRole(user, 'DOCTOR') ||
    hasRole(user, 'CLINIC_HEAD') || hasRole(user, 'BUSINESS_OWNER')
  )
  const canHandleOutcomes = canSeeInquiries
  const canGoToInquiries  = canSeeInquiries
  // Parents and patients attend meetings but never schedule them
  const canCreateMeetings = !!user && !hasRole(user, 'PARENT') && !hasRole(user, 'PATIENT')
  // Booking from the calendar is a front-desk action; clinical staff read the grid.
  const canBookSlots = !!user && (
    hasRole(user, 'BUSINESS_OWNER') || hasRole(user, 'CLINIC_HEAD')
  )
  const canReschedule = !!user && (
    hasRole(user, 'BUSINESS_OWNER') || hasRole(user, 'CLINIC_HEAD')
  )
  // Seeing every therapist's schedule side by side is an org-management view.
  const canSeeStaffView = canBookSlots
  const [newMeetingOpen, setNewMeetingOpen] = useState(false)
  const [slotSelection,  setSlotSelection]  = useState<SlotSelection | null>(null)
  const [slotChoice,     setSlotChoice]     = useState<'meeting' | 'session' | null>(null)
  const [upcomingOpen,   setUpcomingOpen]   = useState(false)
  const [caseFilter,     setCaseFilter]     = useState('')
  const [programFilter,  setProgramFilter]  = useState('')
  const [staffTherapistId,   setStaffTherapistId]   = useState('')
  const [staffGranularity,   setStaffGranularity]   = useState<'day' | 'week' | 'month'>('day')
  const qcMain = useQueryClient()

  // ── Browser notification state ─────────────────────────────────────────────
  const supportsNotif = typeof window !== 'undefined' && 'Notification' in window
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>(
    supportsNotif ? Notification.permission : 'unsupported'
  )
  // Track IDs already notified this session so we don't repeat
  const notifiedRef = useRef(new Set<string>())

  function requestNotifPermission() {
    if (!supportsNotif) return
    Notification.requestPermission().then(p => setNotifPermission(p))
  }

  // ── Visible date range ─────────────────────────────────────────────────────
  const staffIsWeek  = view === 'staff' && staffGranularity === 'week'
  const staffIsMonth = view === 'staff' && staffGranularity === 'month'
  const staffIsDay   = view === 'staff' && staffGranularity === 'day'
  const visStart = useMemo(() => {
    if (view === 'day' || staffIsDay) return format(current, 'yyyy-MM-dd')
    if (view === 'week' || staffIsWeek)  return format(getWeekStart(current, { weekStartsOn: 1 }), 'yyyy-MM-dd')
    return format(startOfWeek(startOfMonth(current), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  }, [current, view, staffIsDay, staffIsWeek])
  const visEnd = useMemo(() => {
    if (view === 'day' || staffIsDay) return format(current, 'yyyy-MM-dd')
    if (view === 'week' || staffIsWeek)  return format(addDays(getWeekStart(current, { weekStartsOn: 1 }), 6), 'yyyy-MM-dd')
    return format(endOfWeek(endOfMonth(current), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  }, [current, view, staffIsDay, staffIsWeek])

  // ── Data fetching ──────────────────────────────────────────────────────────
  const { data: inquiries = [], isLoading: inquiriesLoading } = useQuery({
    queryKey: ['inquiries'],
    queryFn:  () => inquiriesApi.list(),
    enabled:  canSeeInquiries,
  })

  const { data: leaves = [], isLoading: leavesLoading } = useQuery({
    queryKey: ['leaves'],
    queryFn:  () => leavesApi.list(),
    enabled:  canSeeLeaves,
  })

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ['therapy-sessions-cal', { from: visStart, to: visEnd }],
    queryFn:  () => therapySessionsApi.list({ from: visStart, to: visEnd }),
    enabled:  canSeeSessions,
    staleTime: 5 * 60 * 1000,
    // The key is scoped to the visible date range, so switching view or navigating
    // next/prev looks like a brand-new query with no data yet — keep the outgoing
    // range's events on screen while the new range loads instead of blanking the page.
    placeholderData: (previousData) => previousData,
  })

  const { data: publicHolidays = [] } = useQuery({
    queryKey: ['public-holidays'],
    queryFn:  publicHolidaysApi.list,
    staleTime: 60 * 60 * 1000, // holidays rarely change; cache for 1 hour
  })

  const { data: staffTherapists = [] } = useQuery({
    queryKey: ['therapists'],
    queryFn:  () => usersApi.listTherapists(),
    enabled:  canSeeStaffView,
    staleTime: 5 * 60 * 1000,
  })

  // Scoped server-side: therapists get their own, parents their children's
  const { data: reviewMeetings = [] } = useQuery({
    queryKey: ['review-meetings', 'mine'],
    queryFn:  reviewMeetingsApi.listMine,
    staleTime: 5 * 60 * 1000,
  })

  // Scoped server-side: admins get the whole org, everyone else their own meetings
  const { data: meetings = [] } = useQuery({
    queryKey: ['meetings', { from: visStart, to: visEnd }],
    queryFn:  () => meetingsApi.list(visStart, visEnd),
    staleTime: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  })

  const isLoading = inquiriesLoading || leavesLoading || sessionsLoading

  // ── Set of holiday date keys for fast lookup ───────────────────────────────
  const holidayDates = useMemo(
    () => new Set(publicHolidays.map(h => h.holidayDate)),
    [publicHolidays]
  )

  // ── Build unified event list ───────────────────────────────────────────────
  const events = useMemo<CalendarEvent[]>(() => {
    const out: CalendarEvent[] = []
    for (const i of inquiries) {
      const ev = toConsultationEvent(i)
      if (ev) out.push(ev)
    }
    const leavesToShow = canSeeInquiries
      ? leaves.filter(l => l.status === 'APPROVED')
      : leaves
    for (const l of leavesToShow) out.push(toLeaveEvent(l))
    for (const s of sessions) out.push(toSessionEvent(s))
    for (const h of publicHolidays) out.push(toHolidayEvent(h))
    for (const m of reviewMeetings) {
      if (m.status !== 'CANCELLED') out.push(toReviewEvent(m))
    }
    for (const m of meetings) {
      if (m.status !== 'CANCELLED') out.push(toMeetingEvent(m))
    }
    return out
  }, [inquiries, leaves, sessions, publicHolidays, reviewMeetings, meetings, canSeeInquiries])

  // ── Staff view: columns + Case/Program filters ─────────────────────────────
  const staffColumns = useMemo<StaffColumn[]>(() => {
    const me: StaffColumn = {
      id: user?.id ?? '', firstName: user?.firstName ?? '', lastName: user?.lastName ?? '', label: 'Me',
    }
    return [me, ...staffTherapists.map(t => ({
      id: t.id, firstName: t.firstName, lastName: t.lastName, label: `${t.firstName} ${t.lastName}`,
    }))]
  }, [user, staffTherapists])

  const caseOptions = useMemo(() => {
    const byId = new Map<string, string>()
    for (const s of sessions) byId.set(s.patientId, `${s.patientFirstName} ${s.patientLastName}`)
    for (const r of reviewMeetings) byId.set(r.patientId, r.patientName)
    return [...byId.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [sessions, reviewMeetings])

  const programOptions = useMemo(() => {
    const names = new Set(sessions.map(s => s.programName).filter(Boolean))
    return [...names].sort().map(p => ({ value: p, label: p }))
  }, [sessions])

  const staffEvents = useMemo(() => {
    if (view !== 'staff' || (!caseFilter && !programFilter)) return events
    return events.filter(ev => {
      if (caseFilter) {
        if (ev.kind === 'session') { if ((ev.raw as TherapySessionResponse).patientId !== caseFilter) return false }
        else if (ev.kind === 'review') { if ((ev.raw as ReviewMeetingResponse).patientId !== caseFilter) return false }
        else return false // leave/meeting/holiday/consultation aren't tied to a case
      }
      if (programFilter) {
        if (ev.kind === 'session') { if ((ev.raw as TherapySessionResponse).programName !== programFilter) return false }
        else return false // only sessions carry a program
      }
      return true
    })
  }, [events, view, caseFilter, programFilter])

  // Further narrows to one therapist's own events — "show only their cases".
  const staffFilteredEvents = useMemo(() => {
    if (!staffTherapistId) return staffEvents
    return staffEvents.filter(ev => eventOwnerIds(ev).includes(staffTherapistId))
  }, [staffEvents, staffTherapistId])

  const staffDayColumns = useMemo(
    () => staffTherapistId ? staffColumns.filter(c => c.id === staffTherapistId) : staffColumns,
    [staffColumns, staffTherapistId]
  )

  // ── Browser notification effect ────────────────────────────────────────────
  // Fires every 60 s; notifies for timed events starting within 15 minutes.
  useEffect(() => {
    if (!supportsNotif || events.length === 0) return

    function checkUpcoming() {
      if (Notification.permission !== 'granted') return
      const now     = new Date()
      const cutoff  = addMinutes(now, 15)

      for (const ev of events) {
        if (ev.isAllDay || !ev.time) continue
        if (notifiedRef.current.has(ev.id)) continue

        const eventTime = parseISO(`${ev.date}T${ev.time}:00`)
        if (eventTime > now && eventTime <= cutoff) {
          notifiedRef.current.add(ev.id)
          new Notification(
            ev.kind === 'consultation' ? 'Upcoming Consultation' : 'Upcoming Event',
            {
              body: `${ev.title} — ${ev.time}`,
              tag:  ev.id,   // deduplicates in the OS notification centre
            }
          )
        }
      }
    }

    checkUpcoming()                                    // run immediately on mount / data change
    const id = setInterval(checkUpcoming, 60 * 1000)   // then every 60 s
    return () => clearInterval(id)
  }, [events, supportsNotif])

  const hasAnyEvents = canSeeInquiries || canSeeLeaves || canSeeSessions

  // ── Navigation ─────────────────────────────────────────────────────────────
  function prev() {
    setCurrent(v =>
      (view === 'month' || staffIsMonth) ? subMonths(v, 1) :
      (view === 'week' || staffIsWeek) ? subWeeks(v, 1)  :
      subDays(v, 1)
    )
  }
  function next() {
    setCurrent(v =>
      (view === 'month' || staffIsMonth) ? addMonths(v, 1) :
      (view === 'week' || staffIsWeek) ? addWeeks(v, 1)  :
      addDays(v, 1)
    )
  }

  const title = (view === 'month' || staffIsMonth)
    ? format(current, 'MMMM yyyy')
    : (view === 'day' || staffIsDay)
    ? format(current, 'EEEE, d MMMM yyyy')
    : (() => {
        const ws = getWeekStart(current, { weekStartsOn: 1 })
        const we = addDays(ws, 6)
        return isSameMonth(ws, we)
          ? `${format(ws, 'd')} – ${format(we, 'd MMM yyyy')}`
          : `${format(ws, 'd MMM')} – ${format(we, 'd MMM yyyy')}`
      })()

  if (isLoading) return <PageLoader />

  return (
    <div className="flex flex-col gap-5">

      {/* Page header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold" style={{ color: colors.text.heading }}>Calendar</h1>
          <p className="text-sm mt-0.5" style={{ color: colors.text.muted }}>
            {canSeeInquiries
              ? 'Consultation appointments and staff leave.'
              : canSeeLeaves
              ? 'Your leave days and upcoming sessions.'
              : 'Your upcoming sessions.'}
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 flex-wrap">
          {canSeeInquiries && (
            <span className="flex items-center gap-1.5 text-xs" style={{ color: colors.text.muted }}>
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#2B80C8' }} />
              Consultation
            </span>
          )}
          {canSeeLeaves && (
            <span className="flex items-center gap-1.5 text-xs" style={{ color: colors.text.muted }}>
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#E05C5C' }} />
              Leave (Approved)
            </span>
          )}
          {canSeeLeaves && !canSeeInquiries && (
            <span className="flex items-center gap-1.5 text-xs" style={{ color: colors.text.muted }}>
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#F59E0B' }} />
              Leave (Pending)
            </span>
          )}
          {canSeeSessions && (
            <span className="flex items-center gap-1.5 text-xs" style={{ color: colors.text.muted }}>
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: palette.purple.text }} />
              Session
            </span>
          )}
          <span className="flex items-center gap-1.5 text-xs" style={{ color: colors.text.muted }}>
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: palette.teal.text }} />
            Review
          </span>
          <span className="flex items-center gap-1.5 text-xs" style={{ color: colors.text.muted }}>
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: palette.pink.text }} />
            Meeting
          </span>
          {publicHolidays.length > 0 && (
            <span className="flex items-center gap-1.5 text-xs" style={{ color: colors.text.muted }}>
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#B45309' }} />
              Holiday
            </span>
          )}
          {canCreateMeetings && (
            <button
              onClick={() => setNewMeetingOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold"
              style={{ color: '#fff', background: colors.accent }}>
              <Plus size={14} /> New meeting
            </button>
          )}
        </div>
      </div>

      {/* Calendar card */}
      <div className="rounded-2xl overflow-hidden flex flex-col" style={{ ...styles.card, minHeight: 600, maxHeight: 'calc(100vh - 200px)' }}>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b flex-shrink-0"
          style={{ borderColor: border.divider }}>

          {/* Navigation */}
          <button onClick={prev} className="p-1.5 rounded-lg transition-colors"
            style={{ color: colors.text.muted }}
            onMouseEnter={e => (e.currentTarget.style.background = accentAlpha(0.1))}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <ChevronLeft size={16} />
          </button>
          <button onClick={next} className="p-1.5 rounded-lg transition-colors"
            style={{ color: colors.text.muted }}
            onMouseEnter={e => (e.currentTarget.style.background = accentAlpha(0.1))}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <ChevronRight size={16} />
          </button>

          <h2 className="text-base font-semibold flex-1" style={{ color: colors.text.primary }}>{title}</h2>

          <span className="text-xs" style={{ color: colors.text.muted }}>
            {events.length} event{events.length !== 1 ? 's' : ''}
          </span>

          {/* Notification permission — previously lived on the Today/Tomorrow strip */}
          {notifPermission === 'default' ? (
            <button
              onClick={requestNotifPermission}
              title="Get a browser notification 15 minutes before an event"
              className="hidden sm:flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium transition-colors"
              style={styles.filterTabInactive}>
              <Bell size={12} />Notifications
            </button>
          ) : notifPermission === 'granted' ? (
            <span className="hidden sm:flex items-center gap-1.5 text-xs"
              style={{ color: colors.text.dim }} title="Notifications on">
              <Bell size={12} />
            </span>
          ) : notifPermission === 'denied' ? (
            <span className="hidden sm:flex items-center gap-1.5 text-xs"
              style={{ color: colors.text.dim }} title="Notifications blocked in your browser">
              <BellOff size={12} />
            </span>
          ) : null}

          {/* Today */}
          <button onClick={() => setCurrent(new Date())}
            className="text-xs px-3 py-1.5 rounded-full font-medium transition-colors"
            style={styles.filterTabInactive}>
            Today
          </button>

          {/* View toggle — hidden below sm */}
          <div className="hidden sm:flex rounded-full overflow-hidden border" style={{ borderColor: border.divider }}>
            {([...(['day', 'week', 'month'] as ViewMode[]), ...(canSeeStaffView ? ['staff'] as ViewMode[] : [])]).map(m => (
              <button key={m} onClick={() => setView(m)}
                className="px-3 py-1.5 text-xs font-medium capitalize transition-colors"
                style={view === m ? styles.filterTabActive : styles.filterTabInactive}>
                {m === 'staff' ? 'Staff' : m}
              </button>
            ))}
          </div>
        </div>

        {/* Staff view filters — Case / Therapist / Program + Day/Week toggle */}
        {view === 'staff' && (
          <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b flex-shrink-0"
            style={{ borderColor: border.divider }}>
            <div className="w-44">
              <Select value={caseFilter} onChange={e => setCaseFilter(e.target.value)}
                options={caseOptions} placeholder="All Cases" />
            </div>
            <div className="w-44">
              <Select value={staffTherapistId} onChange={e => setStaffTherapistId(e.target.value)}
                options={staffColumns.map(c => ({ value: c.id, label: c.label }))} placeholder="All Therapists" />
            </div>
            <div className="w-44">
              <Select value={programFilter} onChange={e => setProgramFilter(e.target.value)}
                options={programOptions} placeholder="All Programs" />
            </div>
            <div className="flex rounded-full overflow-hidden border ml-auto" style={{ borderColor: border.divider }}>
              {(['day', 'week', 'month'] as const).map(g => (
                <button key={g} onClick={() => setStaffGranularity(g)}
                  className="px-3 py-1.5 text-xs font-medium capitalize transition-colors"
                  style={staffGranularity === g ? styles.filterTabActive : styles.filterTabInactive}>
                  {g}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Content */}
        {!hasAnyEvents ? (
          <ProgramSessionsPlaceholder />
        ) : (
          <div className="flex flex-1 min-h-0 overflow-hidden gap-4 p-0">
            {/* Calendar grid */}
            <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto flex flex-col">
              <div className={`flex flex-col flex-1 min-h-0 ${view !== 'day' ? 'min-w-[420px]' : 'min-w-[280px]'}`}>
                {view === 'month' ? (
                  <MonthView current={current} events={events} onSelect={setSelected} holidayDates={holidayDates}
                    onDayClick={day => { setCurrent(day); setView('day') }} />
                ) : view === 'week' ? (
                  <WeekView current={current} events={events} onSelect={setSelected} holidayDates={holidayDates}
                    onSlotSelect={canBookSlots ? setSlotSelection : undefined} />
                ) : view === 'staff' ? (
                  staffGranularity === 'week' ? (
                    <WeekView current={current} events={staffFilteredEvents} onSelect={setSelected} holidayDates={holidayDates}
                      colorFn={ev => therapistChipStyle(ev, staffColumns)}
                      onSlotSelect={canBookSlots ? setSlotSelection : undefined} />
                  ) : staffGranularity === 'month' ? (
                    <MonthView current={current} events={staffFilteredEvents} onSelect={setSelected} holidayDates={holidayDates}
                      colorFn={ev => therapistChipStyle(ev, staffColumns)}
                      onDayClick={day => { setCurrent(day); setStaffGranularity('day') }} />
                  ) : (
                    <StaffDayView current={current} events={staffFilteredEvents} columns={staffDayColumns}
                      onSelect={setSelected} holidayDates={holidayDates}
                      onSlotSelect={canBookSlots ? setSlotSelection : undefined} />
                  )
                ) : (
                  <DayView current={current} events={events} onSelect={setSelected} holidayDates={holidayDates}
                    onSlotSelect={canBookSlots ? setSlotSelection : undefined} />
                )}
              </div>
            </div>

            {/* Upcoming — collapsed by default so the grid stays the focus */}
            {(view === 'month' || view === 'day') && (
              <div className="hidden lg:flex flex-col border-l overflow-hidden transition-all"
                style={{ borderColor: border.divider, width: upcomingOpen ? 280 : 44, flexShrink: 0 }}>
                <button
                  onClick={() => setUpcomingOpen(o => !o)}
                  aria-expanded={upcomingOpen}
                  className="flex items-center gap-2 px-3 py-3 text-xs font-semibold uppercase tracking-wider transition-colors"
                  style={{ color: colors.text.muted }}
                  title={upcomingOpen ? 'Hide upcoming' : 'Show upcoming'}
                >
                  {/* The panel supplies its own heading when open, so this is chevron-only. */}
                  <ChevronLeft
                    size={14}
                    className="transition-transform flex-shrink-0"
                    style={{ transform: upcomingOpen ? 'rotate(180deg)' : 'none' }}
                  />
                </button>
                {upcomingOpen && (
                  <div className="flex flex-col px-4 pb-4 -mt-2 overflow-hidden">
                    <UpcomingPanel events={events} onSelect={setSelected} />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Therapy session — the same Session Notes modal used on the Patient → Therapy tab */}
      {selected && selected.kind === 'session' && (() => {
        const rawSession = selected.raw as TherapySessionResponse
        const canManageAll = !!user && (hasRole(user, 'CLINIC_HEAD') || hasRole(user, 'BUSINESS_OWNER'))
        return (
          <SessionEventModal
            key={selected.id}
            session={rawSession}
            canAccessNotes={canManageAll || rawSession.therapistId === user?.id}
            canManageAll={canManageAll}
            canReschedule={canReschedule}
            onClose={() => setSelected(null)}
          />
        )
      })()}

      {/* Every other event kind */}
      {selected && selected.kind !== 'session' && (
        <EventDetailDrawer
          key={selected.id}
          event={selected}
          onClose={() => setSelected(null)}
          canGoToInquiries={canGoToInquiries}
          canManageAll={!!user && (hasRole(user, 'CLINIC_HEAD') || hasRole(user, 'BUSINESS_OWNER'))}
          canCreateMeetings={canCreateMeetings}
          onLogOutcome={canHandleOutcomes ? (inq) => { setSelected(null); setActionTarget(inq) } : undefined}
        />
      )}

      {/* Dragged a slot — choose what goes in it */}
      {slotSelection && !slotChoice && (
        <SlotChoiceModal
          slot={slotSelection}
          onClose={() => setSlotSelection(null)}
          onPick={(what, tuned) => { setSlotSelection(tuned); setSlotChoice(what) }}
        />
      )}

      {slotSelection && slotChoice === 'meeting' && (
        <NewMeetingModal
          initial={slotSelection}
          onClose={() => { setSlotSelection(null); setSlotChoice(null) }}
          onDone={() => {
            setSlotSelection(null); setSlotChoice(null)
            qcMain.invalidateQueries({ queryKey: ['meetings'] })
          }}
        />
      )}

      {slotSelection && slotChoice === 'session' && (
        <AdHocSessionModal
          slot={slotSelection}
          onClose={() => { setSlotSelection(null); setSlotChoice(null) }}
          onDone={() => {
            setSlotSelection(null); setSlotChoice(null)
            qcMain.invalidateQueries({ queryKey: ['therapy-sessions-cal'] })
          }}
        />
      )}

      {/* Schedule a meeting */}
      {newMeetingOpen && (
        <NewMeetingModal
          onClose={() => setNewMeetingOpen(false)}
          onDone={() => {
            setNewMeetingOpen(false)
            qcMain.invalidateQueries({ queryKey: ['meetings'] })
          }}
        />
      )}

      {/* Inquiry action modal — log outcome directly from calendar */}
      {actionTarget && (
        <ActionModal
          inquiry={actionTarget}
          onClose={() => setActionTarget(null)}
          onRequestConvert={() => {
            setActionTarget(null)
            navigate(ROUTES.inquiries)
          }}
        />
      )}
    </div>
  )
}
