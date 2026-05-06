import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isToday,
} from 'date-fns'
import { colors, border, surface, accentAlpha } from '../../theme'

export function MiniCalendar({
  selected,
  onSelect,
}: {
  selected: Date | null
  onSelect: (d: Date) => void
}) {
  const [viewMonth, setViewMonth] = useState(new Date())
  const today = new Date(); today.setHours(0, 0, 0, 0)

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(viewMonth), { weekStartsOn: 1 }),
    end:   endOfWeek(endOfMonth(viewMonth),     { weekStartsOn: 1 }),
  })

  return (
    <div style={{ background: surface.card, border: `1px solid ${border.card}`, borderRadius: 10, padding: 12 }}>
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => setViewMonth(subMonths(viewMonth, 1))}
          style={{ color: colors.text.muted, padding: 4, borderRadius: 6 }}
          onMouseEnter={e => (e.currentTarget.style.background = accentAlpha(0.1))}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <ChevronLeft size={14} />
        </button>
        <span className="text-sm font-semibold" style={{ color: colors.text.primary }}>
          {format(viewMonth, 'MMMM yyyy')}
        </span>
        <button onClick={() => setViewMonth(addMonths(viewMonth, 1))}
          style={{ color: colors.text.muted, padding: 4, borderRadius: 6 }}
          onMouseEnter={e => (e.currentTarget.style.background = accentAlpha(0.1))}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <div key={i} className="text-center text-xs font-medium" style={{ color: colors.text.muted }}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {days.map(day => {
          const isSelected = selected ? isSameDay(day, selected) : false
          const isPast     = day < today
          const inMonth    = isSameMonth(day, viewMonth)
          const todayDay   = isToday(day)
          return (
            <button key={day.toISOString()} disabled={isPast} onClick={() => onSelect(day)}
              className="text-xs rounded-md py-1.5 text-center transition-colors"
              style={{
                color: isPast ? colors.text.muted
                  : !inMonth ? colors.text.muted
                  : isSelected ? '#fff'
                  : todayDay ? colors.accent
                  : colors.text.primary,
                background: isSelected ? colors.accent : 'transparent',
                opacity: isPast ? 0.35 : 1,
                cursor: isPast ? 'not-allowed' : 'pointer',
                fontWeight: todayDay && !isSelected ? 700 : 400,
              }}>
              {format(day, 'd')}
            </button>
          )
        })}
      </div>
    </div>
  )
}
