import { client } from './client'
import type { ApiResponse, CreateMeetingRequest, MeetingResponse } from '../types'

export const meetingsApi = {
  /** Meetings in a date range. Admins get the whole org; everyone else their own. */
  list: (from: string, to: string) =>
    client
      .get<ApiResponse<MeetingResponse[]>>('/meetings', { params: { from, to } })
      .then(r => r.data.data),

  get: (id: string) =>
    client.get<ApiResponse<MeetingResponse>>(`/meetings/${id}`).then(r => r.data.data),

  create: (payload: CreateMeetingRequest) =>
    client.post<ApiResponse<MeetingResponse>>('/meetings', payload).then(r => r.data.data),

  cancel: (id: string, reason?: string) =>
    client
      .patch<ApiResponse<MeetingResponse>>(`/meetings/${id}/cancel`, { reason })
      .then(r => r.data.data),
}
