import client from './client'
import type {
  ApiResponse, BaselineReportResponse, BaselineProgressEntryResponse, BaselineDomain,
  CreateBaselineReportRequest, UpdateBaselineReportRequest, AddBaselineProgressRequest,
} from '../types'

// Jackson is configured with NON_NULL, so a null `scorePercent`/`baselineScorePercent` (and a
// null top-level `data` when no report exists yet) is omitted from the payload entirely rather
// than sent as `null` — normalise once here so callers, and components checking `=== null`,
// don't have to treat `undefined` and `null` as different things.
const normaliseEntry = (e: BaselineProgressEntryResponse): BaselineProgressEntryResponse =>
  ({ ...e, scorePercent: e.scorePercent ?? null })

const normaliseReport = (r: BaselineReportResponse): BaselineReportResponse => ({
  ...r,
  domains: r.domains.map(d => ({
    ...d,
    baselineScorePercent: d.baselineScorePercent ?? null,
    currentEntries: d.currentEntries.map(normaliseEntry),
  })),
})

export const baselineReportApi = {
  get: (patientId: string) =>
    client.get<ApiResponse<BaselineReportResponse | null>>(`/patients/${patientId}/baseline-report`)
      .then(r => r.data.data ? normaliseReport(r.data.data) : null),

  create: (patientId: string, data: CreateBaselineReportRequest) =>
    client.post<ApiResponse<BaselineReportResponse>>(`/patients/${patientId}/baseline-report`, data)
      .then(r => normaliseReport(r.data.data)),

  update: (patientId: string, data: UpdateBaselineReportRequest) =>
    client.patch<ApiResponse<BaselineReportResponse>>(`/patients/${patientId}/baseline-report`, data)
      .then(r => normaliseReport(r.data.data)),

  addProgress: (patientId: string, domain: BaselineDomain, data: AddBaselineProgressRequest) =>
    client.post<ApiResponse<BaselineProgressEntryResponse>>(
      `/patients/${patientId}/baseline-report/domains/${domain}/progress`, data,
    ).then(r => normaliseEntry(r.data.data)),
}
