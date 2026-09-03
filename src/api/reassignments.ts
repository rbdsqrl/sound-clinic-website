import client from './client'
import type {
  ApiResponse,
  ReassignmentResponse,
  ReassignmentStatus,
  CreateReassignmentRequest,
} from '../types'

export const reassignmentsApi = {
  /** Batches a therapist appears in, either side. Optional status filter. */
  list: (therapistId: string, status?: ReassignmentStatus) =>
    client
      .get<ApiResponse<ReassignmentResponse[]>>('/therapist-reassignments', { params: { therapistId, status } })
      .then(r => r.data.data),

  /** Bulk-reassign selected cases — permanent, or bounded to a start/end window (Admin Roles). */
  create: (data: CreateReassignmentRequest) =>
    client
      .post<ApiResponse<ReassignmentResponse>>('/therapist-reassignments', data)
      .then(r => r.data.data),

  /** End a TEMPORARY batch early — not available for PERMANENT batches. */
  cancelEarly: (id: string) =>
    client
      .patch<ApiResponse<ReassignmentResponse>>(`/therapist-reassignments/${id}/cancel`)
      .then(r => r.data.data),
}
