import client from './client'
import type {
  CreateAdHocSessionRequest,
  ApiResponse,
  TherapySessionResponse,
  UpdateSessionStatusRequest,
  UpdateSessionNotesRequest,
  RescheduleSessionRequest,
  SessionAttachmentResponse,
  SessionFeedbackResponse,
  UpdateSessionFeedbackRequest,
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

  /** Book a one-off session from the calendar (BUSINESS_OWNER / CLINIC_HEAD) */
  createAdHoc: (data: CreateAdHocSessionRequest) =>
    client.post<ApiResponse<TherapySessionResponse>>('/therapy-sessions/ad-hoc', data)
      .then(r => r.data.data),

  /** Request reschedule of a SCHEDULED session (parent role) */
  requestReschedule: (id: string) =>
    client.post<ApiResponse<TherapySessionResponse>>(
      `/therapy-sessions/${id}/reschedule-request`,
    ).then(r => r.data.data),

  /** Request cancellation of a SCHEDULED session (therapist/doctor) — requires admin approval */
  requestCancellation: (id: string) =>
    client.post<ApiResponse<TherapySessionResponse>>(
      `/therapy-sessions/${id}/cancellation-request`,
    ).then(r => r.data.data),

  /** Approve a cancellation request — sets status to CANCELLED (admin/owner only) */
  approveCancellation: (id: string) =>
    client.post<ApiResponse<TherapySessionResponse>>(
      `/therapy-sessions/${id}/approve-cancellation`,
    ).then(r => r.data.data),

  /** Reject a cancellation request — reverts to SCHEDULED (admin/owner only) */
  rejectCancellation: (id: string) =>
    client.post<ApiResponse<TherapySessionResponse>>(
      `/therapy-sessions/${id}/reject-cancellation`,
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

  /** Get the session feedback checklist template (from the session's program) and this session's answers */
  getFeedback: (id: string) =>
    client.get<ApiResponse<SessionFeedbackResponse>>(
      `/therapy-sessions/${id}/feedback`,
    ).then(r => r.data.data),

  /** Save this session's feedback checklist answers */
  updateFeedback: (id: string, data: UpdateSessionFeedbackRequest) =>
    client.put<ApiResponse<void>>(
      `/therapy-sessions/${id}/feedback`,
      data,
    ).then(r => r.data.data),
}
