import { client } from './client'
import type { ApiResponse, CreateMeetingRequest, MeetingResponse } from '../types'

export const meetingsApi = {
  /** Meetings in a date range. Admins get the whole org; everyone else their own. */
  list: (from: string, to: string) =>
    client
      .get<ApiResponse<MeetingResponse[]>>('/meetings', { params: { from, to } })
      .then(r => r.data.data),

  create: (payload: CreateMeetingRequest) =>
    client.post<ApiResponse<MeetingResponse>>('/meetings', payload).then(r => r.data.data),

  cancel: (id: string, reason?: string) =>
    client
      .patch<ApiResponse<MeetingResponse>>(`/meetings/${id}/cancel`, { reason })
      .then(r => r.data.data),

  /** Per-occurrence write-up — a recurring series' other occurrences keep their own notes. */
  updateNotes: (id: string, notes: string) =>
    client
      .patch<ApiResponse<MeetingResponse>>(`/meetings/${id}/notes`, { notes })
      .then(r => r.data.data),
}
