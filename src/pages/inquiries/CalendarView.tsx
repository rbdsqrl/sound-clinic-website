import { useState } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays, Clock, Zap } from 'lucide-react'
import {
  format, parseISO, addMonths, subMonths, addWeeks, subWeeks,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, isToday,
  startOfWeek as weekStart, addDays,
} from 'date-fns'
import { colors, border, surface, accentAlpha, paletteStyle, styles } from '../../theme'
import type { InquiryResponse, InquiryStatus } from '../../types'

// ── Types ──────────────────────────────────────────────────────────────────────

type ViewMode = 'month' | 'week'

// ── Event chip colours by status ───────────────────────────────────────────────

const EVENT_PALETTE: Partial<Record<InquiryStatus, 'blue' | 'green' | 'yellow' | 'slate'>> = {
  CONSULTATION_SCHEDULED: 'blue',
  VISITED:                'green',
  CONTACTED:              'yellow',
  CONVERTED:              'green',
}

function eventStyle(status: InquiryStatus) {
  const key = EVENT_PALETTE[status] ?? 'slate'
  return paletteStyle(key, 0.18)
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function appointmentsOnDay(inquiries: InquiryResponse[], day: Date): InquiryResponse[] {
  const key = format(day, 'yyyy-MM-dd')
  return inquiries
    .filter(i => i.appointmentDate && format(parseISO(i.appointmentDate), 'yyyy-MM-dd') === key)
    .sort((a, b) => (a.appointmentDate ?? '').localeCompare(b.appointmentDate ?? ''))
}

function formatTime(iso: string): string {
  return format(parseISO(iso), 'h:mm a')
}

// ── Event chip ─────────────────────────────────────────────────────────────────

function EventChip({
  inquiry, onClick, onAction, compact = false,
}: {
  inquiry: InquiryResponse
  onClick: () => void
  onAction?: () => void
  compact?: boolean
}) {
  const ps = eventStyle(inquiry.status)
  const showAction = !!onAction && inquiry.status === 'CONSULTATION_SCHEDULED'

  return (
    <div className="w-full flex items-center gap-0.5">
      <button
        onClick={e => { e.stopPropagation(); onClick() }}
        className="flex-1 min-w-0 text-left rounded-md px-2 py-1 truncate transition-opacity hover:opacity-80"
        style={{ ...ps, fontSize: compact ? 10 : 11, fontWeight: 600 }}>
        <span className="truncate">{inquiry.name}</span>
        {!compact && inquiry.appointmentDate && (
          <span className="ml-1 opacity-70 font-normal">{formatTime(inquiry.appointmentDate)}</span>
        )}
      </button>
      {showAction && (
        <button
          onClick={e => { e.stopPropagation(); onAction() }}
          title="Log outcome"
          className="flex-shrink-0 rounded p-0.5 transition-colors hover:opacity-80"
          style={{ color: ps.color }}>
          <Zap size={compact ? 9 : 11} />
        </button>
      )}
    </div>
  )
}

// ── Month View ─────────────────────────────────────────────────────────────────

function MonthView({
  current, inquiries, onSelect, onAction,
}: {
  current: Date
  inquiries: InquiryResponse[]
  onSelect: (i: InquiryResponse) => void
  onAction?: (i: InquiryResponse) => void
}) {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(current), { weekStartsOn: 1 }),
    end:   endOfWeek(endOfMonth(current),     { weekStartsOn: 1 }),
  })

  const dayHeaders = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b" style={{ borderColor: border.divider }}>
        {dayHeaders.map(d => (
          <div key={d} className="py-2 text-center text-xs font-semibold uppercase tracking-wide"
            style={{ color: colors.text.muted }}>{d}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 flex-1" style={{ gridAutoRows: '1fr' }}>
        {days.map((day, idx) => {
          const events     = appointmentsOnDay(inquiries, day)
          const inMonth    = isSameMonth(day, current)
          const todayDay   = isToday(day)
          const isLastRow  = idx >= days.length - 7
          const isLastCol  = (idx + 1) % 7 === 0

          return (
            <div key={day.toISOString()}
              className="flex flex-col p-1 min-h-[90px]"
              style={{
                borderRight: !isLastCol ? `1px solid ${border.divider}` : 'none',
                borderBottom: !isLastRow ? `1px solid ${border.divider}` : 'none',
                opacity: inMonth ? 1 : 0.4,
              }}>
              {/* Day number */}
              <div className="flex justify-end mb-1">
                <span className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full`}
                  style={{
                    background: todayDay ? colors.accent : 'transparent',
                    color: todayDay ? '#fff' : inMonth ? colors.text.primary : colors.text.muted,
                    fontWeight: todayDay ? 700 : 500,
                  }}>
                  {format(day, 'd')}
                </span>
              </div>

              {/* Events */}
              <div className="flex flex-col gap-0.5 flex-1 overflow-hidden">
                {events.slice(0, 3).map(inq => (
                  <EventChip key={inq.id} inquiry={inq} onClick={() => onSelect(inq)}
                    onAction={onAction ? () => onAction(inq) : undefined} compact />
                ))}
                {events.length > 3 && (
                  <p className="text-xs pl-1" style={{ color: colors.text.muted }}>
                    +{events.length - 3} more
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

// ── Week View ──────────────────────────────────────────────────────────────────

function WeekView({
  current, inquiries, onSelect, onAction,
}: {
  current: Date
  inquiries: InquiryResponse[]
  onSelect: (i: InquiryResponse) => void
  onAction?: (i: InquiryResponse) => void
}) {
  const weekStart_ = weekStart(current, { weekStartsOn: 1 })
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart_, i))

  // Hours: 7am – 8pm
  const HOURS = Array.from({ length: 14 }, (_, i) => i + 7)

  // Map each appointment to its hour slot
  function eventsAtHour(day: Date, hour: number): InquiryResponse[] {
    const dayKey = format(day, 'yyyy-MM-dd')
    return inquiries.filter(i => {
      if (!i.appointmentDate) return false
      const appt = parseISO(i.appointmentDate)
      return format(appt, 'yyyy-MM-dd') === dayKey && appt.getHours() === hour
    })
  }

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      {/* Day headers */}
      <div className="grid sticky top-0 z-10 border-b"
        style={{ gridTemplateColumns: '52px repeat(7, 1fr)', borderColor: border.divider, background: surface.card }}>
        <div /> {/* time gutter */}
        {days.map(day => (
          <div key={day.toISOString()} className="py-2 text-center border-l"
            style={{ borderColor: border.divider }}>
            <p className="text-xs font-semibold" style={{ color: colors.text.muted }}>
              {format(day, 'EEE')}
            </p>
            <div className={`text-sm font-bold mx-auto mt-0.5 w-7 h-7 rounded-full flex items-center justify-center`}
              style={{
                background: isToday(day) ? colors.accent : 'transparent',
                color: isToday(day) ? '#fff' : colors.text.primary,
              }}>
              {format(day, 'd')}
            </div>
          </div>
        ))}
      </div>

      {/* Hour rows */}
      <div className="flex-1">
        {HOURS.map(hour => (
          <div key={hour} className="grid border-b"
            style={{ gridTemplateColumns: '52px repeat(7, 1fr)', borderColor: border.divider, minHeight: 64 }}>
            {/* Time label */}
            <div className="px-2 pt-1 text-right">
              <span className="text-xs" style={{ color: colors.text.muted }}>
                {hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
              </span>
            </div>

            {/* Day columns */}
            {days.map(day => {
              const events = eventsAtHour(day, hour)
              return (
                <div key={day.toISOString()} className="border-l p-1 flex flex-col gap-1"
                  style={{ borderColor: border.divider }}>
                  {events.map(inq => (
                    <EventChip key={inq.id} inquiry={inq} onClick={() => onSelect(inq)}
                      onAction={onAction ? () => onAction(inq) : undefined} />
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

// ── Upcoming sidebar ───────────────────────────────────────────────────────────

function UpcomingSidebar({
  inquiries, onSelect, onAction,
}: {
  inquiries: InquiryResponse[]
  onSelect: (i: InquiryResponse) => void
  onAction?: (i: InquiryResponse) => void
}) {
  const now = new Date()
  const upcoming = inquiries
    .filter(i => i.appointmentDate && parseISO(i.appointmentDate) >= now)
    .sort((a, b) => (a.appointmentDate ?? '').localeCompare(b.appointmentDate ?? ''))
    .slice(0, 8)

  return (
    <div className="w-64 flex-shrink-0 flex flex-col gap-3 border-l pl-4"
      style={{ borderColor: border.divider }}>
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: colors.text.muted }}>
        Upcoming
      </p>
      {upcoming.length === 0 ? (
        <p className="text-sm" style={{ color: colors.text.muted }}>No upcoming appointments</p>
      ) : (
        <div className="flex flex-col gap-2">
          {upcoming.map(inq => {
            const canAct = !!onAction && inq.status === 'CONSULTATION_SCHEDULED'
            return (
              <div key={inq.id} className="rounded-xl overflow-hidden" style={{ background: surface.rowHover }}>
                <button onClick={() => onSelect(inq)}
                  className="text-left p-2.5 transition-colors w-full"
                  onMouseEnter={e => (e.currentTarget.style.background = accentAlpha(0.08))}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <p className="text-xs font-semibold truncate" style={{ color: colors.text.primary }}>
                    {inq.name}
                  </p>
                  <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color: colors.accent }}>
                    <CalendarDays size={10} />
                    {format(parseISO(inq.appointmentDate!), 'd MMM, h:mm a')}
                  </p>
                  {inq.reason && (
                    <p className="text-xs truncate mt-0.5" style={{ color: colors.text.muted }}>{inq.reason}</p>
                  )}
                </button>
                {canAct && (
                  <button
                    onClick={() => onAction!(inq)}
                    className="w-full flex items-center justify-center gap-1 py-1.5 text-xs font-semibold transition-colors border-t"
                    style={{
                      borderColor: border.divider,
                      color: colors.accent,
                      background: accentAlpha(0.06),
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = accentAlpha(0.14))}
                    onMouseLeave={e => (e.currentTarget.style.background = accentAlpha(0.06))}>
                    <Zap size={11} /> Log Outcome
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Main CalendarView ──────────────────────────────────────────────────────────

export function CalendarView({
  inquiries,
  onSelect,
  onAction,
}: {
  inquiries: InquiryResponse[]
  onSelect: (i: InquiryResponse) => void
  onAction?: (i: InquiryResponse) => void
}) {
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [current,  setCurrent]  = useState(new Date())

  // Only show inquiries that have an appointment date
  const withAppts = inquiries.filter(i => i.appointmentDate)

  function prev() {
    setCurrent(viewMode === 'month' ? subMonths(current, 1) : subWeeks(current, 1))
  }
  function next() {
    setCurrent(viewMode === 'month' ? addMonths(current, 1) : addWeeks(current, 1))
  }
  function today() { setCurrent(new Date()) }

  const title = viewMode === 'month'
    ? format(current, 'MMMM yyyy')
    : (() => {
        const ws = weekStart(current, { weekStartsOn: 1 })
        const we = addDays(ws, 6)
        return isSameMonth(ws, we)
          ? `${format(ws, 'd')} – ${format(we, 'd MMM yyyy')}`
          : `${format(ws, 'd MMM')} – ${format(we, 'd MMM yyyy')}`
      })()

  const totalAppts = withAppts.length

  return (
    <div className="rounded-2xl overflow-hidden flex flex-col" style={{ ...styles.card, minHeight: 600 }}>
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
          {totalAppts} appointment{totalAppts !== 1 ? 's' : ''}
        </span>

        {/* Today button */}
        <button onClick={today}
          className="text-xs px-3 py-1.5 rounded-full font-medium transition-colors"
          style={styles.filterTabInactive}>
          Today
        </button>

        {/* View toggle — hidden below sm since week view is unusable on narrow screens */}
        <div className="hidden sm:flex rounded-full overflow-hidden border" style={{ borderColor: border.card }}>
          {(['month', 'week'] as ViewMode[]).map(m => (
            <button key={m} onClick={() => setViewMode(m)}
              className="px-3 py-1.5 text-xs font-medium capitalize transition-colors"
              style={viewMode === m ? styles.filterTabActive : styles.filterTabInactive}>
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden gap-4 p-0">
        {/* Horizontal scroll wrapper: allows calendar to scroll rather than squish on narrow screens */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden flex flex-col">
          <div className="min-w-[420px] flex flex-col flex-1">
            {viewMode === 'month' ? (
              <MonthView current={current} inquiries={withAppts} onSelect={onSelect} onAction={onAction} />
            ) : (
              <WeekView current={current} inquiries={withAppts} onSelect={onSelect} onAction={onAction} />
            )}
          </div>
        </div>

        {/* Upcoming sidebar — only in month view */}
        {viewMode === 'month' && (
          <div className="hidden lg:block p-4 border-l" style={{ borderColor: border.divider }}>
            <UpcomingSidebar inquiries={withAppts} onSelect={onSelect} onAction={onAction} />
          </div>
        )}
      </div>
    </div>
  )
}
