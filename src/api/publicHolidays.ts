import client from './client'
import type { ApiResponse, PublicHolidayResponse, CreatePublicHolidayRequest } from '../types'

export const publicHolidaysApi = {
  list: () =>
    client.get<ApiResponse<PublicHolidayResponse[]>>('/public-holidays')
      .then(r => r.data.data),

  create: (data: CreatePublicHolidayRequest) =>
    client.post<ApiResponse<PublicHolidayResponse>>('/public-holidays', data)
      .then(r => r.data.data),

  delete: (id: string) =>
    client.delete<ApiResponse<void>>(`/public-holidays/${id}`)
      .then(r => r.data.data),
}
