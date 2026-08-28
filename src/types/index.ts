// ── Enums ──────────────────────────────────────────────────────────────────────
export type Role = 'CLINIC_HEAD' | 'BUSINESS_OWNER' | 'THERAPIST' | 'DOCTOR' | 'PATIENT' | 'PARENT'
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

/** How an inquiry reached the clinic. */
export type InquirySource = 'WEBSITE' | 'WALK_IN' | 'PHONE'
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
  source: InquirySource
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

/** An inquiry entered by staff — a walk-in, or a call taken by hand. */
export interface CreateManualInquiryRequest {
  name: string
  phone: string
  email?: string
  reason?: string
  preferredTime?: PreferredTime
  /** Where it starts in the pipeline. Defaults to VISITED for a walk-in. */
  status?: 'NEW' | 'CONTACTED' | 'VISITED'
  /** How they reached the clinic. WEBSITE is rejected by the API. */
  source?: Exclude<InquirySource, 'WEBSITE'>
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
  bySource: InquirySourceBreakdown[]
}

/** Per-channel volume and conversion — a walk-in converts very differently from a web lead. */
export interface InquirySourceBreakdown {
  source: InquirySource
  count: number
  convertedCount: number
  conversionRate: number
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
  faceEnrolled: boolean
  createdAt: string
}

/** Name + role only — what an assignee picker needs, readable by any staff member. */
export interface AssignableUser {
  id: string
  firstName: string
  lastName: string
  role: Role
}

export interface StaffMemberResponse {
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
  faceEnrolled: boolean
  caseCount: number
  createdAt: string
}

// ── Member Profile ────────────────────────────────────────────────────────────

export interface MemberProfileResponse {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  role: Role
  additionalRoles: Role[]
  isActive: boolean
  clinicId: string | null
  clinicName: string | null
  qualification: string | null
  specialization: string | null
  languages: LanguageResponse[]
  caseCount: number
  createdAt: string
}

export interface UpdateMemberProfileRequest {
  phone?: string
  clinicId?: string
  qualification?: string
  specialization?: string
  languageIds?: string[]
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

export interface ForgotPasswordRequest {
  email: string
}

export interface ResetPasswordRequest {
  token: string
  password: string
  confirmPassword: string
}

export interface ResetTokenPreviewResponse {
  maskedEmail: string
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
export type AiProvider = 'ANTHROPIC' | 'OPENAI' | 'GEMINI'

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
  aiProvider: AiProvider | null
  aiKeyConfigured: boolean
  /** Days autoscheduling (therapy sessions, review meetings) skips every week. Ad-hoc sessions are unaffected. */
  weeklyOffDays: DayOfWeek[]
  createdAt: string
}

export interface UpdateOrganisationRequest {
  name?: string
  contactEmail?: string
  contactPhone?: string
  address?: string
  logoUrl?: string
  timezone?: string
  aiProvider?: AiProvider
  /** Write-only. Omit to leave the stored key unchanged; pass '' to clear it. */
  aiApiKey?: string
  /** Omit to leave unchanged; pass [] to clear all weekly off days. */
  weeklyOffDays?: DayOfWeek[]
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
  latitude: number | null
  longitude: number | null
  geoFenceRadiusMeters: number | null
  isActive: boolean
  createdAt: string
}

export interface CreateClinicRequest {
  name: string
  address?: string
  phone?: string
  email?: string
  timezone?: string
  latitude?: number
  longitude?: number
  geoFenceRadiusMeters?: number
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

export interface TherapySummary {
  id: string
  name: string
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
  therapies: TherapySummary[]
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

export interface InviteParentRequest {
  email: string
}

export interface InviteParentResponse {
  inviteLink: string
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
export type EnrollmentCareStatus = 'ON_TRACK' | 'NEEDS_ATTENTION' | 'REVIEW' | 'PROGRAM_COMPLETED'

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
  endDate: string | null   // "YYYY-MM-DD" — last day of the plan
  dayOfWeek: DayOfWeek
  startTime: string        // "HH:mm:ss"
  status: EnrollmentStatus
  careStatus: EnrollmentCareStatus
  careStatusNote: string | null
  therapistSignedOff: boolean
  therapistSignoffNotes: string | null
  sessionsCompleted: number
  totalSessions: number
  createdAt: string
}

// ── Enrollment Concerns ──────────────────────────────────────────────────────
export type ConcernStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED'

export interface ConcernResponse {
  id: string
  enrollmentId: string
  programName: string
  patientId: string
  patientFirstName: string
  patientLastName: string
  therapistId: string
  therapistFirstName: string
  therapistLastName: string
  raisedBy: string
  raisedAt: string
  description: string
  status: ConcernStatus
  acknowledgedAt: string | null
  resolutionNotes: string | null
  resolvedAt: string | null
}

/** Recurring review-meeting schedule, set up alongside a therapy plan. */
export interface ReviewScheduleRequest {
  startTime: string             // "HH:mm"
  durationMinutes: number
  intervalWeeks: number         // defaults to a fortnightly rhythm
  firstMeetingDate?: string     // "YYYY-MM-DD"
  endDate?: string              // "YYYY-MM-DD"
}

export interface CreateEnrollmentRequest {
  subscriptionId: string
  patientId: string
  therapistId: string
  sessionDurationMinutes: number
  startDate: string        // "YYYY-MM-DD"
  startTime: string        // "HH:mm"
  endDate?: string         // "YYYY-MM-DD" — defaults to the last generated session
  reviewSchedule?: ReviewScheduleRequest   // omit for no review meetings
}

export type ReviewMeetingStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED'

export interface ReviewMeetingResponse {
  id: string
  orgId: string
  enrollmentId: string
  patientId: string
  patientName: string
  therapistId: string
  therapistName: string
  meetingNumber: number
  meetingDate: string      // "YYYY-MM-DD"
  startTime: string        // "HH:mm:ss"
  endTime: string          // "HH:mm:ss"
  status: ReviewMeetingStatus

