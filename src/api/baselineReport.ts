import client from './client'
import type {
  ApiResponse, BaselineReportResponse, BaselineProgressEntryResponse, BaselineDomain,
  CreateBaselineReportRequest, UpdateBaselineReportRequest, AddBaselineProgressRequest,
} from '../types'

export const baselineReportApi = {
  // Jackson is configured with NON_NULL, so when there's no report yet the backend omits `data`
  // from the payload entirely rather than sending it as `null` — normalise here so callers (and
  // React Query, which rejects `undefined` query data) see a real `null` instead.
  get: (patientId: string) =>
    client.get<ApiResponse<BaselineReportResponse | null>>(`/patients/${patientId}/baseline-report`)
      .then(r => r.data.data ?? null),

  create: (patientId: string, data: CreateBaselineReportRequest) =>
    client.post<ApiResponse<BaselineReportResponse>>(`/patients/${patientId}/baseline-report`, data)
      .then(r => r.data.data),

  update: (patientId: string, data: UpdateBaselineReportRequest) =>
    client.patch<ApiResponse<BaselineReportResponse>>(`/patients/${patientId}/baseline-report`, data)
      .then(r => r.data.data),

  addProgress: (patientId: string, domain: BaselineDomain, data: AddBaselineProgressRequest) =>
    client.post<ApiResponse<BaselineProgressEntryResponse>>(
      `/patients/${patientId}/baseline-report/domains/${domain}/progress`, data,
    ).then(r => r.data.data),

  listProgress: (patientId: string, domain: BaselineDomain) =>
    client.get<ApiResponse<BaselineProgressEntryResponse[]>>(
      `/patients/${patientId}/baseline-report/domains/${domain}/progress`,
    ).then(r => r.data.data),
}
