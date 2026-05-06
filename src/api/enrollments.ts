import client from './client'
import type {
  ApiResponse,
  EnrollmentResponse,
  CreateEnrollmentRequest,
  AvailableTherapistResponse,
  AvailableTherapistsQuery,
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

  /** Create an enrollment (OFFICE_ADMIN / ADMIN / BUSINESS_OWNER) */
  create: (data: CreateEnrollmentRequest) =>
    client.post<ApiResponse<EnrollmentResponse>>('/enrollments', data).then(r => r.data.data),

  /** Cancel an enrollment */
  cancel: (id: string) =>
    client.patch<ApiResponse<EnrollmentResponse>>(`/enrollments/${id}/cancel`).then(r => r.data.data),
}
