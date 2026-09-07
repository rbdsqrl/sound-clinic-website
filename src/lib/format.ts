import { format, parseISO } from 'date-fns'

/** Formats an ISO timestamp as a local "h:mm AM/PM" string, or an em dash when absent. */
export function formatTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/**
 * Formats a date as "dd MMM, yyyy" (e.g. "07 Sep, 2026") — the app-wide default for any
 * standalone date shown to a user (a row's date column, a detail view, a due date). Accepts
 * an ISO timestamp, a bare "yyyy-MM-dd" key, or a Date. Not for calendar UI chrome that
 * intentionally shows only part of a date (a month title, a weekday header) — those keep
 * their own format.
 */
export function formatDateStr(date: string | Date | null | undefined): string {
  if (!date) return '—'
  // A bare "yyyy-MM-dd" key needs an explicit local midnight, or parseISO reads it as UTC
  // and the displayed day can shift by one west of Greenwich.
  const d = typeof date === 'string'
    ? parseISO(/^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T00:00:00` : date)
    : date
  if (Number.isNaN(d.getTime())) return '—'
  return format(d, 'dd MMM, yyyy')
}

/** Formats a full timestamp as "dd MMM, yyyy, h:mm a" (e.g. "07 Sep, 2026, 3:45 PM"). */
export function formatDateTimeStr(date: string | Date | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? parseISO(date) : date
  if (Number.isNaN(d.getTime())) return '—'
  return `${format(d, 'dd MMM, yyyy')}, ${format(d, 'h:mm a')}`
}

/**
 * Formats a bare "HH:mm" or "HH:mm:ss" clock string (as stored/sent by the API — never a
 * full timestamp) as "h:mm AM/PM". Every other time value in the app comes as one of these
 * plain strings, so this is the one place that turns them into the 12-hour display format —
 * never format one inline, and never reuse the raw string for anything user-facing.
 */
export function formatTimeStr(time: string | null | undefined): string {
  if (!time) return '—'
  const [h, m] = time.split(':')
  const hour = parseInt(h, 10)
  if (Number.isNaN(hour)) return time
  const period = hour < 12 ? 'AM' : 'PM'
  const hour12 = hour % 12 === 0 ? 12 : hour % 12
  return `${hour12}:${m} ${period}`
}
