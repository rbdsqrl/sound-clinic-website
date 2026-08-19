import { useState, useMemo, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft, ChevronRight, X, CalendarDays, Phone,
  CalendarOff, Clock, ExternalLink, Users, Bell, BellOff,
  Activity, CheckCircle2, Zap, Save, Sun, MessageSquare,
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
import { colors, styles, border, surface, accentAlpha, palette } from '../../theme'
import { sessionStatusLabel, labelFromEnum } from '../../components/ui/Badge'
import { reviewMeetingsApi } from '../../api/reviewMeetings'
import type { InquiryResponse, LeaveResponse, TherapySessionResponse, TherapySessionStatus, UpdateSessionNotesRequest, PublicHolidayResponse, ReviewMeetingResponse } from '../../types'
import { ROUTES } from '../../lib/routes'

// ── Event model ───────────────────────────────────────────────────────────────

type EventKind = 'consultation' | 'leave' | 'session' | 'holiday' | 'review'

interface CalendarEvent {
  id: string
  date: string        // 'yyyy-MM-dd'
  time?: string       // 'HH:mm' — timed events only
  kind: EventKind
  title: string
  subtitle?: string
  status?: string
  isAllDay: boolean
  raw: InquiryResponse | LeaveResponse | TherapySessionResponse | PublicHolidayResponse | ReviewMeetingResponse
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
    if (status === 'CANCELLED') return { background: '#88888818', color: '#888' }
    if (status === 'COMPLETED') return { background: '#10b98118', color: '#059669' }
    return { background: `rgba(${palette.teal.raw}, 0.12)`, color: palette.teal.text }
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
    subtitle: `${s.therapistFirstName} ${s.therapistLastName} · Session ${s.sessionNumber}/${s.totalSessions}`,
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
  event, onClick, compact = false,
}: { event: CalendarEvent; onClick: () => void; compact?: boolean }) {
  const s = kindStyle(event.kind, event.status)
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick() }}
      className="w-full text-left rounded-md px-1.5 py-0.5 truncate transition-opacity hover:opacity-75"
      style={{ ...s, fontSize: compact ? 12 : 13.2, fontWeight: 600 }}>
      {!compact && event.isAllDay && <CalendarOff size={9} className="inline mr-1 opacity-70" />}
      <span className="truncate">{event.title}</span>
      {!compact && !event.isAllDay && event.time && (
        <span className="ml-1 opacity-60 font-normal">{event.time}</span>
      )}
    </button>
  )
}

// ── Month View ────────────────────────────────────────────────────────────────

