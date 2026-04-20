import client from './client'
import type {
  ApiResponse,
  PatientResponse,
  CreatePatientRequest,
  AddConditionRequest,
  LinkParentRequest,
  AssignTherapistRequest,
} from '../types'

export const patientsApi = {
  list: () =>
    client.get<ApiResponse<PatientResponse[]>>('/patients').then((r) => r.data.data),

  get: (id: string) =>
    client.get<ApiResponse<PatientResponse>>(`/patients/${id}`).then((r) => r.data.data),

  create: (data: CreatePatientRequest) =>
    client.post<ApiResponse<PatientResponse>>('/patients', data).then((r) => r.data.data),

  update: (id: string, data: Partial<CreatePatientRequest>) =>
    client.patch<ApiResponse<PatientResponse>>(`/patients/${id}`, data).then((r) => r.data.data),

  // Conditions
  addCondition: (id: string, data: AddConditionRequest) =>
    client.post<ApiResponse<PatientResponse>>(`/patients/${id}/conditions`, data).then((r) => r.data.data),

  removeCondition: (id: string, conditionId: string) =>
    client.delete(`/patients/${id}/conditions/${conditionId}`),

  // Parents
  linkParent: (id: string, data: LinkParentRequest) =>
    client.post<ApiResponse<PatientResponse>>(`/patients/${id}/parents`, data).then((r) => r.data.data),

  unlinkParent: (id: string, parentId: string) =>
    client.delete(`/patients/${id}/parents/${parentId}`),

  // Therapists
  assignTherapist: (id: string, data: AssignTherapistRequest) =>
    client.post<ApiResponse<PatientResponse>>(`/patients/${id}/therapists`, data).then((r) => r.data.data),

  unassignTherapist: (id: string, therapistId: string) =>
    client.delete(`/patients/${id}/therapists/${therapistId}`),
}
