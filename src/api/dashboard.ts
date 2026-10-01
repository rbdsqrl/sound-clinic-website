import client from './client'
import type { ApiResponse, OrgOverviewResponse } from '../types'

export const dashboardApi = {
  /** The Organisation Overview ring counts — active/inactive cases and active/invited members. */
  orgOverview: () =>
    client.get<ApiResponse<OrgOverviewResponse>>('/dashboard/org-overview').then(r => r.data.data),
}
