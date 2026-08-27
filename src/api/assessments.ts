import client from './client'
import type {
  ApiResponse,
  AssessmentType,
  AssessmentDefinitionResponse,
  CreateAssessmentRequest,
  PatientAssessmentResponse,
} from '../types'

export const assessmentsApi = {
  /** The fixed item/section definition for ISAA or PRBA */
  getDefinition: (patientId: string, type: AssessmentType) =>
    client.get<ApiResponse<AssessmentDefinitionResponse>>(
      `/patients/${patientId}/assessments/${type}/definition`,
    ).then(r => r.data.data),

  /** A patient's fills of this assessment, oldest first */
  list: (patientId: string, type: AssessmentType) =>
    client.get<ApiResponse<PatientAssessmentResponse[]>>(
      `/patients/${patientId}/assessments/${type}`,
    ).then(r => r.data.data),

  /** Record a new fill */
  create: (patientId: string, type: AssessmentType, data: CreateAssessmentRequest) =>
    client.post<ApiResponse<PatientAssessmentResponse>>(
      `/patients/${patientId}/assessments/${type}`,
      data,
    ).then(r => r.data.data),

  /** Get a download URL for one filled assessment's PDF, laid out like the paper form */
  pdfUrl: (patientId: string, type: AssessmentType, assessmentId: string) =>
    client.get<ApiResponse<{ url: string }>>(
      `/patients/${patientId}/assessments/${type}/${assessmentId}/pdf`,
    ).then(r => r.data.data.url),
}
