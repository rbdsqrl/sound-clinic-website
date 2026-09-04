import client from './client'
import type {
  ApiResponse,
  PagedResponse,
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

export interface PatientSearchParams {
  page?: number
  size?: number
  search?: string
  /** Scope to patients assigned to the caller. Always on server-side for THERAPIST regardless of this. */
  mine?: boolean
  /** Comma-separated subset of ACTIVE,INACTIVE (Active = not discharged, Inactive = stage DISCHARGED). Omit for the default (ACTIVE); pass '' to include every status. */
  status?: string
  /** Returns parents/therapists as id-only stubs (blank name/email) — pass true when the caller only reads .length, not names. */
  compact?: boolean
}

export const patientsApi = {
  /** Every patient in the org — for pickers/dashboards that need the full list, not a page of it. */
  list: () =>
    client.get<ApiResponse<PagedResponse<PatientResponse>>>('/patients', { params: { size: 1000, status: '' } })
      .then((r) => r.data.data.content),

  /** Paginated, filtered Cases list — powers the Cases page. Defaults to newest-joined first. */
  search: (params: PatientSearchParams = {}) =>
    client.get<ApiResponse<PagedResponse<PatientResponse>>>('/patients', { params })
      .then((r) => r.data.data),

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

  /** Grants an existing org member (e.g. a Therapist) Parent access to this patient —
   *  confirms the `existingUser` an inviteParent call returned instead of an invite link. */
  linkExistingUserAsParent: (id: string, data: LinkParentRequest) =>
    client.post<ApiResponse<PatientResponse>>(`/patients/${id}/parents/link-existing-user`, data).then((r) => r.data.data),

  /** Invites someone who doesn't have an account yet; auto-linked as this patient's parent on accept. */
  inviteParent: (id: string, data: InviteParentRequest) =>
    client.post<ApiResponse<InviteParentResponse>>(`/patients/${id}/parents/invite`, data).then((r) => r.data.data),

  // Therapists
  assignTherapist: (id: string, data: AssignTherapistRequest) =>
    client.post<ApiResponse<PatientResponse>>(`/patients/${id}/therapists`, data).then((r) => r.data.data),

  unassignTherapist: (id: string, therapistId: string) =>
    client.delete(`/patients/${id}/therapists/${therapistId}`),
}
