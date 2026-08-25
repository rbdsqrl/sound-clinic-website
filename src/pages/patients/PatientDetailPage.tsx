import { useState, useRef, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { ArrowLeft, Plus, X, UserCheck, Heart, Users, BookOpen, IndianRupee, Ban, CalendarDays, Clock, ChevronRight, CheckCircle2, XCircle, Circle, Sparkles, CreditCard, ShieldCheck, ClipboardList, Upload, FileText, Pencil, AlertTriangle, Trash2, Search, Download, LogOut } from 'lucide-react'
import IEPTab from './IEPTab'
import ActivitiesTab from './ActivitiesTab'
import { CaseHistoryCard } from './CaseHistoryCard'
import { ReviewMeetingsPanel, DEFAULT_REVIEW_INTERVAL_WEEKS } from './ReviewMeetings'
import { patientsApi } from '../../api/patients'
import { clinicsApi } from '../../api/clinics'
import { conditionsApi } from '../../api/conditions'
import { programsApi } from '../../api/programs'
import { subscriptionsApi } from '../../api/subscriptions'
import { enrollmentsApi } from '../../api/enrollments'
import { concernsApi } from '../../api/concerns'
import { dischargeApi } from '../../api/discharge'
import { PerformanceScoreSlider, ScorePill, scoreColor } from '../../components/ui/PerformanceScore'
import { usersApi } from '../../api/users'
import { therapySessionsApi } from '../../api/therapySessions'
import { Card, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Modal } from '../../components/ui/Modal'
import { Badge } from '../../components/ui/Badge'
import { PageLoader } from '../../components/ui/Spinner'
import { ToastContainer } from '../../components/ui/Toast'
import { UserSearchPicker } from '../../components/ui/UserSearchPicker'
import { TimePicker } from '../../components/ui/TimePicker'
import { useToast } from '../../hooks/useToast'
import { getApiError } from '../../lib/apiError'
import { ROUTES } from '../../lib/routes'
import { useAuth } from '../../contexts/AuthContext'
import { colors, border, surface, accentAlpha, dangerAlpha, successAlpha, warningAlpha, paletteStyle, styles, palette } from '../../theme'
import { format } from 'date-fns'
import type {
  AddConditionRequest,
  AssignTherapistRequest,
  LinkParentRequest,
  UserResponse,
  PatientStage,
  PatientResponse,
  SubscriptionResponse,
  CreateSubscriptionRequest,
  UpdatePaymentRequest,
  SubscriptionPaymentStatus,
  EnrollmentResponse,
  CreateEnrollmentRequest,
  AvailableTherapistResponse,
  TherapySessionResponse,
  TherapySessionStatus,
  SessionAttachmentResponse,
} from '../../types'

// ── Stage config ───────────────────────────────────────────────────────────────

const STAGES: PatientStage[] = [
  'INQUIRY_CONVERTED',
  'PRE_ASSESSMENT',
  'ASSESSMENT_DONE',
  'ENROLLMENT',
  'ENROLLED',
  'THERAPY_ACTIVE',
  'DISCHARGED',
]

const STAGE_LABELS: Record<PatientStage, string> = {
  INQUIRY_CONVERTED: 'Inquiry',
  PRE_ASSESSMENT:    'Pre-Assessment',
  ASSESSMENT_DONE:   'Assessment Done',
  ENROLLMENT:        'Enrollment',
  ENROLLED:          'Enrolled',
  THERAPY_ACTIVE:    'Therapy Active',
  DISCHARGED:        'Discharged',
}

// ── Stage Progress Bar (read-only) ────────────────────────────────────────────

function StageProgress({ current }: { current: PatientStage }) {
  const currentIdx = STAGES.indexOf(current)
  return (
    <div className="flex items-center overflow-x-auto pb-1 gap-0">
      {STAGES.map((stage, idx) => {
        const isPast    = idx < currentIdx
        const isCurrent = idx === currentIdx
        return (
          <div key={stage} className="flex items-center flex-shrink-0">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-all"
                style={{
                  background: isCurrent ? colors.accent : isPast ? accentAlpha(0.25) : surface.filterStrip,
                  color: isCurrent ? '#fff' : isPast ? colors.accent : colors.text.dim,
                  border: !isCurrent && !isPast ? `1.5px solid ${border.divider}` : 'none',
                  boxShadow: isCurrent ? `0 0 0 3px ${accentAlpha(0.18)}` : 'none',
                }}
              >
                {isPast ? '✓' : idx + 1}
              </div>
              <span
                className="text-[10.35px] font-medium text-center whitespace-nowrap max-w-[60px] leading-tight"
                style={{ color: isCurrent ? colors.accent : isPast ? colors.text.muted : colors.text.dim }}
              >
                {STAGE_LABELS[stage]}
              </span>
            </div>
            {idx < STAGES.length - 1 && (
              <div
                className="h-0.5 w-6 sm:w-10 flex-shrink-0 -mt-4 mx-0.5"
                style={{ background: isPast ? accentAlpha(0.35) : border.divider }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Journey Card (next action prompt) ─────────────────────────────────────────

function JourneyCard({
  patient,
  subscriptions,
  enrollments,
  canManage,
  onAddSubscription,
  onSetupSchedule,
  onRecordPayment,
  onPayNow,
  onOpenDetails,
}: {
  patient: { stage: PatientStage; firstName: string; lastName: string }
  subscriptions: import('../../types').SubscriptionResponse[]
  enrollments: import('../../types').EnrollmentResponse[]
  canManage: boolean
  onAddSubscription: () => void
  onSetupSchedule: () => void
  onRecordPayment: (sub: import('../../types').SubscriptionResponse) => void
  onPayNow?: (sub: import('../../types').SubscriptionResponse) => void
  /** Opens the Therapy tab for full enrollment/payment detail — the card itself is clickable. */
  onOpenDetails: () => void
}) {
  const activeSubscription = subscriptions.find(s => s.status === 'ACTIVE')
  const activeEnrollment   = enrollments.find(e => e.status === 'ACTIVE')
  const isDischarged        = patient.stage === 'DISCHARGED'

  // Determine which step we're on
  let step: 'subscription' | 'schedule' | 'payment' | 'active' | 'done' = 'done'
  if (isDischarged) {
    step = 'done'
  } else if (!activeSubscription) {
    step = 'subscription'
  } else if (!activeEnrollment) {
    step = 'schedule'
  } else if (activeSubscription.paymentStatus !== 'PAID') {
    step = 'payment'
  } else {
    step = 'active'
  }

  const config = {
    subscription: {
      icon: <BookOpen size={20} style={{ color: colors.accent }} />,
      title: 'Set up a therapy plan',
      description: 'Choose a program and the number of sessions to create the patient\'s plan.',
      cta: 'Add Subscription',
      action: onAddSubscription,
      accent: colors.accent,
    },
    schedule: {
      icon: <CalendarDays size={20} style={{ color: palette.purple.text }} />,
      title: 'Schedule sessions',
      description: 'Pick a start date and time slot. The system will find an available therapist.',
      cta: 'Set up Schedule',
      action: onSetupSchedule,
      accent: palette.purple.text,
    },
    payment: {
      icon: <CreditCard size={20} style={{ color: palette.green.text }} />,
      title: 'Confirm payment',
      description: `${activeSubscription?.programName ?? 'Subscription'} — record the payment to activate therapy sessions.`,
      cta: 'Record Payment',
      action: () => activeSubscription && onRecordPayment(activeSubscription),
      accent: palette.green.text,
    },
    active: {
      icon: <CheckCircle2 size={20} style={{ color: palette.green.text }} />,
      title: 'Therapy is active',
      description: `${activeEnrollment?.sessionsCompleted ?? 0} of ${activeEnrollment?.totalSessions ?? 0} sessions completed · ${activeSubscription?.programName ?? ''}`,
      cta: null,
      action: null,
      accent: palette.green.text,
    },
    done: {
      icon: <CheckCircle2 size={20} style={{ color: colors.text.dim }} />,
      title: 'Patient discharged',
      description: 'This patient\'s therapy journey is complete.',
      cta: null,
      action: null,
      accent: colors.text.dim,
    },
  }[step]

  return (
    <div
      onClick={onOpenDetails}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onOpenDetails() }}
      className="rounded-2xl p-4 flex items-start gap-4 cursor-pointer transition-opacity hover:opacity-90"
      style={{
        background: step === 'active' || step === 'done'
          ? surface.filterStrip
          : accentAlpha(0.05),
        border: `1px solid ${step === 'active' || step === 'done' ? border.divider : accentAlpha(0.15)}`,
      }}
    >
      <div
        className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: accentAlpha(0.08) }}
      >
        {config.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold" style={{ color: colors.text.heading }}>{config.title}</p>
        <p className="text-xs mt-0.5" style={{ color: colors.text.muted }}>{config.description}</p>
      </div>
      {config.cta && canManage && (
        <button
          onClick={e => { e.stopPropagation(); config.action?.() }}
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors"
          style={{ background: accentAlpha(0.10), color: colors.accent }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = accentAlpha(0.18)}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = accentAlpha(0.10)}
        >
          <Sparkles size={12} />
          {config.cta}
        </button>
      )}
      {step === 'payment' && !canManage && onPayNow && activeSubscription && (
        <button
          onClick={e => { e.stopPropagation(); onPayNow(activeSubscription) }}
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors"
          style={{ background: palette.green.text + '1A', color: palette.green.text }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = palette.green.text + '30'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = palette.green.text + '1A'}
        >
          <CreditCard size={12} />
          Pay Now
        </button>
      )}
    </div>
  )
}

// ── Subscription helpers ───────────────────────────────────────────────────────

function paymentStatusStyle(s: SubscriptionPaymentStatus): React.CSSProperties {
  if (s === 'PAID')    return paletteStyle('teal',   0.12, 0)
  if (s === 'PARTIAL') return paletteStyle('blue',   0.12, 0)
  return                      paletteStyle('yellow', 0.14, 0)
}

function formatINR(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

// ── CreateSubscriptionModal ────────────────────────────────────────────────────

function CreateSubscriptionModal({
  patientId,
  onClose,
  onCreated,
}: {
  patientId: string
  onClose: () => void
  onCreated: (sub: SubscriptionResponse) => void
}) {
  const { toast } = useToast()
  const [programId, setProgramId] = useState('')
  const [numSessions, setNumSessions] = useState('')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<{ programId?: string; numSessions?: string }>({})

  const { data: programs = [], isLoading: loadingPrograms } = useQuery({
    queryKey: ['programs', 'active'],
    queryFn: () => programsApi.listActive(),
    staleTime: 2 * 60 * 1000,
  })

  const createMut = useMutation({
    mutationFn: (data: CreateSubscriptionRequest) => subscriptionsApi.create(data),
    onSuccess: (sub) => { onCreated(sub) },
    onError: (err) => toast(getApiError(err, 'Failed to create subscription'), 'error'),
  })

  const selectedProgram = programs.find(p => p.id === programId)
  const sessions = parseInt(numSessions) || 0
  const previewTotal = selectedProgram ? formatINR(selectedProgram.perSessionCost * sessions) : null

  const validate = () => {
    const e: typeof errors = {}
    if (!programId) e.programId = 'Select a program'
    const n = parseInt(numSessions)
    if (!numSessions || isNaN(n) || n < 1) e.numSessions = 'Enter at least 1 session'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!validate()) return
    createMut.mutate({ patientId, programId, numSessions: parseInt(numSessions), notes: notes || undefined })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={styles.modalBackdrop}>
      <div className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 md:p-6 max-h-[92vh] overflow-y-auto" style={styles.modal}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold" style={{ color: colors.text.heading }}>Add Subscription</h2>
          <button onClick={onClose} className="p-2.5 rounded-lg transition-colors" style={{ color: colors.text.muted }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = accentAlpha(0.08)}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Program select */}
          <div>
            <label className="form-label">Program</label>
            <select
              value={programId}
              onChange={e => setProgramId(e.target.value)}
              disabled={loadingPrograms}
              className="form-input w-full"
            >
              <option value="">Select a program…</option>
              {programs.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} — {formatINR(p.perSessionCost)}/session
                </option>
              ))}
            </select>
            {errors.programId && <p className="form-error">{errors.programId}</p>}
          </div>

          {/* Sessions */}
          <div>
            <label className="form-label">Number of Sessions</label>
            <input
              type="number"
              min="1"
              value={numSessions}
              onChange={e => setNumSessions(e.target.value)}
              placeholder="12"
              className="form-input w-full"
            />
            {errors.numSessions && <p className="form-error">{errors.numSessions}</p>}
          </div>

          {/* Preview total */}
          {previewTotal && sessions > 0 && (
            <div className="rounded-xl p-3 flex items-center justify-between" style={{ background: accentAlpha(0.06), border: `1px solid ${accentAlpha(0.15)}` }}>
              <span className="text-xs" style={{ color: colors.text.muted }}>Estimated total (before discount)</span>
              <span className="text-sm font-bold" style={{ color: colors.accent }}>{previewTotal}</span>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="form-label">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Any special instructions…"
              className="form-input w-full resize-none"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={styles.buttonSecondary}>Cancel</button>
            <button type="submit" disabled={createMut.isPending} className="flex-1 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50" style={styles.buttonPrimary}>
              {createMut.isPending ? 'Creating…' : 'Create Subscription'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── RecordPaymentModal ─────────────────────────────────────────────────────────

function RecordPaymentModal({
  subscription,
  onClose,
  onSaved,
}: {
  subscription: SubscriptionResponse
  onClose: () => void
  onSaved: (sub: SubscriptionResponse) => void
}) {
  const { toast } = useToast()
  const [discount, setDiscount] = useState(String(subscription.discountPercent))
  const [amountPaid, setAmountPaid] = useState(String(subscription.amountPaid))
  const [paymentNotes, setPaymentNotes] = useState(subscription.paymentNotes ?? '')
  const [errors, setErrors] = useState<{ discount?: string; amount?: string }>({})

  const discountVal = parseFloat(discount) || 0
  const total = subscription.perSessionCost * subscription.numSessions * (1 - discountVal / 100)

  const saveMut = useMutation({
    mutationFn: (data: UpdatePaymentRequest) => subscriptionsApi.recordPayment(subscription.id, data),
    onSuccess: (sub) => { onSaved(sub) },
    onError: (err) => toast(getApiError(err, 'Failed to record payment'), 'error'),
  })

  const validate = () => {
    const e: typeof errors = {}
    const d = parseFloat(discount)
    if (isNaN(d) || d < 0 || d > 100) e.discount = 'Discount must be between 0 and 100'
    const a = parseFloat(amountPaid)
    if (isNaN(a) || a < 0) e.amount = 'Enter a valid amount'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!validate()) return
    saveMut.mutate({
      discountPercent: parseFloat(discount),
      amountPaid: parseFloat(amountPaid),
      paymentNotes: paymentNotes || undefined,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={styles.modalBackdrop}>
      <div className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 md:p-6 max-h-[92vh] overflow-y-auto" style={styles.modal}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold" style={{ color: colors.text.heading }}>Record Payment</h2>
          <button onClick={onClose} className="p-2.5 rounded-lg transition-colors" style={{ color: colors.text.muted }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = accentAlpha(0.08)}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
            <X size={16} />
          </button>
        </div>
        <p className="text-sm mb-4" style={{ color: colors.text.muted }}>
          {subscription.programName} · {subscription.numSessions} sessions
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            {/* Discount */}
            <div>
              <label className="form-label">Discount (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={discount}
                onChange={e => setDiscount(e.target.value)}
                placeholder="0"
                className="form-input w-full"
              />
              {errors.discount && <p className="form-error">{errors.discount}</p>}
            </div>

            {/* Amount paid */}
            <div>
              <label className="form-label">Amount Paid (₹)</label>
              <div className="relative">
                <IndianRupee size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: colors.text.muted }} />
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={amountPaid}
                  onChange={e => setAmountPaid(e.target.value)}
                  placeholder="0"
                  className="form-input w-full pl-8"
                />
              </div>
              {errors.amount && <p className="form-error">{errors.amount}</p>}
            </div>
          </div>

          {/* Live total preview */}
          <div className="rounded-xl p-3 flex items-center justify-between" style={{ background: accentAlpha(0.06), border: `1px solid ${accentAlpha(0.15)}` }}>
            <div>
              <p className="text-xs" style={{ color: colors.text.muted }}>Total due after discount</p>
              <p className="text-sm font-bold mt-0.5" style={{ color: colors.accent }}>{formatINR(Math.max(0, total))}</p>
            </div>
            <div className="text-right">
              <p className="text-xs" style={{ color: colors.text.muted }}>Remaining</p>
              <p className="text-sm font-bold mt-0.5" style={{ color: parseFloat(amountPaid) >= total ? palette.teal.text : colors.status.warning }}>
                {formatINR(Math.max(0, total - (parseFloat(amountPaid) || 0)))}
              </p>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="form-label">Payment Notes (optional)</label>
            <textarea
              value={paymentNotes}
              onChange={e => setPaymentNotes(e.target.value)}
              rows={2}
              placeholder="e.g. Paid via UPI, receipt #123…"
              className="form-input w-full resize-none"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={styles.buttonSecondary}>Cancel</button>
            <button type="submit" disabled={saveMut.isPending} className="flex-1 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50" style={styles.buttonPrimary}>
              {saveMut.isPending ? 'Saving…' : 'Save Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── MockRazorpayModal ──────────────────────────────────────────────────────────

function MockRazorpayModal({
  subscription,
  onClose,
  onSaved,
}: {
  subscription: SubscriptionResponse
  onClose: () => void
  onSaved: () => void
}) {
  const [step, setStep] = useState<'gateway' | 'success'>('gateway')
  const [processing, setProcessing] = useState(false)

  const handlePay = async () => {
    setProcessing(true)
    try {
      await subscriptionsApi.recordPayment(subscription.id, {
        discountPercent: 0,
        amountPaid: subscription.totalAmount,
        paymentNotes: 'Paid via Razorpay',
      })
    } catch {
      // PARENT role doesn't have backend permission to call recordPayment directly;
      // in production this would be handled by a Razorpay webhook. For demo, proceed.
    }
    setProcessing(false)
    setStep('success')
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={styles.modalBackdrop}>
      <div className="relative w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-6 max-h-[92vh] overflow-y-auto" style={styles.modal}>
        {step === 'gateway' ? (
          <>
            {/* Mock gateway header */}
            <div className="flex items-center gap-2.5 mb-6">
              <div className="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: '#072654' }}>
                <span className="text-white font-bold text-sm">R</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold" style={{ color: colors.text.primary }}>Razorpay</p>
                <p className="text-[12.65px]" style={{ color: colors.text.dim }}>Secure Payment Gateway</p>
              </div>
              <button onClick={onClose} className="p-2 rounded-lg" style={{ color: colors.text.muted }}>
                <X size={16} />
              </button>
            </div>

            {/* Amount */}
            <div className="text-center mb-6 py-4 rounded-2xl" style={{ background: accentAlpha(0.05), border: `1px solid ${accentAlpha(0.12)}` }}>
              <p className="text-3xl font-bold" style={{ color: colors.text.heading }}>
                {formatINR(subscription.totalAmount)}
              </p>
              <p className="text-sm mt-1 font-medium" style={{ color: colors.text.muted }}>{subscription.programName}</p>
              <p className="text-xs mt-0.5" style={{ color: colors.text.dim }}>{subscription.numSessions} sessions</p>
            </div>

            {/* Mock payment method */}
            <div className="mb-5">
              <p className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: colors.text.dim }}>Payment Method</p>
              <div className="rounded-xl px-4 py-3 flex items-center gap-3"
                style={{ background: surface.filterStrip, border: `1.5px solid ${colors.accent}` }}>
                <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                  style={{ borderColor: colors.accent }}>
                  <div className="w-2 h-2 rounded-full" style={{ background: colors.accent }} />
                </div>
                <span className="text-sm font-medium" style={{ color: colors.text.primary }}>UPI</span>
                <span className="ml-auto text-xs" style={{ color: colors.text.dim }}>·····@upi</span>
              </div>
            </div>

            <button
              onClick={handlePay}
              disabled={processing}
              className="w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-50 transition-opacity"
              style={styles.buttonPrimary}
            >
              {processing ? 'Processing…' : `Pay ${formatINR(subscription.totalAmount)}`}
            </button>

            <p className="text-center text-[12.65px] mt-3" style={{ color: colors.text.dim }}>
              Demo only — no real transaction occurs
            </p>
          </>
        ) : (
          <div className="flex flex-col items-center py-6 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
              style={{ background: successAlpha(0.13), color: colors.status.success }}>
              <ShieldCheck size={32} />
            </div>
            <h3 className="text-lg font-bold mb-1" style={{ color: colors.text.heading }}>Payment Successful!</h3>
            <p className="text-sm" style={{ color: colors.text.muted }}>
              {formatINR(subscription.totalAmount)} paid for {subscription.programName}
            </p>
            <p className="text-xs mt-1" style={{ color: colors.text.dim }}>Your therapy sessions are now active.</p>
            <button onClick={onClose}
              className="mt-6 px-8 py-2.5 rounded-xl text-sm font-semibold"
              style={styles.buttonPrimary}>
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Session status helpers ─────────────────────────────────────────────────────

const SESSION_DURATION_OPTIONS = [
  { value: 30,  label: '30 min' },
  { value: 45,  label: '45 min' },
  { value: 60,  label: '60 min' },
  { value: 90,  label: '90 min' },
]


function sessionStatusIcon(status: TherapySessionStatus) {
  if (status === 'COMPLETED') return <CheckCircle2 size={13} style={{ color: colors.status.success }} />
  if (status === 'CANCELLED' || status === 'NO_SHOW') return <XCircle size={13} style={{ color: colors.status.danger }} />
  return <Circle size={13} style={{ color: colors.text.dim }} />
}

// ── PatientSwitcher ────────────────────────────────────────────────────────────
// A dropdown replacement for the old left-hand list column: same jump-to-patient
// job, but it costs nothing until opened instead of holding a permanently
// half-empty strip of the page.

function PatientSwitcher({
  patients,
  currentId,
  search,
  onSearch,
}: {
  patients: PatientResponse[]
  currentId: string
  search: string
  onSearch: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  const q = search.trim().toLowerCase()
  const filtered = patients.filter(
    p => !q || `${p.firstName} ${p.lastName}`.toLowerCase().includes(q)
  )

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
        style={{ color: colors.text.muted, border: `1px solid ${border.divider}` }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = colors.accent; (e.currentTarget as HTMLElement).style.borderColor = colors.accent }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = colors.text.muted; (e.currentTarget as HTMLElement).style.borderColor = border.divider }}
      >
        <Users size={13} /> Switch patient
        <span style={{ color: colors.text.dim }}>({patients.length})</span>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 z-30 w-64 rounded-xl overflow-hidden"
          style={{ background: surface.card, border: border.card, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
        >
          <div className="p-2" style={{ borderBottom: `1px solid ${border.divider}` }}>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: colors.text.dim }} />
              <input
                autoFocus
                className="form-input w-full pl-7 pr-2 py-1.5"
                placeholder="Search patients…"
                value={search}
                onChange={e => onSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: colors.text.dim }}>No patients found</p>
            ) : filtered.map(p => {
              const isActive = p.id === currentId
              return (
                <Link
                  key={p.id}
                  to={`/patients/${p.id}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors"
                  style={isActive ? { background: accentAlpha(0.10) } : undefined}
                  onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = accentAlpha(0.05) }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  <div
                    className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                    style={{ background: accentAlpha(isActive ? 0.20 : 0.08), color: colors.accent }}
                  >
                    {p.firstName[0]}{p.lastName[0]}
                  </div>
                  <div className="min-w-0 flex-1 leading-tight">
                    <p className="text-[13px] font-medium truncate"
                      style={{ color: isActive ? colors.accent : colors.text.primary }}>
                      {p.firstName} {p.lastName}
                    </p>
                    <p className="text-[11px] truncate" style={{ color: colors.text.dim }}>
                      {STAGE_LABELS[p.stage]}
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── EnrollmentModal ────────────────────────────────────────────────────────────

function EnrollmentModal({
  subscriptions,
  patientId,
  preselectedSub,
  onClose,
  onCreated,
}: {
  subscriptions: SubscriptionResponse[]
  patientId: string
  preselectedSub?: SubscriptionResponse
  onClose: () => void
  onCreated: (enrollment: EnrollmentResponse) => void
}) {
  const { toast } = useToast()

  // Step 1 fields
  const [subscriptionId, setSubscriptionId]     = useState(
    preselectedSub?.id ?? subscriptions.find(s => s.status === 'ACTIVE')?.id ?? ''
  )
  const [duration, setDuration]                 = useState<number>(45)
  const [startDate, setStartDate]               = useState('')
  const [startTime, setStartTime]               = useState('')
  const [step, setStep]                         = useState<1 | 2>(1)

  // Review meetings — opt-in, fortnightly by default
  const [wantsReviews, setWantsReviews]         = useState(true)
  const [reviewIntervalWeeks, setReviewIntervalWeeks] = useState(DEFAULT_REVIEW_INTERVAL_WEEKS)
  const [reviewTime, setReviewTime]             = useState('16:00')
  const [reviewDuration, setReviewDuration]     = useState(30)
  const [availableTherapists, setAvailableTherapists] = useState<AvailableTherapistResponse[]>([])
  const [selectedTherapistId, setSelectedTherapistId] = useState('')
  const [findingTherapists, setFindingTherapists]     = useState(false)
  const [step1Errors, setStep1Errors]           = useState<Record<string, string>>({})

  const createMut = useMutation({
    mutationFn: (data: CreateEnrollmentRequest) => enrollmentsApi.create(data),
    onSuccess: (enrollment) => { onCreated(enrollment) },
    onError: (err) => toast(getApiError(err, 'Failed to create enrollment'), 'error'),
  })

  const validateStep1 = () => {
    const e: Record<string, string> = {}
    if (!subscriptionId) e.sub = 'Select a subscription'
    if (!startDate) e.date = 'Select a start date'
    if (!startTime) e.time = 'Select a time'
    setStep1Errors(e)
    return Object.keys(e).length === 0
  }

  const handleFindTherapists = async () => {
    if (!validateStep1()) return
    setFindingTherapists(true)
    try {
      const therapists = await enrollmentsApi.getAvailableTherapists({
        startTime,
        durationMinutes: duration,
        startDate,
      })
      setAvailableTherapists(therapists)
      setStep(2)
    } catch {
      toast('Failed to fetch available therapists', 'error')
    } finally {
      setFindingTherapists(false)
    }
  }

  const handleConfirm = () => {
    if (!selectedTherapistId) { toast('Select a therapist', 'error'); return }
    createMut.mutate({
      subscriptionId,
      patientId,
      therapistId: selectedTherapistId,
      sessionDurationMinutes: duration,
      startDate,
      startTime,
      // No end date sent — the server derives it from the start date and the
      // number of sessions in the plan, and the review series inherits it.
      reviewSchedule: wantsReviews
        ? {
            startTime: reviewTime,
            durationMinutes: reviewDuration,
            intervalWeeks: reviewIntervalWeeks,
          }
        : undefined,
    })
  }

  const paidSubs = subscriptions.filter(s => s.status === 'ACTIVE')

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={styles.modalBackdrop}>
      {/* Wide enough for a two-column form, and capped so a long form scrolls
          inside the card instead of running off the bottom of the screen. */}
      <div
        className="relative w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl p-5 md:p-6 max-h-[92vh] sm:max-h-[88vh] overflow-y-auto"
        style={styles.modal}
      >

        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            {step === 2 && (
              <button onClick={() => setStep(1)} className="p-1.5 rounded-lg" style={{ color: colors.text.muted }}>
                <ChevronRight size={14} className="rotate-180" />
              </button>
            )}
            <h2 className="text-base font-semibold" style={{ color: colors.text.heading }}>
              {step === 1 ? 'New Enrollment' : 'Select Therapist'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2.5 rounded-lg transition-colors" style={{ color: colors.text.muted }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = accentAlpha(0.08)}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
            <X size={16} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex gap-1.5 mb-5 mt-1">
          {[1, 2].map(n => (
            <div key={n} className="h-1 flex-1 rounded-full transition-all"
              style={{ background: n <= step ? colors.accent : border.divider }} />
          ))}
        </div>

        {/* ── Step 1: Slot details ── */}
        {step === 1 && (
          <div className="flex flex-col gap-4">
            {/* Subscription — locked when pre-selected, dropdown otherwise */}
            {preselectedSub ? (
              <div className="rounded-xl px-4 py-3 flex items-center gap-3"
                style={{ background: accentAlpha(0.06), border: `1px solid ${accentAlpha(0.18)}` }}>
                <BookOpen size={15} style={{ color: colors.accent, flexShrink: 0 }} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold" style={{ color: colors.text.heading }}>
                    {preselectedSub.programName}
                  </p>
                  <p className="text-xs" style={{ color: colors.text.muted }}>
                    {preselectedSub.numSessions} sessions · {formatINR(preselectedSub.perSessionCost)}/session
                  </p>
                </div>
                <span className="text-[11.5px] font-bold px-2 py-0.5 rounded-full uppercase"
                  style={{ background: accentAlpha(0.12), color: colors.accent }}>Paid</span>
              </div>
            ) : (
              <div>
                <label className="form-label">Subscription</label>
                <select value={subscriptionId} onChange={e => setSubscriptionId(e.target.value)} className="form-input w-full">
                  <option value="">Select subscription…</option>
                  {paidSubs.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.programName} · {s.numSessions} sessions
                    </option>
                  ))}
                </select>
                {step1Errors.sub && <p className="form-error">{step1Errors.sub}</p>}
              </div>
            )}

            {/* Schedule — two columns on anything wider than a phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
              {/* Duration */}
              <div>
                <label className="form-label">Session Duration</label>
                <select value={duration} onChange={e => setDuration(Number(e.target.value))} className="form-input w-full">
                  {SESSION_DURATION_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {/* Time */}
              <TimePicker
                label="Start Time"
                value={startTime}
                onChange={setStartTime}
                error={step1Errors.time}
              />

              {/* Start date — the plan's end is derived from this plus the session count */}
              <div>
                <label className="form-label">Start Date</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="form-input w-full" />
                {step1Errors.date && <p className="form-error">{step1Errors.date}</p>}
              </div>
            </div>

            {/* Review meetings */}
            <div className="rounded-xl p-3" style={{ background: surface.filterStrip }}>
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={wantsReviews}
                  onChange={e => setWantsReviews(e.target.checked)}
                  className="mt-0.5 h-4 w-4 flex-shrink-0"
                  style={{ accentColor: colors.accent }}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium" style={{ color: colors.text.primary }}>
                    Schedule review meetings
                  </span>
                  <span className="block text-[12.65px] mt-0.5" style={{ color: colors.text.muted }}>
                    Recurring feedback meetings for the therapist and parents, with calendar invites
                  </span>
                </span>
              </label>

              {wantsReviews && (
                <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${border.divider}` }}>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
                    <div>
                      <label className="form-label">Every</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number" min={1} max={26} value={reviewIntervalWeeks}
                          onChange={e => setReviewIntervalWeeks(Math.max(1, Number(e.target.value)))}
                          className="form-input w-full"
                        />
                        <span className="text-xs whitespace-nowrap" style={{ color: colors.text.muted }}>weeks</span>
                      </div>
                    </div>
                    <div>
                      <label className="form-label">For</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number" min={15} max={240} step={15} value={reviewDuration}
                          onChange={e => setReviewDuration(Math.max(15, Number(e.target.value)))}
                          className="form-input w-full"
                        />
                        <span className="text-xs whitespace-nowrap" style={{ color: colors.text.muted }}>min</span>
                      </div>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <TimePicker label="Meeting time" value={reviewTime} onChange={setReviewTime} />
                    </div>
                  </div>
                  <p className="text-[12.65px] mt-3" style={{ color: colors.text.dim }}>
                    Meetings run until the plan's last session.
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={styles.buttonSecondary}>Cancel</button>
              <button
                type="button"
                onClick={handleFindTherapists}
                disabled={findingTherapists}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
                style={styles.buttonPrimary}
              >
                {findingTherapists ? 'Searching…' : 'Find Therapists →'}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Choose therapist ── */}
        {step === 2 && (
          <div className="flex flex-col gap-4">
            {availableTherapists.length === 0 ? (
              <div className="rounded-xl p-4 text-center" style={{ background: surface.filterStrip }}>
                <p className="text-sm font-medium mb-1" style={{ color: colors.text.heading }}>No therapists available</p>
                <p className="text-xs" style={{ color: colors.text.muted }}>
                  No therapist has a slot covering {startTime} for {duration} min on {startDate}, or all are on leave.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {availableTherapists.map(t => {
                  const selected = selectedTherapistId === t.userId
                  return (
                    <button
                      key={t.userId}
                      type="button"
                      onClick={() => setSelectedTherapistId(t.userId)}
                      className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all"
                      style={{
                        background: selected ? accentAlpha(0.10) : surface.filterStrip,
                        border: `1px solid ${selected ? colors.accent : 'transparent'}`,
                      }}
                    >
                      <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{ background: accentAlpha(0.15), color: colors.accent }}>
                        {t.firstName[0]}{t.lastName[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium" style={{ color: colors.text.primary }}>{t.firstName} {t.lastName}</p>
                        <p className="text-xs truncate" style={{ color: colors.text.muted }}>{t.clinicName}</p>
                      </div>
                      {selected && <CheckCircle2 size={16} className="ml-auto flex-shrink-0" style={{ color: colors.accent }} />}
                    </button>
                  )
                })}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setStep(1)} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={styles.buttonSecondary}>Back</button>
              {availableTherapists.length > 0 && (
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={!selectedTherapistId || createMut.isPending}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
                  style={styles.buttonPrimary}
                >
                  {createMut.isPending ? 'Enrolling…' : 'Confirm Enrollment'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Tab config ─────────────────────────────────────────────────────────────────

const TABS = ['Overview', 'Therapy', 'IEP', 'Activities'] as const
type Tab = typeof TABS[number]

// ── Concerns banner ──────────────────────────────────────────────────────────

function ConcernsBanner({ patientId, canAct }: { patientId: string; canAct: boolean }) {
  const qc = useQueryClient()
  const { toast } = useToast()

  const { data: concerns = [] } = useQuery({
    queryKey: ['enrollment-concerns', patientId],
    queryFn: () => concernsApi.list({ patientId }),
  })
  const open = concerns.filter(c => c.status !== 'RESOLVED')

  const ackMut = useMutation({
    mutationFn: (id: string) => concernsApi.acknowledge(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['enrollment-concerns', patientId] }); toast('Concern acknowledged', 'success') },
    onError: (err) => toast(getApiError(err, 'Failed to acknowledge'), 'error'),
  })
  const resolveMut = useMutation({
    mutationFn: (id: string) => concernsApi.resolve(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['enrollment-concerns', patientId] }); toast('Concern resolved', 'success') },
    onError: (err) => toast(getApiError(err, 'Failed to resolve'), 'error'),
  })

  if (open.length === 0) return null

  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: warningAlpha(0.08), border: `1px solid ${warningAlpha(0.25)}` }}>
      <p className="text-xs font-bold uppercase tracking-wide flex items-center gap-1.5" style={{ color: colors.status.warning }}>
        <AlertTriangle size={13} /> {open.length} open concern{open.length === 1 ? '' : 's'}
      </p>
      <div className="space-y-2">
        {open.map(c => (
          <div key={c.id} className="rounded-lg p-3" style={{ background: surface.card }}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="text-xs font-semibold" style={{ color: colors.text.heading }}>{c.programName}</p>
                <p className="text-sm mt-0.5" style={{ color: colors.text.primary }}>{c.description}</p>
                <p className="text-[11px] mt-1" style={{ color: colors.text.dim }}>
                  Raised {format(new Date(c.raisedAt), 'MMM d, yyyy')} · {c.status === 'ACKNOWLEDGED' ? 'Acknowledged' : 'Open'}
                </p>
              </div>
              {canAct && (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {c.status === 'OPEN' && (
                    <button
                      onClick={() => ackMut.mutate(c.id)}
                      className="text-[11.5px] font-semibold px-2 py-1 rounded-lg"
                      style={{ color: colors.accent, background: accentAlpha(0.10) }}
                    >
                      Acknowledge
                    </button>
                  )}
                  <button
                    onClick={() => resolveMut.mutate(c.id)}
                    className="text-[11.5px] font-semibold px-2 py-1 rounded-lg"
                    style={{ color: colors.status.success, background: successAlpha(0.10) }}
                  >
                    Resolve
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Discharge ─────────────────────────────────────────────────────────────────

function CriteriaChip({ label, value, met }: { label: string; value: string; met: boolean | null }) {
  return (
    <div className="rounded-lg p-2.5" style={{ background: accentAlpha(0.05) }}>
      <p className="text-[11px]" style={{ color: colors.text.dim }}>{label}</p>
      <p className="text-sm font-semibold" style={{ color: met ? palette.green.text : colors.text.primary }}>
        {value}
      </p>
    </div>
  )
}

function DischargeModal({ patientId, patientName, onClose }: { patientId: string; patientName: string; onClose: () => void }) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [notes, setNotes] = useState('')

  const { data: preview, isLoading } = useQuery({
    queryKey: ['discharge-preview', patientId],
    queryFn: () => dischargeApi.preview(patientId),
  })

  const dischargeMut = useMutation({
    mutationFn: () => dischargeApi.create(patientId, notes || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patients', patientId] })
      qc.invalidateQueries({ queryKey: ['discharge-history', patientId] })
      toast('Patient discharged', 'success')
      onClose()
    },
    onError: (err) => toast(getApiError(err, 'Failed to discharge patient'), 'error'),
  })

  return (
    <Modal open onClose={onClose} title={`Discharge ${patientName}`} size="lg">
      {isLoading ? (
        <p className="py-8 text-center text-sm" style={{ color: colors.text.muted }}>Loading…</p>
      ) : !preview || preview.enrollments.length === 0 ? (
        <p className="py-8 text-center text-sm" style={{ color: colors.text.muted }}>
          This patient has no active or completed programs to discharge.
        </p>
      ) : (
        <div className="space-y-4">
          {!preview.allCriteriaMet && (
            <div className="rounded-lg p-3 flex items-start gap-2" style={{ background: warningAlpha(0.10) }}>
              <AlertTriangle size={15} style={{ color: colors.status.warning, flexShrink: 0, marginTop: 2 }} />
              <p className="text-xs" style={{ color: colors.text.primary }}>
                Not every program in this episode meets its success criteria yet. You can still discharge — this will be reflected in the report.
              </p>
            </div>
          )}
          <div className="space-y-3">
            {preview.enrollments.map(e => (
              <div key={e.enrollmentId} className="rounded-xl p-3" style={{ background: surface.rowHover }}>
                <p className="text-sm font-semibold" style={{ color: colors.text.heading }}>{e.programName}</p>
                <p className="text-xs mb-2" style={{ color: colors.text.muted }}>{e.therapistName}</p>
                <div className="grid grid-cols-3 gap-2">
                  <CriteriaChip label="Goal mastery" met={e.criteria.goalMasteryMet}
                    value={e.criteria.goalMasteryPct !== null ? `${e.criteria.goalMasteryPct}%` : 'No data'} />
                  <CriteriaChip label="Parent satisfaction" met={e.criteria.parentSatisfactionMet}
                    value={e.criteria.parentSatisfactionPct !== null ? `${Math.round(e.criteria.parentSatisfactionPct)}%` : 'No data'} />
                  <CriteriaChip label="Therapist sign-off" met={e.criteria.therapistSignedOff}
                    value={e.criteria.therapistSignedOff ? 'Confirmed' : 'Pending'} />
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-1">
            <label className="form-label">Discharge notes (optional)</label>
            <textarea
              className="form-input"
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Anything worth recording about this discharge"
            />
          </div>
          <div className="flex items-center gap-2 justify-end pt-2 border-t" style={{ borderColor: border.divider }}>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="danger" onClick={() => dischargeMut.mutate()} loading={dischargeMut.isPending}>
              Confirm Discharge
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

function DischargeHistoryPanel({ patientId }: { patientId: string }) {
  const { toast } = useToast()
  const { data: records = [] } = useQuery({
    queryKey: ['discharge-history', patientId],
    queryFn: () => dischargeApi.list(patientId),
  })

  const downloadMut = useMutation({
    mutationFn: (dischargeId: string) => dischargeApi.pdfUrl(patientId, dischargeId),
    onSuccess: (url) => window.open(url, '_blank', 'noopener,noreferrer'),
    onError: (err) => toast(getApiError(err, 'Failed to prepare PDF'), 'error'),
  })

  if (records.length === 0) return null

  return (
    <Card>
      <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5" style={{ color: colors.text.heading }}>
        <LogOut size={14} /> Discharge History
      </h2>
      <div className="space-y-2">
        {records.map(r => (
          <div key={r.id} className="rounded-xl p-3 flex items-center justify-between gap-3 flex-wrap" style={{ background: surface.rowHover }}>
            <div className="min-w-0">
              <p className="text-sm font-semibold" style={{ color: colors.text.heading }}>
                {format(new Date(r.dischargeDate), 'd MMM yyyy')}
                <span className="ml-2 text-xs font-normal" style={{ color: r.overallSuccessful ? palette.green.text : colors.text.muted }}>
                  {r.overallSuccessful ? 'Successful Completion' : 'Discharged'}
                </span>
              </p>
              <p className="text-xs mt-0.5" style={{ color: colors.text.muted }}>
                {r.enrollments.map(e => e.programName).join(', ') || 'No programs on record'} · by {r.dischargedByName}
              </p>
            </div>
            <button
              onClick={() => downloadMut.mutate(r.id)}
              disabled={downloadMut.isPending}
              className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg flex-shrink-0"
              style={{ color: colors.accent, background: accentAlpha(0.10) }}
            >
              <Download size={12} /> PDF
            </button>
          </div>
        ))}
      </div>
    </Card>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { toasts, toast, dismiss } = useToast()
  const { user, activeRole } = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const [editModal,        setEditModal]        = useState(false)
  const [deleteConfirm,    setDeleteConfirm]    = useState(false)
  const [conditionModal,       setConditionModal]       = useState(false)
  const [selectedConditionIds, setSelectedConditionIds] = useState<string[]>([])
  const [parentModal,      setParentModal]      = useState(false)
  const [therapistModal,   setTherapistModal]   = useState(false)
  const [subModal,         setSubModal]         = useState(false)
  const [paymentTarget,    setPaymentTarget]    = useState<SubscriptionResponse | null>(null)
  const [mockPayTarget,    setMockPayTarget]    = useState<SubscriptionResponse | null>(null)
  const [enrollForSub,     setEnrollForSub]     = useState<SubscriptionResponse | null>(null)
  const [changeTherapistFor, setChangeTherapistFor] = useState<EnrollmentResponse | null>(null)
  const [activeTab,        setActiveTab]        = useState<Tab>('Overview')
  const [sidebarSearch,    setSidebarSearch]    = useState('')
  const [dischargeModal,   setDischargeModal]   = useState(false)

  // Derive role early so queries can use it as a gate
  const currentRoleEarly = activeRole ?? user?.role
  const isParentRole = currentRoleEarly === 'PARENT'

  const { data: patient, isLoading } = useQuery({
    queryKey: ['patients', id],
    queryFn: () => patientsApi.get(id!),
    enabled: !!id,
  })
  const { data: conditions } = useQuery({ queryKey: ['conditions'], queryFn: conditionsApi.list })
  const { data: clinics }    = useQuery({ queryKey: ['clinics'],    queryFn: clinicsApi.list })

  // Sidebar patient list — PARENT cannot call GET /patients (403), skip it
  const { data: allPatients = [] } = useQuery({
    queryKey: ['patients'],
    queryFn: patientsApi.list,
    staleTime: 2 * 60 * 1000,
    enabled: !isParentRole,
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['patients', id] })

  // Delete patient
  const deletePatientMut = useMutation({
    mutationFn: () => patientsApi.delete(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      navigate(ROUTES.patients)
    },
    onError: (err) => toast(getApiError(err, 'Failed to delete patient'), 'error'),
  })

  // Stage mutation
  const stageMutation = useMutation({
    mutationFn: (stage: PatientStage) => patientsApi.updateStage(id!, stage),
    onSuccess: () => { refresh(); toast('Stage updated', 'success') },
    onError:   (err) => toast(getApiError(err, 'Failed to update stage'), 'error'),
  })

  // Condition mutations
  const conditionForm = useForm<{ diagnosedAt: string; notes: string }>()
  const addConditionMutation = useMutation({
    mutationFn: async ({ conditionIds, diagnosedAt, notes }: { conditionIds: string[]; diagnosedAt?: string; notes?: string }) => {
      for (const conditionId of conditionIds) {
        await patientsApi.addCondition(id!, { conditionId, diagnosedAt: diagnosedAt || undefined, notes: notes || undefined })
      }
    },
    onSuccess: () => {
      refresh()
      toast('Condition(s) added', 'success')
      setConditionModal(false)
      setSelectedConditionIds([])
      conditionForm.reset()
    },
    onError: (err) => toast(getApiError(err, 'Failed to add condition'), 'error'),
  })
  const removeConditionMutation = useMutation({
    mutationFn: (conditionId: string) => patientsApi.removeCondition(id!, conditionId),
    onSuccess: () => { refresh(); toast('Condition removed', 'success') },
  })

  // Parent mutations
  const [selectedParent, setSelectedParent] = useState<UserResponse | null>(null)
  const linkParentMutation = useMutation({
    mutationFn: (d: LinkParentRequest) => patientsApi.linkParent(id!, d),
    onSuccess: () => { refresh(); toast('Parent linked', 'success'); setParentModal(false); setSelectedParent(null) },
    onError: (e) => toast(getApiError(e, 'Failed to link parent'), 'error'),
  })
  const unlinkParentMutation = useMutation({
    mutationFn: (parentId: string) => patientsApi.unlinkParent(id!, parentId),
    onSuccess: () => { refresh(); toast('Parent unlinked', 'success') },
  })

  // Therapist mutations
  const [selectedTherapist, setSelectedTherapist] = useState<UserResponse | null>(null)
  const assignTherapistMutation = useMutation({
    mutationFn: (d: AssignTherapistRequest) => patientsApi.assignTherapist(id!, d),
    onSuccess: () => { refresh(); toast('Therapist assigned', 'success'); setTherapistModal(false); setSelectedTherapist(null) },
    onError: (e) => toast(getApiError(e, 'Failed to assign therapist'), 'error'),
  })
  const unassignTherapistMutation = useMutation({
    mutationFn: (therapistId: string) => patientsApi.unassignTherapist(id!, therapistId),
    onSuccess: () => { refresh(); toast('Therapist unassigned', 'success') },
  })

  // Subscriptions query + mutations
  const { data: subscriptions = [], refetch: refetchSubs } = useQuery({
    queryKey: ['subscriptions', id],
    queryFn: () => subscriptionsApi.listForPatient(id!),
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
  })

  const cancelSubMutation = useMutation({
    mutationFn: (subId: string) => subscriptionsApi.cancel(subId),
    onSuccess: () => { refetchSubs(); toast('Subscription cancelled', 'success') },
    onError: (err) => toast(getApiError(err, 'Failed to cancel subscription'), 'error'),
  })

  // Enrollments query + mutations
  const { data: enrollments = [], refetch: refetchEnrollments } = useQuery({
    queryKey: ['enrollments', id],
    queryFn: () => enrollmentsApi.listForPatient(id!),
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
  })

  const cancelEnrollmentMutation = useMutation({
    mutationFn: (enrollId: string) => enrollmentsApi.cancel(enrollId),
    onSuccess: () => { refetchEnrollments(); toast('Enrollment cancelled', 'success') },
    onError: (err) => toast(getApiError(err, 'Failed to cancel enrollment'), 'error'),
  })

  const editForm = useForm<{ firstName: string; lastName: string; dateOfBirth: string; gender: string; notes: string }>()
  const updatePatientMutation = useMutation({
    mutationFn: (data: { firstName: string; lastName: string; dateOfBirth: string; gender: string; notes: string }) =>
      patientsApi.update(id!, {
        firstName:   data.firstName   || undefined,
        lastName:    data.lastName    || undefined,
        dateOfBirth: data.dateOfBirth || undefined,
        gender:      (data.gender as 'MALE' | 'FEMALE' | 'OTHER') || undefined,
        notes:       data.notes       || undefined,
      }),
    onSuccess: () => { refresh(); toast('Patient details updated', 'success'); setEditModal(false) },
    onError:   (err) => toast(getApiError(err, 'Failed to update patient'), 'error'),
  })

  if (isLoading) return <PageLoader />
  if (!patient)  return <p className="text-sm" style={{ color: colors.text.muted }}>Patient not found</p>

  const conditionOptions = (conditions ?? [])
    .filter((c) => !patient.conditions.some((pc) => pc.id === c.id))
    .map((c) => ({ value: c.id, label: c.name }))
  const clinicName = clinics?.find((c) => c.id === patient.clinicId)?.name ?? '—'

  const currentRole = currentRoleEarly
  const isParent            = isParentRole
  const canChangeStage      = ['BUSINESS_OWNER', 'CLINIC_HEAD', 'DOCTOR'].includes(currentRole ?? '')
  const canManageSubs       = ['BUSINESS_OWNER', 'CLINIC_HEAD'].includes(currentRole ?? '')
  const canRecordPayment    = ['CLINIC_HEAD', 'BUSINESS_OWNER'].includes(currentRole ?? '')
  const canCreateEnrollment = ['CLINIC_HEAD', 'BUSINESS_OWNER'].includes(currentRole ?? '')
  const canEditDetails      = ['BUSINESS_OWNER', 'CLINIC_HEAD'].includes(currentRole ?? '')
  const canDelete           = currentRole === 'BUSINESS_OWNER'
  const hasActiveSubscription = subscriptions.some(s => s.status === 'ACTIVE')

  // Shared remove-button style (hover via event handlers)
  const removeBtn = (onClick: () => void) => (
    <button
      onClick={onClick}
      className="ml-2 rounded-lg p-1.5 transition-colors flex-shrink-0"
      style={{ color: colors.text.dim }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.color = colors.status.danger
        ;(e.currentTarget as HTMLElement).style.background = 'dangerAlpha(0.08)'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.color = colors.text.dim
        ;(e.currentTarget as HTMLElement).style.background = 'transparent'
      }}
    >
      <X size={14} />
    </button>
  )

  return (
    <div className="max-w-4xl mx-auto space-y-5">

      {/* Back link + patient switcher — replaces the old always-on list column,
          which sat mostly empty and ate a fixed slice of the page width. */}
      <div className="flex items-center justify-between gap-3">
        <Link
          to="/patients"
          className="inline-flex items-center gap-1 text-sm transition-colors"
          style={{ color: colors.text.muted }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = colors.accent}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = colors.text.muted}
        >
          <ArrowLeft size={14} /> Patients
        </Link>

        {!isParentRole && (
          <PatientSwitcher
            patients={allPatients}
            currentId={id!}
            search={sidebarSearch}
            onSearch={setSidebarSearch}
          />
        )}
      </div>

      <ConcernsBanner patientId={id!} canAct={!isParentRole} />

      {/* ── Page header (always visible) ─────────────────────────────────── */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div
            className="h-10 w-10 rounded-full font-bold text-base flex items-center justify-center flex-shrink-0"
            style={{ background: accentAlpha(0.10), color: colors.accent }}
          >
            {patient.firstName[0]}{patient.lastName[0]}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold" style={{ color: colors.text.heading }}>
              {patient.firstName} {patient.lastName}
            </h1>
            <p className="text-sm" style={{ color: colors.text.muted }}>{clinicName}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {canEditDetails && (
              <button
                onClick={() => {
                  editForm.reset({
                    firstName:   patient.firstName,
                    lastName:    patient.lastName,
                    dateOfBirth: patient.dateOfBirth ?? '',
                    gender:      patient.gender ?? '',
                    notes:       patient.notes ?? '',
                  })
                  setEditModal(true)
                }}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                style={{ color: colors.text.muted, border: `1px solid ${border.divider}` }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = colors.accent; (e.currentTarget as HTMLElement).style.borderColor = colors.accent }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = colors.text.muted; (e.currentTarget as HTMLElement).style.borderColor = border.divider }}
              >
                <Pencil size={13} /> Edit
              </button>
            )}
            {canChangeStage && patient.stage !== 'DISCHARGED' && (
              <button
                onClick={() => setDischargeModal(true)}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                style={{ color: colors.status.warning, border: `1px solid ${colors.status.warning}30` }}
              >
                <LogOut size={13} /> Discharge Patient
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => setDeleteConfirm(true)}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                style={{ color: colors.status.error, border: `1px solid ${colors.status.error}20` }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'dangerAlpha(0.08)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <Trash2 size={13} /> Delete
              </button>
            )}
          </div>
        </div>

        {/* Read-only stage progress */}
        <StageProgress current={patient.stage} />
      </Card>

      <DischargeHistoryPanel patientId={id!} />

      {dischargeModal && (
        <DischargeModal
          patientId={id!}
          patientName={`${patient.firstName} ${patient.lastName}`}
          onClose={() => setDischargeModal(false)}
        />
      )}

      {/* ── Tab strip ────────────────────────────────────────────────────── */}
      <div className="flex gap-0 border-b overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0" style={{ borderColor: border.divider }}>
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex-shrink-0 whitespace-nowrap px-4 py-2.5 text-sm font-medium -mb-px transition-colors"
            style={activeTab === tab ? styles.tabActive : styles.tabInactive}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Overview tab ─────────────────────────────────────────────────── */}
      {activeTab === 'Overview' && (
          <div className="space-y-4">
            <JourneyCard
              patient={patient}
              subscriptions={subscriptions}
              enrollments={enrollments}
              canManage={canManageSubs || canCreateEnrollment}
              onAddSubscription={() => setSubModal(true)}
              onSetupSchedule={() => {
                const paidSub = subscriptions.find(s => s.status === 'ACTIVE' && s.paymentStatus === 'PAID')
                if (paidSub) setEnrollForSub(paidSub)
              }}
              onRecordPayment={(sub) => setPaymentTarget(sub)}
              onPayNow={isParent ? (sub) => setMockPayTarget(sub) : undefined}
              onOpenDetails={() => setActiveTab('Therapy')}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Parents / Guardians */}
              <Card>
                <CardHeader
                  title="Parents / Guardians"
                  subtitle={`${patient.parents.length} linked`}
                  action={<Button size="sm" onClick={() => setParentModal(true)}><Plus size={14} /> Link</Button>}
                />
                {!patient.parents.length ? (
                  <p className="text-sm" style={{ color: colors.text.dim }}>No parents linked.</p>
                ) : (
                  <div className="divide-subtle">
                    {patient.parents.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between gap-3 py-3"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
                            style={styles.avatar}
                          >
                            {p.firstName[0]}{p.lastName[0]}
                          </div>
                          <div>
                            <p className="text-sm font-medium" style={{ color: colors.text.primary }}>{p.firstName} {p.lastName}</p>
                            <p className="text-xs mt-0.5" style={{ color: colors.text.muted }}>{p.email}</p>
                          </div>
                        </div>
                        {removeBtn(() => unlinkParentMutation.mutate(p.id))}
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Assigned Therapists */}
              <Card>
                <CardHeader
                  title="Assigned Therapists"
                  subtitle={`${patient.therapists.length} assigned`}
                  action={<Button size="sm" onClick={() => setTherapistModal(true)}><Plus size={14} /> Assign</Button>}
                />
                {!patient.therapists.length ? (
                  <p className="text-sm" style={{ color: colors.text.dim }}>No therapists assigned.</p>
                ) : (
                  <div className="divide-subtle">
                    {patient.therapists.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between gap-3 py-3"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
                            style={styles.avatar}
                          >
                            {t.firstName[0]}{t.lastName[0]}
                          </div>
                          <div>
                            <p className="text-sm font-medium" style={{ color: colors.text.primary }}>{t.firstName} {t.lastName}</p>
                            <p className="text-xs mt-0.5" style={{ color: colors.text.muted }}>
                              Assigned {format(new Date(t.assignedAt), 'MMM d, yyyy')}
                            </p>
                          </div>
                        </div>
                        {removeBtn(() => unassignTherapistMutation.mutate(t.id))}
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Patient Info */}
              <Card>
                <CardHeader title="Patient Info" />
                <dl className="grid grid-cols-2 gap-x-4 gap-y-5">
                  {[
                    ['Date of Birth', patient.dateOfBirth ? format(new Date(patient.dateOfBirth), 'MMM d, yyyy') : null],
                    ['Gender', patient.gender?.toLowerCase()],
                    ['Clinic', clinicName],
                    ['Status', patient.isActive ? 'Active' : 'Inactive'],
                  ].map(([label, value]) => (
                    <div key={label as string}>
                      <dt className="text-xs font-medium uppercase tracking-wider" style={{ color: colors.text.dim }}>{label}</dt>
                      <dd className="mt-1 text-sm capitalize" style={{ color: colors.text.primary }}>
                        {value || <span style={{ color: colors.text.dim }}>—</span>}
                      </dd>
                    </div>
                  ))}
                </dl>
                {patient.notes && (
                  <div
                    className="mt-4 rounded-xl p-3 text-sm"
                    style={{ background: surface.sidebarFooter, color: colors.text.muted, border: `1px solid ${border.divider}` }}
                  >
                    {patient.notes}
                  </div>
                )}
              </Card>

              {/* Conditions */}
              <Card>
                <CardHeader
                  title="Conditions"
                  subtitle={`${patient.conditions.length} condition${patient.conditions.length !== 1 ? 's' : ''}`}
                  action={canEditDetails ? <Button size="sm" onClick={() => setConditionModal(true)}><Plus size={14} /> Add</Button> : undefined}
                />
                {!patient.conditions.length ? (
                  <p className="text-sm" style={{ color: colors.text.dim }}>No conditions recorded.</p>
                ) : (
                  <div className="divide-subtle">
                    {patient.conditions.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-start justify-between gap-3 py-3"
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className="h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                            style={{ background: accentAlpha(0.08) }}
                          >
                            <Heart size={13} style={{ color: colors.accent }} />
                          </div>
                          <div>
                            <p className="text-sm font-medium" style={{ color: colors.text.primary }}>{c.name}</p>
                            {c.diagnosedAt && (
                              <p className="text-xs mt-0.5" style={{ color: colors.text.muted }}>
                                Diagnosed {format(new Date(c.diagnosedAt), 'MMM yyyy')}
                              </p>
                            )}
                            {c.notes && <p className="text-xs italic mt-0.5" style={{ color: colors.text.muted }}>{c.notes}</p>}
                          </div>
                        </div>
                        {canEditDetails && removeBtn(() => removeConditionMutation.mutate(c.id))}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            <CaseHistoryCard patientId={patient.id} canEdit={canEditDetails} />
        </div>
      )}

      {/* ── Therapy tab ──────────────────────────────────────────────────── */}
      {activeTab === 'Therapy' && (
        <div className="space-y-4">
          {/* Programs — merged subscription + enrollment */}
          <Card>
            <CardHeader
              title="Programs"
              subtitle={`${subscriptions.length} program${subscriptions.length !== 1 ? 's' : ''}`}
              action={
                canManageSubs ? (
                  <Button size="sm" onClick={() => setSubModal(true)}>
                    <Plus size={14} /> Add
                  </Button>
                ) : undefined
              }
            />

            {subscriptions.length === 0 ? (
              <p className="text-sm" style={{ color: colors.text.dim }}>No programs yet.</p>
            ) : (
              <div className="space-y-4">
                {/* Cancelled plans sink to the bottom and render as a single quiet line */}
                {[...subscriptions]
                  .sort((a, b) => Number(a.status === 'CANCELLED') - Number(b.status === 'CANCELLED'))
                  .map(sub => {
                  const isCancelled   = sub.status === 'CANCELLED'
                  const enrollment    = enrollments.find(e => e.subscriptionId === sub.id && e.status === 'ACTIVE')
                  const isEnrolled    = !!enrollment
                  const isPaid        = sub.paymentStatus === 'PAID'
                  const alreadyEnrolled = isEnrolled
                  const canEnroll     = canCreateEnrollment && isPaid && !alreadyEnrolled && !isCancelled

                  const sessionsCompleted = enrollment?.sessionsCompleted ?? 0
                  const progressPct       = sub.numSessions > 0
                    ? Math.min(100, (sessionsCompleted / sub.numSessions) * 100)
                    : 0

                  // A cancelled plan has no progress worth showing — a full card with a
                  // 0% hero just reads as a live plan that isn't working. One line instead.
                  if (isCancelled) {
                    return (
                      <div
                        key={sub.id}
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2"
                        style={{ background: surface.filterStrip, border: `1px solid ${border.divider}` }}
                      >
                        <Ban size={13} className="flex-shrink-0" style={{ color: colors.text.dim }} />
                        <p className="text-xs font-medium truncate flex-1" style={{ color: colors.text.muted }}>
                          {sub.programName}
                        </p>
                        <span className="text-[12.65px] flex-shrink-0" style={{ color: colors.text.dim }}>
                          {formatINR(sub.amountPaid)} paid
                        </span>
                        <span
                          className="text-[11.5px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide flex-shrink-0"
                          style={{ background: surface.card, color: colors.text.dim }}
                        >
                          Cancelled
                        </span>
                      </div>
                    )
                  }

                  return (
                    <div
                      key={sub.id}
                      className="rounded-2xl overflow-hidden"
                      style={{ border: `1px solid ${accentAlpha(0.18)}` }}
                    >
                      <div className="p-4" style={{ background: accentAlpha(0.03) }}>
                        {/* Header: icon + program name + therapist + badges */}
                        <div className="flex items-start justify-between gap-3 mb-4">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
                              style={{ background: accentAlpha(0.10) }}
                            >
                              <BookOpen size={15} style={{ color: colors.accent }} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold truncate" style={{ color: colors.text.heading }}>
                                {sub.programName}
                              </p>
                              {enrollment && (
                                <p className="text-xs mt-0.5 truncate" style={{ color: colors.text.muted }}>
                                  {enrollment.therapistFirstName} {enrollment.therapistLastName}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span
                              className="text-[11.5px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
                              style={paymentStatusStyle(sub.paymentStatus)}
                            >
                              {sub.paymentStatus === 'PAID' ? 'Paid' : sub.paymentStatus === 'PARTIAL' ? 'Partial' : 'Unpaid'}
                            </span>
                            {isEnrolled && (
                              <span
                                className="text-[11.5px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
                                style={paletteStyle('teal', 0.12, 0)}
                              >
                                Active
                              </span>
                            )}
                            {!isEnrolled && isPaid && !isCancelled && (
                              <span
                                className="text-[11.5px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
                                style={paletteStyle('yellow', 0.14, 0)}
                              >
                                Not enrolled
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Session progress — hero element */}
                        <div className="mb-4">
                          <div className="flex items-end justify-between mb-2">
                            <div>
                              <p className="leading-none" style={{ color: colors.text.heading }}>
                                <span className="text-3xl font-bold">{sessionsCompleted}</span>
                                <span className="text-lg font-medium ml-1.5" style={{ color: colors.text.muted }}>
                                  / {sub.numSessions}
                                </span>
                              </p>
                              <p className="text-[11.5px] uppercase tracking-wider mt-1.5" style={{ color: colors.text.dim }}>
                                sessions completed
                              </p>
                            </div>
                            <p
                              className="text-2xl font-bold leading-none mb-0.5"
                              style={{
                                color: progressPct >= 100
                                  ? palette.green.text
                                  : progressPct > 0
                                    ? colors.accent
                                    : colors.text.dim,
                              }}
                            >
                              {Math.round(progressPct)}%
                            </p>
                          </div>
                          <div className="h-2.5 rounded-full overflow-hidden" style={{ background: accentAlpha(0.10) }}>
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${progressPct}%`,
                                background: progressPct >= 100 ? palette.green.text : colors.accent,
                                minWidth: sessionsCompleted > 0 ? '6px' : '0',
                              }}
                            />
                          </div>
                        </div>

                        {/* Details strip: schedule + payment inline */}
                        <div
                          className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-4 pb-4 border-b text-xs"
                          style={{ borderColor: border.divider, color: colors.text.muted }}
                        >
                          {isEnrolled && enrollment && (
                            <>
                              <span className="flex items-center gap-1.5">
                                <CalendarDays size={11} style={{ color: colors.text.dim }} />
                                {enrollment.startDate}
                              </span>
                              <span className="flex items-center gap-1.5">
                                <Clock size={11} style={{ color: colors.text.dim }} />
                                {enrollment.startTime.slice(0, 5)} · {enrollment.sessionDurationMinutes}min
                              </span>
                            </>
                          )}
                          <span className="flex items-center gap-1.5">
                            <IndianRupee size={11} style={{ color: colors.text.dim }} />
                            {formatINR(sub.amountPaid)} paid
                            {sub.discountPercent > 0 && ` · ${sub.discountPercent}% off`}
                          </span>
                          {sub.paymentNotes && (
                            <span className="italic">{sub.paymentNotes}</span>
                          )}
                        </div>

                        {/* Actions: primary left, destructive right */}
                        {!isCancelled && (
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              {canEnroll && (
                                <button
                                  onClick={() => setEnrollForSub(sub)}
                                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors"
                                  style={{ color: '#fff', background: colors.accent }}
                                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.88'}
                                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
                                >
                                  <UserCheck size={12} /> Assign Therapist
                                </button>
                              )}
                              {isEnrolled && enrollment && canCreateEnrollment && !isCancelled && (
                                <button
                                  onClick={() => setChangeTherapistFor(enrollment)}
                                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors"
                                  style={{ color: colors.text.muted, background: surface.filterStrip }}
                                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = colors.accent}
                                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = colors.text.muted}
                                >
                                  <UserCheck size={12} /> Change Therapist
                                </button>
                              )}
                              {isEnrolled && enrollment && (
                                <Link
                                  to={ROUTES.enrollment(id!, enrollment.id)}
                                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors"
                                  style={{ color: colors.text.muted, background: surface.filterStrip }}
                                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = colors.accent}
                                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = colors.text.muted}
                                >
                                  <ClipboardList size={12} />
                                  View Sessions
                                </Link>
                              )}
                              {canRecordPayment && !isPaid && (
                                <button
                                  onClick={() => setPaymentTarget(sub)}
                                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors"
                                  style={{ color: '#fff', background: colors.accent }}
                                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.88'}
                                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
                                >
                                  <IndianRupee size={12} /> Record Payment
                                </button>
                              )}
                              {isParent && !isPaid && (
                                <button
                                  onClick={() => setMockPayTarget(sub)}
                                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors"
                                  style={{ color: '#fff', background: colors.accent }}
                                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.88'}
                                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
                                >
                                  <CreditCard size={12} /> Pay Now
                                </button>
                              )}
                            </div>
                            {canManageSubs && (
                              <div className="flex items-center gap-1">
                                {isEnrolled && enrollment && (
                                  <button
                                    onClick={() => cancelEnrollmentMutation.mutate(enrollment.id)}
                                    disabled={cancelEnrollmentMutation.isPending}
                                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                                    style={{ color: colors.status.error }}
                                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'dangerAlpha(0.08)'}
                                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                                  >
                                    Cancel Enrollment
                                  </button>
                                )}
                                <button
                                  onClick={() => cancelSubMutation.mutate(sub.id)}
                                  disabled={cancelSubMutation.isPending}
                                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                                  style={{ color: colors.status.error }}
                                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'dangerAlpha(0.08)'}
                                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                                >
                                  Cancel Plan
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Review meetings — available for any ongoing plan */}
                      {isEnrolled && enrollment && (
                        <div style={{ borderTop: `1px solid ${border.divider}` }}>
                          <ReviewMeetingsPanel
                            enrollmentId={enrollment.id}
                            enrollmentStartDate={enrollment.startDate}
                            enrollmentEndDate={enrollment.endDate}
                            therapistId={enrollment.therapistId}
                            currentUserId={user?.id ?? ''}
                            canSchedule={canCreateEnrollment}
                            canGiveTherapistFeedback={
                              currentRole === 'THERAPIST' || currentRole === 'DOCTOR'
                            }
                            isParent={isParent}
                          />
                        </div>
                      )}

                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── IEP tab ──────────────────────────────────────────────────────── */}
      {activeTab === 'IEP' && <IEPTab patientId={id!} />}

      {activeTab === 'Activities' && <ActivitiesTab patientId={id!} />}

      {/* ── Modals ───────────────────────────────────────────────────────── */}
      <Modal open={conditionModal} onClose={() => { setConditionModal(false); setSelectedConditionIds([]); conditionForm.reset() }} title="Add Condition">
        <form
          onSubmit={conditionForm.handleSubmit((d) =>
            addConditionMutation.mutate({ conditionIds: selectedConditionIds, diagnosedAt: d.diagnosedAt, notes: d.notes })
          )}
          className="space-y-4"
        >
          <div>
            <label className="form-label">Conditions</label>
            {conditionOptions.length === 0 ? (
              <p className="text-sm" style={{ color: colors.text.dim }}>All conditions already added.</p>
            ) : (
              <div className="flex flex-wrap gap-2 mt-1">
                {conditionOptions.map(opt => {
                  const selected = selectedConditionIds.includes(opt.value)
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSelectedConditionIds(prev =>
                        selected ? prev.filter(id => id !== opt.value) : [...prev, opt.value]
                      )}
                      className="px-3 py-1.5 rounded-full text-sm font-medium transition-all"
                      style={selected
                        ? { background: 'var(--color-accent)', color: '#fff' }
                        : { background: surface.card, color: colors.text.primary, border: `1px solid ${border.divider}` }
                      }
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            )}
            {selectedConditionIds.length > 0 && (
              <p className="text-xs mt-1.5" style={{ color: colors.text.dim }}>
                {selectedConditionIds.length} selected
              </p>
            )}
          </div>
          <Input label="Diagnosed on (optional)" type="date" {...conditionForm.register('diagnosedAt')} />
          <div>
            <label className="form-label">Notes</label>
            <textarea className="form-input resize-none min-h-[80px]" {...conditionForm.register('notes')} />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => { setConditionModal(false); setSelectedConditionIds([]); conditionForm.reset() }}>Cancel</Button>
            <Button type="submit" loading={addConditionMutation.isPending} disabled={selectedConditionIds.length === 0}>Add</Button>
          </div>
        </form>
      </Modal>

      <Modal open={parentModal} onClose={() => { setParentModal(false); setSelectedParent(null) }} title="Link a Parent">
        <div className="space-y-4">
          <UserSearchPicker
            role="PARENT"
            selected={selectedParent}
            onSelect={setSelectedParent}
            onClear={() => setSelectedParent(null)}
            label="Search parent by email"
            placeholder="e.g. jane@example.com"
          />
          {!selectedParent && (
            <p className="text-xs" style={{ color: colors.text.dim }}>
              The person must already have an account with the <strong>Parent</strong> role in your organisation.
            </p>
          )}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => { setParentModal(false); setSelectedParent(null) }}>Cancel</Button>
            <Button
              disabled={!selectedParent}
              loading={linkParentMutation.isPending}
              onClick={() => selectedParent && linkParentMutation.mutate({ parentId: selectedParent.id })}
            >
              Link Parent
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={therapistModal} onClose={() => { setTherapistModal(false); setSelectedTherapist(null) }} title="Assign a Therapist">
        <div className="space-y-4">
          <UserSearchPicker
            role="THERAPIST"
            selected={selectedTherapist}
            onSelect={setSelectedTherapist}
            onClear={() => setSelectedTherapist(null)}
            label="Search therapist by email"
            placeholder="e.g. john@clinic.com"
          />
          {!selectedTherapist && (
            <p className="text-xs" style={{ color: colors.text.dim }}>
              The person must already have an account with the <strong>Therapist</strong> role in your organisation.
            </p>
          )}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => { setTherapistModal(false); setSelectedTherapist(null) }}>Cancel</Button>
            <Button
              disabled={!selectedTherapist}
              loading={assignTherapistMutation.isPending}
              onClick={() => selectedTherapist && assignTherapistMutation.mutate({ therapistId: selectedTherapist.id })}
            >
              Assign Therapist
            </Button>
          </div>
        </div>
      </Modal>

      {/* Enrollment modal */}
      {enrollForSub && (
        <EnrollmentModal
          subscriptions={subscriptions}
          patientId={id!}
          preselectedSub={enrollForSub}
          onClose={() => setEnrollForSub(null)}
          onCreated={() => {
            refetchEnrollments()
            refetchSubs()
            toast('Enrollment created — sessions generated', 'success')
            setEnrollForSub(null)
          }}
        />
      )}

      {/* Create subscription modal */}
      {subModal && (
        <CreateSubscriptionModal
          patientId={id!}
          onClose={() => setSubModal(false)}
          onCreated={() => { refetchSubs(); toast('Subscription created', 'success'); setSubModal(false) }}
        />
      )}

      {/* Record payment modal (staff) */}
      {paymentTarget && (
        <RecordPaymentModal
          subscription={paymentTarget}
          onClose={() => setPaymentTarget(null)}
          onSaved={() => { refetchSubs(); toast('Payment recorded', 'success'); setPaymentTarget(null) }}
        />
      )}

      {/* Mock Razorpay modal (PARENT) */}
      {mockPayTarget && (
        <MockRazorpayModal
          subscription={mockPayTarget}
          onClose={() => setMockPayTarget(null)}
          onSaved={() => { refetchSubs(); refetchEnrollments() }}
        />
      )}

      {/* Change the therapist on an ongoing plan */}
      {changeTherapistFor && (
        <ChangeTherapistModal
          enrollment={changeTherapistFor}
          onClose={() => setChangeTherapistFor(null)}
          onSaved={() => {
            refetchEnrollments()
            queryClient.invalidateQueries({ queryKey: ['therapy-sessions-enrollment'] })
            queryClient.invalidateQueries({ queryKey: ['review-meetings'] })
            toast('Therapist changed — upcoming sessions moved across', 'success')
            setChangeTherapistFor(null)
          }}
        />
      )}

      {/* Edit patient details modal */}
      <Modal open={editModal} onClose={() => setEditModal(false)} title="Edit Patient Details">
        <form
          onSubmit={editForm.handleSubmit((data) => updatePatientMutation.mutate(data))}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="First name"
              {...editForm.register('firstName', { required: 'Required' })}
              error={editForm.formState.errors.firstName?.message}
            />
            <Input
              label="Last name"
              {...editForm.register('lastName', { required: 'Required' })}
              error={editForm.formState.errors.lastName?.message}
            />
            <Input
              label="Date of birth"
              type="date"
              {...editForm.register('dateOfBirth')}
            />
            <Select
              label="Gender"
              placeholder="Select…"
              options={[
                { value: 'MALE',   label: 'Male' },
                { value: 'FEMALE', label: 'Female' },
                { value: 'OTHER',  label: 'Other' },
              ]}
              {...editForm.register('gender')}
            />
          </div>
          <div>
            <label className="form-label">Notes</label>
            <textarea
              className="form-input resize-none min-h-[80px]"
              placeholder="Any additional notes…"
              {...editForm.register('notes')}
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setEditModal(false)}>Cancel</Button>
            <Button type="submit" loading={updatePatientMutation.isPending}>Save changes</Button>
          </div>
        </form>
      </Modal>

      {/* Delete patient confirmation */}
      <Modal open={deleteConfirm} onClose={() => setDeleteConfirm(false)} title="Delete Patient">
        <div className="space-y-4">
          <p className="text-sm" style={{ color: colors.text.primary }}>
            Are you sure you want to permanently delete <strong>{patient.firstName} {patient.lastName}</strong>?
            This will remove all their conditions, parent links, therapist assignments, and cannot be undone.
          </p>
          <div className="flex gap-3">
            <Button variant="danger" onClick={() => deletePatientMut.mutate()} loading={deletePatientMut.isPending}>
              <Trash2 size={14} /> Delete permanently
            </Button>
            <Button variant="secondary" onClick={() => setDeleteConfirm(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}


// ── Change therapist on an ongoing plan ───────────────────────────────────────

function ChangeTherapistModal({
  enrollment, onClose, onSaved,
}: {
  enrollment: EnrollmentResponse
  onClose: () => void
  onSaved: () => void
}) {
  const [therapistId, setTherapistId] = useState('')
  const [reason, setReason]           = useState('')
  const [error, setError]             = useState('')

  const { data: therapists = [], isLoading } = useQuery({
    queryKey: ['therapists'],
    queryFn:  () => usersApi.listTherapists(),
  })

  const options = therapists
    .filter((t: UserResponse) => t.id !== enrollment.therapistId)
    .map((t: UserResponse) => ({
      value: t.id,
      label: `${t.firstName} ${t.lastName}${t.role === 'DOCTOR' ? ' (Doctor)' : ''}`,
    }))

  const mut = useMutation({
    mutationFn: () => enrollmentsApi.changeTherapist(enrollment.id, therapistId, reason.trim() || undefined),
    onSuccess: onSaved,
    onError: (err: unknown) => setError(getApiError(err, 'Could not change the therapist')),
  })

  return (
    <Modal open title="Change therapist" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="rounded-xl px-3 py-2.5 text-sm"
          style={{ background: surface.rowHover, color: colors.text.muted }}>
          Currently with{' '}
          <span style={{ color: colors.text.primary, fontWeight: 600 }}>
            {enrollment.therapistFirstName} {enrollment.therapistLastName}
          </span>
        </div>

        <Select
          label="New therapist"
          value={therapistId}
          onChange={e => setTherapistId(e.target.value)}
          placeholder={isLoading ? 'Loading…' : 'Select a therapist'}
          options={options}
        />

        <Input
          label="Reason (optional)"
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Therapist on extended leave"
        />

        <p className="text-xs" style={{ color: colors.text.dim }}>
          Sessions and review meetings still ahead move to the new therapist. Anything already
          completed keeps the therapist who took it, so the history stays accurate.
        </p>

        {error && <p className="form-error">{error}</p>}
      </div>

      <div className="flex gap-2 justify-end mt-6 pt-4" style={{ borderTop: `1px solid ${border.divider}` }}>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button
          variant="primary"
          loading={mut.isPending}
          onClick={() => {
            if (!therapistId) { setError('Pick a therapist'); return }
            setError('')
            mut.mutate()
          }}
        >
          Change therapist
        </Button>
      </div>
    </Modal>
  )
}
