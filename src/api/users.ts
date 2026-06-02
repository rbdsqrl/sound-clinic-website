import client from './client'
import type { ApiResponse, UserResponse, StaffMemberResponse, Role } from '../types'

export const usersApi = {
  me: () =>
    client.get<ApiResponse<UserResponse>>('/users/me').then((r) => r.data.data),

  /**
   * All THERAPIST and DOCTOR users in the org.
   * Pass clinicId to scope to a single clinic.
   * Only callable by BUSINESS_OWNER / ADMIN.
   */
  listTherapists: (clinicId?: string) =>
    client
      .get<ApiResponse<UserResponse[]>>('/users/therapists', {
        params: clinicId ? { clinicId } : {},
      })
      .then((r) => r.data.data),

  listMembers: () =>
    client
      .get<ApiResponse<StaffMemberResponse[]>>('/users/members')
      .then((r) => r.data.data),

  /** Search users by partial email within the caller's organisation. */
  search: (email: string, role?: Role) =>
    client
      .get<ApiResponse<UserResponse[]>>('/users/search', { params: { email, role } })
      .then((r) => r.data.data),

  addRole: (role: string) =>
    client.post<ApiResponse<UserResponse>>('/users/me/roles', { role }).then((r) => r.data.data),

  removeRole: (role: string) =>
    client.delete<ApiResponse<UserResponse>>(`/users/me/roles/${role}`).then((r) => r.data.data),
}
