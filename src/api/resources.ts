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

  renameFolder: (id: string, name: string) =>
    client.patch<ApiResponse<ResourceFolderResponse>>(`/resources/folders/${id}`, { name }).then(r => r.data.data),

  deleteFolder: (id: string) =>
    client.delete(`/resources/folders/${id}`),

  create: (data: CreateResourceRequest) =>
    client.post<ApiResponse<ResourceResponse>>('/resources', data).then(r => r.data.data),

  update: (id: string, data: UpdateResourceRequest) =>
    client.patch<ApiResponse<ResourceResponse>>(`/resources/${id}`, data).then(r => r.data.data),

  delete: (id: string) =>
    client.delete(`/resources/${id}`),
}
