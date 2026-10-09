import { useEffect, useMemo, useState } from 'react'
import { useIsFetching, useQuery } from '@tanstack/react-query'
import { format, parseISO, isAfter } from 'date-fns'
import { useAuth } from '../contexts/AuthContext'
import { hasRole } from '../types'
import { inquiriesApi } from '../api/inquiries'
import { leavesApi } from '../api/leaves'
import { therapySessionsApi } from '../api/therapySessions'

/** The queries this hook owns, which must not count as "the page is busy". */
const BADGE_QUERY_KEYS = new Set(['inquiries', 'leaves'])
/** Longest the badge waits for the page's own requests before loading anyway. */
const BADGE_MAX_WAIT_MS = 5000
/** Gives the page's own requests a moment to start before "nothing is fetching" is believed. */
const BADGE_ARM_DELAY_MS = 800

/**
 * Returns the count of calendar events happening TODAY.
 * Used by the Sidebar to show a badge on the Calendar nav item.
 *
 * Loads after the page's own requests settle (see `settled`), using slim rows shared with the
 * dashboard's Today's Sessions card. The Calendar page fetches its own data only when opened.
 */
export function useCalendarBadge(): number {
  const { user } = useAuth()

  const canSeeInquiries = !!user && (
    hasRole(user, 'BUSINESS_OWNER') || hasRole(user, 'CLINIC_HEAD')
  )
  const canSeeLeaves   = !!user && !hasRole(user, 'PARENT') && !hasRole(user, 'PATIENT')
  const canSeeSessions = !!user && !hasRole(user, 'PATIENT')

  const todayKey = format(new Date(), 'yyyy-MM-dd')

  // The badge is decoration, so it waits for the page's own requests to finish — the dashboard
  // fires a dozen at once, and these three would only join the queue. It counts only its own
  // queries out of "busy", so it can't wait on itself, and gives up waiting after a few seconds
  // in case some other request never settles.
  const busy = useIsFetching({
    predicate: q => q.queryKey[1] !== 'summary' && !BADGE_QUERY_KEYS.has(String(q.queryKey[0])),
  }) > 0
  // On the very first render nothing has started fetching yet, so "not busy" means nothing —
  // hold off briefly (armed) so the page's own requests get under way and are seen as busy.
  const [armed, setArmed] = useState(false)
  const [waitedLongEnough, setWaitedLongEnough] = useState(false)
  useEffect(() => {
    const arm = setTimeout(() => setArmed(true), BADGE_ARM_DELAY_MS)
    const giveUp = setTimeout(() => setWaitedLongEnough(true), BADGE_MAX_WAIT_MS)
    return () => { clearTimeout(arm); clearTimeout(giveUp) }
  }, [])
  const settled = waitedLongEnough || (armed && !busy)

  const { data: inquiries = [] } = useQuery({
    queryKey: ['inquiries'],
    queryFn:  () => inquiriesApi.list(),
    enabled:  canSeeInquiries && settled,
    staleTime: 5 * 60 * 1000,
  })

  const { data: leaves = [] } = useQuery({
    queryKey: ['leaves'],
    queryFn:  () => leavesApi.list(),
    enabled:  canSeeLeaves && settled,
    staleTime: 5 * 60 * 1000,
  })

  const { data: sessions = [] } = useQuery({
    // Same slim rows and key as the dashboard's Today's Sessions card, so on the dashboard this
    // is a cache hit rather than a second call.
    queryKey: ['therapy-sessions-cal', 'summary', todayKey],
    queryFn:  () => therapySessionsApi.summary(todayKey, todayKey),
    enabled:  canSeeSessions && settled,
    staleTime: 60 * 1000,
  })

  // Past sessions drop off the count as the day goes on. That only needs the clock, not the
  // network — a local minute tick re-runs the count below instead of polling the server every
  // minute from every open tab.
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60 * 1000)
    return () => clearInterval(id)
  }, [])


  return useMemo(() => {
    const now        = new Date()
    const nowTimeStr = format(now, 'HH:mm:ss')
    let count = 0

    // Inquiry appointments: only count if the appointment datetime is still in the future
    for (const i of inquiries) {
      if (i.appointmentDate) {
        const apptTime = parseISO(i.appointmentDate)
        if (format(apptTime, 'yyyy-MM-dd') === todayKey && isAfter(apptTime, now)) {
          count++
        }
      }
    }

    // Leaves are full-day — count any approved leave today
    for (const l of leaves) {
      if (l.leaveDate === todayKey) count++
    }

    // Sessions: only count SCHEDULED sessions whose start time hasn't passed yet
    for (const s of sessions) {
      if (s.sessionDate === todayKey && s.status === 'SCHEDULED' && s.startTime > nowTimeStr) {
        count++
      }
    }

    return count
  }, [inquiries, leaves, sessions, todayKey, tick])
}
