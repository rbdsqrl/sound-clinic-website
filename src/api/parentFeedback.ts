import client from './client'
import type { ApiResponse, ParentFeedback } from '../types'

export const parentFeedbackApi = {
  /** Parent: give (or edit) feedback on a completed session of their own child */
  give: (sessionId: string, message: string) =>
    client.put<ApiResponse<ParentFeedback>>(`/parent-feedback/sessions/${sessionId}`, { message }).then(r => r.data.data),

  /** The feedback on one session that the caller may see — everything for admin roles, only what was shared for the
   *  therapist, only their own for a parent */
  forSession: (sessionId: string) =>
    client.get<ApiResponse<ParentFeedback[]>>(`/parent-feedback/sessions/${sessionId}`).then(r => r.data.data),

  /** Parent: their own feedback on one plan's sessions */
  mine: (enrollmentId: string) =>
    client.get<ApiResponse<ParentFeedback[]>>('/parent-feedback/mine', { params: { enrollmentId } }).then(r => r.data.data),

  /** Admin roles: feedback no admin has read yet */
  unreviewed: () =>
    client.get<ApiResponse<ParentFeedback[]>>('/parent-feedback').then(r => r.data.data),

  /** Admin roles: share with the session's therapist (also marks it read) */
  share: (id: string) =>
    client.patch<ApiResponse<ParentFeedback>>(`/parent-feedback/${id}/share`).then(r => r.data.data),

  /** Admin roles: mark read without sharing */
  review: (id: string) =>
    client.patch<ApiResponse<ParentFeedback>>(`/parent-feedback/${id}/review`).then(r => r.data.data),

  /** Therapist: feedback shared with them that they haven't marked seen */
  shared: () =>
    client.get<ApiResponse<ParentFeedback[]>>('/parent-feedback/shared').then(r => r.data.data),

  /** Therapist: mark shared feedback as seen */
  seen: (id: string) =>
    client.patch<ApiResponse<ParentFeedback>>(`/parent-feedback/${id}/seen`).then(r => r.data.data),
}
