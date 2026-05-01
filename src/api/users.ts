import client from './client'
import type { ApiResponse, UserResponse, Role } from '../types'

export const usersApi = {
  me: () =>
    client.get<ApiResponse<UserResponse>>('/users/me').then((r) => r.data.data),

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
