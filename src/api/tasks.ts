import client from './client'
import type {
  ApiResponse,
  TaskResponse,
  TaskCommentResponse,
  TaskAttachmentResponse,
  TaskLogResponse,
  CreateTaskRequest,
  UpdateTaskRequest,
  UpdateTaskStatusRequest,
} from '../types'

export const tasksApi = {
  list: () =>
    client.get<ApiResponse<TaskResponse[]>>('/tasks').then(r => r.data.data),

  get: (id: string) =>
    client.get<ApiResponse<TaskResponse>>(`/tasks/${id}`).then(r => r.data.data),

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