  // Withheld until the viewer has submitted their own side — see the backend's enrich()
  communicationRating: number | null  // 1-5 stars
  progressRatingPct: number | null    // 0-100
  parentComments: string | null
  parentFeedbackAt: string | null

  therapistSummary: string | null
  therapistProgressNotes: string | null
  therapistFeedbackAt: string | null

  cancelledReason: string | null
  /** Therapist plus every parent linked to the patient. */
  participants: MeetingParticipant[]
  createdAt: string
}

export interface CreateReviewMeetingRequest {
  enrollmentId: string
  meetingDate: string      // "YYYY-MM-DD"
  startTime: string        // "HH:mm"
  durationMinutes: number
}

export interface RescheduleReviewRequest {
  meetingDate: string
  startTime: string
  durationMinutes?: number
}

export interface ParentFeedbackRequest {
  communicationRating: number   // 1–5
  progressRatingPct: number     // 0–100
  comments?: string
}

export interface TherapistFeedbackRequest {
  summary: string
  progressNotes?: string
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
  /** True once a parent has asked for this session to be moved. Never resets. */
  parentRescheduleRequested: boolean
  /** Sessions of this plan the parent may still ask to move. */
  parentReschedulesRemaining: number
  /** Booked by hand from the calendar rather than generated with the plan. */
  adHoc: boolean
  /** False when it is an extra, on top of the sessions the family paid for. */
  countsTowardPlan: boolean
  /** True when an extra session still has to be paid for. */
  requiresPayment: boolean
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

// ── Program session-feedback checklist ──────────────────────────────────────

export type FeedbackQuestionType = 'SINGLE_CHOICE' | 'MULTI_CHOICE' | 'TEXT'

export interface ProgramFeedbackOption {
  id: string
  optionText: string
}

export interface ProgramFeedbackQuestion {
  id: string
  questionText: string
  questionType: FeedbackQuestionType
  options: ProgramFeedbackOption[]
}

export interface ProgramFeedbackQuestionInput {
  questionText: string
  questionType: FeedbackQuestionType
  options: string[]
}

export interface UpdateProgramFeedbackTemplateRequest {
  questions: ProgramFeedbackQuestionInput[]
}

export interface SessionFeedbackAnswer {
  questionId: string
  selectedOptionIds: string[]
  textAnswer: string | null
}

export interface SessionFeedbackResponse {
  template: ProgramFeedbackQuestion[]
  answers: SessionFeedbackAnswer[]
  checklistNotes: string | null
}

export interface SessionFeedbackAnswerInput {
  questionId: string
  selectedOptionIds: string[]
  textAnswer?: string
}

export interface UpdateSessionFeedbackRequest {
  answers: SessionFeedbackAnswerInput[]
  checklistNotes?: string
}

export interface CreateAdHocSessionRequest {
  enrollmentId: string
  sessionDate: string   // "YYYY-MM-DD"
  startTime: string     // "HH:mm"
  endTime: string       // "HH:mm"
  therapistId?: string
  /** True consumes one of the sessions the family paid for; false adds it as an extra. */
  countsTowardPlan: boolean
  /** Whether an extra session is chargeable. Ignored when countsTowardPlan is true. */
  requiresPayment?: boolean
  notes?: string
}

export interface RescheduleSessionRequest {
  newDate?: string           // "YYYY-MM-DD"
  newStartTime?: string      // "HH:mm" — session keeps its length
  substituteTherapistId?: string
  /** Included in the email sent to the family and the therapist. */
  reason?: string
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
  description: string | null
  perSessionCost: number
  taxId: string | null
  taxName: string | null
  taxRate: number | null
  priceIncludesTax: boolean
  totalCost: number
  isActive: boolean
  createdAt: string
}

export interface CreateProgramRequest {
  name: string
  description?: string
  perSessionCost: number
  taxId?: string
  priceIncludesTax?: boolean
}

export interface UpdateProgramRequest {
  name?: string
  description?: string
  perSessionCost?: number
  taxId?: string
  priceIncludesTax?: boolean
  removeTax?: boolean
  isActive?: boolean
}

// ── Taxes ──────────────────────────────────────────────────────────────────────
export interface TaxResponse {
  id: string
  orgId: string
  name: string
  rate: number
  isActive: boolean
  createdAt: string
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
  completedAt: string | null
}

export type TaskLogType =
  | 'STATUS_CHANGED'
  | 'PRIORITY_CHANGED'
  | 'ASSIGNEE_CHANGED'
  | 'ATTACHMENT_ADDED'
  | 'ATTACHMENT_DELETED'
  | 'NAME_CHANGED'
  | 'DESCRIPTION_CHANGED'

export interface TaskLogResponse {
  id: string
  taskId: string
  logType: TaskLogType
  actorId: string
  actorName: string
  details: string
  createdAt: string
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

// ── Feed ───────────────────────────────────────────────────────────────────────
export interface FeedPostImageResponse {
  id: string
  postId: string
  fileName: string
  fileUrl: string
  contentType: string | null
  fileSizeBytes: number | null
  orderIndex: number
  createdAt: string
}

export interface FeedPostResponse {
  id: string
  orgId: string
  authorId: string
  authorFirstName: string
  authorLastName: string
  authorRole: Role
  title: string
  body: string | null
  createdAt: string
  updatedAt: string
  likeCount: number
  likedByMe: boolean
  viewCount: number
  commentCount: number
  images: FeedPostImageResponse[]
}

export interface CreateFeedPostRequest {
  title: string
  body?: string
}

export interface UpdateFeedPostRequest {
  title?: string
  body?: string
}

export interface FeedCommentResponse {
  id: string
  postId: string
  authorId: string
  authorFirstName: string
  authorLastName: string
  body: string
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

// ── Attendance ─────────────────────────────────────────────────────────────────
export type AttendanceStatus = 'CHECKED_IN' | 'CHECKED_OUT'

export interface AttendanceResponse {
  id: string
  userId: string
  userFirstName: string
  userLastName: string
  clinicId: string
  clinicName: string
  attendanceDate: string     // "YYYY-MM-DD"
  checkInTime: string | null
  checkOutTime: string | null
  geoVerified: boolean
  faceVerified: boolean
  faceOverride: boolean
  overrideApproved: boolean | null
  overrideReviewedByName: string | null
  overrideReviewedAt: string | null
  status: AttendanceStatus
  createdAt: string
}

export interface CheckInRequest {
  clinicId: string
  latitude?: number
  longitude?: number
  faceDescriptor?: number[]
  forceCheckIn?: boolean
}

export interface CheckOutRequest {
  latitude?: number
  longitude?: number
  faceDescriptor?: number[]
}

export interface EnrollFaceRequest {
  faceDescriptor: number[]
}

export interface VerifyAttendanceRequest {
  latitude?: number
  longitude?: number
  faceDescriptor?: number[]
}

// ── IEP ───────────────────────────────────────────────────────────────────────

export type IEPGoalDomain =
  | 'AUDITORY' | 'SPEECH' | 'LANGUAGE' | 'SENSORY'
  | 'MOTOR' | 'SOCIAL' | 'COGNITIVE' | 'LITERACY' | 'ADAPTIVE'

export type IEPGoalStatus =
  | 'IN_PROGRESS' | 'COMPLETED' | 'ON_HOLD' | 'PENDING_APPROVAL' | 'APPROVED'

export type IEPPlanStatus = 'ACTIVE' | 'COMPLETED' | 'ARCHIVED'

export interface IEPGoalResponse {
  id: string
  planId: string
  title: string
  goalStatement: string | null
  domain: IEPGoalDomain
  baseline: string | null
  targetCriteria: string | null
  targetDate: string | null
  status: IEPGoalStatus
  progressTag: string | null
  assignedTherapistId: string | null
  therapistName: string | null
  progressCount: number
  /** Trials passed ÷ trials attempted on the most recent progress entry — null when that entry
   *  didn't record trial counts, or none has been logged yet. */
  latestMasteryPct: number | null
  createdAt: string
}

export interface IEPPlanResponse {
  id: string
  patientId: string
  therapistId: string | null
  therapistName: string | null
  patientName: string | null
  title: string
  startDate: string | null
  endDate: string | null
  status: IEPPlanStatus
  tags: string[]
  goals: IEPGoalResponse[]
  totalGoals: number
  completedGoals: number
  createdAt: string
}

export interface CreateIEPGoalRequest {
  title: string
  goalStatement?: string
  domain: IEPGoalDomain
  baseline?: string
  targetCriteria?: string
  targetDate?: string
}

export interface CreateIEPPlanRequest {
  title: string
  startDate?: string
  endDate?: string
  tags?: string[]
  goals?: CreateIEPGoalRequest[]
  therapistId?: string
}

export interface UpdateIEPGoalRequest {
  status?: IEPGoalStatus
  title?: string
  goalStatement?: string
  domain?: IEPGoalDomain
  baseline?: string
  targetCriteria?: string
  targetDate?: string
  progressTag?: string
}

export interface AddProgressRequest {
  sessionDate: string
  note?: string
  trialsPassed?: number
  trialsTotal?: number
}

export interface IEPGoalProgressResponse {
  id: string
  sessionDate: string
  note: string | null
  trialsPassed: number | null
  trialsTotal: number | null
  masteryPct: number | null
  therapistName: string | null
  createdAt: string
}

export interface ImportResultResponse {
  plansCreated: number
  goalsCreated: number
  errors: string[]
}

// ── Baseline Report ────────────────────────────────────────────────────────────

export type BaselineDomain =
  | 'EYE_CONTACT' | 'ATTENTION' | 'COMPLIANCE' | 'GROSS_MOTOR' | 'FINE_MOTOR'
  | 'ADL_SKILLS' | 'RECEPTIVE_LANGUAGE' | 'EXPRESSIVE_LANGUAGE' | 'NON_VERBAL_COMMUNICATION'
  | 'ORO_MOTOR_SKILLS' | 'COGNITIVE_SKILLS' | 'SOCIAL_SKILLS' | 'EMOTIONAL_SKILLS'

export interface BaselineProgressEntryResponse {
  id: string
  entryDate: string
  value: string
  loggedByName: string | null
  createdAt: string
}

export interface BaselineDomainResponse {
  domain: BaselineDomain
  baselineValue: string | null
  baselineUpdatedAt: string | null
  currentEntries: BaselineProgressEntryResponse[]
}

export interface BaselineReportResponse {
  id: string
  patientId: string
  ageAtAdmission: string | null
  ageOnDate: string | null
  cdct: string | null
  createdAt: string
  updatedAt: string
  domains: BaselineDomainResponse[]
}

export interface CreateBaselineReportRequest {
  ageAtAdmission?: string
  ageOnDate?: string
  cdct?: string
  domainValues?: Partial<Record<BaselineDomain, string>>
}

export interface UpdateBaselineReportRequest {
  ageAtAdmission?: string
  ageOnDate?: string
  cdct?: string
  domainValues?: Partial<Record<BaselineDomain, string>>
}

export interface AddBaselineProgressRequest {
  entryDate: string
  value: string
}

// ── IEP Template Library ──────────────────────────────────────────────────────

export interface IEPTemplateGoalResponse {
  id: string
  templateId: string
  orgId: string
  title: string
  goalStatement?: string
  domain?: IEPGoalDomain
  baseline?: string
  targetCriteria?: string
  createdAt: string
}

export interface IEPTemplateResponse {
  id: string
  orgId: string
  name: string
  description?: string
  tags: string[]
  goals: IEPTemplateGoalResponse[]
  goalCount: number
  createdAt: string
}

export interface CreateIEPTemplateRequest {
  name: string
  description?: string
  tags?: string[]
}

export interface CreateIEPTemplateGoalRequest {
  title: string
  goalStatement?: string
  domain?: IEPGoalDomain
  baseline?: string
  targetCriteria?: string
}

// ── Analytics ──────────────────────────────────────────────────────────────────

export type Granularity = 'DAILY' | 'WEEKLY' | 'MONTHLY'

export type AnalyticsSubjectType = 'PATIENT' | 'THERAPIST' | 'ORGANISATION'

/** One period on the x-axis. `masteryPct` is null when nothing was logged — never 0. */
export interface AnalyticsBucket {
  periodStart: string
  label: string
  masteryPct: number | null
  trialsPassed: number
  trialsTotal: number
  sessionsCompleted: number
  sessionsNoShow: number
  sessionsCancelled: number
  sessionsRescheduled: number
  sessionsLogged: number
  avgPerformanceScore: number | null
  avgParentRating: number | null
  avgParentProgressPct: number | null
}

/** Per-domain mastery, aligned index-for-index with the parent series' buckets. */
export interface DomainSeries {
  domain: IEPGoalDomain
  masteryPct: (number | null)[]
  current: number | null
  deltaPts: number | null
  trialsTotal: number
  plateau: boolean
}

export interface AnalyticsTotals {
  masteryPct: number | null
  masteryDeltaPts: number | null
  trialsPassed: number
  trialsTotal: number
  sessionsScheduled: number
  sessionsCompleted: number
  sessionsNoShow: number
  sessionsCancelled: number
  sessionsLogged: number
  coveragePct: number | null
  goalsTotal: number
  goalsCompleted: number
  avgPerformanceScore: number | null
  avgParentRating: number | null
  avgParentProgressPct: number | null
  /** How many review meetings the average(s) above are drawn from. */
  parentFeedbackCount: number
}

export interface TimeSeriesResponse {
  subjectType: AnalyticsSubjectType
  subjectId: string
  subjectName: string
  granularity: Granularity
  from: string
  to: string
  buckets: AnalyticsBucket[]
  domains: DomainSeries[]
  /** One point per scored session, for plotting progress session by session. */
  sessions: AnalyticsSessionPoint[]
  reschedules: RescheduleStats
  totals: AnalyticsTotals
}

export interface AnalyticsSessionPoint {
  sessionId: string
  sessionDate: string
  sessionNumber: number
  /** 0-100, the therapist's score for that session. */
  performanceScore: number
  adHoc: boolean
}

/** How much moving around a plan has needed. */
export interface RescheduleStats {
  sessionsMoved: number
  totalMoves: number
  parentRequested: number
  clinicInitiated: number
  awaitingAction: number
}

export interface CaseloadPatientRow {
  patientId: string
  patientName: string
  masteryPct: number | null
  deltaPts: number | null
  spark: (number | null)[]
  sessionsCompleted: number
  sessionsScheduled: number
  sessionsNoShow: number
  coveragePct: number | null
  goalsTotal: number
  goalsCompleted: number
  plateau: boolean
}

export interface CaseloadResponse {
  therapistId: string
  therapistName: string
  from: string
  to: string
  series: TimeSeriesResponse
  patients: CaseloadPatientRow[]
  /** Children on this therapist's caseload, grouped by therapy/program — same shape as
   *  OrgSnapshotResponse.programBreakdown, scoped to one therapist. Not windowed. */
  programBreakdown: ProgramBreakdown[]
}

// ── API wrapper ────────────────────────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean
  message: string | null
  data: T
  timestamp: string
}


// ── Meetings ─────────────────────────────────────────────────────────────────

export type MeetingStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED'

/** Someone attending a meeting — name and role only, never personal details. */
export interface MeetingParticipant {
  id: string
  firstName: string
  lastName: string
  role: Role
  isOrganiser: boolean
}

export interface MeetingResponse {
  id: string
  orgId: string
  title: string
  description: string | null
  meetingDate: string   // "YYYY-MM-DD"
  startTime: string     // "HH:mm:ss"
  endTime: string       // "HH:mm:ss"
  location: string | null
  status: MeetingStatus
  cancelledReason: string | null
  createdBy: string
  createdByName: string | null
  participants: MeetingParticipant[]
}

export interface CreateMeetingRequest {
  title: string
  description?: string
  meetingDate: string
  startTime: string
  endTime: string
  location?: string
  participantIds: string[]
}

// ── Activities ───────────────────────────────────────────────────────────────

export type ActivityDifficulty = 'EASY' | 'MEDIUM' | 'HARD'
export type AgeUnit = 'MONTH' | 'YEAR'
export type ChecklistQuestionType = 'SINGLE_CHOICE' | 'MULTI_CHOICE' | 'TEXT'
export type AssignmentStatus = 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'DISCONTINUED'

export interface SkillResponse { id: string; name: string; isActive: boolean }
export interface LanguageResponse { id: string; name: string; isActive: boolean }
export interface PropResponse { id: string; name: string; isActive: boolean }

export interface ChecklistOptionResponse {
  id: string
  optionText: string
}

export interface ChecklistQuestionResponse {
  id: string
  questionText: string
  questionType: ChecklistQuestionType
  options: ChecklistOptionResponse[]
}

export interface ChecklistQuestionInput {
  questionText: string
  questionType: ChecklistQuestionType
  options: string[]
}

export interface ActivityResourceResponse {
  id: string
  fileName: string
  fileUrl: string
  contentType: string | null
  fileSizeBytes: number | null
}

export interface ActivityResponse {
  id: string
  orgId: string
  orgName: string | null
  mine: boolean
  title: string
  aboutActivity: string
  programId: string | null
  programName: string | null
  skills: SkillResponse[]
  languages: LanguageResponse[]
  durationWeeks: number
  ageMinValue: number
  ageMinUnit: AgeUnit
  ageMaxValue: number
  ageMaxUnit: AgeUnit
  difficulty: ActivityDifficulty
  instructions: string[]
  checklist: ChecklistQuestionResponse[]
  props: PropResponse[]
  tipsAndSuggestions: string | null
  resources: ActivityResourceResponse[]
  links: string[]
  isShared: boolean
  sourceActivityId: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateActivityRequest {
  title: string
  aboutActivity: string
  programId?: string
  skillIds?: string[]
  languageIds?: string[]
  durationWeeks: number
  ageMinValue: number
  ageMinUnit: AgeUnit
  ageMaxValue: number
  ageMaxUnit: AgeUnit
  difficulty?: ActivityDifficulty
  instructions?: string[]
  checklist?: ChecklistQuestionInput[]
  propIds?: string[]
  tipsAndSuggestions?: string
  links?: string[]
  isShared?: boolean
}

export type UpdateActivityRequest = Partial<CreateActivityRequest> & { isActive?: boolean }

export interface UpdateAssignmentStatusRequest {
  status: AssignmentStatus
}

export interface AssignActivityRequest {
  patientId: string
  assignedTherapistId?: string
  startDate?: string
}

export interface ActivityAssignmentResponse {
  id: string
  activityId: string
  activityTitle: string | null
  patientId: string
  patientName: string | null
  assignedBy: string
  assignedByName: string | null
  assignedTherapistId: string | null
  assignedTherapistName: string | null
  status: AssignmentStatus
  startDate: string | null
  dueDate: string | null
  attemptCount: number
  createdAt: string
}

export interface AttemptAnswerInput {
  questionId: string
  selectedOptionIds?: string[]
  textAnswer?: string
}

export interface LogAttemptRequest {
  attemptDate: string
  note?: string
  answers: AttemptAnswerInput[]
}

export interface AttemptAnswerResponse {
  questionId: string
  questionText: string | null
  selectedOptionIds: string[]
  selectedOptionTexts: string[]
  textAnswer: string | null
}

export interface ActivityAttemptResponse {
  id: string
  assignmentId: string
  loggedBy: string
  loggedByName: string | null
  attemptDate: string
  note: string | null
  answers: AttemptAnswerResponse[]
  createdAt: string
}

export interface MagicFillRequest {
  title: string
  aboutActivity?: string
  programName?: string
  skillNames?: string[]
  ageMinValue?: number
  ageMinUnit?: string
  ageMaxValue?: number
  ageMaxUnit?: string
  difficulty?: string
  section: 'instructions' | 'checklist'
}

export interface MagicFillResponse {
  instructions: string[]
  checklist: ChecklistQuestionInput[]
}

export interface ActivityProgressResponse {
  assignedCount: number
  inProgressCount: number
  completedCount: number
  discontinuedCount: number
  completionRatePct: number | null
  weeklyAttempts: { weekStart: string; attempts: number }[]
}

// ── Session frequency (cadence across concurrent enrollments) ──────────────────
export interface FrequencyResponse {
  weekly: {
    weekStart: string
    totalSessions: number
    planSessions: number
    adHocSessions: number
    byProgram: { programName: string; count: number }[]
  }[]
  byProgram: { programName: string; totalSessions: number }[]
}

// ── Discharge episodes ───────────────────────────────────────────────────────────
export interface DischargeEnrollmentSummary {
  enrollmentId: string
  programName: string
  therapistName: string
  startDate: string | null
  endDate: string | null
}

export interface DischargeRecordResponse {
  id: string
  patientId: string
  dischargeDate: string
  dischargedBy: string
  dischargedByName: string
  episodeStartDate: string | null
  avgCommunicationRating: number | null
  avgProgressRatingPct: number | null
  goalMasteryPct: number | null
  goalMasteryMet: boolean | null
  therapistSignoffMet: boolean
  parentSatisfactionMet: boolean | null
  overallSuccessful: boolean
  notes: string | null
  pdfAvailable: boolean
  enrollments: DischargeEnrollmentSummary[]
  createdAt: string
}

export interface DischargePreviewResponse {
  enrollments: {
    enrollmentId: string
    programName: string
    therapistName: string
    criteria: SuccessCriteriaResponse
  }[]
  allCriteriaMet: boolean
}

// ── Discharge success criteria ──────────────────────────────────────────────────
export interface SuccessCriteriaResponse {
  goalMasteryPct: number | null
  goalMasteryMet: boolean | null
  therapistSignedOff: boolean
  parentSatisfactionPct: number | null
  parentSatisfactionMet: boolean | null
  overallSuccessful: boolean
}

// ── Org snapshot (clinical outcomes) ────────────────────────────────────────────
export interface ProgramBreakdown {
  programName: string
  patientCount: number
  enrollmentCount: number
}

export interface OrgSnapshotResponse {
  avgTherapyDurationWeeks: number | null
  enrollmentsWithDuration: number
  programBreakdown: ProgramBreakdown[]
  stageCounts: { stage: PatientStage; count: number }[]
}

// ── Engagement Overview (Analytics — Overview tab) ──────────────────────────────

export interface UserCounts {
  members: number
  cases: number
}

export interface NameCount {
  name: string
  count: number
}

export interface TrendPoint {
  date: string   // "YYYY-MM-DD"
  count: number
}

export interface EngagementOverviewResponse {
  activeUsers: UserCounts
  invitedUsers: UserCounts
  avgSessionDurationMinutes: number | null
  skillsBreakdown: NameCount[]
  ageGroups: NameCount[]
  sessionsTrend: TrendPoint[]
  totalSessions: number
  checklistFilledTrend: TrendPoint[]
  mostAssignedActivities: NameCount[]
}

// ── Cases (Analytics — Cases tab) ────────────────────────────────────────────
export interface CaseSummaryResponse {
  patientId: string
  patientName: string
  sessionsAttended: number
  sessionsUpcoming: number
  sessionsCancelled: number
  membersAssigned: number
  activitiesAssigned: number
  checklistFilled: number
  ltGoals: number
  paymentStatus: 'PENDING' | 'PARTIAL' | 'PAID' | null
}

// ── Members (Analytics — Members tab) ────────────────────────────────────────
export interface MemberSummaryResponse {
  therapistId: string
  therapistName: string
  role: string
  casesAssigned: number
  activitiesCreated: number
  activitiesAssigned: number
  sessionsCancelled: number
  iepPlans: number
}

// ── Schedule (Analytics — Schedule tab) ──────────────────────────────────────
export interface ScheduleEntry {
  sessionId: string
  sessionDate: string        // "YYYY-MM-DD"
  startTime: string          // "HH:mm:ss"
  durationMinutes: number
  programName: string
  patientName: string
  therapistName: string
  status: TherapySessionStatus
  cost: number | null
}

export interface ScheduleResponse {
  totalSessions: number
  cancelledPct: number | null
  rescheduledPct: number | null
  attendancePct: number | null
  totalDurationMinutes: number
  avgDurationMinutes: number | null
  sessions: ScheduleEntry[]
}

// ── Case History ─────────────────────────────────────────────────────────────
export type DeliveryType = 'FT' | 'PREMATURE' | 'NORMAL' | 'OTHER'
export type LabourType = 'NORMAL' | 'PROLONGED' | 'VACUUM' | 'EPIDURAL' | 'C_SECTION'
export type BirthCry = 'NORMAL' | 'DELAYED' | 'ABSENT'
export type MilestoneStatus = 'NORMAL' | 'DELAYED'
export type Handedness = 'RIGHT_HAND' | 'LEFT_HAND' | 'MIXED_LATERALITY'
export type FamilyType = 'NUCLEAR' | 'JOINT' | 'SINGLE_PARENT'
export type EyeContact = 'NOT_PRESENT' | 'AVOIDS' | 'LIMITED' | 'FLEETING' | 'MAINTAINS_ONLY_IF_INTERESTED' | 'MAINTAINS'
export type StutteringFrequency = 'NONE' | 'RARELY' | 'OCCASIONALLY' | 'FREQUENTLY'
export type PlayBehavior = 'UNOCCUPIED' | 'SOLITARY_PLAY' | 'REPETITIVE_PLAY' | 'PARALLEL_PLAY' | 'ASSOCIATED_PLAY' | 'COOPERATIVE_PLAY' | 'GROUP'
export type SocialSmiling = 'NONE' | 'RARE' | 'LIMITED' | 'APPROPRIATE'
export type SelfRegulationLevel = 'VERY_POOR' | 'POOR' | 'AVERAGE' | 'GOOD' | 'EXCELLENT'
export type FriendshipLevel = 'NO_FRIENDS' | 'CASUAL_FRIENDS' | 'CLOSE_FRIENDS' | 'OVER_INVOLVED_WITH_FRIENDS'
export type ListeningLevel = 'DISINTERESTED' | 'NOT_ABLE_TO_SUSTAIN_FOCUS' | 'POOR_VOCABULARY' | 'ACTIVE_LISTENING'

export interface MilestoneSkill {
  skill: string
  notPresent: boolean
  unaware: boolean
  ageInMonths: number | null
  status: MilestoneStatus | null
}

export interface FamilyMember {
  name: string
  relation: string
  age: string
  notes: string
}

export interface CaseHistoryResponse {
  id: string
  patientId: string

