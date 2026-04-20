import client from './client'
import type { ApiResponse, OrganisationResponse, UpdateOrganisationRequest } from '../types'

export const organisationApi = {
  get: () =>
    client.get<ApiResponse<OrganisationResponse>>('/organisation').then((r) => r.data.data),

  update: (data: UpdateOrganisationRequest) =>
    client.patch<ApiResponse<OrganisationResponse>>('/organisation', data).then((r) => r.data.data),
}
