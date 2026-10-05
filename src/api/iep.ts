import client from './client'
import type {
  ApiResponse, IEPPlanResponse, IEPGoalResponse, ImportResultResponse,
  CreateIEPPlanRequest, CreateIEPGoalRequest, UpdateIEPGoalRequest,
  AddProgressRequest, IEPGoalProgressResponse, GoalPacingResponse,
} from '../types'

export const iepApi = {
  /** How the plan's active goals are spread across the upcoming sessions of its linked therapy. */
  pacing: (planId: string) =>
    client.get<ApiResponse<GoalPacingResponse>>(`/iep/${planId}/pacing`).then(r => r.data.data),

  /** Re-spread the active goals and set their target dates to the suggested ones. */
  applyPacing: (planId: string) =>
    client.post<ApiResponse<GoalPacingResponse>>(`/iep/${planId}/pacing/apply`).then(r => r.data.data),

  listPlans: (patientId: string) =>
    client.get<ApiResponse<IEPPlanResponse[]>>('/iep', { params: { patientId } })
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

  updatePlan: (planId: string, data: Partial<{ title: string; startDate: string; endDate: string; tags: string[]; status: string; therapistId: string; enrollmentId: string; unlinkEnrollment: boolean }>) =>
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
}