  presentComplaints: string | null
  habits: string[]
  physicalOtherProblems: string | null

  prenatalHealth: string[]
  deliveryType: DeliveryType | null
  labourType: LabourType | null
  birthCry: BirthCry | null
  prenatalNotes: string | null
  birthAdditionalNotes: string | null
  birthHeight: number | null
  birthHeightUnit: string | null
  birthWeight: number | null
  birthWeightUnit: string | null
  postnatalHealth: string[]
  phototherapyDays: number | null
  postnatalNotes: string | null

  motorMilestones: MilestoneStatus | null
  speechMilestones: MilestoneStatus | null
  milestoneSkills: MilestoneSkill[]
  milestonesAdditionalNotes: string | null
  handedness: Handedness | null

  familyType: FamilyType | null
  familyMembers: FamilyMember[]
  consanguinityHistory: boolean | null
  familyImpairmentsNotes: string | null

  eyeContact: EyeContact | null
  stutteringFrequency: StutteringFrequency | null
  playBehavior: PlayBehavior | null
  socialSmiling: SocialSmiling | null
  behaviouralSelfRegulation: SelfRegulationLevel | null
  emotionalSelfRegulation: SelfRegulationLevel | null
  friendships: FriendshipLevel | null
  listening: ListeningLevel | null
  communications: string[]
  behavioralProblems: string[]
  provisionalDiagnosis: string | null

