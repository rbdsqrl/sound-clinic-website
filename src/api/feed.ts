import client from './client'
import type {
  ApiResponse,
  FeedPostResponse,
  FeedPostImageResponse,
  FeedCommentResponse,
  CreateFeedPostRequest,
  UpdateFeedPostRequest,
} from '../types'

export const feedApi = {
  list: () =>
    client.get<ApiResponse<FeedPostResponse[]>>('/feed').then(r => r.data.data),

  create: (data: CreateFeedPostRequest) =>
    client.post<ApiResponse<FeedPostResponse>>('/feed', data).then(r => r.data.data),

  update: (id: string, data: UpdateFeedPostRequest) =>
    client.put<ApiResponse<FeedPostResponse>>(`/feed/${id}`, data).then(r => r.data.data),

  delete: (id: string) =>
    client.delete<ApiResponse<void>>(`/feed/${id}`).then(r => r.data.data),

  like: (id: string) =>
    client.post<ApiResponse<FeedPostResponse>>(`/feed/${id}/like`).then(r => r.data.data),

  unlike: (id: string) =>
    client.delete<ApiResponse<FeedPostResponse>>(`/feed/${id}/like`).then(r => r.data.data),

  recordView: (id: string) =>
    client.post<ApiResponse<void>>(`/feed/${id}/view`).then(r => r.data.data),

  listComments: (id: string) =>
    client.get<ApiResponse<FeedCommentResponse[]>>(`/feed/${id}/comments`).then(r => r.data.data),

  addComment: (id: string, body: string) =>
    client.post<ApiResponse<FeedCommentResponse>>(`/feed/${id}/comments`, { body }).then(r => r.data.data),

  deleteComment: (id: string, commentId: string) =>
    client.delete<ApiResponse<void>>(`/feed/${id}/comments/${commentId}`).then(r => r.data.data),

  uploadImages: (id: string, files: File[]) => {
    const fd = new FormData()
    files.forEach(f => fd.append('files', f))
    return client.post<ApiResponse<FeedPostImageResponse[]>>(
      `/feed/${id}/images`, fd,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    ).then(r => r.data.data)
  },

  deleteImage: (id: string, imageId: string) =>
    client.delete<ApiResponse<void>>(`/feed/${id}/images/${imageId}`).then(r => r.data.data),
}
