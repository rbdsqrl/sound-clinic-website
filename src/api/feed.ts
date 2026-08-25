import client from './client'
import type {
  ApiResponse,
  FeedPostResponse,
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
}
