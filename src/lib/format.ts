/** Formats an ISO timestamp as a local "h:mm AM/PM" string, or an em dash when absent. */
export function formatTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
