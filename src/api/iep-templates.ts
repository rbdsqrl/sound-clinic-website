import client from './client'
import type {
  ApiResponse,
  IEPTemplateResponse,
  CreateIEPTemplateRequest,
  CreateIEPTemplateGoalRequest,
} from '../types'

export const iepTemplatesApi = {
  list: () =>
    client.get<ApiResponse<IEPTemplateResponse[]>>('/iep/templates').then(r => r.data.data),
  create: (data: CreateIEPTemplateRequest) =>
    client.post<ApiResponse<IEPTemplateResponse>>('/iep/templates', data).then(r => r.data.data),
  update: (id: string, data: Partial<CreateIEPTemplateRequest>) =>
    client.patch<ApiResponse<IEPTemplateResponse>>(`/iep/templates/${id}`, data).then(r => r.data.data),
  delete: (id: string) =>
    client.delete(`/iep/templates/${id}`),
  addGoal: (templateId: string, data: CreateIEPTemplateGoalRequest) =>
    client.post<ApiResponse<IEPTemplateResponse>>(`/iep/templates/${templateId}/goals`, data).then(r => r.data.data),
  deleteGoal: (goalId: string) =>
    client.delete(`/iep/templates/goals/${goalId}`),
}
