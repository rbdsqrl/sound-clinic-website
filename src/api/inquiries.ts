import client from './client'
import type {
  ApiResponse,
  InquiryResponse,
  InquiryLogResponse,
  InquiryAnalyticsResponse,
  CreateInquiryRequest,
  UpdateInquiryRequest,
  CreateInquiryLogRequest,
  ConvertInquiryRequest,
  ConvertInquiryResponse,
  NextActionRequest,
  InquiryStatus,
} from '../types'

import { publicClient } from './client'

export const inquiriesApi = {
  /** Submit an inquiry from the public landing page (no auth) */
  submit: (data: CreateInquiryRequest) =>
    publicClient.post<ApiResponse<InquiryResponse>>('/inquiries', data).then(r => r.data.data),

  /** List inquiries — OFFICE_ADMIN / ADMIN / BUSINESS_OWNER */
  list: (status?: InquiryStatus) =>
    client.get<ApiResponse<InquiryResponse[]>>('/inquiries', {
      params: status ? { status } : {},
    }).then(r => r.data.data),

  /** Update inquiry status, notes, and/or appointment */
  update: (id: string, data: UpdateInquiryRequest) =>
    client.patch<ApiResponse<InquiryResponse>>(`/inquiries/${id}`, data).then(r => r.data.data),

  /** Get all activity log entries for an inquiry */
  getLogs: (id: string) =>
    client.get<ApiResponse<InquiryLogResponse[]>>(`/inquiries/${id}/logs`).then(r => r.data.data),

  /** Add a manual activity log entry */
  addLog: (id: string, data: CreateInquiryLogRequest) =>
    client.post<ApiResponse<InquiryLogResponse>>(`/inquiries/${id}/logs`, data).then(r => r.data.data),

  /** Convert inquiry to a patient record */
  convert: (id: string, data: ConvertInquiryRequest) =>
    client.post<ApiResponse<ConvertInquiryResponse>>(`/inquiries/${id}/convert`, data).then(r => r.data.data),

  /** Execute a next-action transition (state machine) */
  nextAction: (id: string, data: NextActionRequest) =>
    client.post<ApiResponse<InquiryResponse>>(`/inquiries/${id}/next-action`, data).then(r => r.data.data),

  /** Aggregated analytics for the inquiries dashboard */
  getAnalytics: () =>
    client.get<ApiResponse<InquiryAnalyticsResponse>>('/inquiries/analytics').then(r => r.data.data),
}
