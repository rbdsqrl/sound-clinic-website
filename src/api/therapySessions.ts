import client from './client'
import type {
  ApiResponse,
  TherapySessionResponse,
  UpdateSessionStatusRequest,
} from '../types'

export const therapySessionsApi = {
  /** List sessions — role-scoped on backend, optional date range + patient/therapist filters */
  list: (params?: {
    patientId?: string
    therapistId?: string
    from?: string   // "YYYY-MM-DD"
    to?: string     // "YYYY-MM-DD"
  }) =>
    client.get<ApiResponse<TherapySessionResponse[]>>('/therapy-sessions', { params })
      .then(r => r.data.data),

  /** All sessions for a specific enrollment (used in patient detail page) */
  byEnrollment: (enrollmentId: string) =>
    client.get<ApiResponse<TherapySessionResponse[]>>(
      `/therapy-sessions/by-enrollment/${enrollmentId}`,
    ).then(r => r.data.data),

  /** Mark a session COMPLETED / CANCELLED / NO_SHOW */
  updateStatus: (id: string, data: UpdateSessionStatusRequest) =>
    client.patch<ApiResponse<TherapySessionResponse>>(
      `/therapy-sessions/${id}/status`,
      data,
    ).then(r => r.data.data),
}
