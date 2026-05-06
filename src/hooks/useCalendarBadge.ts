import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { useAuth } from '../contexts/AuthContext'
import { hasRole } from '../types'
import { inquiriesApi } from '../api/inquiries'
import { leavesApi } from '../api/leaves'
import { therapySessionsApi } from '../api/therapySessions'

/**
 * Returns the count of calendar events happening TODAY.
 * Used by the Sidebar to show a badge on the Calendar nav item.
 *
 * Shares TanStack Query cache with CalendarPage — no duplicate API calls
 * when both are mounted at the same time.
 */
export function useCalendarBadge(): number {
  const { user } = useAuth()

  const canSeeInquiries = !!user && (
    hasRole(user, 'ADMIN') || hasRole(user, 'BUSINESS_OWNER') || hasRole(user, 'OFFICE_ADMIN')
  )
  const canSeeLeaves   = !!user && !hasRole(user, 'PARENT') && !hasRole(user, 'PATIENT')
  const canSeeSessions = !!user && !hasRole(user, 'PATIENT')

  const todayKey = format(new Date(), 'yyyy-MM-dd')

  const { data: inquiries = [] } = useQuery({
    queryKey: ['inquiries'],
    queryFn:  () => inquiriesApi.list(),
    enabled:  canSeeInquiries,
    staleTime: 5 * 60 * 1000,
  })

  const { data: leaves = [] } = useQuery({
    queryKey: ['leaves'],
    queryFn:  () => leavesApi.list(),
    enabled:  canSeeLeaves,
    staleTime: 5 * 60 * 1000,
  })

  const { data: sessions = [] } = useQuery({
    queryKey: ['therapy-sessions-cal', { from: todayKey, to: todayKey }],
    queryFn:  () => therapySessionsApi.list({ from: todayKey, to: todayKey }),
    enabled:  canSeeSessions,
    staleTime: 5 * 60 * 1000,
  })

  return useMemo(() => {
    let count = 0

    for (const i of inquiries) {
      if (i.appointmentDate && format(parseISO(i.appointmentDate), 'yyyy-MM-dd') === todayKey) {
        count++
      }
    }

    for (const l of leaves) {
      if (l.leaveDate === todayKey) count++
    }

    // Count today's scheduled/completed sessions
    for (const s of sessions) {
      if (s.sessionDate === todayKey && s.status !== 'CANCELLED') count++
    }

    return count
  }, [inquiries, leaves, sessions, todayKey])
}
