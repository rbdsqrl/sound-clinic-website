import client from './client'
import type { ApiResponse, MemberDocumentCategory, MemberDocumentResponse } from '../types'

export const memberDocumentsApi = {
  list: (memberId: string) =>
    client.get<ApiResponse<MemberDocumentResponse[]>>(`/users/${memberId}/documents`)
      .then(r => r.data.data),

  upload: (memberId: string, data: { file: File; category: MemberDocumentCategory; title?: string; notes?: string }) => {
    const fd = new FormData()
    fd.append('file', data.file)
    fd.append('category', data.category)
    if (data.title) fd.append('title', data.title)
    if (data.notes) fd.append('notes', data.notes)
    return client.post<ApiResponse<MemberDocumentResponse>>(
      `/users/${memberId}/documents`, fd,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    ).then(r => r.data.data)
  },

  remove: (memberId: string, documentId: string) =>
    client.delete<void>(`/users/${memberId}/documents/${documentId}`).then(() => undefined),
}
