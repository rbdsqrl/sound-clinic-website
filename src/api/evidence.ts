import type { AxiosError } from 'axios'
import client from './client'
import type { ApiResponse, EvidenceReason, EvidenceResponse, EvidenceSettings } from '../types'

interface UploadLink { uploadId: string; uploadUrl: string; headers: Record<string, string>; expiresInSeconds: number }

/** Storage couldn't be reached from the browser at all (blocked, or CORS) — use the through-the-server path. */
class DirectUploadBlocked extends Error {}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/** An error shaped like an API error so getApiError() can show its message. */
const uploadError = (message: string) => Object.assign(new Error(message), { response: { data: { message } } })

/**
 * PUTs the file to the signed URL with progress. A plain XMLHttpRequest, not the app's axios client: that one
 * adds an Authorization header, which a signed storage URL rejects (the URL itself is the credential).
 * Retries a dropped connection a couple of times; gives up straight away on a 4xx (an expired or refused link).
 */
async function putToStorage(link: UploadLink, file: File, onProgress?: (pct: number) => void) {
  const MAX_ATTEMPTS = 3
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const result = await new Promise<{ ok: boolean; status: number; sentAnything: boolean }>(resolve => {
      const xhr = new XMLHttpRequest()
      let sent = 0
      xhr.open('PUT', link.uploadUrl)
      Object.entries(link.headers).forEach(([k, v]) => xhr.setRequestHeader(k, v))
      xhr.upload.onprogress = e => { sent = e.loaded; if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100)) }
      xhr.onload = () => resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, sentAnything: sent > 0 })
      xhr.onerror = () => resolve({ ok: false, status: 0, sentAnything: sent > 0 })
      xhr.ontimeout = () => resolve({ ok: false, status: 0, sentAnything: sent > 0 })
      xhr.send(file)
    })

    if (result.ok) return
    // Refused outright (expired link, bad signature): retrying the same link can't help.
    if (result.status >= 400 && result.status < 500) throw uploadError('The upload link was refused or has expired. Please try again.')
    // Failed before a single byte went out on the first try: almost certainly the browser can't talk to storage.
    if (attempt === 1 && result.status === 0 && !result.sentAnything) throw new DirectUploadBlocked()
    if (attempt === MAX_ATTEMPTS) throw uploadError('The upload kept failing — check your connection and try again.')
    onProgress?.(0)
    await sleep(attempt === 1 ? 1500 : 4000)
  }
}

/** The original path: send the file to the API, which stores it. Used as a fallback. */
function uploadThroughServer(
  patientId: string,
  data: { file: File; goalId?: string; sessionId?: string; note?: string; durationSeconds?: number | null },
  onProgress?: (pct: number) => void,
) {
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
}

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

  /**
   * Uploads a video as evidence. The file goes straight to storage using a short-lived signed link, so it
   * never passes through the API server (which can't comfortably carry large videos); the server then
   * checks what arrived and registers it. A flaky connection retries the transfer with a pause between
   * attempts. If the browser can't reach storage directly at all (blocked, or direct uploads unavailable),
   * it quietly falls back to sending the file through the server.
   */
  uploadVideo: async (
    patientId: string,
    data: { file: File; goalId?: string; sessionId?: string; note?: string; durationSeconds?: number | null },
    onProgress?: (pct: number) => void,
  ): Promise<EvidenceResponse> => {
    let link: UploadLink
    try {
      link = await client.post<ApiResponse<UploadLink>>(`/patients/${patientId}/evidence/upload-url`, {
        fileName: data.file.name, contentType: data.file.type, sizeBytes: data.file.size,
        durationSeconds: data.durationSeconds ?? undefined, goalId: data.goalId, sessionId: data.sessionId, note: data.note,
      }).then(r => r.data.data)
    } catch (err) {
      if ((err as AxiosError)?.response?.status === 501) return uploadThroughServer(patientId, data, onProgress)
      throw err   // a real refusal (too large, wrong type…) — show its message
    }

    try {
      await putToStorage(link, data.file, onProgress)
    } catch (err) {
      if (err instanceof DirectUploadBlocked) return uploadThroughServer(patientId, data, onProgress)
      throw err
    }
    onProgress?.(100)

    // The bytes may take a moment to be visible in storage — ask a few times before giving up.
    for (let attempt = 0; ; attempt++) {
      try {
        return await client.post<ApiResponse<EvidenceResponse>>(`/patients/${patientId}/evidence/uploads/${link.uploadId}/complete`)
          .then(r => r.data.data)
      } catch (err) {
        if ((err as AxiosError)?.response?.status === 409 && attempt < 3) { await sleep(1500 * (attempt + 1)); continue }
        throw err
      }
    }
  },

  cannotUpload: (patientId: string, data: { reasonCode: EvidenceReason; reasonText?: string; goalId?: string; sessionId?: string; note?: string }) =>
    client.post<ApiResponse<EvidenceResponse>>(`/patients/${patientId}/evidence/cannot-upload`, data).then(r => r.data.data),

  remove: (patientId: string, id: string) =>
    client.delete<void>(`/patients/${patientId}/evidence/${id}`).then(() => undefined),
}
