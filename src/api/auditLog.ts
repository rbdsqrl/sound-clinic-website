import client from './client'
import type { ApiResponse, AuditLogEntryResponse } from '../types'

export type AuditSubjectType = 'USER' | 'CASE'

export const auditLogApi = {
  /** Newest first. Business Owner only — a member, parent (USER) or case (CASE) activity log. */
  list: (subjectType: AuditSubjectType, subjectId: string) =>
    client.get<ApiResponse<AuditLogEntryResponse[]>>('/audit-log', { params: { subjectType, subjectId } })
      .then(r => r.data.data),
}
