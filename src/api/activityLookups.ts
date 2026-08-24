import client from './client'
import type { ApiResponse, SkillResponse, LanguageResponse, PropResponse } from '../types'

export const skillsApi = {
  list: () => client.get<ApiResponse<SkillResponse[]>>('/activities/skills').then((r) => r.data.data),
  create: (name: string) => client.post<ApiResponse<SkillResponse>>('/activities/skills', { name }).then((r) => r.data.data),
  delete: (id: string) => client.delete<ApiResponse<void>>(`/activities/skills/${id}`).then((r) => r.data),
}

export const languagesApi = {
  list: () => client.get<ApiResponse<LanguageResponse[]>>('/activities/languages').then((r) => r.data.data),
  create: (name: string) => client.post<ApiResponse<LanguageResponse>>('/activities/languages', { name }).then((r) => r.data.data),
  delete: (id: string) => client.delete<ApiResponse<void>>(`/activities/languages/${id}`).then((r) => r.data),
}

export const propsApi = {
  list: () => client.get<ApiResponse<PropResponse[]>>('/activities/props').then((r) => r.data.data),
  create: (name: string) => client.post<ApiResponse<PropResponse>>('/activities/props', { name }).then((r) => r.data.data),
  delete: (id: string) => client.delete<ApiResponse<void>>(`/activities/props/${id}`).then((r) => r.data),
}
