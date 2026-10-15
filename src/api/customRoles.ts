import client from './client'
import type { ApiResponse } from '../types'

export interface CustomRole {
  id: string
  name: string
}

export const customRolesApi = {
  /** The organisation's Custom Role names, for the member profile picker. */
  list: () =>
    client.get<ApiResponse<CustomRole[]>>('/organisation/custom-roles').then(r => r.data.data),

  /** Adds a Custom Role (returns the existing one if the name is already there). */
  create: (name: string) =>
    client.post<ApiResponse<CustomRole>>('/organisation/custom-roles', { name }).then(r => r.data.data),

  /** Removes a name from the picker — members who already have it keep it. */
  delete: (id: string) =>
    client.delete<void>(`/organisation/custom-roles/${id}`).then(() => undefined),
}
