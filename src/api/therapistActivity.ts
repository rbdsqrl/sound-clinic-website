import client from './client'
import type { ApiResponse, TherapistActivityResponse } from '../types'

export const therapistActivityApi = {
  /** One therapist's session notes, free-text notes and media over a date range, per child.
   *  A single day is just from === to. */
  get: (therapistId: string, from: string, to: string) =>
    client.get<ApiResponse<TherapistActivityResponse>>('/therapist-activity', {
      params: { therapistId, from, to },
    }).then(r => r.data.data),
}
