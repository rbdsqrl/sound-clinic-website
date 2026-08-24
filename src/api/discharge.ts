import client from './client'
import { num } from './analytics'
import type { ApiResponse, DischargePreviewResponse, DischargeRecordResponse } from '../types'

/** See analytics.ts — Jackson NON_NULL omits null fields, so they arrive as `undefined`. */
const normaliseRecord = (d: DischargeRecordResponse): DischargeRecordResponse => ({
  ...d,
  avgCommunicationRating: num(d.avgCommunicationRating),
  avgProgressRatingPct:   num(d.avgProgressRatingPct),
  goalMasteryPct:         num(d.goalMasteryPct),
  goalMasteryMet:         d.goalMasteryMet ?? null,
  parentSatisfactionMet:  d.parentSatisfactionMet ?? null,
})

export const dischargeApi = {
  /** Dry run of what discharging this patient right now would look like. */
  preview: (patientId: string) =>
    client.get<ApiResponse<DischargePreviewResponse>>(`/patients/${patientId}/discharge/preview`)
      .then(r => ({
        ...r.data.data,
        enrollments: r.data.data.enrollments.map(e => ({
          ...e,
          criteria: {
            ...e.criteria,
            goalMasteryPct: num(e.criteria.goalMasteryPct),
            goalMasteryMet: e.criteria.goalMasteryMet ?? null,
            parentSatisfactionPct: num(e.criteria.parentSatisfactionPct),
            parentSatisfactionMet: e.criteria.parentSatisfactionMet ?? null,
          },
        })),
      })),

  /** Discharge — closes every enrollment in the patient's current episode. */
  create: (patientId: string, notes?: string) =>
    client.post<ApiResponse<DischargeRecordResponse>>(`/patients/${patientId}/discharge`, { notes })
      .then(r => normaliseRecord(r.data.data)),

  /** List a patient's discharge episodes, most recent first. */
  list: (patientId: string) =>
    client.get<ApiResponse<DischargeRecordResponse[]>>(`/patients/${patientId}/discharge`)
      .then(r => r.data.data.map(normaliseRecord)),

  /** Get (generates on first call) a download URL for a discharge episode's PDF. */
  pdfUrl: (patientId: string, dischargeId: string) =>
    client.get<ApiResponse<{ url: string }>>(`/patients/${patientId}/discharge/${dischargeId}/pdf`)
      .then(r => r.data.data.url),
}
