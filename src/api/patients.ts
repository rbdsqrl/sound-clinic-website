import client from './client'
import type {
  ApiResponse,
  PatientResponse,
  CreatePatientRequest,
  AddConditionRequest,
  LinkParentRequest,
  InviteParentRequest,
  InviteParentResponse,
  AssignTherapistRequest,
  PatientStage,
  UpcomingBirthdayResponse,
} from '../types'

export const patientsApi = {
  list: () =>
    client.get<ApiResponse<PatientResponse[]>>('/patients').then((r) => r.data.data),

  myChildren: () =>
    client.get<ApiResponse<PatientResponse[]>>('/patients/my-children').then((r) => r.data.data),

  upcomingBirthdays: () =>
    client.get<ApiResponse<UpcomingBirthdayResponse[]>>('/patients/upcoming-birthdays').then((r) => r.data.data),

  get: (id: string) =>
    client.get<ApiResponse<PatientResponse>>(`/patients/${id}`).then((r) => r.data.data),

  create: (data: CreatePatientRequest) =>
    client.post<ApiResponse<PatientResponse>>('/patients', data).then((r) => r.data.data),

  update: (id: string, data: Partial<CreatePatientRequest>) =>
    client.patch<ApiResponse<PatientResponse>>(`/patients/${id}`, data).then((r) => r.data.data),

  updateStage: (id: string, stage: PatientStage) =>
    client.patch<ApiResponse<PatientResponse>>(`/patients/${id}/stage`, { stage }).then((r) => r.data.data),

  delete: (id: string) =>
    client.delete(`/patients/${id}`),

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

  /** Invites someone who doesn't have an account yet; auto-linked as this patient's parent on accept. */
  inviteParent: (id: string, data: InviteParentRequest) =>
    client.post<ApiResponse<InviteParentResponse>>(`/patients/${id}/parents/invite`, data).then((r) => r.data.data),

  // Therapists
  assignTherapist: (id: string, data: AssignTherapistRequest) =>
    client.post<ApiResponse<PatientResponse>>(`/patients/${id}/therapists`, data).then((r) => r.data.data),

  unassignTherapist: (id: string, therapistId: string) =>
    client.delete(`/patients/${id}/therapists/${therapistId}`),
}
