import { client } from './client'
import type {
  ApiResponse,
  ResourceFolderContentsResponse,
  ResourceResponse,
  ResourceFolderResponse,
  CreateResourceFolderRequest,
  CreateResourceRequest,
  UpdateResourceRequest,
} from '../types'

export const resourcesApi = {
  /** Browse a folder — its breadcrumb, subfolders, and resources. Omit folderId for the root. */
  browse: (folderId?: string) =>
    client
      .get<ApiResponse<ResourceFolderContentsResponse>>('/resources', { params: folderId ? { folderId } : {} })
      .then(r => r.data.data),

  createFolder: (data: CreateResourceFolderRequest) =>
    client.post<ApiResponse<ResourceFolderResponse>>('/resources/folders', data).then(r => r.data.data),

  deleteFolder: (id: string) =>
    client.delete(`/resources/folders/${id}`),

  create: (data: CreateResourceRequest) =>
    client.post<ApiResponse<ResourceResponse>>('/resources', data).then(r => r.data.data),

  update: (id: string, data: UpdateResourceRequest) =>
    client.patch<ApiResponse<ResourceResponse>>(`/resources/${id}`, data).then(r => r.data.data),

  delete: (id: string) =>
    client.delete(`/resources/${id}`),

  /** Upload a file and get back a URL to use as a resource's URL — any file type. */
  uploadFile: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return client
      .post<ApiResponse<{ url: string }>>('/resources/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then(r => r.data.data.url)
  },
}
