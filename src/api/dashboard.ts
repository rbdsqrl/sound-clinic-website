import client from './client'
import type { ApiResponse, AttentionCountsResponse, OrgOverviewResponse } from '../types'

export const dashboardApi = {
  /** The Organisation Overview ring counts — active/inactive cases and active/invited members. */
  orgOverview: () =>
    client.get<ApiResponse<OrgOverviewResponse>>('/dashboard/org-overview').then(r => r.data.data),

  /** Counts for the needs-attention cards (sessions to reschedule, cancellation requests, open
   *  concerns) — one tiny call, so each list is fetched only when it has something in it. */
  attentionCounts: () =>
    client.get<ApiResponse<AttentionCountsResponse>>('/dashboard/attention-counts').then(r => r.data.data),
}
