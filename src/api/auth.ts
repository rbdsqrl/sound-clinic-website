import client, { publicClient } from './client'
import type {
  ApiResponse, LoginRequest, LoginResponse, RegisterRequest, UserResponse,
  ForgotPasswordRequest, ResetPasswordRequest, ResetTokenPreviewResponse,
} from '../types'

export const authApi = {
  register: (data: RegisterRequest) =>
    client.post<ApiResponse<LoginResponse>>('/auth/register', data).then((r) => r.data.data),

  login: (data: LoginRequest) =>
    client.post<ApiResponse<LoginResponse>>('/auth/login', data).then((r) => r.data.data),

  logout: (refreshToken: string) =>
    client.post('/auth/logout', { refreshToken }),

  me: () =>
    client.get<ApiResponse<UserResponse>>('/auth/me').then((r) => r.data.data),

  // ── Password reset ───────────────────────────────────────────────────────────
  // The caller is locked out by definition, so these use publicClient — no Bearer
  // token attached and no 401 refresh-and-retry interceptor in the way.

  forgotPassword: (data: ForgotPasswordRequest) =>
    publicClient.post<ApiResponse<void>>('/auth/forgot-password', data).then((r) => r.data),

  validateResetToken: (token: string) =>
    publicClient
      .get<ApiResponse<ResetTokenPreviewResponse>>('/auth/reset-password/validate', { params: { token } })
      .then((r) => r.data.data),

  resetPassword: (data: ResetPasswordRequest) =>
    publicClient.post<ApiResponse<void>>('/auth/reset-password', data).then((r) => r.data),
}
