import client from './client'
import type { ApiResponse, InviteRequest, InviteResponse, AcceptInviteRequest, InvitePreviewResponse } from '../types'

export const invitationsApi = {
  list: () =>
    client.get<ApiResponse<InviteResponse[]>>('/invitations').then((r) => r.data.data),

  send: (data: InviteRequest) =>
    client.post<ApiResponse<InviteResponse>>('/invitations', data).then((r) => r.data.data),

  resend: (id: string) =>
    client.post<ApiResponse<InviteResponse>>(`/invitations/${id}/resend`).then((r) => r.data.data),

  /** Withdraw an invitation that was never accepted (BUSINESS_OWNER / CLINIC_HEAD) */
  cancel: (id: string) =>
    client.patch<ApiResponse<InviteResponse>>(`/invitations/${id}/cancel`).then((r) => r.data.data),

  preview: (token: string) =>
    client.get<ApiResponse<InvitePreviewResponse>>('/invitations/preview', { params: { token } }).then((r) => r.data.data),

  accept: (data: AcceptInviteRequest) =>
    client.post<ApiResponse<void>>('/invitations/accept', data).then((r) => r.data),
}
