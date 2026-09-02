import client from './client'
import type {
  ApiResponse,
  ActivityResponse,
  CreateActivityRequest,
  UpdateActivityRequest,
  ActivityResourceResponse,
  AssignActivityRequest,
  ActivityAssignmentResponse,
  UpdateAssignmentStatusRequest,
  LogAttemptRequest,
  ActivityAttemptResponse,
  MagicFillRequest,
  MagicFillResponse,
} from '../types'

export const activitiesApi = {
  list: (activeOnly = false) =>
    client.get<ApiResponse<ActivityResponse[]>>('/activities', { params: { activeOnly } }).then((r) => r.data.data),

  get: (id: string) =>
    client.get<ApiResponse<ActivityResponse>>(`/activities/${id}`).then((r) => r.data.data),

  create: (data: CreateActivityRequest) =>
    client.post<ApiResponse<ActivityResponse>>('/activities', data).then((r) => r.data.data),

  update: (id: string, data: UpdateActivityRequest) =>
    client.put<ApiResponse<ActivityResponse>>(`/activities/${id}`, data).then((r) => r.data.data),

  aiStatus: () =>
    client.get<ApiResponse<{ enabled: boolean }>>('/activities/ai-status').then((r) => r.data.data),

  magicFill: (data: MagicFillRequest) =>
    client.post<ApiResponse<MagicFillResponse>>('/activities/magic-fill', data).then((r) => r.data.data),

  sharedLibrary: () =>
    client.get<ApiResponse<ActivityResponse[]>>('/activities/shared-library').then((r) => r.data.data),

  importActivity: (id: string) =>
    client.post<ApiResponse<ActivityResponse>>(`/activities/${id}/import`).then((r) => r.data.data),

  uploadResource: (id: string, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return client.post<ApiResponse<ActivityResourceResponse>>(
      `/activities/${id}/resources`, fd,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    ).then((r) => r.data.data)
  },

  deleteResource: (id: string, resourceId: string) =>
    client.delete<ApiResponse<void>>(`/activities/${id}/resources/${resourceId}`).then((r) => r.data),

  assign: (id: string, data: AssignActivityRequest) =>
    client.post<ApiResponse<ActivityAssignmentResponse>>(`/activities/${id}/assignments`, data).then((r) => r.data.data),

  listAssignments: (patientId: string) =>
    client.get<ApiResponse<ActivityAssignmentResponse[]>>('/activities/assignments', { params: { patientId } }).then((r) => r.data.data),

  updateAssignmentStatus: (assignmentId: string, data: UpdateAssignmentStatusRequest) =>
    client.patch<ApiResponse<ActivityAssignmentResponse>>(`/activities/assignments/${assignmentId}/status`, data).then((r) => r.data.data),

  logAttempt: (assignmentId: string, data: LogAttemptRequest) =>
    client.post<ApiResponse<ActivityAttemptResponse>>(`/activities/assignments/${assignmentId}/attempts`, data).then((r) => r.data.data),

  listAttempts: (assignmentId: string) =>
    client.get<ApiResponse<ActivityAttemptResponse[]>>(`/activities/assignments/${assignmentId}/attempts`).then((r) => r.data.data),
}
