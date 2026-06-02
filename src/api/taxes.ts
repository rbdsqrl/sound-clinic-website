import client from './client'
import type { ApiResponse, TaxResponse } from '../types'

export const taxesApi = {
  list: () =>
    client.get<ApiResponse<TaxResponse[]>>('/taxes').then((r) => r.data.data),

  create: (name: string, rate: number) =>
    client.post<ApiResponse<TaxResponse>>('/taxes', { name, rate }).then((r) => r.data.data),

  delete: (id: string) =>
    client.delete<ApiResponse<void>>(`/taxes/${id}`).then((r) => r.data),
}
