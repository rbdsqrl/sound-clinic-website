import axios from 'axios'
import type { ApiResponse } from '../types'

export interface PublicOrgInfo {
  id: string
  name: string
}

export const publicApi = {
  getOrg: () =>
    axios.get<ApiResponse<PublicOrgInfo>>('/api/v1/public/organisation')
      .then(r => r.data.data),
}
