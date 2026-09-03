import client from './client'
import type {
  ApiResponse,
  PagedResponse,
  TaskResponse,
  TaskCommentResponse,
  TaskAttachmentResponse,
  TaskLogResponse,
  CreateTaskRequest,
  UpdateTaskRequest,
  UpdateTaskStatusRequest,
} from '../types'

export const tasksApi = {
  /** Every task visible to the caller — for pages that need the full list, not a page of it. */
  list: () =>
    client.get<ApiResponse<PagedResponse<TaskResponse>>>('/tasks', { params: { size: 1000 } })
      .then(r => r.data.data.content),

  /**
   * Paginated tasks — powers the Dashboard's "My Tasks" preview and its "View all" fetch.
   * Defaults to newest first. `mine` scopes to tasks assigned to the caller; `status` is a
   * comma-separated status filter (e.g. 'OPEN,IN_PROGRESS').
   */
  search: (params: { page?: number; size?: number; mine?: boolean; status?: string } = {}) =>
    client.get<ApiResponse<PagedResponse<TaskResponse>>>('/tasks', { params })
      .then(r => r.data.data),

  create: (data: CreateTaskRequest) =>
    client.post<ApiResponse<TaskResponse>>('/tasks', data).then(r => r.data.data),

  update: (id: string, data: UpdateTaskRequest) =>
    client.patch<ApiResponse<TaskResponse>>(`/tasks/${id}`, data).then(r => r.data.data),

  updateStatus: (id: string, data: UpdateTaskStatusRequest) =>
    client.patch<ApiResponse<TaskResponse>>(`/tasks/${id}/status`, data).then(r => r.data.data),

  delete: (id: string) =>
    client.delete<ApiResponse<void>>(`/tasks/${id}`).then(r => r.data.data),

  listComments: (id: string) =>
    client.get<ApiResponse<TaskCommentResponse[]>>(`/tasks/${id}/comments`).then(r => r.data.data),

  addComment: (id: string, body: string) =>
    client.post<ApiResponse<TaskCommentResponse>>(`/tasks/${id}/comments`, { body }).then(r => r.data.data),

  deleteComment: (taskId: string, commentId: string) =>
    client.delete<ApiResponse<void>>(`/tasks/${taskId}/comments/${commentId}`).then(r => r.data.data),

  listAttachments: (id: string) =>
    client.get<ApiResponse<TaskAttachmentResponse[]>>(`/tasks/${id}/attachments`).then(r => r.data.data),

  uploadAttachment: (id: string, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return client.post<ApiResponse<TaskAttachmentResponse>>(
      `/tasks/${id}/attachments`, fd,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    ).then(r => r.data.data)
  },

  deleteAttachment: (taskId: string, attachmentId: string) =>
    client.delete<ApiResponse<void>>(`/tasks/${taskId}/attachments/${attachmentId}`).then(r => r.data.data),

  listLogs: (id: string) =>
    client.get<ApiResponse<TaskLogResponse[]>>(`/tasks/${id}/logs`).then(r => r.data.data),
}
