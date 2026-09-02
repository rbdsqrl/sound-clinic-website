import client from './client'
import type {
  ApiResponse,
  ReviewMeetingResponse,
  ReviewScheduleRequest,
  CreateReviewMeetingRequest,
  RescheduleReviewRequest,
  ParentFeedbackRequest,
  TherapistFeedbackRequest,
} from '../types'

export const reviewMeetingsApi = {
  /** Meetings for one therapy plan. */
  listForEnrollment: (enrollmentId: string) =>
    client
      .get<ApiResponse<ReviewMeetingResponse[]>>('/review-meetings', { params: { enrollmentId } })
      .then(r => r.data.data),

  /** The caller's own meetings — their children's if a parent, their own if a therapist. */
  listMine: () =>
    client.get<ApiResponse<ReviewMeetingResponse[]>>('/review-meetings').then(r => r.data.data),

  /** Generates a recurring schedule for an existing plan. 409s if one already exists. */
  generateSchedule: (enrollmentId: string, data: ReviewScheduleRequest) =>
    client
      .post<ApiResponse<ReviewMeetingResponse[]>>(`/review-meetings/schedule/${enrollmentId}`, data)
      .then(r => r.data.data),

  /** Adds a single ad-hoc meeting outside the recurring rhythm. */
  create: (data: CreateReviewMeetingRequest) =>
    client.post<ApiResponse<ReviewMeetingResponse>>('/review-meetings', data).then(r => r.data.data),

  cancel: (id: string, reason?: string) =>
    client
      .patch<ApiResponse<ReviewMeetingResponse>>(`/review-meetings/${id}/cancel`, { reason })
      .then(r => r.data.data),

  complete: (id: string) =>
    client
      .patch<ApiResponse<ReviewMeetingResponse>>(`/review-meetings/${id}/complete`)
      .then(r => r.data.data),

  submitParentFeedback: (id: string, data: ParentFeedbackRequest) =>
    client
      .put<ApiResponse<ReviewMeetingResponse>>(`/review-meetings/${id}/parent-feedback`, data)
      .then(r => r.data.data),

  submitTherapistFeedback: (id: string, data: TherapistFeedbackRequest) =>
    client
      .put<ApiResponse<ReviewMeetingResponse>>(`/review-meetings/${id}/therapist-feedback`, data)
      .then(r => r.data.data),
}
