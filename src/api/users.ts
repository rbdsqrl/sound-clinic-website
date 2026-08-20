import client from './client'
import type { ApiResponse, UserResponse, StaffMemberResponse, AssignableUser, Role } from '../types'

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

  /** Full staff directory with personal details. BUSINESS_OWNER / ADMIN only. */
  listMembers: () =>
    client
      .get<ApiResponse<StaffMemberResponse[]>>('/users/members')
      .then((r) => r.data.data),

  /**
   * Active staff as names + roles, for assignee pickers.
   * Callable by any staff member, since anyone can create and assign a task.
   */
  listAssignable: (includeParents = false) =>
    client
      .get<ApiResponse<AssignableUser[]>>('/users/assignable', { params: { includeParents } })
      .then((r) => r.data.data),

  /** Search users by partial email within the caller's organisation. */
  search: (email: string, role?: Role) =>
    client
      .get<ApiResponse<UserResponse[]>>('/users/search', { params: { email, role } })
      .then((r) => r.data.data),

  deleteMember: (id: string) =>
    client.delete(`/users/${id}`),

  addRole: (role: string) =>
    client.post<ApiResponse<UserResponse>>('/users/me/roles', { role }).then((r) => r.data.data),

  removeRole: (role: string) =>
    client.delete<ApiResponse<UserResponse>>(`/users/me/roles/${role}`).then((r) => r.data.data),
}
