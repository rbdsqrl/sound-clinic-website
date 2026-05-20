import client from './client'
import type {
  ApiResponse,
  TherapySessionResponse,
  UpdateSessionStatusRequest,
  UpdateSessionNotesRequest,
  RescheduleSessionRequest,
  SessionAttachmentResponse,
} from '../types'

export const therapySessionsApi = {
  /** List sessions — role-scoped on backend, optional date range + patient/therapist/status filters */
  list: (params?: {
    patientId?: string
    therapistId?: string
    from?: string   // "YYYY-MM-DD"
    to?: string     // "YYYY-MM-DD"
    status?: string
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

  /** Update session feedback, progress report, and notes */
  updateNotes: (id: string, data: UpdateSessionNotesRequest) =>
    client.patch<ApiResponse<TherapySessionResponse>>(
      `/therapy-sessions/${id}/notes`,
      data,
    ).then(r => r.data.data),

  /** Reschedule a PENDING_RESCHEDULE session — set new date and/or substitute therapist */
  reschedule: (id: string, data: RescheduleSessionRequest) =>
    client.patch<ApiResponse<TherapySessionResponse>>(
      `/therapy-sessions/${id}/reschedule`,
      data,
    ).then(r => r.data.data),

  /** Request reschedule of a SCHEDULED session (parent role) */
  requestReschedule: (id: string) =>
    client.post<ApiResponse<TherapySessionResponse>>(
      `/therapy-sessions/${id}/reschedule-request`,
    ).then(r => r.data.data),

  /** List all attachments for a session */
  listAttachments: (id: string) =>
    client.get<ApiResponse<SessionAttachmentResponse[]>>(
      `/therapy-sessions/${id}/attachments`,
    ).then(r => r.data.data),

  /** Upload a file attachment to a session */
  uploadAttachment: (id: string, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return client.post<ApiResponse<SessionAttachmentResponse>>(
      `/therapy-sessions/${id}/attachments`,
      fd,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    ).then(r => r.data.data)
  },

  /** Delete a session attachment */
  deleteAttachment: (sessionId: string, attachmentId: string) =>
    client.delete<ApiResponse<void>>(
      `/therapy-sessions/${sessionId}/attachments/${attachmentId}`,
    ).then(r => r.data.data),
}
