import client from './client'
import type { ApiResponse, SharedMediaResponse } from '../types'

export const sharedMediaApi = {
  list: (patientId: string) =>
    client.get<ApiResponse<SharedMediaResponse[]>>(`/patients/${patientId}/shared-media`)
      .then(r => r.data.data),

  upload: (patientId: string, data: { video?: File; note?: string }) => {
    const fd = new FormData()
    if (data.video) fd.append('video', data.video)
    if (data.note) fd.append('note', data.note)
    return client.post<ApiResponse<SharedMediaResponse>>(
      `/patients/${patientId}/shared-media`, fd,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    ).then(r => r.data.data)
  },

  remove: (patientId: string, id: string) =>
    client.delete<ApiResponse<void>>(`/patients/${patientId}/shared-media/${id}`)
      .then(r => r.data.data),
}
