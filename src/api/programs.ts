import client from './client'
import type { ApiResponse, ProgramResponse, CreateProgramRequest, UpdateProgramRequest } from '../types'

export const programsApi = {
  /** List all programs for the org (includes inactive by default) */
  list: (activeOnly = false) =>
    client.get<ApiResponse<ProgramResponse[]>>('/programs', {
      params: activeOnly ? { activeOnly: true } : {},
    }).then(r => r.data.data),

  /** List only active programs (used when creating a subscription) */
  listActive: () =>
    client.get<ApiResponse<ProgramResponse[]>>('/programs', {
      params: { activeOnly: true },
    }).then(r => r.data.data),

  /** Create a new therapy program */
  create: (data: CreateProgramRequest) =>
    client.post<ApiResponse<ProgramResponse>>('/programs', data).then(r => r.data.data),

  /** Update program name, cost or active status */
  update: (id: string, data: UpdateProgramRequest) =>
    client.put<ApiResponse<ProgramResponse>>(`/programs/${id}`, data).then(r => r.data.data),

  /** Soft-delete a program (sets isActive = false) */
  deactivate: (id: string) =>
    client.delete<ApiResponse<ProgramResponse>>(`/programs/${id}`).then(r => r.data.data),
}
