import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { hasRole } from '../types'
import { inquiriesApi } from '../api/inquiries'

/**
 * Returns the count of NEW (unactioned) inquiries.
 * Used by the Sidebar to show a badge on the Inquiries nav item.
 *
 * Shares TanStack Query cache with InquiriesPage — no duplicate API calls
 * when both are mounted at the same time.
 */
export function useInquiryBadge(): number {
  const { user } = useAuth()

  const canSee = !!user && (
    hasRole(user, 'BUSINESS_OWNER') || hasRole(user, 'CLINIC_HEAD')
  )

  const { data: newInquiries = [] } = useQuery({
    queryKey: ['inquiries', 'NEW'],
    queryFn:  () => inquiriesApi.list('NEW'),
    enabled:  canSee,
    staleTime: 60 * 1000,   // refresh every minute
    refetchInterval: 60 * 1000,
  })

  return newInquiries.length
}
