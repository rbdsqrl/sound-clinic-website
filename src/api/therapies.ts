import client from './client'
import type { ApiResponse, TherapyResponse } from '../types'

export const therapiesApi = {
  list: () =>
    client.get<ApiResponse<TherapyResponse[]>>('/therapies').then((r) => r.data.data),

  create: (name: string) =>
    client.post<ApiResponse<TherapyResponse>>('/therapies', { name }).then((r) => r.data.data),

  delete: (id: string) =>
    client.delete<ApiResponse<void>>(`/therapies/${id}`).then((r) => r.data),
}
