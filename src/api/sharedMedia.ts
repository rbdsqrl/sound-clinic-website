import client from './client'
import type { ApiResponse, SharedMediaInboxResponse, SharedMediaResponse } from '../types'

export const sharedMediaApi = {
  list: (patientId: string) =>
    client.get<ApiResponse<SharedMediaResponse[]>>(`/patients/${patientId}/shared-media`)
      .then(r => r.data.data),

  upload: (patientId: string, data: { file?: File; note?: string }) => {
    const fd = new FormData()
    if (data.file) fd.append('file', data.file)
    if (data.note) fd.append('note', data.note)
    return client.post<ApiResponse<SharedMediaResponse>>(
      `/patients/${patientId}/shared-media`, fd,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    ).then(r => r.data.data)
  },

  /** Records that the recipient opened the post. A no-op for anyone who isn't its intended recipient. */
  markRead: (patientId: string, id: string) =>
    client.post<ApiResponse<SharedMediaResponse>>(`/patients/${patientId}/shared-media/${id}/read`)
      .then(r => r.data.data),

  /** The dashboard notes card: a parent's posts from the care team, or a therapist's posts from families. */
  inbox: () =>
    client.get<ApiResponse<SharedMediaInboxResponse>>('/shared-media/inbox')
      .then(r => r.data.data),

  remove: (patientId: string, id: string) =>
    client.delete<ApiResponse<void>>(`/patients/${patientId}/shared-media/${id}`)
      .then(r => r.data.data),
}
