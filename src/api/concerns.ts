import client from './client'
import type { ApiResponse, ConcernResponse, ConcernStatus } from '../types'

export const concernsApi = {
  /** Parent raises a concern about an active enrollment */
  raise: (enrollmentId: string, description: string) =>
    client.post<ApiResponse<ConcernResponse>>('/enrollment-concerns', { enrollmentId, description })
      .then(r => r.data.data),

  /** List concerns — pass exactly one of enrollmentId / patientId, or status for an org-wide staff view */
  list: (params: { enrollmentId?: string; patientId?: string; status?: ConcernStatus }) =>
    client.get<ApiResponse<ConcernResponse[]>>('/enrollment-concerns', { params }).then(r => r.data.data),

  acknowledge: (id: string) =>
    client.patch<ApiResponse<ConcernResponse>>(`/enrollment-concerns/${id}/acknowledge`).then(r => r.data.data),

  resolve: (id: string, resolutionNotes?: string) =>
    client.patch<ApiResponse<ConcernResponse>>(`/enrollment-concerns/${id}/resolve`, { resolutionNotes })
      .then(r => r.data.data),
}
