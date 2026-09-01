import client from './client'
import type {
  ApiResponse,
  AssessmentType,
  AssessmentDefinitionResponse,
  CreateAssessmentRequest,
  PatientAssessmentResponse,
} from '../types'

export const assessmentsApi = {
  /** The category/item/option definition for an assessment type */
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

  /** Upload a file for a FILE-type item and get back a URL to submit in the fill */
  uploadFile: (patientId: string, type: AssessmentType, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return client.post<ApiResponse<{ url: string }>>(
      `/patients/${patientId}/assessments/${type}/upload`, fd,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    ).then(r => r.data.data.url)
  },

  /** Get a download URL for one filled assessment's PDF, laid out like the paper form */
  pdfUrl: (patientId: string, type: AssessmentType, assessmentId: string) =>
    client.get<ApiResponse<{ url: string }>>(
      `/patients/${patientId}/assessments/${type}/${assessmentId}/pdf`,
    ).then(r => r.data.data.url),
}
