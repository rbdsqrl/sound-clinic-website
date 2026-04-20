import client from './client'
import type { ApiResponse, ConditionResponse } from '../types'

export const conditionsApi = {
  list: () =>
    client.get<ApiResponse<ConditionResponse[]>>('/conditions').then((r) => r.data.data),
}
