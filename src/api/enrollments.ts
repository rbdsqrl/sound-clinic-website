import client from './client'
import type {
  ApiResponse,
  EnrollmentResponse,
  CreateEnrollmentRequest,
  AvailableTherapistResponse,
  AvailableTherapistsQuery,
  EnrollmentCareStatus,
} from '../types'

export const enrollmentsApi = {
  /** List enrollments for a patient */
  listForPatient: (patientId: string) =>
    client.get<ApiResponse<EnrollmentResponse[]>>('/enrollments', {
      params: { patientId },
    }).then(r => r.data.data),

  /** Find therapists available for the given slot */
  getAvailableTherapists: (params: AvailableTherapistsQuery) =>
    client.get<ApiResponse<AvailableTherapistResponse[]>>('/enrollments/available-therapists', {
      params,
    }).then(r => r.data.data),

  /** Create an enrollment (CLINIC_HEAD / BUSINESS_OWNER) */
  create: (data: CreateEnrollmentRequest) =>
    client.post<ApiResponse<EnrollmentResponse>>('/enrollments', data).then(r => r.data.data),

  /** Hand an ongoing plan to a different therapist (CLINIC_HEAD / BUSINESS_OWNER) */
  changeTherapist: (id: string, therapistId: string, reason?: string) =>
    client
      .patch<ApiResponse<EnrollmentResponse>>(`/enrollments/${id}/therapist`, { therapistId, reason })
      .then(r => r.data.data),

  /** Cancel an enrollment */
  cancel: (id: string) =>
    client.patch<ApiResponse<EnrollmentResponse>>(`/enrollments/${id}/cancel`).then(r => r.data.data),

  /**
   * Set the clinical-health signal on an active enrollment (assigned therapist or admin-tier
   * roles). The manual* fields are only honoured when careStatus is PROGRAM_COMPLETED and the
   * caller is admin-tier — they fill in the discharge success criteria that would otherwise
   * never arrive on a program force-completed this way.
   */
  updateCareStatus: (id: string, careStatus: EnrollmentCareStatus, opts?: {
    note?: string
    manualGoalMasteryPct?: number
    manualParentSatisfactionPct?: number
    therapistSignedOff?: boolean
  }) =>
    client
      .patch<ApiResponse<EnrollmentResponse>>(`/enrollments/${id}/care-status`, { careStatus, ...opts })
      .then(r => r.data.data),

  /** Assigned therapist confirms the program's goals were met — only once care status is Review or Program Completed */
  therapistSignoff: (id: string, notes?: string) =>
    client
      .patch<ApiResponse<EnrollmentResponse>>(`/enrollments/${id}/therapist-signoff`, { notes })
      .then(r => r.data.data),

  /**
   * Undo a "Mark as Completed" override — back to ACTIVE/ON_TRACK, clears the manual success-
   * criteria overrides, and restores exactly the sessions that override auto-cancelled. Only
   * for a program force-completed that way, not one closed by a patient discharge.
   */
  reactivate: (id: string) =>
    client
      .patch<ApiResponse<EnrollmentResponse>>(`/enrollments/${id}/reactivate`)
      .then(r => r.data.data),
}
