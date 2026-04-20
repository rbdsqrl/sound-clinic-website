import client from './client'
import type { ApiResponse, ClinicResponse, CreateClinicRequest } from '../types'

export const clinicsApi = {
  list: () =>
    client.get<ApiResponse<ClinicResponse[]>>('/clinics').then((r) => r.data.data),

  get: (id: string) =>
    client.get<ApiResponse<ClinicResponse>>(`/clinics/${id}`).then((r) => r.data.data),

  create: (data: CreateClinicRequest) =>
    client.post<ApiResponse<ClinicResponse>>('/clinics', data).then((r) => r.data.data),

  update: (id: string, data: Partial<CreateClinicRequest>) =>
    client.patch<ApiResponse<ClinicResponse>>(`/clinics/${id}`, data).then((r) => r.data.data),
}
