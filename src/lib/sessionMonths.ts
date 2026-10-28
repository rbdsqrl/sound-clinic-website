import { format } from 'date-fns'
import type { TherapySessionResponse } from '../types'

/**
 * Splits a program's sessions by calendar month so every screen quotes the same "this month's" count
 * rather than one running total across renewals. The counting rule mirrors the backend's `ProgramMonths`:
 * a session counts toward its month when it is part of the paid plan (not an extra) and isn't cancelled.
 */

export type MonthState = 'current' | 'past' | 'future'

export interface SessionMonth {
  key: string              // "2026-10"
  label: string            // "October 2026"
  sessions: TherapySessionResponse[]   // every session dated in the month, oldest first
  total: number            // plan sessions in the month (not cancelled, not extras)
  completed: number
  missed: number           // no-shows
  open: number             // still to happen (scheduled / awaiting reschedule)
  state: MonthState
}

const isOpen = (s: TherapySessionResponse) =>
  s.status === 'SCHEDULED' || s.status === 'PENDING_RESCHEDULE' || s.status === 'CANCELLATION_REQUESTED'

export function monthKeyOf(date: string): string {
  return date.slice(0, 7)
}

export function groupSessionsByMonth(sessions: TherapySessionResponse[], today: string): SessionMonth[] {
  const byKey = new Map<string, TherapySessionResponse[]>()
  for (const s of sessions) {
    const k = monthKeyOf(s.sessionDate)
    const list = byKey.get(k)
    if (list) list.push(s)
    else byKey.set(k, [s])
  }

  const keys = [...byKey.keys()].sort()
  // The month a program is "in": this month if it has sessions, else the next month that does, else the last one.
  const todayKey = monthKeyOf(today)
  const currentKey = keys.includes(todayKey)
    ? todayKey
    : keys.find(k => k > todayKey) ?? keys[keys.length - 1]

  return keys.map(key => {
    const list = byKey.get(key)!.sort((a, b) =>
      a.sessionDate.localeCompare(b.sessionDate) || a.startTime.localeCompare(b.startTime) || a.sessionNumber - b.sessionNumber)
    const counted = list.filter(s => s.countsTowardPlan && s.status !== 'CANCELLED')
    return {
      key,
      label: format(new Date(`${key}-01T00:00:00`), 'MMMM yyyy'),
      sessions: list,
      total: counted.length,
      completed: counted.filter(s => s.status === 'COMPLETED').length,
      missed: counted.filter(s => s.status === 'NO_SHOW').length,
      open: counted.filter(isOpen).length,
      state: key === currentKey ? 'current' : key < currentKey ? 'past' : 'future',
    } satisfies SessionMonth
  })
}

/** "2026-10" → "October" (for compact "October 5/20" labels on cards). */
export function monthName(key: string): string {
  return format(new Date(`${key}-01T00:00:00`), 'MMMM')
}