function MonthView({
  current, events, onSelect, holidayDates,
}: { current: Date; events: CalendarEvent[]; onSelect: (e: CalendarEvent) => void; holidayDates: Set<string> }) {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(current), { weekStartsOn: 1 }),
    end:   endOfWeek(endOfMonth(current),     { weekStartsOn: 1 }),
  })
  const dayHeaders = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="grid grid-cols-7 border-b" style={{ borderColor: border.divider }}>
        {dayHeaders.map(d => (
          <div key={d} className="py-2 text-center text-xs font-semibold uppercase tracking-wide"
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
              className="flex flex-col p-1 min-h-[90px]"
              style={{
                borderRight: !isLastCol ? `1px solid ${border.divider}` : 'none',
                borderBottom: !isLastRow ? `1px solid ${border.divider}` : 'none',
                opacity: inMonth ? 1 : 0.4,
                background: isHoliday ? '#FEF3C720' : undefined,
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
              <div className="flex flex-col gap-0.5 flex-1 overflow-hidden">
                {sorted.slice(0, 3).map(ev => (
                  <EventChip key={ev.id} event={ev} onClick={() => onSelect(ev)} compact />
                ))}
                {sorted.length > 3 && (
                  <p className="text-[12px] pl-1" style={{ color: colors.text.muted }}>
                    +{sorted.length - 3} more
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
  current, events, onSelect, holidayDates,
}: { current: Date; events: CalendarEvent[]; onSelect: (e: CalendarEvent) => void; holidayDates: Set<string> }) {
  const ws   = getWeekStart(current, { weekStartsOn: 1 })
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i))
  const HOURS = Array.from({ length: 14 }, (_, i) => i + 7) // 7 AM – 8 PM

  const hasAnyAllDay = days.some(d => allDayEventsOnDay(events, d).length > 0)

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      {/* Day headers */}
      <div className="grid sticky top-0 z-10 border-b"
        style={{ gridTemplateColumns: '52px repeat(7, 1fr)', borderColor: border.divider, background: surface.card }}>
        <div />
        {days.map(day => {
          const dayKey    = format(day, 'yyyy-MM-dd')
          const isHoliday = holidayDates.has(dayKey)
          return (
            <div key={day.toISOString()} className="py-2 text-center border-l"
              style={{ borderColor: border.divider, background: isHoliday ? '#FEF3C730' : undefined }}>
              <p className="text-xs font-semibold" style={{ color: isHoliday ? '#B45309' : colors.text.muted }}>
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
          style={{ gridTemplateColumns: '52px repeat(7, 1fr)', borderColor: border.divider, background: surface.card, top: 73 }}>
          <div className="px-1 pt-1 text-right">
            <span className="text-[10.8px] uppercase tracking-wide" style={{ color: colors.text.muted }}>All day</span>
          </div>
          {days.map(day => {
            const leaves = allDayEventsOnDay(events, day)
            return (
              <div key={day.toISOString()} className="border-l p-1 flex flex-col gap-0.5 min-h-[28px]"
                style={{ borderColor: border.divider }}>
                {leaves.map(ev => (
                  <EventChip key={ev.id} event={ev} onClick={() => onSelect(ev)} />
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
            style={{ gridTemplateColumns: '52px repeat(7, 1fr)', borderColor: border.divider, minHeight: 56 }}>
            <div className="px-2 pt-1 text-right">
              <span className="text-xs" style={{ color: colors.text.muted }}>
                {hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
              </span>
            </div>
            {days.map(day => {
              const timed    = timedEventsAtHour(events, day, hour)
              const dayKeyH  = format(day, 'yyyy-MM-dd')
              const isHolCol = holidayDates.has(dayKeyH)
              return (
                <div key={day.toISOString()} className="border-l p-1 flex flex-col gap-0.5"
                  style={{ borderColor: border.divider, background: isHolCol ? '#FFFBEB30' : undefined }}>
                  {timed.map(ev => (
                    <EventChip key={ev.id} event={ev} onClick={() => onSelect(ev)} />
                  ))}
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
  current, events, onSelect, holidayDates,
}: { current: Date; events: CalendarEvent[]; onSelect: (e: CalendarEvent) => void; holidayDates: Set<string> }) {
  const dayKey    = format(current, 'yyyy-MM-dd')
  const isHoliday = holidayDates.has(dayKey)
  const HOURS     = Array.from({ length: 14 }, (_, i) => i + 7) // 7 AM – 8 PM

  const allDayEvs = allDayEventsOnDay(events, current)

  return (
    <div className="flex flex-col flex-1 overflow-auto">

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
            <span className="text-[10.8px] uppercase tracking-wide" style={{ color: colors.text.muted }}>All day</span>
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
                <span className="text-xs tabular-nums" style={{ color: colors.text.muted }}>
                  {hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                </span>
              </div>
              {/* Events */}
              <div className="flex-1 border-l p-2 flex flex-col gap-1.5"
                style={{ borderColor: border.divider }}>
                {timed.map(ev => {
                  const s = kindStyle(ev.kind, ev.status)
                  const rawSess = ev.kind === 'session' ? (ev.raw as TherapySessionResponse) : null
                  return (
                    <button key={ev.id} onClick={() => onSelect(ev)}
                      className="w-full text-left rounded-xl px-3 py-2.5 transition-opacity hover:opacity-80"
                      style={{ ...s, minHeight: 52 }}>
                      <p className="text-xs font-semibold leading-tight">{ev.title}</p>
                      <p className="text-[13.2px] mt-0.5 opacity-75">
                        {ev.time}
                        {rawSess && ` – ${rawSess.endTime.substring(0, 5)}`}
                      </p>
                      {ev.subtitle && (
                        <p className="text-[13.2px] mt-0.5 opacity-70 truncate">{ev.subtitle}</p>
                      )}
                      {rawSess?.status && rawSess.status !== 'SCHEDULED' && (
                        <span className="inline-block mt-1 text-[12px] font-semibold px-1.5 py-0.5 rounded-full"
                          style={{ background: 'rgba(0,0,0,0.08)' }}>
                          {sessionStatusLabel(rawSess.status)}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
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
                <span className="text-[13.2px] font-bold uppercase tracking-wide flex-shrink-0"
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

// ── Event detail drawer ───────────────────────────────────────────────────────

// Status options for admin/owner (can directly cancel)
const SESSION_STATUS_OPTIONS_ADMIN: { value: TherapySessionStatus; label: string }[] = [
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'NO_SHOW',   label: 'No Show' },
  { value: 'CANCELLED', label: 'Cancelled' },
]
// Status options for therapists/doctors (cannot directly cancel)
const SESSION_STATUS_OPTIONS_THERAPIST: { value: TherapySessionStatus; label: string }[] = [
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'NO_SHOW',   label: 'No Show' },
]

function EventDetailDrawer({
  event, onClose, canGoToInquiries, canUpdateSession, canManageAll, currentUserId, onLogOutcome,
}: {
  event: CalendarEvent
  onClose: () => void
  canGoToInquiries: boolean
  canUpdateSession: boolean
  canManageAll: boolean
  currentUserId: string
  onLogOutcome?: (inquiry: InquiryResponse) => void
}) {
  const navigate  = useNavigate()
  const qc        = useQueryClient()
  const s         = kindStyle(event.kind, event.status)

  const isConsultation = event.kind === 'consultation'
  const isSession      = event.kind === 'session'
  const isHolidayEv    = event.kind === 'holiday'
  const isReview       = event.kind === 'review'
  const rawInquiry     = event.raw as InquiryResponse
  const rawLeave       = event.raw as LeaveResponse
  const rawSession     = event.raw as TherapySessionResponse
  const rawReview      = event.raw as ReviewMeetingResponse

  const canAccessNotes = isSession && (canManageAll || rawSession.therapistId === currentUserId)
  const [sessionNotes, setSessionNotes] = useState(isSession ? (rawSession.notes ?? '') : '')

  const updateSessionMut = useMutation({
    mutationFn: ({ status, notes }: { status: TherapySessionStatus; notes?: string }) =>
      therapySessionsApi.updateStatus(rawSession.id, { status, notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['therapy-sessions-cal'] })
      qc.invalidateQueries({ queryKey: ['therapy-sessions-enrollment'] })
      onClose()
    },
  })

  const requestCancellationMut = useMutation({
    mutationFn: () => therapySessionsApi.requestCancellation(rawSession.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['therapy-sessions-cal'] })
      qc.invalidateQueries({ queryKey: ['therapy-sessions-enrollment'] })
      onClose()
    },
  })

  const approveCancellationMut = useMutation({
    mutationFn: () => therapySessionsApi.approveCancellation(rawSession.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['therapy-sessions-cal'] })
      qc.invalidateQueries({ queryKey: ['therapy-sessions-enrollment'] })
      onClose()
    },
  })

  const rejectCancellationMut = useMutation({
    mutationFn: () => therapySessionsApi.rejectCancellation(rawSession.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['therapy-sessions-cal'] })
      qc.invalidateQueries({ queryKey: ['therapy-sessions-enrollment'] })
      onClose()
    },
  })

  const updateNotesMut = useMutation({
    mutationFn: () => therapySessionsApi.updateNotes(rawSession.id, { notes: sessionNotes } as UpdateSessionNotesRequest),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['therapy-sessions-cal'] })
      qc.invalidateQueries({ queryKey: ['therapy-sessions-enrollment'] })
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
              {isConsultation ? <CalendarDays size={17} /> : isSession ? <Activity size={17} /> : isHolidayEv ? <Sun size={17} /> : isReview ? <MessageSquare size={17} /> : <CalendarOff size={17} />}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-0.5"
                style={{ color: s.color as string }}>
                {isConsultation ? 'Consultation' : isSession ? 'Therapy Session' : isHolidayEv ? 'Public Holiday' : isReview ? 'Review Meeting' : 'Leave'}
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
            {event.subtitle && !isSession && (
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

          {/* Session-specific */}
          {isSession && (
            <>
              <Row icon={<Users size={14} />}
                label={`${rawSession.therapistFirstName} ${rawSession.therapistLastName}`} />
              <Row icon={<Activity size={14} />}
                label={`Session ${rawSession.sessionNumber} of ${rawSession.totalSessions}`} />
              {/* Status chip */}
              <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold self-start"
                style={kindStyle('session', rawSession.status)}>
                <CheckCircle2 size={11} />
                {sessionStatusLabel(rawSession.status)}
              </div>
              {canAccessNotes && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-1.5"
                    style={{ color: colors.text.muted }}>Session Notes</p>
                  <textarea
                    className="form-input w-full text-sm resize-none"
                    rows={4}
                    placeholder="Add session notes…"
                    value={sessionNotes}
                    onChange={e => setSessionNotes(e.target.value)}
                  />
                </div>
              )}
              {/* Status update — assigned therapist only, or admin/owner */}
              {canUpdateSession && rawSession.status === 'SCHEDULED'
               && (canManageAll || rawSession.therapistId === currentUserId) && (
                <>
                  <div style={{ height: 1, background: border.divider }} />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-2"
                      style={{ color: colors.text.muted }}>Mark as</p>
                    <div className="flex flex-col gap-2">
                      {(canManageAll ? SESSION_STATUS_OPTIONS_ADMIN : SESSION_STATUS_OPTIONS_THERAPIST).map(opt => (
                        <button
                          key={opt.value}
                          disabled={updateSessionMut.isPending}
                          onClick={() => updateSessionMut.mutate({ status: opt.value, notes: sessionNotes || undefined })}
                          className="text-sm font-medium px-3 py-2 rounded-xl text-left transition-colors"
                          style={kindStyle('session', opt.value)}
                          onMouseEnter={e => (e.currentTarget.style.opacity = '0.75')}
                          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                          {opt.label}
                        </button>
                      ))}
                      {/* Therapists/doctors request cancellation instead of directly cancelling */}
                      {!canManageAll && (
                        <button
                          disabled={requestCancellationMut.isPending}
                          onClick={() => requestCancellationMut.mutate()}
                          className="text-sm font-medium px-3 py-2 rounded-xl text-left transition-colors"
                          style={{ background: '#EF444418', color: '#dc2626' }}
                          onMouseEnter={e => (e.currentTarget.style.opacity = '0.75')}
                          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                          Request Cancellation
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}
              {/* Admin/owner: approve or reject a pending cancellation */}
              {canManageAll && rawSession.status === 'CANCELLATION_REQUESTED' && (
                <>
                  <div style={{ height: 1, background: border.divider }} />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-2"
                      style={{ color: '#dc2626' }}>Cancellation requested</p>
                    <div className="flex flex-col gap-2">
                      <button
                        disabled={approveCancellationMut.isPending || rejectCancellationMut.isPending}
                        onClick={() => approveCancellationMut.mutate()}
                        className="text-sm font-medium px-3 py-2 rounded-xl text-left"
                        style={{ background: '#EF444418', color: '#dc2626' }}>
                        Approve — Cancel session
                      </button>
                      <button
                        disabled={approveCancellationMut.isPending || rejectCancellationMut.isPending}
                        onClick={() => rejectCancellationMut.mutate()}
                        className="text-sm font-medium px-3 py-2 rounded-xl text-left"
                        style={{ background: '#16a34a18', color: '#16a34a' }}>
                        Reject — Keep scheduled
                      </button>
                    </div>
                  </div>
                </>
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
          {!isConsultation && !isSession && !isHolidayEv && !isReview && (
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
        {!isHolidayEv && ((canGoToInquiries && isConsultation) || canAccessNotes) && (
          <div className="p-5 border-t flex-shrink-0 flex flex-col gap-2" style={{ borderColor: border.divider }}>
            {canGoToInquiries && isConsultation && (
              <>
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
              </>
            )}
            {canAccessNotes && (
              <button
                disabled={updateNotesMut.isPending}
                onClick={() => updateNotesMut.mutate()}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
                style={{ background: colors.accent, color: '#fff' }}>
                <Save size={14} />
                {updateNotesMut.isPending ? 'Saving…' : updateNotesMut.isSuccess ? 'Saved!' : 'Save Notes'}
              </button>
            )}
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

// ── Today / Tomorrow summary panel ───────────────────────────────────────────

function TodayEventChip({
  event, onClick,
}: { event: CalendarEvent; onClick: () => void }) {
  const s = kindStyle(event.kind, event.status)
  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 flex items-center gap-2 rounded-xl px-3 py-2 text-left transition-opacity hover:opacity-75"
      style={{ background: s.background, border: `1px solid ${s.color}22` }}>
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
      <div className="min-w-0">
        <p className="text-xs font-semibold truncate max-w-[130px]" style={{ color: s.color }}>
          {event.title}
        </p>
        <p className="text-[12px] mt-0.5" style={{ color: s.color, opacity: 0.7 }}>
          {event.isAllDay ? (event.subtitle ?? 'All day') : event.time}
        </p>
      </div>
    </button>
  )
}

function TodayPanel({
  events,
  onSelect,
  notifPermission,
  onRequestNotif,
}: {
  events: CalendarEvent[]
  onSelect: (e: CalendarEvent) => void
  notifPermission: NotificationPermission | 'unsupported'
  onRequestNotif: () => void
}) {
  const todayKey    = format(new Date(), 'yyyy-MM-dd')
  const tomorrowKey = format(addDays(new Date(), 1), 'yyyy-MM-dd')

  const sort = (evs: CalendarEvent[]) =>
    [...evs].sort((a, b) =>
      // all-day first, then by time
      (b.isAllDay ? 1 : 0) - (a.isAllDay ? 1 : 0) ||
      (a.time ?? '').localeCompare(b.time ?? '')
    )

  const todayEvents    = sort(events.filter(e => e.date === todayKey))
  const tomorrowEvents = sort(events.filter(e => e.date === tomorrowKey))

  if (todayEvents.length === 0 && tomorrowEvents.length === 0) return null

  return (
    <div className="rounded-2xl p-4 flex flex-col gap-4" style={styles.card}>
      {/* Header row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Today */}
          {todayEvents.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: colors.text.muted }}>Today</span>
              <span className="text-[12px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1"
                style={{ background: colors.accent, color: '#fff' }}>
                {todayEvents.length}
              </span>
            </div>
          )}
          {/* Tomorrow */}
          {tomorrowEvents.length > 0 && (
            <div className="flex items-center gap-2 border-l pl-3" style={{ borderColor: border.divider }}>
              <span className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: colors.text.muted }}>Tomorrow</span>
              <span className="text-[12px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1"
                style={{ background: surface.rowHover, color: colors.text.muted }}>
                {tomorrowEvents.length}
              </span>
            </div>
          )}
        </div>

        {/* Notification permission button */}
        {notifPermission !== 'unsupported' && (
          notifPermission === 'granted' ? (
            <span className="flex items-center gap-1.5 text-xs" style={{ color: colors.text.muted }}>
              <Bell size={12} />Notifications on
            </span>
          ) : notifPermission === 'default' ? (
            <button
              onClick={onRequestNotif}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium transition-colors"
              style={styles.filterTabInactive}>
              <Bell size={12} />Enable notifications
            </button>
          ) : (
            <span className="flex items-center gap-1.5 text-xs" style={{ color: colors.text.muted }}>
              <BellOff size={12} />Notifications blocked
            </span>
          )
        )}
      </div>

      {/* Event chips — horizontally scrollable */}
      {todayEvents.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0">
          {todayEvents.map(ev => (
            <TodayEventChip key={ev.id} event={ev} onClick={() => onSelect(ev)} />
          ))}
        </div>
      )}

      {tomorrowEvents.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0"
          style={todayEvents.length > 0 ? { borderTop: `1px solid ${border.divider}`, paddingTop: 12 } : {}}>
          {tomorrowEvents.map(ev => (
            <TodayEventChip key={ev.id} event={ev} onClick={() => onSelect(ev)} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Placeholder for roles with no data yet ────────────────────────────────────

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

type ViewMode = 'month' | 'week' | 'day'

export default function CalendarPage() {
  const { user, activeRole }  = useAuth()
  const navigate = useNavigate()
  const [view,         setView]         = useState<ViewMode>('month')
  const [current,      setCurrent]      = useState(new Date())
  const [selected,     setSelected]     = useState<CalendarEvent | null>(null)
  const [actionTarget, setActionTarget] = useState<InquiryResponse | null>(null)

  const currentRole = activeRole ?? user?.role
  const canSeeInquiries  = !!user && (
    hasRole(user, 'ADMIN') || hasRole(user, 'BUSINESS_OWNER') || hasRole(user, 'OFFICE_ADMIN')
  )
  const canSeeLeaves     = !!user && !hasRole(user, 'PARENT') && !hasRole(user, 'PATIENT')
  const canSeeSessions   = !!user && !hasRole(user, 'PATIENT')
  const canUpdateSession = !!user && (
    hasRole(user, 'THERAPIST') || hasRole(user, 'DOCTOR') ||
    hasRole(user, 'ADMIN') || hasRole(user, 'BUSINESS_OWNER')
  )
  const canHandleOutcomes = canSeeInquiries
  const canGoToInquiries  = canSeeInquiries

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
  const visStart = useMemo(() => {
    if (view === 'day')   return format(current, 'yyyy-MM-dd')
    if (view === 'week')  return format(getWeekStart(current, { weekStartsOn: 1 }), 'yyyy-MM-dd')
    return format(startOfWeek(startOfMonth(current), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  }, [current, view])
  const visEnd = useMemo(() => {
    if (view === 'day')   return format(current, 'yyyy-MM-dd')
    if (view === 'week')  return format(addDays(getWeekStart(current, { weekStartsOn: 1 }), 6), 'yyyy-MM-dd')
    return format(endOfWeek(endOfMonth(current), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  }, [current, view])

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
  })

  const { data: publicHolidays = [] } = useQuery({
    queryKey: ['public-holidays'],
    queryFn:  publicHolidaysApi.list,
    staleTime: 60 * 60 * 1000, // holidays rarely change; cache for 1 hour
  })

  // Scoped server-side: therapists get their own, parents their children's
  const { data: reviewMeetings = [] } = useQuery({
    queryKey: ['review-meetings', 'mine'],
    queryFn:  reviewMeetingsApi.listMine,
    staleTime: 5 * 60 * 1000,
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
    return out
  }, [inquiries, leaves, sessions, publicHolidays, reviewMeetings, canSeeInquiries])

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
      view === 'month' ? subMonths(v, 1) :
      view === 'week'  ? subWeeks(v, 1)  :
      subDays(v, 1)
    )
  }
  function next() {
    setCurrent(v =>
      view === 'month' ? addMonths(v, 1) :
      view === 'week'  ? addWeeks(v, 1)  :
      addDays(v, 1)
    )
  }

  const title = view === 'month'
    ? format(current, 'MMMM yyyy')
    : view === 'day'
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
          {publicHolidays.length > 0 && (
            <span className="flex items-center gap-1.5 text-xs" style={{ color: colors.text.muted }}>
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#B45309' }} />
              Holiday
            </span>
          )}
        </div>
      </div>

      {/* Today / Tomorrow panel — only renders when there are events on those days */}
      {hasAnyEvents && (
        <TodayPanel
          events={events}
          onSelect={setSelected}
          notifPermission={notifPermission}
          onRequestNotif={requestNotifPermission}
        />
      )}

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

          {/* Today */}
          <button onClick={() => setCurrent(new Date())}
            className="text-xs px-3 py-1.5 rounded-full font-medium transition-colors"
            style={styles.filterTabInactive}>
            Today
          </button>

          {/* View toggle — hidden below sm */}
          <div className="hidden sm:flex rounded-full overflow-hidden border" style={{ borderColor: border.divider }}>
            {(['day', 'week', 'month'] as ViewMode[]).map(m => (
              <button key={m} onClick={() => setView(m)}
                className="px-3 py-1.5 text-xs font-medium capitalize transition-colors"
                style={view === m ? styles.filterTabActive : styles.filterTabInactive}>
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {!hasAnyEvents ? (
          <ProgramSessionsPlaceholder />
        ) : (
          <div className="flex flex-1 min-h-0 overflow-hidden gap-4 p-0">
            {/* Calendar grid */}
            <div className="flex-1 overflow-x-auto overflow-y-auto flex flex-col">
              <div className={`flex flex-col flex-1 ${view !== 'day' ? 'min-w-[420px]' : 'min-w-[280px]'}`}>
                {view === 'month' ? (
                  <MonthView current={current} events={events} onSelect={setSelected} holidayDates={holidayDates} />
                ) : view === 'week' ? (
                  <WeekView current={current} events={events} onSelect={setSelected} holidayDates={holidayDates} />
                ) : (
                  <DayView current={current} events={events} onSelect={setSelected} holidayDates={holidayDates} />
                )}
              </div>
            </div>

            {/* Upcoming sidebar — month + day views on lg+ */}
            {(view === 'month' || view === 'day') && (
              <div className="hidden lg:flex flex-col p-4 border-l overflow-hidden"
                style={{ borderColor: border.divider }}>
                <UpcomingPanel events={events} onSelect={setSelected} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Event detail drawer */}
      {selected && (
        <EventDetailDrawer
          key={selected.id}
          event={selected}
          onClose={() => setSelected(null)}
          canGoToInquiries={canGoToInquiries}
          canUpdateSession={canUpdateSession}
          canManageAll={!!user && (hasRole(user, 'ADMIN') || hasRole(user, 'BUSINESS_OWNER'))}
          currentUserId={user?.id ?? ''}
          onLogOutcome={canHandleOutcomes ? (inq) => { setSelected(null); setActionTarget(inq) } : undefined}
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
