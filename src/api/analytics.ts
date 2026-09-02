import client from './client'
import type {
  ActivityProgressResponse, AnalyticsBucket, AnalyticsTotals, ApiResponse, CaseloadResponse,
  CaseSummaryResponse, DomainSeries, EngagementOverviewResponse, FrequencyResponse, Granularity,
  IEPGoalDomain, MemberSummaryResponse, OrgSnapshotResponse, ScheduleResponse, SuccessCriteriaResponse,
  TimeSeriesResponse, TrendPoint,
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
export const num = (v: number | null | undefined): number | null => (v === undefined ? null : v)

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

  /** Activity assignment/attempt counts for one patient — additive to patientProgress. */
  patientActivityProgress: (patientId: string, from: string, to: string) =>
    client
      .get<ApiResponse<ActivityProgressResponse>>(`/analytics/patients/${patientId}/activities`, { params: { from, to } })
      .then(r => r.data.data),

  /** Org-wide clinical-outcome rollup — avg therapy duration, program breakdown, admission→discharge funnel. */
  orgSnapshot: () =>
    client.get<ApiResponse<OrgSnapshotResponse>>('/analytics/snapshot').then(r => r.data.data),

  /** Session cadence for one patient, folded across every concurrent enrollment. */
  patientFrequency: (patientId: string, from: string, to: string) =>
    client
      .get<ApiResponse<FrequencyResponse>>(`/analytics/patients/${patientId}/frequency`, { params: { from, to } })
      .then(r => r.data.data),

  /** Org-wide engagement rollup for the Overview analytics tab. */
  engagementOverview: (from: string, to: string) =>
    client
      .get<ApiResponse<EngagementOverviewResponse>>('/analytics/engagement-overview', { params: { from, to } })
      .then(r => ({ ...r.data.data, avgSessionDurationMinutes: num(r.data.data.avgSessionDurationMinutes) })),

  /** Session count per day in the window — powers the calendar heatmap. */
  sessionHeatmap: (from: string, to: string) =>
    client
      .get<ApiResponse<TrendPoint[]>>('/analytics/session-heatmap', { params: { from, to } })
      .then(r => r.data.data),

  /** One row per active patient for the Cases analytics tab. */
  cases: (from: string, to: string) =>
    client
      .get<ApiResponse<CaseSummaryResponse[]>>('/analytics/cases', { params: { from, to } })
      .then(r => r.data.data),

  /** One row per therapist — cases/activities assigned, activities created, sessions cancelled, IEP plans. */
  members: (from: string, to: string) =>
    client
      .get<ApiResponse<MemberSummaryResponse[]>>('/analytics/members', { params: { from, to } })
      .then(r => r.data.data),

  /** Flat session log + KPI strip for the Schedule tab. All filters optional. */
  schedule: (from: string, to: string, filters?: { patientId?: string; therapistId?: string; programId?: string }) =>
    client
      .get<ApiResponse<ScheduleResponse>>('/analytics/sessions', { params: { from, to, ...filters } })
      .then(r => {
        const d = r.data.data
        return {
          ...d,
          cancelledPct: num(d.cancelledPct),
          rescheduledPct: num(d.rescheduledPct),
          attendancePct: num(d.attendancePct),
          avgDurationMinutes: num(d.avgDurationMinutes),
        }
      }),

  /** Discharge success-criteria composite for one enrollment. */
  successCriteria: (enrollmentId: string) =>
    client
      .get<ApiResponse<SuccessCriteriaResponse>>(`/analytics/enrollments/${enrollmentId}/success-criteria`)
      .then(r => {
        const d = r.data.data
        return {
          ...d,
          goalMasteryPct: num(d.goalMasteryPct),
          goalMasteryMet: d.goalMasteryMet ?? null,
          parentSatisfactionPct: num(d.parentSatisfactionPct),
          parentSatisfactionMet: d.parentSatisfactionMet ?? null,
        }
      }),
}
