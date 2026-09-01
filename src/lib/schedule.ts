import { format } from 'date-fns'

/** Today's date in the browser's local timezone, as YYYY-MM-DD — for `<input type="date" min=...>`. */
export function todayStr(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

/** True if the given date (YYYY-MM-DD) + time (HH:mm) has already passed. Either blank means "not past yet". */
export function isPastDateTime(date: string, time: string): boolean {
  if (!date || !time) return false
  return new Date(`${date}T${time}:00`) < new Date()
}

/** Adds minutes to an "HH:mm" start time, clamped so it can't roll past 23:45. */
export function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = Math.min((h || 0) * 60 + (m || 0) + minutes, 23 * 60 + 45)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}
