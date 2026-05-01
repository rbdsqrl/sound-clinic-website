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
  additionalRoles: Role[]
  isActive: boolean
  createdAt: string
}

/** All roles this user holds (primary + additional). */
export function allRoles(user: UserResponse): Role[] {
  return [user.role, ...user.additionalRoles.filter(r => r !== user.role)]
}

export function hasRole(user: UserResponse, role: Role): boolean {
  return user.role === role || user.additionalRoles.includes(role)
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
  acceptLink?: string
  clinicName?: string
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

// ── Appointments ───────────────────────────────────────────────────────────────
export type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED'

/** ISO day-of-week names Java uses (DayOfWeek.name()) */
export type DayOfWeek = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY'

export interface SlotResponse {
  id: string
  therapistId: string
  therapistFirstName: string
  therapistLastName: string
  clinicId: string
  clinicName: string
  dayOfWeek: DayOfWeek
  startTime: string   // "HH:mm:ss"
  endTime: string     // "HH:mm:ss"
  slotDurationMinutes: number
}

export interface CreateSlotRequest {
  therapistId: string
  clinicId: string
  dayOfWeek: DayOfWeek
  startTime: string   // "HH:mm"
  endTime: string     // "HH:mm"
  slotDurationMinutes: number
}

export interface AppointmentResponse {
  id: string
  patientId: string
  patientFirstName: string
  patientLastName: string
  therapistId: string
  therapistFirstName: string
  therapistLastName: string
  clinicId: string
  clinicName: string
  appointmentDate: string   // "YYYY-MM-DD"
  startTime: string         // "HH:mm:ss"
  endTime: string           // "HH:mm:ss"
  status: AppointmentStatus
  notes: string | null
  bookedBy: string
  createdAt: string
}

export interface BookAppointmentRequest {
  patientId: string
  therapistId: string
  appointmentDate: string   // "YYYY-MM-DD"
  startTime: string         // "HH:mm"
  notes?: string
}

export interface UpdateAppointmentStatusRequest {
  status: AppointmentStatus
}

// ── API wrapper ────────────────────────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean
  message: string | null
  data: T
  timestamp: string
}
