// ── Enums ──────────────────────────────────────────────────────────────────────
export type Role = 'ADMIN' | 'BUSINESS_OWNER' | 'THERAPIST' | 'DOCTOR' | 'PATIENT' | 'PARENT'
export type Gender = 'MALE' | 'FEMALE' | 'OTHER'
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED'

// ── Auth ───────────────────────────────────────────────────────────────────────
export interface UserResponse {
  id: string
  orgId: string
  clinicId: string | null
  email: string
  firstName: string
  lastName: string
  phone: string | null
  dateOfBirth: string | null
  gender: Gender | null
  role: Role
  isActive: boolean
  createdAt: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
  user: UserResponse
}

export interface RegisterRequest {
  orgName: string
  slug: string
  firstName: string
  lastName: string
  email: string
  password: string
}

// ── Organisation ───────────────────────────────────────────────────────────────
export interface OrganisationResponse {
  id: string
  name: string
  slug: string
  contactEmail: string | null
  contactPhone: string | null
  address: string | null
  logoUrl: string | null
  timezone: string
  isActive: boolean
  createdAt: string
}

export interface UpdateOrganisationRequest {
  name?: string
  contactEmail?: string
  contactPhone?: string
  address?: string
  logoUrl?: string
  timezone?: string
}

// ── Clinic ─────────────────────────────────────────────────────────────────────
export interface ClinicResponse {
  id: string
  orgId: string
  name: string
  address: string | null
  phone: string | null
  email: string | null
  timezone: string
  isActive: boolean
  createdAt: string
}

export interface CreateClinicRequest {
  name: string
  address?: string
  phone?: string
  email?: string
  timezone?: string
}

// ── Patient ────────────────────────────────────────────────────────────────────
export interface ConditionSummary {
  id: string
  name: string
  diagnosedAt: string | null
  notes: string | null
}

export interface ParentSummary {
  id: string
  firstName: string
  lastName: string
  email: string
}

export interface TherapistSummary {
  id: string
  firstName: string
  lastName: string
  assignedAt: string
}

export interface PatientResponse {
  id: string
  orgId: string
  clinicId: string
  firstName: string
  lastName: string
  dateOfBirth: string | null
  gender: Gender | null
  notes: string | null
  isActive: boolean
  createdAt: string
  conditions: ConditionSummary[]
  parents: ParentSummary[]
  therapists: TherapistSummary[]
}

export interface CreatePatientRequest {
  clinicId: string
  firstName: string
  lastName: string
  dateOfBirth?: string
  gender?: Gender
  notes?: string
}

export interface AddConditionRequest {
  conditionId: string
  diagnosedAt?: string
  notes?: string
}

export interface LinkParentRequest {
  parentId: string
}

export interface AssignTherapistRequest {
  therapistId: string
}

// ── Invitation ─────────────────────────────────────────────────────────────────
export interface InviteRequest {
  email: string
  role: Role
  clinicId?: string
}

export interface InviteResponse {
  id: string
  email: string
  role: Role
  status: InvitationStatus
  expiresAt: string
  createdAt: string
}

export interface AcceptInviteRequest {
  token: string
  firstName: string
  lastName: string
  password: string
}

// ── Condition ──────────────────────────────────────────────────────────────────
export interface ConditionResponse {
  id: string
  name: string
  description: string | null
}

// ── API wrapper ────────────────────────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean
  message: string | null
  data: T
  timestamp: string
}
