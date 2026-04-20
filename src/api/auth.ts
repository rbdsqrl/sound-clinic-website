import client from './client'
import type { ApiResponse, LoginRequest, LoginResponse, RegisterRequest, UserResponse } from '../types'

export const authApi = {
  register: (data: RegisterRequest) =>
    client.post<ApiResponse<LoginResponse>>('/auth/register', data).then((r) => r.data.data),

  login: (data: LoginRequest) =>
    client.post<ApiResponse<LoginResponse>>('/auth/login', data).then((r) => r.data.data),

  logout: (refreshToken: string) =>
    client.post('/auth/logout', { refreshToken }),

  me: () =>
    client.get<ApiResponse<UserResponse>>('/auth/me').then((r) => r.data.data),
}