  currentGrade: string | null
  school: string | null
  syllabus: string | null
  ageOfJoining: number | null
  performanceAndProgress: string | null
  attitudeTowardsStudies: string | null
  schoolAdditionalNotes: string | null

  createdAt: string
  updatedAt: string
}

export type UpdateCaseHistoryRequest = Omit<CaseHistoryResponse, 'id' | 'patientId' | 'createdAt' | 'updatedAt'>

// ── Patient assessments (ISAA / PRBA) ───────────────────────────────────────────

export type AssessmentType = 'ISAA' | 'PRBA'

export interface AssessmentOption {
  label: string
  score: number
}

export interface AssessmentItem {
  number: number
  text: string
  options: AssessmentOption[]
}

export interface AssessmentSection {
  name: string
  items: AssessmentItem[]
}

export interface AssessmentDefinitionResponse {
  assessmentType: AssessmentType
  maxScore: number
  sections: AssessmentSection[]
}

export interface CreateAssessmentRequest {
  assessmentDate: string   // "YYYY-MM-DD"
  itemScores: Record<number, number>
}

export interface PatientAssessmentResponse {
  id: string
  assessmentType: AssessmentType
  assessmentDate: string   // "YYYY-MM-DD"
  filledByName: string | null
  totalScore: number
  maxScore: number
  classification: string | null
}
