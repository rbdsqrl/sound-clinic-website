import client from './client'
import type { ApiResponse, PagedResponse, UserResponse, StaffMemberResponse, AssignableUser, Role, MemberProfileResponse, UpdateMemberProfileRequest } from '../types'

export interface MemberSearchParams {
  page?: number
  size?: number
  search?: string
  role?: Role
  clinicId?: string
  /** Members tab (true, default) vs Archived tab (false). */
  active?: boolean
}

export const usersApi = {
  /**
   * All THERAPIST users in the org.
   * Pass clinicId to scope to a single clinic.
   * Only callable by BUSINESS_OWNER / CLINIC_HEAD.
   */
  listTherapists: (clinicId?: string) =>
    client
      .get<ApiResponse<UserResponse[]>>('/users/therapists', {
        params: clinicId ? { clinicId } : {},
      })
      .then((r) => r.data.data),

  /** Every active staff member — for pickers/dashboards that need the full list, not a page of it. */
  listMembers: () =>
    client
      .get<ApiResponse<PagedResponse<StaffMemberResponse>>>('/users/members', { params: { size: 1000 } })
      .then((r) => r.data.data.content),

  /** Paginated, filtered Members list — powers the Members page. Defaults to newest-joined first. */
  searchMembers: (params: MemberSearchParams = {}) =>
    client
      .get<ApiResponse<PagedResponse<StaffMemberResponse>>>('/users/members', { params })
      .then((r) => r.data.data),

  /**
   * Active staff as names + roles, for assignee pickers.
   * Callable by any staff member, since anyone can create and assign a task.
   * Pass role to scope to just that role (e.g. the review-meeting Clinic-Head picker).
   */
  listAssignable: (includeParents = false, role?: Role) =>
    client
      .get<ApiResponse<AssignableUser[]>>('/users/assignable', { params: { includeParents, role } })
      .then((r) => r.data.data),

  /** Search users by partial name or email within the caller's organisation. */
  search: (q: string, role?: Role) =>
    client
      .get<ApiResponse<UserResponse[]>>('/users/search', { params: { q, role } })
      .then((r) => r.data.data),

  deleteMember: (id: string) =>
    client.delete(`/users/${id}`),

  /** Restores login access for a deactivated member, keeping their existing role. */
  activateMember: (id: string) =>
    client.patch(`/users/${id}/activate`),

  /** The member profile page — contact, qualification, specialization, languages, case count. */
  getProfile: (id: string) =>
    client.get<ApiResponse<MemberProfileResponse>>(`/users/${id}/profile`).then((r) => r.data.data),

  updateProfile: (id: string, data: UpdateMemberProfileRequest) =>
    client.patch<ApiResponse<MemberProfileResponse>>(`/users/${id}/profile`, data).then((r) => r.data.data),

  addRole: (role: string) =>
    client.post<ApiResponse<UserResponse>>('/users/me/roles', { role }).then((r) => r.data.data),

  removeRole: (role: string) =>
    client.delete<ApiResponse<UserResponse>>(`/users/me/roles/${role}`).then((r) => r.data.data),
}
