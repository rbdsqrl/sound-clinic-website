// ── Enums ──────────────────────────────────────────────────────────────────────
export type Role = 'ADMIN' | 'OFFICE_ADMIN' | 'BUSINESS_OWNER' | 'THERAPIST' | 'DOCTOR' | 'PATIENT' | 'PARENT'
export type Gender = 'MALE' | 'FEMALE' | 'OTHER'
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED'
export type InquiryStatus =
  | 'NEW'
  | 'ATTEMPTED_CONTACT'
  | 'CONTACTED'
  | 'CONSULTATION_SCHEDULED'
  | 'VISITED'
  | 'CONVERTED'
  | 'DISCONTINUED'
  | 'DROPPED'
export type PreferredTime = 'MORNING' | 'AFTERNOON' | 'EVENING'
export type PatientStage =
  | 'INQUIRY_CONVERTED'
  | 'PRE_ASSESSMENT'
  | 'ASSESSMENT_DONE'
  | 'ENROLLMENT'
  | 'ENROLLED'
  | 'THERAPY_ACTIVE'
  | 'DISCHARGED'

// ── Inquiry ────────────────────────────────────────────────────────────────────
export interface InquiryResponse {
  id: string
  orgId: string | null
  name: string
  email: string | null
  phone: string
  reason: string | null
  preferredTime: PreferredTime | null
  status: InquiryStatus
  adminNotes: string | null
  appointmentDate: string | null
  appointmentNotes: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateInquiryRequest {
  name: string
  email?: string
  phone: string
  reason?: string
  preferredTime?: PreferredTime
  orgId?: string
}

export interface UpdateInquiryRequest {
  status?: InquiryStatus
  adminNotes?: string
  appointmentDate?: string        // ISO string — set appointment
  appointmentNotes?: string
  clearAppointment?: boolean      // explicitly clear appointment
}

export type InquiryLogType =
  | 'CALL'
  | 'EMAIL'
  | 'WHATSAPP'
  | 'NOTE'
  | 'APPOINTMENT_SCHEDULED'
  | 'APPOINTMENT_CANCELLED'
  | 'STATUS_CHANGED'
  | 'CONVERTED'

export interface InquiryLogResponse {
  id: string
  inquiryId: string
  logType: InquiryLogType
  notes: string | null
  createdBy: string | null
  createdByName: string | null
  createdAt: string
}

export interface CreateInquiryLogRequest {
  logType: InquiryLogType
  notes?: string
}

export interface ConvertInquiryRequest {
  firstName: string
  lastName: string
  clinicId: string
  linkedUserEmail?: string
  linkedUserFirstName?: string
  linkedUserLastName?: string
  linkedUserRole?: 'PARENT' | 'PATIENT'
}

export interface ConvertInquiryResponse {
  patientId: string
  patientName: string
  linkedUserInviteLink?: string | null
}

export interface InquiryAnalyticsResponse {
  totalCount: number
  convertedCount: number
  conversionRate: number          // e.g. 23.5 (%)
  avgResponseTimeHours: number | null
  overdueCount: number
  readyToConvertCount: number
  countByStatus: Partial<Record<InquiryStatus, number>>
}

export type InquiryActionOutcome =
  | 'NO_ANSWER'
  | 'SPOKE_NO_PROGRESS'
  | 'APPOINTMENT_BOOKED'
  | 'REMINDER_SENT'
  | 'VISITED'
  | 'NO_SHOW'
  | 'CANCELLED'
  | 'SCHEDULE_FOLLOWUP'
  | 'DROPPED'
  | 'REOPEN'

export interface NextActionRequest {
  outcome: InquiryActionOutcome
  notes?: string
  appointmentDate?: string    // ISO — required for APPOINTMENT_BOOKED / SCHEDULE_FOLLOWUP
  appointmentNotes?: string
}

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
  stage: PatientStage
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

export interface UpcomingBirthdayResponse {
  id: string
  firstName: string
  lastName: string
  dateOfBirth: string
  daysUntil: number
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

export interface InvitePreviewResponse {
  email: string
  role: Role
  orgName: string
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

// ── Leave ──────────────────────────────────────────────────────────────────────
export type LeaveType   = 'FULL_DAY' | 'HALF_DAY'
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface LeaveResponse {
  id: string
  therapistId: string
  therapistFirstName: string
  therapistLastName: string
  leaveDate: string        // "YYYY-MM-DD"
  leaveType: LeaveType
  reason: string | null
  status: LeaveStatus
  reviewedBy: string | null
  reviewedByFirstName: string | null
  reviewedByLastName: string | null
  reviewedAt: string | null
  createdAt: string
}

export interface CreateLeaveRequest {
  leaveDate: string        // "YYYY-MM-DD"
  leaveType: LeaveType
  reason?: string
}

export interface ReviewLeaveRequest {
  status: 'APPROVED' | 'REJECTED'
}

// ── Enrollments ────────────────────────────────────────────────────────────────
export type EnrollmentStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED'

export interface EnrollmentResponse {
  id: string
  subscriptionId: string
  patientId: string
  therapistId: string
  therapistFirstName: string
  therapistLastName: string
  programName: string
  sessionDurationMinutes: number
  startDate: string        // "YYYY-MM-DD"
  dayOfWeek: DayOfWeek
  startTime: string        // "HH:mm:ss"
  status: EnrollmentStatus
  sessionsCompleted: number
  totalSessions: number
  createdAt: string
}

export interface CreateEnrollmentRequest {
  subscriptionId: string
  patientId: string
  therapistId: string
  sessionDurationMinutes: number
  startDate: string        // "YYYY-MM-DD"
  startTime: string        // "HH:mm"
}

export interface AvailableTherapistResponse {
  userId: string
  firstName: string
  lastName: string
  clinicId: string
  clinicName: string
}

export interface AvailableTherapistsQuery {
  startTime: string        // "HH:mm"
  durationMinutes: number
  startDate: string        // "YYYY-MM-DD"
}

// ── Therapy Sessions ───────────────────────────────────────────────────────────
export type TherapySessionStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW' | 'PENDING_RESCHEDULE' | 'CANCELLATION_REQUESTED'
export type RescheduleReason = 'THERAPIST_LEAVE' | 'PUBLIC_HOLIDAY' | 'PARENT_REQUEST'

export interface TherapySessionResponse {
  id: string
  enrollmentId: string
  patientId: string
  patientFirstName: string
  patientLastName: string
  therapistId: string
  therapistFirstName: string
  therapistLastName: string
  programName: string
  sessionNumber: number
  totalSessions: number
  sessionDate: string      // "YYYY-MM-DD"
  startTime: string        // "HH:mm:ss"
  endTime: string          // "HH:mm:ss"
  status: TherapySessionStatus
  notes: string | null
  feedback: string | null
  progressReport: string | null
  performanceScore: number | null  // 1–5
  completedAt: string | null
  rescheduleReason: RescheduleReason | null
}

export interface UpdateSessionStatusRequest {
  status: TherapySessionStatus
  notes?: string
}

export interface UpdateSessionNotesRequest {
  feedback?: string
  progressReport?: string
  notes?: string
  performanceScore?: number  // 1–5
}

export interface RescheduleSessionRequest {
  newDate?: string           // "YYYY-MM-DD"
  substituteTherapistId?: string
}

export interface SessionAttachmentResponse {
  id: string
  sessionId: string
  therapistId: string
  fileName: string
  fileUrl: string
  contentType: string | null
  fileSizeBytes: number
  createdAt: string
}

// ── Subscriptions ──────────────────────────────────────────────────────────────
export type SubscriptionPaymentStatus = 'PENDING' | 'PARTIAL' | 'PAID'
export type SubscriptionStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED'

export interface SubscriptionResponse {
  id: string
  patientId: string
  programId: string
  programName: string
  numSessions: number
  perSessionCost: number
  discountPercent: number
  amountPaid: number
  totalAmount: number
  paymentStatus: SubscriptionPaymentStatus
  status: SubscriptionStatus
  paymentNotes: string | null
  notes: string | null
  createdAt: string
}

export interface CreateSubscriptionRequest {
  patientId: string
  programId: string
  numSessions: number
  notes?: string
}

export interface UpdatePaymentRequest {
  discountPercent: number
  amountPaid: number
  paymentNotes?: string
}

// ── Programs ───────────────────────────────────────────────────────────────────
export interface ProgramResponse {
  id: string
  orgId: string
  name: string
  perSessionCost: number
  isActive: boolean
  createdAt: string
}

export interface CreateProgramRequest {
  name: string
  perSessionCost: number
}

export interface UpdateProgramRequest {
  name?: string
  perSessionCost?: number
  isActive?: boolean
}

// ── Tasks ──────────────────────────────────────────────────────────────────────
export type TaskStatus   = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH'

export interface TaskAssignee {
  id: string
  firstName: string
  lastName: string
}

export interface TaskResponse {
  id: string
  orgId: string
  title: string
  description: string | null
  assignees: TaskAssignee[]
  assignedBy: string
  assignedByFirstName: string
  assignedByLastName: string
  dueDate: string | null      // "YYYY-MM-DD"
  priority: TaskPriority
  status: TaskStatus
  commentCount: number
  attachmentCount: number
  createdAt: string
  updatedAt: string
}

export interface CreateTaskRequest {
  title: string
  description?: string
  assignedTo: string[]        // array of user IDs
  dueDate?: string            // "YYYY-MM-DD"
  priority?: TaskPriority
}

export interface UpdateTaskRequest {
  title?: string
  description?: string
  assignedTo?: string[]
  dueDate?: string
  priority?: TaskPriority
}

export interface UpdateTaskStatusRequest {
  status: TaskStatus
}

export interface TaskCommentResponse {
  id: string
  taskId: string
  authorId: string
  authorFirstName: string
  authorLastName: string
  body: string
  createdAt: string
}

export interface TaskAttachmentResponse {
  id: string
  taskId: string
  uploadedBy: string
  uploadedByFirstName: string
  uploadedByLastName: string
  fileName: string
  fileUrl: string
  contentType: string | null
  fileSizeBytes: number
  createdAt: string
}

// ── Public Holidays ────────────────────────────────────────────────────────────
export interface PublicHolidayResponse {
  id: string
  orgId: string
  holidayDate: string    // "YYYY-MM-DD"
  name: string
  sessionsAffected: number
}

export interface CreatePublicHolidayRequest {
  holidayDate: string    // "YYYY-MM-DD"
  name: string
}

// ── API wrapper ────────────────────────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean
  message: string | null
  data: T
  timestamp: string
}
