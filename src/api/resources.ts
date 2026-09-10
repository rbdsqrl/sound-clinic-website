import { client } from './client'
import type {
  ApiResponse,
  ResourceFolderContentsResponse,
  ResourceResponse,
  ResourceFolderResponse,
  ResourceAssignmentResponse,
  CreateResourceFolderRequest,
  CreateResourceRequest,
  UpdateResourceRequest,
  AssignResourceRequest,
  AssignFolderResponse,
} from '../types'

export const resourcesApi = {
  /** Browse a folder — its breadcrumb, subfolders, and resources. Omit folderId for the root.
   *  Pass search instead for a flat, folder-less list of name matches across the whole org. */
  browse: (params: { folderId?: string; search?: string } = {}) =>
    client
      .get<ApiResponse<ResourceFolderContentsResponse>>('/resources', { params })
      .then(r => r.data.data),

  /** Assigns a resource to a patient — the only thing that makes a resource visible in the Parent app. */
  assign: (resourceId: string, data: AssignResourceRequest) =>
    client.post<ApiResponse<ResourceAssignmentResponse>>(`/resources/${resourceId}/assign`, data).then(r => r.data.data),

  unassign: (assignmentId: string) =>
    client.delete(`/resources/assignments/${assignmentId}`),

  /** Assigns every resource in a folder (subfolders included) to a patient in one call. */
  assignFolder: (folderId: string, data: AssignResourceRequest) =>
    client.post<ApiResponse<AssignFolderResponse>>(`/resources/folders/${folderId}/assign`, data).then(r => r.data.data),

  /** Resources assigned to one patient — staff can pass any patient in their org, a Parent only their own child. */
  listAssignments: (patientId: string) =>
    client.get<ApiResponse<ResourceAssignmentResponse[]>>('/resources/assignments', { params: { patientId } })
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
