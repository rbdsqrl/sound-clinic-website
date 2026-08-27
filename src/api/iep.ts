import client from './client'
import type {
  ApiResponse, IEPPlanResponse, IEPGoalResponse, ImportResultResponse,
  CreateIEPPlanRequest, CreateIEPGoalRequest, UpdateIEPGoalRequest,
  AddProgressRequest, IEPGoalProgressResponse,
} from '../types'

export const iepApi = {
  listPlans: (patientId: string) =>
    client.get<ApiResponse<IEPPlanResponse[]>>('/iep', { params: { patientId } })
      .then(r => r.data.data),

  listAllPlans: () =>
    client.get<ApiResponse<IEPPlanResponse[]>>('/iep')
      .then(r => r.data.data),

  createPlan: (patientId: string, data: CreateIEPPlanRequest) =>
    client.post<ApiResponse<IEPPlanResponse>>('/iep', data, { params: { patientId } })
      .then(r => r.data.data),

  importCsv: (patientId: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return client.post<ApiResponse<ImportResultResponse>>('/iep/import', form, {
      params: { patientId },
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data.data)
  },

  updatePlan: (planId: string, data: Partial<{ title: string; startDate: string; endDate: string; tags: string[]; status: string; therapistId: string }>) =>
    client.patch<ApiResponse<IEPPlanResponse>>(`/iep/${planId}`, data).then(r => r.data.data),

  deletePlan: (planId: string) =>
    client.delete(`/iep/${planId}`),

  addGoal: (planId: string, data: CreateIEPGoalRequest) =>
    client.post<ApiResponse<IEPGoalResponse>>(`/iep/${planId}/goals`, data).then(r => r.data.data),

  updateGoal: (goalId: string, data: UpdateIEPGoalRequest) =>
    client.patch<ApiResponse<IEPGoalResponse>>(`/iep/goals/${goalId}`, data).then(r => r.data.data),

  deleteGoal: (goalId: string) =>
    client.delete(`/iep/goals/${goalId}`),

  addProgress: (goalId: string, data: AddProgressRequest) =>
    client.post<ApiResponse<IEPGoalResponse>>(`/iep/goals/${goalId}/progress`, data).then(r => r.data.data),

  listProgress: (goalId: string) =>
    client.get<ApiResponse<IEPGoalProgressResponse[]>>(`/iep/goals/${goalId}/progress`).then(r => r.data.data),

  sampleCsvUrl: () => '/api/v1/iep/sample-csv',
}
