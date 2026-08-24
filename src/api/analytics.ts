import client from './client'
import type {
  ActivityProgressResponse, AnalyticsBucket, AnalyticsTotals, ApiResponse, CaseloadResponse,
  DomainSeries, Granularity, IEPGoalDomain, TimeSeriesResponse,
} from '../types'

export interface AnalyticsWindow {
  granularity: Granularity
  from: string          // yyyy-MM-dd
  to: string            // yyyy-MM-dd
  domain?: IEPGoalDomain
}

/**
 * Jackson is configured with NON_NULL, so a null metric is omitted from the payload rather
 * than sent as null. Left alone that turns "not logged" into `undefined`, and every consumer
 * would have to guard both. Normalising once here keeps the components checking one thing.
 */
const num = (v: number | null | undefined): number | null => (v === undefined ? null : v)

const normaliseBucket = (b: AnalyticsBucket): AnalyticsBucket => ({
  ...b,
  masteryPct:          num(b.masteryPct),
  avgPerformanceScore: num(b.avgPerformanceScore),
  avgParentRating:     num(b.avgParentRating),
})

const normaliseDomain = (d: DomainSeries): DomainSeries => ({
  ...d,
  masteryPct: (d.masteryPct ?? []).map(num),
  current:    num(d.current),
  deltaPts:   num(d.deltaPts),
})

const normaliseTotals = (t: AnalyticsTotals): AnalyticsTotals => ({
  ...t,
  masteryPct:          num(t.masteryPct),
  masteryDeltaPts:     num(t.masteryDeltaPts),
  coveragePct:         num(t.coveragePct),
  avgPerformanceScore: num(t.avgPerformanceScore),
  avgParentRating:     num(t.avgParentRating),
})

const normaliseSeries = (s: TimeSeriesResponse): TimeSeriesResponse => ({
  ...s,
  buckets: (s.buckets ?? []).map(normaliseBucket),
  domains: (s.domains ?? []).map(normaliseDomain),
  totals:  normaliseTotals(s.totals),
})

export const analyticsApi = {
  /** One child's progress series, with the per-domain breakdown for the small multiples. */
  patientProgress: (patientId: string, params: AnalyticsWindow) =>
    client
      .get<ApiResponse<TimeSeriesResponse>>(`/analytics/patients/${patientId}/progress`, { params })
      .then(r => normaliseSeries(r.data.data)),

  /** A therapist's series plus a row per patient on their caseload. */
  therapistCaseload: (therapistId: string, params: AnalyticsWindow): Promise<CaseloadResponse> =>
    client
      .get<ApiResponse<CaseloadResponse>>(`/analytics/therapists/${therapistId}/caseload`, { params })
      .then(r => {
        const d = r.data.data
        return {
          ...d,
          series: normaliseSeries(d.series),
          patients: (d.patients ?? []).map(p => ({
            ...p,
            masteryPct:  num(p.masteryPct),
            deltaPts:    num(p.deltaPts),
            coveragePct: num(p.coveragePct),
            spark:       (p.spark ?? []).map(num),
          })),
        }
      }),

  /** Organisation rollup. The API rejects DAILY here — weekly or monthly only. */
  overview: (params: AnalyticsWindow) =>
    client
      .get<ApiResponse<TimeSeriesResponse>>('/analytics/overview', { params })
      .then(r => normaliseSeries(r.data.data)),

  /** Activity assignment/attempt counts for one patient — additive to patientProgress. */
  patientActivityProgress: (patientId: string, from: string, to: string) =>
    client
      .get<ApiResponse<ActivityProgressResponse>>(`/analytics/patients/${patientId}/activities`, { params: { from, to } })
      .then(r => r.data.data),
}
