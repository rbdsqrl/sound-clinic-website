import client from './client'
import type { ApiResponse, EvidenceReason, EvidenceResponse, EvidenceSettings } from '../types'

export const evidenceApi = {
  /** The organisation's rules — readable by all staff, so the app can enforce them. */
  getSettings: () =>
    client.get<ApiResponse<EvidenceSettings>>('/organisation/evidence-settings').then(r => r.data.data),

  updateSettings: (data: EvidenceSettings) =>
    client.put<ApiResponse<EvidenceSettings>>('/organisation/evidence-settings', data).then(r => r.data.data),

  /** A child's evidence, newest first (parents get videos only). */
  list: (patientId: string, goalId?: string) =>
    client.get<ApiResponse<EvidenceResponse[]>>(`/patients/${patientId}/evidence`, { params: goalId ? { goalId } : undefined })
      .then(r => r.data.data),

  uploadVideo: (
    patientId: string,
    data: { file: File; goalId?: string; sessionId?: string; note?: string; durationSeconds?: number | null },
    onProgress?: (pct: number) => void,
  ) => {
    const fd = new FormData()
    fd.append('file', data.file)
    if (data.goalId) fd.append('goalId', data.goalId)
    if (data.sessionId) fd.append('sessionId', data.sessionId)
    if (data.note) fd.append('note', data.note)
    if (data.durationSeconds != null) fd.append('durationSeconds', String(data.durationSeconds))
    return client.post<ApiResponse<EvidenceResponse>>(`/patients/${patientId}/evidence`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      // Videos are big — let a slow connection take its time rather than timing out mid-upload.
      timeout: 0,
      onUploadProgress: e => { if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100)) },
    }).then(r => r.data.data)
  },

  cannotUpload: (patientId: string, data: { reasonCode: EvidenceReason; reasonText?: string; goalId?: string; sessionId?: string; note?: string }) =>
    client.post<ApiResponse<EvidenceResponse>>(`/patients/${patientId}/evidence/cannot-upload`, data).then(r => r.data.data),

  remove: (patientId: string, id: string) =>
    client.delete<void>(`/patients/${patientId}/evidence/${id}`).then(() => undefined),
}
