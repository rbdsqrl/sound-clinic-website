import client from './client'
import type { ApiResponse, ConditionResponse } from '../types'

export const conditionsApi = {
  list: () =>
    client.get<ApiResponse<ConditionResponse[]>>('/conditions').then((r) => r.data.data),

  create: (name: string) =>
    client.post<ApiResponse<ConditionResponse>>('/conditions', { name }).then((r) => r.data.data),

  delete: (id: string) =>
    client.delete<ApiResponse<void>>(`/conditions/${id}`).then((r) => r.data),
}
