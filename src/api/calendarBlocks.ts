import client from './client'
import type { ApiResponse, OrgCalendarBlockResponse, CreateOrgCalendarBlockRequest } from '../types'

export const calendarBlocksApi = {
  list: () =>
    client.get<ApiResponse<OrgCalendarBlockResponse[]>>('/calendar-blocks')
      .then(r => r.data.data),

  create: (data: CreateOrgCalendarBlockRequest) =>
    client.post<ApiResponse<OrgCalendarBlockResponse>>('/calendar-blocks', data)
      .then(r => r.data.data),

  delete: (id: string) =>
    client.delete<ApiResponse<void>>(`/calendar-blocks/${id}`)
      .then(r => r.data.data),
}
