import client from './client'
import type { ApiResponse, LeaveResponse, CreateLeaveRequest, ReviewLeaveRequest, LeaveStatus } from '../types'

export const leavesApi = {
  /** Apply for leave (THERAPIST / DOCTOR) */
  apply: (data: CreateLeaveRequest) =>
    client.post<ApiResponse<LeaveResponse>>('/leaves', data).then(r => r.data.data),

  /** List leaves — role-scoped on the backend */
  list: (status?: LeaveStatus) =>
    client.get<ApiResponse<LeaveResponse[]>>('/leaves', {
      params: status ? { status } : {},
    }).then(r => r.data.data),

  /** Approve or reject a leave request (BUSINESS_OWNER / ADMIN) */
  review: (id: string, data: ReviewLeaveRequest) =>
    client.patch<ApiResponse<LeaveResponse>>(`/leaves/${id}/review`, data).then(r => r.data.data),

  /** Cancel own pending leave (THERAPIST / DOCTOR) */
  cancel: (id: string) =>
    client.delete(`/leaves/${id}`),
}
