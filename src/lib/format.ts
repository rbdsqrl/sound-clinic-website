/** Formats an ISO timestamp as a local "h:mm AM/PM" string, or an em dash when absent. */
export function formatTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
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
