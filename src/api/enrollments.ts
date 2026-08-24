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

  /** Set the clinical-health signal on an active enrollment (assigned therapist or admin-tier roles) */
  updateCareStatus: (id: string, careStatus: EnrollmentCareStatus, note?: string) =>
    client
      .patch<ApiResponse<EnrollmentResponse>>(`/enrollments/${id}/care-status`, { careStatus, note })
      .then(r => r.data.data),

  /** Assigned therapist confirms the program's goals were met — only once care status is Review or Program Completed */
  therapistSignoff: (id: string, notes?: string) =>
    client
      .patch<ApiResponse<EnrollmentResponse>>(`/enrollments/${id}/therapist-signoff`, { notes })
      .then(r => r.data.data),
}
