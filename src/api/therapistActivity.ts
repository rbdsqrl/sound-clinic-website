import client from './client'
import type { ApiResponse, TherapistActivityResponse } from '../types'

export const therapistActivityApi = {
  /** One therapist's session notes, free-text notes and media for one day, per child. */
  get: (therapistId: string, date: string) =>
    client.get<ApiResponse<TherapistActivityResponse>>('/therapist-activity', {
      params: { therapistId, date },
    }).then(r => r.data.data),
}
