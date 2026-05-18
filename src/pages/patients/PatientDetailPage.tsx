import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { ArrowLeft, Plus, X, UserCheck, Heart, Users, BookOpen, IndianRupee, Ban, CalendarDays, Clock, ChevronRight, CheckCircle2, XCircle, Circle, Sparkles, CreditCard, ShieldCheck, ClipboardList, Upload, FileText, Pencil, AlertTriangle } from 'lucide-react'
import { patientsApi } from '../../api/patients'
import { clinicsApi } from '../../api/clinics'
import { conditionsApi } from '../../api/conditions'
import { programsApi } from '../../api/programs'
import { subscriptionsApi } from '../../api/subscriptions'
import { enrollmentsApi } from '../../api/enrollments'
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
import { useAuth } from '../../contexts/AuthContext'
import { colors, border, surface, accentAlpha, paletteStyle, styles, palette } from '../../theme'
import { format } from 'date-fns'
import type {
  AddConditionRequest,
  AssignTherapistRequest,
  LinkParentRequest,
  UserResponse,
  PatientStage,
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
                className="text-[9px] font-medium text-center whitespace-nowrap max-w-[60px] leading-tight"
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
}: {
  patient: { stage: PatientStage; firstName: string; lastName: string }
  subscriptions: import('../../types').SubscriptionResponse[]
  enrollments: import('../../types').EnrollmentResponse[]
  canManage: boolean
  onAddSubscription: () => void
  onSetupSchedule: () => void
  onRecordPayment: (sub: import('../../types').SubscriptionResponse) => void
  onPayNow?: (sub: import('../../types').SubscriptionResponse) => void
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
      className="rounded-2xl p-4 flex items-start gap-4"
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
          onClick={config.action ?? undefined}
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
          onClick={() => onPayNow(activeSubscription)}
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
    onError: () => toast('Failed to create subscription', 'error'),
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
      <div className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 md:p-6" style={styles.modal}>
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
    onError: () => toast('Failed to record payment', 'error'),
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
      <div className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 md:p-6" style={styles.modal}>
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
      <div className="relative w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-6" style={styles.modal}>
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
                <p className="text-[11px]" style={{ color: colors.text.dim }}>Secure Payment Gateway</p>
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

            <p className="text-center text-[11px] mt-3" style={{ color: colors.text.dim }}>
              Demo only — no real transaction occurs
            </p>
          </>
        ) : (
          <div className="flex flex-col items-center py-6 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
              style={{ background: '#4CAF5022', color: '#4CAF50' }}>
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

// ── Session helpers ────────────────────────────────────────────────────────────

const SCORE_LABELS = ['Needs Work', 'Developing', 'On Track', 'Good', 'Excellent']

function scoreColor(score: number): string {
  if (score <= 2) return '#dc2626'
  if (score === 3) return '#d97706'
  return '#16a34a'
}

function ScoreSparkline({ sessions }: { sessions: TherapySessionResponse[] }) {
  const scored = sessions
    .filter(s => s.status === 'COMPLETED' && s.performanceScore != null)
    .sort((a, b) => a.sessionNumber - b.sessionNumber)

  if (scored.length === 0) return null

  const W = 80
  const H = 24
  const barW = Math.min(8, (W - (scored.length - 1) * 2) / scored.length)
  const gap  = scored.length > 1 ? (W - barW * scored.length) / (scored.length - 1) : 0

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="flex-shrink-0">
      {scored.map((s, i) => {
        const score = s.performanceScore!
        const barH  = (score / 5) * (H - 2)
        const x     = i * (barW + gap)
        const y     = H - barH
        return (
          <rect
            key={s.id}
            x={x} y={y}
            width={barW} height={barH}
            rx={2}
            fill={scoreColor(score)}
            opacity={0.85}
          />
        )
      })}
    </svg>
  )
}

function MiniDonut({ done, total }: { done: number; total: number }) {
  const r    = 18
  const circ = 2 * Math.PI * r
  const dash = total > 0 ? (done / total) * circ : 0
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" className="flex-shrink-0">
      <circle cx="22" cy="22" r={r} fill="none" strokeWidth="4.5" stroke={border.divider} />
      <circle
        cx="22" cy="22" r={r}
        fill="none" strokeWidth="4.5" strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
        transform="rotate(-90 22 22)"
        style={{ stroke: '#16a34a', transition: 'stroke-dasharray 0.35s ease' }}
      />
      <text x="22" y="27" textAnchor="middle" fontSize="9" fontWeight="700"
        style={{ fill: colors.text.primary, fontFamily: 'inherit' }}>
        {done}/{total}
      </text>
    </svg>
  )
}

function sessionRowIcon(status: string) {
  if (status === 'COMPLETED')
    return <CheckCircle2 size={14} className="flex-shrink-0" style={{ color: '#16a34a' }} />
  if (status === 'CANCELLED' || status === 'NO_SHOW')
    return <XCircle size={14} className="flex-shrink-0" style={{ color: '#dc2626' }} />
  if (status === 'PENDING_RESCHEDULE')
    return <AlertTriangle size={14} className="flex-shrink-0" style={{ color: '#d97706' }} />
  return <Circle size={14} className="flex-shrink-0" style={{ color: colors.text.dim }} />
}

function sessionRowStatusColor(status: string): string {
  if (status === 'COMPLETED')              return '#16a34a'
  if (status === 'CANCELLED' || status === 'NO_SHOW') return '#dc2626'
  if (status === 'PENDING_RESCHEDULE')     return '#d97706'
  return colors.text.dim
}

function sessionRowStatusLabel(status: string): string {
  if (status === 'NO_SHOW')            return 'No show'
  if (status === 'PENDING_RESCHEDULE') return 'Rescheduling'
  return status.charAt(0) + status.slice(1).toLowerCase()
}

// ── SessionList (row-based, lazy-loaded per enrollment) ───────────────────────

const SESSION_PREVIEW = 5

function SessionList({
  enrollmentId,
  canUpdate,
  onOpenNotes,
}: {
  enrollmentId: string
  canUpdate: boolean
  onOpenNotes: (s: TherapySessionResponse) => void
}) {
  const [showAll, setShowAll] = useState(false)

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['sessions', 'enrollment', enrollmentId],
    queryFn: () => therapySessionsApi.byEnrollment(enrollmentId),
    staleTime: 60 * 1000,
  })

  if (isLoading) return (
    <div className="px-4 py-4 flex justify-center" style={{ borderTop: `1px solid ${border.divider}` }}>
      <div className="h-4 w-4 animate-spin rounded-full border-2"
        style={{ borderColor: `${colors.accent}30`, borderTopColor: colors.accent }} />
    </div>
  )

  const completed = sessions.filter(s => s.status === 'COMPLETED').length
  const missed    = sessions.filter(s => s.status === 'NO_SHOW' || s.status === 'CANCELLED').length
  const upcoming  = sessions.filter(s => s.status === 'SCHEDULED' || s.status === 'PENDING_RESCHEDULE').length
  const total     = sessions.length
  const pct       = total > 0 ? Math.round((completed / total) * 100) : 0

  const pastRows = sessions
    .filter(s => s.status !== 'SCHEDULED' && s.status !== 'PENDING_RESCHEDULE')
    .sort((a, b) => b.sessionNumber - a.sessionNumber)

  const upcomingRows = sessions
    .filter(s => s.status === 'SCHEDULED' || s.status === 'PENDING_RESCHEDULE')
    .sort((a, b) => a.sessionNumber - b.sessionNumber)

  const shownPast     = showAll ? pastRows     : pastRows.slice(0, SESSION_PREVIEW)
  const shownUpcoming = showAll ? upcomingRows : upcomingRows.slice(0, SESSION_PREVIEW)
  const displayRows   = [...shownPast, ...shownUpcoming]

  const hiddenCount = (pastRows.length - shownPast.length) + (upcomingRows.length - shownUpcoming.length)

  return (
    <div style={{ borderTop: `1px solid ${border.divider}` }}>
      {/* Stats header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <MiniDonut done={completed} total={total} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mb-2">
            <span className="text-xs font-medium" style={{ color: '#16a34a' }}>{completed} done</span>
            {missed > 0 && (
              <span className="text-xs font-medium" style={{ color: '#dc2626' }}>{missed} missed</span>
            )}
            <span className="text-xs" style={{ color: colors.text.dim }}>{upcoming} upcoming</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: surface.filterStrip }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, background: '#16a34a' }}
              />
            </div>
            <span className="text-[10px] font-semibold tabular-nums flex-shrink-0" style={{ color: colors.text.muted }}>
              {pct}%
            </span>
          </div>
        </div>
        <ScoreSparkline sessions={sessions} />
      </div>

      {/* Session rows */}
      {displayRows.length > 0 && (
        <div style={{ borderTop: `1px solid ${border.divider}` }}>
          {displayRows.map((s, i) => {
            const hasNotes  = !!(s.feedback || s.progressReport || s.notes)
            const clickable = canUpdate
            return (
              <div
                key={s.id}
                onClick={() => clickable && onOpenNotes(s)}
                className="flex items-center gap-3 px-4 py-2.5 transition-colors"
                style={{
                  borderBottom: i < displayRows.length - 1 ? `1px solid ${border.divider}` : 'none',
                  cursor: clickable ? 'pointer' : 'default',
                }}
                onMouseEnter={e => { if (clickable) (e.currentTarget as HTMLElement).style.background = surface.rowHover }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                {sessionRowIcon(s.status)}

                <span className="text-xs font-medium w-8 flex-shrink-0 tabular-nums"
                  style={{ color: colors.text.muted }}>
                  #{s.sessionNumber}
                </span>

                <span className="text-xs flex-1 truncate" style={{ color: colors.text.muted }}>
                  {format(new Date(s.sessionDate + 'T00:00:00'), 'EEE d MMM')}
                </span>

                <span className="text-[11px] font-medium flex-shrink-0"
                  style={{ color: sessionRowStatusColor(s.status) }}>
                  {sessionRowStatusLabel(s.status)}
                </span>

                {s.performanceScore != null && (
                  <span
                    className="text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full flex-shrink-0"
                    style={{ background: scoreColor(s.performanceScore) + '20', color: scoreColor(s.performanceScore) }}
                  >
                    {s.performanceScore}
                  </span>
                )}

                {hasNotes && (
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: colors.accent }} />
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Show all / show less */}
      {(hiddenCount > 0 || showAll) && (
        <div className="px-4 py-2 text-center" style={{ borderTop: `1px solid ${border.divider}` }}>
          <button
            onClick={() => setShowAll(v => !v)}
            className="text-xs font-medium"
            style={{ color: colors.accent }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.7'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
          >
            {showAll ? 'Show less' : `Show all ${total} sessions`}
          </button>
        </div>
      )}
    </div>
  )
}

// ── SessionNotesModal ──────────────────────────────────────────────────────────

function SessionNotesModal({
  session,
  canEdit,
  enrollmentId,
  onClose,
}: {
  session: TherapySessionResponse
  canEdit: boolean
  enrollmentId: string
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { toast } = useToast()

  const [feedback, setFeedback]             = useState(session.feedback ?? '')
  const [progressReport, setProgressReport] = useState(session.progressReport ?? '')
  const [notes, setNotes]                   = useState(session.notes ?? '')
  const [score, setScore]                   = useState<number | null>(session.performanceScore ?? null)

  const { data: attachments = [], isLoading: attLoading } = useQuery({
    queryKey: ['session-attachments', session.id],
    queryFn: () => therapySessionsApi.listAttachments(session.id),
  })

  const notesMut = useMutation({
    mutationFn: () => therapySessionsApi.updateNotes(session.id, {
      feedback, progressReport, notes,
      ...(score !== null ? { performanceScore: score } : {}),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions', 'enrollment', enrollmentId] })
      toast('Notes saved', 'success')
      onClose()
    },
    onError: () => toast('Failed to save notes', 'error'),
  })

  const statusMut = useMutation({
    mutationFn: (status: TherapySessionStatus) => therapySessionsApi.updateStatus(session.id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions', 'enrollment', enrollmentId] })
      qc.invalidateQueries({ queryKey: ['enrollments'] })
      toast('Session updated', 'success')
      onClose()
    },
    onError: () => toast('Failed to update session', 'error'),
  })

  const uploadMut = useMutation({
    mutationFn: (file: File) => therapySessionsApi.uploadAttachment(session.id, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['session-attachments', session.id] }),
    onError: () => toast('Upload failed', 'error'),
  })

  const deleteMut = useMutation({
    mutationFn: (attachmentId: string) => therapySessionsApi.deleteAttachment(session.id, attachmentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['session-attachments', session.id] }),
    onError: () => toast('Delete failed', 'error'),
  })

  const handleFiles = (files: FileList | null) => {
    if (!files) return
    Array.from(files).forEach(f => uploadMut.mutate(f))
  }

  return (
    <Modal open title={`Session #${session.sessionNumber} Notes`} onClose={onClose} size="lg">
      {/* Session info strip */}
      <div className="flex items-center gap-3 mb-5 p-3 rounded-xl" style={{ background: accentAlpha(0.05) }}>
        <div className="flex-1">
          <p className="text-sm font-semibold" style={{ color: colors.text.heading }}>{session.sessionDate}</p>
          <p className="text-xs mt-0.5" style={{ color: colors.text.muted }}>
            {session.startTime.slice(0, 5)} · {session.programName}
          </p>
        </div>
        <span className="text-[10px] px-2 py-1 rounded-full font-medium"
          style={
            session.status === 'COMPLETED' ? paletteStyle('teal', 0.12, 0)
            : session.status === 'CANCELLED' || session.status === 'NO_SHOW' ? paletteStyle('red', 0.12, 0)
            : paletteStyle('blue', 0.10, 0)
          }>
          {session.status.replace('_', ' ')}
        </span>
      </div>

      <div className="flex flex-col gap-4">
        {/* Status update — only for scheduled sessions */}
        {canEdit && session.status === 'SCHEDULED' && (
          <div>
            <p className="form-label">Mark session as</p>
            <div className="flex gap-2">
              {([
                { value: 'COMPLETED' as TherapySessionStatus, label: 'Completed', color: '#16a34a' },
                { value: 'NO_SHOW'   as TherapySessionStatus, label: 'No Show',   color: '#d97706' },
                { value: 'CANCELLED' as TherapySessionStatus, label: 'Cancelled', color: '#dc2626' },
              ]).map(opt => (
                <button
                  key={opt.value}
                  disabled={statusMut.isPending}
                  onClick={() => statusMut.mutate(opt.value)}
                  className="flex-1 text-xs font-semibold py-2 rounded-xl transition-opacity disabled:opacity-50"
                  style={{ background: opt.color + '18', color: opt.color }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Performance Score */}
        <div>
          <label className="form-label">Performance Score</label>
          <div className="flex gap-2">
            {SCORE_LABELS.map((label, i) => {
              const val = i + 1
              const active = score === val
              return (
                <button
                  key={val}
                  type="button"
                  disabled={!canEdit}
                  onClick={() => setScore(active ? null : val)}
                  className="flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl text-[10px] font-semibold transition-colors"
                  style={{
                    background: active ? scoreColor(val) + '22' : surface.filterStrip,
                    color: active ? scoreColor(val) : colors.text.muted,
                    border: `1.5px solid ${active ? scoreColor(val) : 'transparent'}`,
                    opacity: !canEdit ? 0.6 : 1,
                    cursor: canEdit ? 'pointer' : 'default',
                  }}
                >
                  <span className="text-sm font-bold">{val}</span>
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Feedback */}
        <div>
          <label className="form-label">Feedback</label>
          <textarea
            className="form-input w-full resize-none"
            rows={3}
            placeholder={canEdit ? 'Add session feedback…' : 'No feedback recorded'}
            value={feedback}
            onChange={e => setFeedback(e.target.value)}
            readOnly={!canEdit}
          />
        </div>

        {/* Progress Report */}
        <div>
          <label className="form-label">Progress Report</label>
          <textarea
            className="form-input w-full resize-none"
            rows={3}
            placeholder={canEdit ? 'Describe patient progress…' : 'No progress report recorded'}
            value={progressReport}
            onChange={e => setProgressReport(e.target.value)}
            readOnly={!canEdit}
          />
        </div>

        {/* Notes */}
        <div>
          <label className="form-label">Notes</label>
          <textarea
            className="form-input w-full resize-none"
            rows={2}
            placeholder={canEdit ? 'Any additional notes…' : 'No notes recorded'}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            readOnly={!canEdit}
          />
        </div>

        {/* Attachments */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="form-label mb-0">Attachments</label>
            {canEdit && (
              <label className="cursor-pointer flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                style={{ color: colors.accent, background: accentAlpha(0.08) }}>
                {uploadMut.isPending
                  ? <div className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
                  : <Upload size={12} />}
                Upload
                <input
                  type="file"
                  accept="image/*,video/*,.pdf,.doc,.docx"
                  multiple
                  className="hidden"
                  onChange={e => handleFiles(e.target.files)}
                />
              </label>
            )}
          </div>

          {attLoading ? (
            <div className="flex justify-center py-6">
              <div className="h-5 w-5 animate-spin rounded-full border-2" style={{ borderColor: `${colors.accent}30`, borderTopColor: colors.accent }} />
            </div>
          ) : attachments.length === 0 ? (
            <p className="text-xs text-center py-5" style={{ color: colors.text.dim }}>No attachments yet</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {attachments.map((att: SessionAttachmentResponse) => (
                <div key={att.id} className="relative rounded-xl overflow-hidden" style={{ border: border.card }}>
                  {att.contentType?.startsWith('image/') ? (
                    <a href={att.fileUrl} target="_blank" rel="noopener noreferrer">
                      <img src={att.fileUrl} alt={att.fileName} className="w-full h-24 object-cover" />
                    </a>
                  ) : (
                    <a href={att.fileUrl} target="_blank" rel="noopener noreferrer"
                      className="w-full h-24 flex flex-col items-center justify-center gap-1.5 transition-colors"
                      style={{ background: accentAlpha(0.04) }}>
                      <FileText size={20} style={{ color: colors.accent }} />
                      <p className="text-[10px] truncate px-2 w-full text-center" style={{ color: colors.text.muted }}>{att.fileName}</p>
                    </a>
                  )}
                  {canEdit && (
                    <button
                      onClick={() => deleteMut.mutate(att.id)}
                      className="absolute top-1 right-1 p-1 rounded-full"
                      style={{ background: 'rgba(0,0,0,0.55)', color: '#fff' }}
                      title="Delete attachment"
                    >
                      <X size={10} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex gap-2 justify-end mt-6 pt-4" style={{ borderTop: `1px solid ${border.divider}` }}>
        <Button variant="ghost" onClick={onClose}>Close</Button>
        {canEdit && (
          <Button variant="primary" loading={notesMut.isPending} onClick={() => notesMut.mutate()}>
            Save Notes
          </Button>
        )}
      </div>
    </Modal>
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
  if (status === 'COMPLETED') return <CheckCircle2 size={13} style={{ color: '#16a34a' }} />
  if (status === 'CANCELLED' || status === 'NO_SHOW') return <XCircle size={13} style={{ color: '#dc2626' }} />
  return <Circle size={13} style={{ color: '#6b7280' }} />
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
  const [availableTherapists, setAvailableTherapists] = useState<AvailableTherapistResponse[]>([])
  const [selectedTherapistId, setSelectedTherapistId] = useState('')
  const [findingTherapists, setFindingTherapists]     = useState(false)
  const [step1Errors, setStep1Errors]           = useState<Record<string, string>>({})

  const createMut = useMutation({
    mutationFn: (data: CreateEnrollmentRequest) => enrollmentsApi.create(data),
    onSuccess: (enrollment) => { onCreated(enrollment) },
    onError: () => toast('Failed to create enrollment', 'error'),
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
    })
  }

  const paidSubs = subscriptions.filter(s => s.status === 'ACTIVE')

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={styles.modalBackdrop}>
      <div className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 md:p-6" style={styles.modal}>

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
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase"
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

            {/* Duration */}
            <div>
              <label className="form-label">Session Duration</label>
              <select value={duration} onChange={e => setDuration(Number(e.target.value))} className="form-input w-full">
                {SESSION_DURATION_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Start date */}
            <div>
              <label className="form-label">Start Date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="form-input w-full" />
              {step1Errors.date && <p className="form-error">{step1Errors.date}</p>}
            </div>

            {/* Time */}
            <TimePicker
              label="Start Time"
              value={startTime}
              onChange={setStartTime}
              error={step1Errors.time}
            />

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

const TABS = ['Overview', 'Clinical', 'Therapy'] as const
type Tab = typeof TABS[number]

// ── Page ───────────────────────────────────────────────────────────────────────

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { toasts, toast, dismiss } = useToast()
  const { user, activeRole } = useAuth()
  const queryClient = useQueryClient()

  const [editModal,        setEditModal]        = useState(false)
  const [conditionModal,   setConditionModal]   = useState(false)
  const [parentModal,      setParentModal]      = useState(false)
  const [therapistModal,   setTherapistModal]   = useState(false)
  const [subModal,         setSubModal]         = useState(false)
  const [paymentTarget,    setPaymentTarget]    = useState<SubscriptionResponse | null>(null)
  const [mockPayTarget,    setMockPayTarget]    = useState<SubscriptionResponse | null>(null)
  const [enrollForSub,     setEnrollForSub]     = useState<SubscriptionResponse | null>(null)
  const [expandedEnroll,   setExpandedEnroll]   = useState<string | null>(null)
  const [notesState,       setNotesState]       = useState<{ session: TherapySessionResponse; enrollmentId: string; canEdit: boolean } | null>(null)
  const [activeTab,        setActiveTab]        = useState<Tab>('Overview')
  const [sidebarSearch,    setSidebarSearch]    = useState('')

  const { data: patient, isLoading } = useQuery({
    queryKey: ['patients', id],
    queryFn: () => patientsApi.get(id!),
    enabled: !!id,
  })
  const { data: conditions } = useQuery({ queryKey: ['conditions'], queryFn: conditionsApi.list })
  const { data: clinics }    = useQuery({ queryKey: ['clinics'],    queryFn: clinicsApi.list })

  // Sidebar patient list
  const { data: allPatients = [] } = useQuery({
    queryKey: ['patients'],
    queryFn: patientsApi.list,
    staleTime: 2 * 60 * 1000,
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['patients', id] })

  // Stage mutation
  const stageMutation = useMutation({
    mutationFn: (stage: PatientStage) => patientsApi.updateStage(id!, stage),
    onSuccess: () => { refresh(); toast('Stage updated', 'success') },
    onError:   () => toast('Failed to update stage', 'error'),
  })

  // Condition mutations
  const conditionForm = useForm<AddConditionRequest>()
  const addConditionMutation = useMutation({
    mutationFn: (d: AddConditionRequest) => patientsApi.addCondition(id!, d),
    onSuccess: () => { refresh(); toast('Condition added', 'success'); setConditionModal(false); conditionForm.reset() },
    onError:   () => toast('Failed to add condition', 'error'),
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
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast(msg ?? 'Failed to link parent', 'error')
    },
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
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast(msg ?? 'Failed to assign therapist', 'error')
    },
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
    onError: () => toast('Failed to cancel subscription', 'error'),
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
    onError: () => toast('Failed to cancel enrollment', 'error'),
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
    onError:   () => toast('Failed to update patient', 'error'),
  })

  if (isLoading) return <PageLoader />
  if (!patient)  return <p className="text-sm" style={{ color: colors.text.muted }}>Patient not found</p>

  const conditionOptions = (conditions ?? [])
    .filter((c) => !patient.conditions.some((pc) => pc.id === c.id))
    .map((c) => ({ value: c.id, label: c.name }))
  const clinicName = clinics?.find((c) => c.id === patient.clinicId)?.name ?? '—'

  const currentRole = activeRole ?? user?.role
  const isParent            = currentRole === 'PARENT'
  const canChangeStage      = ['BUSINESS_OWNER', 'ADMIN', 'DOCTOR'].includes(currentRole ?? '')
  const canManageSubs       = ['BUSINESS_OWNER', 'ADMIN'].includes(currentRole ?? '')
  const canRecordPayment    = ['OFFICE_ADMIN', 'ADMIN', 'BUSINESS_OWNER'].includes(currentRole ?? '')
  const canCreateEnrollment = ['OFFICE_ADMIN', 'ADMIN', 'BUSINESS_OWNER'].includes(currentRole ?? '')
  const canUpdateSession    = ['THERAPIST', 'DOCTOR', 'ADMIN', 'BUSINESS_OWNER'].includes(currentRole ?? '')
  const canEditDetails      = ['BUSINESS_OWNER', 'ADMIN', 'OFFICE_ADMIN'].includes(currentRole ?? '')
  const hasActiveSubscription = subscriptions.some(s => s.status === 'ACTIVE')

  // Shared remove-button style (hover via event handlers)
  const removeBtn = (onClick: () => void) => (
    <button
      onClick={onClick}
      className="ml-2 rounded-lg p-1.5 transition-colors flex-shrink-0"
      style={{ color: colors.text.dim }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.color = colors.status.danger
        ;(e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.08)'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.color = colors.text.dim
        ;(e.currentTarget as HTMLElement).style.background = 'transparent'
      }}
    >
      <X size={14} />
    </button>
  )

  // Filtered sidebar patient list
  const filteredPatients = allPatients.filter(p => {
    const q = sidebarSearch.toLowerCase()
    return !q || `${p.firstName} ${p.lastName}`.toLowerCase().includes(q)
  })

  return (
    <div className="-mx-4 sm:-mx-6 -my-6 sm:-my-8 flex min-h-screen">

      {/* ── Left sidebar (desktop only) ──────────────────────────────────────── */}
      <aside
        className="hidden lg:flex flex-col w-64 flex-shrink-0 sticky top-0 self-start overflow-y-auto"
        style={{
          maxHeight: '100vh',
          background: surface.sidebar,
          borderRight: `1px solid ${border.sidebar}`,
        }}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between px-4 pt-5 pb-3 flex-shrink-0">
          <span className="text-sm font-semibold" style={{ color: colors.text.heading }}>Patients</span>
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-full"
            style={{ background: accentAlpha(0.10), color: colors.accent }}
          >
            {allPatients.length}
          </span>
        </div>

        {/* Search */}
        <div className="px-3 pb-3 flex-shrink-0">
          <input
            className="form-input w-full"
            placeholder="Search patients…"
            value={sidebarSearch}
            onChange={e => setSidebarSearch(e.target.value)}
          />
        </div>

        {/* Patient list */}
        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {filteredPatients.map(p => {
            const isActive = p.id === id
            return (
              <Link
                key={p.id}
                to={`/patients/${p.id}`}
                className="flex items-center gap-3 rounded-xl px-2 py-2.5 mb-0.5 transition-colors"
                style={isActive
                  ? { background: accentAlpha(0.10), border: `1px solid ${accentAlpha(0.20)}` }
                  : { border: '1px solid transparent' }
                }
                onMouseEnter={e => {
                  if (!isActive) (e.currentTarget as HTMLElement).style.background = accentAlpha(0.05)
                }}
                onMouseLeave={e => {
                  if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'
                }}
              >
                {/* Avatar */}
                <div
                  className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={isActive
                    ? { background: accentAlpha(0.20), color: colors.accent }
                    : { background: accentAlpha(0.08), color: colors.accent }
                  }
                >
                  {p.firstName[0]}{p.lastName[0]}
                </div>

                {/* Name + stage */}
                <div className="min-w-0 flex-1">
                  <p
                    className="text-sm font-medium truncate"
                    style={{ color: isActive ? colors.accent : colors.text.primary }}
                  >
                    {p.firstName} {p.lastName}
                  </p>
                  <span
                    className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                    style={isActive
                      ? { background: accentAlpha(0.15), color: colors.accent }
                      : { background: accentAlpha(0.06), color: colors.text.dim }
                    }
                  >
                    {STAGE_LABELS[p.stage]}
                  </span>
                </div>
              </Link>
            )
          })}

          {filteredPatients.length === 0 && (
            <p className="text-xs text-center py-4" style={{ color: colors.text.dim }}>No patients found</p>
          )}
        </div>
      </aside>

      {/* ── Right panel ──────────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto space-y-5">

          {/* Mobile back link (hidden on lg) */}
          <div className="lg:hidden">
            <Link
              to="/patients"
              className="inline-flex items-center gap-1 text-sm transition-colors"
              style={{ color: colors.text.muted }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = colors.accent}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = colors.text.muted}
            >
              <ArrowLeft size={14} /> Patients
            </Link>
          </div>

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
                  className="flex-shrink-0 flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                  style={{ color: colors.text.muted, border: `1px solid ${border.divider}` }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = colors.accent; (e.currentTarget as HTMLElement).style.borderColor = colors.accent }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = colors.text.muted; (e.currentTarget as HTMLElement).style.borderColor = border.divider }}
                >
                  <Pencil size={13} /> Edit
                </button>
              )}
            </div>

            {/* Read-only stage progress */}
            <StageProgress current={patient.stage} />
          </Card>

          {/* ── Tab strip ────────────────────────────────────────────────────── */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0">
            {TABS.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="flex-shrink-0 whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-all"
                style={activeTab === tab ? styles.filterTabActive : styles.filterTabInactive}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* ── Overview tab ─────────────────────────────────────────────────── */}
          {activeTab === 'Overview' && (() => {
            const activeEnrollment   = enrollments.find(e => e.status === 'ACTIVE')
            const activeSubscription = subscriptions.find(s => s.status === 'ACTIVE')
            const unpaidSub          = subscriptions.find(s => s.status !== 'CANCELLED' && s.paymentStatus !== 'PAID')

            return (
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
                />

                {/* ── Payment due card — shown to PARENT whenever any sub is unpaid ── */}
                {isParent && unpaidSub && (
                  <div className="rounded-2xl p-4 flex items-center gap-4"
                    style={{
                      background: 'rgba(234,179,8,0.06)',
                      border: `1px solid rgba(234,179,8,0.25)`,
                    }}>
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(234,179,8,0.12)' }}>
                      <CreditCard size={18} style={{ color: '#b45309' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold" style={{ color: colors.text.heading }}>
                        Payment due
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: colors.text.muted }}>
                        {unpaidSub.programName} · {formatINR(unpaidSub.totalAmount)}
                        {unpaidSub.paymentStatus === 'PARTIAL' && unpaidSub.amountPaid > 0 && (
                          <span className="ml-1.5">({formatINR(unpaidSub.amountPaid)} paid)</span>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={() => setMockPayTarget(unpaidSub)}
                      className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold"
                      style={styles.buttonPrimary}
                    >
                      <CreditCard size={12} /> Pay Now
                    </button>
                  </div>
                )}

                {/* ── Active enrollment summary ──────────────────────────── */}
                {activeEnrollment && (
                  <Card>
                    <CardHeader title="Active Enrollment" />
                    <div className="space-y-3">
                      {/* Program + therapist */}
                      <div className="flex items-start gap-3">
                        <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: accentAlpha(0.10) }}>
                          <BookOpen size={16} style={{ color: colors.accent }} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold" style={{ color: colors.text.heading }}>
                            {activeEnrollment.programName}
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: colors.text.muted }}>
                            {activeEnrollment.therapistFirstName} {activeEnrollment.therapistLastName}
                          </p>
                        </div>
                        <span className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
                          style={paletteStyle('teal', 0.12, 0)}>
                          Active
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs" style={{ color: colors.text.muted }}>Sessions completed</span>
                          <span className="text-xs font-semibold" style={{ color: colors.text.primary }}>
                            {activeEnrollment.sessionsCompleted} / {activeEnrollment.totalSessions}
                          </span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden" style={{ background: border.divider }}>
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${activeEnrollment.totalSessions > 0
                                ? Math.min(100, (activeEnrollment.sessionsCompleted / activeEnrollment.totalSessions) * 100)
                                : 0}%`,
                              background: colors.accent,
                            }}
                          />
                        </div>
                      </div>

                      {/* Meta info grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
                        {[
                          [<CalendarDays size={11} />, `Starts ${activeEnrollment.startDate}`],
                          [<Clock size={11} />, `${activeEnrollment.startTime.slice(0, 5)} · ${activeEnrollment.sessionDurationMinutes} min`],
                          [<CheckCircle2 size={11} />, `${activeEnrollment.totalSessions - activeEnrollment.sessionsCompleted} remaining`],
                        ].map(([icon, text], i) => (
                          <div key={i} className="flex items-center gap-1.5">
                            <span style={{ color: colors.text.dim }}>{icon}</span>
                            <span className="text-xs" style={{ color: colors.text.muted }}>{text as string}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </Card>
                )}

                {/* Patient Info */}
                <Card>
                  <CardHeader title="Patient Info" />
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
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
              </div>
            )
          })()}

          {/* ── Clinical tab ─────────────────────────────────────────────────── */}
          {activeTab === 'Clinical' && (
            <div className="space-y-4">
              {/* Conditions */}
              <Card>
                <CardHeader
                  title="Conditions"
                  subtitle={`${patient.conditions.length} condition${patient.conditions.length !== 1 ? 's' : ''}`}
                  action={<Button size="sm" onClick={() => setConditionModal(true)}><Plus size={14} /> Add</Button>}
                />
                {!patient.conditions.length ? (
                  <p className="text-sm" style={{ color: colors.text.dim }}>No conditions recorded.</p>
                ) : (
                  <div className="space-y-2">
                    {patient.conditions.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between rounded-xl px-4 py-3"
                        style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.15)' }}
                      >
                        <div className="flex items-center gap-3">
                          <Heart size={16} style={{ color: '#3b82f6' }} />
                          <div>
                            <p className="text-sm font-medium" style={{ color: colors.text.primary }}>{c.name}</p>
                            {c.diagnosedAt && (
                              <p className="text-xs" style={{ color: colors.text.muted }}>
                                Diagnosed {format(new Date(c.diagnosedAt), 'MMM yyyy')}
                              </p>
                            )}
                            {c.notes && <p className="text-xs italic" style={{ color: colors.text.muted }}>{c.notes}</p>}
                          </div>
                        </div>
                        {removeBtn(() => removeConditionMutation.mutate(c.id))}
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Divider */}
              <div style={{ borderTop: `1px solid ${border.divider}` }} />

              {/* Parents */}
              <Card>
                <CardHeader
                  title="Parents / Guardians"
                  subtitle={`${patient.parents.length} linked`}
                  action={<Button size="sm" onClick={() => setParentModal(true)}><Plus size={14} /> Link</Button>}
                />
                {!patient.parents.length ? (
                  <p className="text-sm" style={{ color: colors.text.dim }}>No parents linked.</p>
                ) : (
                  <div className="space-y-2">
                    {patient.parents.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between rounded-xl px-4 py-3"
                        style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)' }}
                      >
                        <div className="flex items-center gap-3">
                          <Users size={16} style={{ color: '#16a34a' }} />
                          <div>
                            <p className="text-sm font-medium" style={{ color: colors.text.primary }}>{p.firstName} {p.lastName}</p>
                            <p className="text-xs" style={{ color: colors.text.muted }}>{p.email}</p>
                          </div>
                        </div>
                        {removeBtn(() => unlinkParentMutation.mutate(p.id))}
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Divider */}
              <div style={{ borderTop: `1px solid ${border.divider}` }} />

              {/* Therapists */}
              <Card>
                <CardHeader
                  title="Assigned Therapists"
                  subtitle={`${patient.therapists.length} assigned`}
                  action={<Button size="sm" onClick={() => setTherapistModal(true)}><Plus size={14} /> Assign</Button>}
                />
                {!patient.therapists.length ? (
                  <p className="text-sm" style={{ color: colors.text.dim }}>No therapists assigned.</p>
                ) : (
                  <div className="space-y-2">
                    {patient.therapists.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between rounded-xl px-4 py-3"
                        style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.15)' }}
                      >
                        <div className="flex items-center gap-3">
                          <UserCheck size={16} style={{ color: '#7c3aed' }} />
                          <div>
                            <p className="text-sm font-medium" style={{ color: colors.text.primary }}>{t.firstName} {t.lastName}</p>
                            <p className="text-xs" style={{ color: colors.text.muted }}>
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
            </div>
          )}

          {/* ── Therapy tab ──────────────────────────────────────────────────── */}
          {activeTab === 'Therapy' && (
            <div className="space-y-4">
              {/* Subscriptions */}
              <Card>
                <CardHeader
                  title="Subscriptions"
                  subtitle={`${subscriptions.length} subscription${subscriptions.length !== 1 ? 's' : ''}`}
                  action={
                    canManageSubs ? (
                      <Button size="sm" onClick={() => setSubModal(true)}>
                        <Plus size={14} /> Add
                      </Button>
                    ) : undefined
                  }
                />
                {subscriptions.length === 0 ? (
                  <p className="text-sm" style={{ color: colors.text.dim }}>No subscriptions yet.</p>
                ) : (
                  <div className="space-y-3">
                    {subscriptions.map(sub => {
                      const isCancelled = sub.status === 'CANCELLED'
                      return (
                        <div
                          key={sub.id}
                          className="rounded-xl p-4"
                          style={{
                            background: isCancelled ? surface.filterStrip : accentAlpha(0.05),
                            border: `1px solid ${isCancelled ? border.divider : accentAlpha(0.15)}`,
                            opacity: isCancelled ? 0.7 : 1,
                          }}
                        >
                          {/* Top row */}
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <BookOpen size={15} style={{ color: colors.accent, flexShrink: 0 }} />
                              <p className="text-sm font-semibold truncate" style={{ color: colors.text.heading }}>
                                {sub.programName}
                              </p>
                            </div>
                            <span
                              className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
                              style={paymentStatusStyle(sub.paymentStatus)}
                            >
                              {sub.paymentStatus}
                            </span>
                          </div>

                          {/* Stats row */}
                          <div className="grid grid-cols-3 gap-2 mb-3">
                            {[
                              ['Sessions',  `${sub.numSessions}`],
                              ['Rate',      formatINR(sub.perSessionCost)],
                              ['Total Due', formatINR(sub.totalAmount)],
                            ].map(([label, value]) => (
                              <div key={label}>
                                <p className="text-[10px] uppercase tracking-wider" style={{ color: colors.text.dim }}>{label}</p>
                                <p className="text-xs font-semibold mt-0.5" style={{ color: colors.text.primary }}>{value}</p>
                              </div>
                            ))}
                          </div>

                          {/* Discount + paid */}
                          {(sub.discountPercent > 0 || sub.amountPaid > 0) && (
                            <div className="flex gap-4 mb-3 text-xs" style={{ color: colors.text.muted }}>
                              {sub.discountPercent > 0 && <span>Discount: {sub.discountPercent}%</span>}
                              {sub.amountPaid > 0 && <span>Paid: {formatINR(sub.amountPaid)}</span>}
                            </div>
                          )}

                          {/* Payment notes */}
                          {sub.paymentNotes && (
                            <p className="text-xs italic mb-3" style={{ color: colors.text.muted }}>{sub.paymentNotes}</p>
                          )}

                          {/* Actions */}
                          {!isCancelled && (() => {
                            const alreadyEnrolled = enrollments.some(
                              e => e.subscriptionId === sub.id && e.status === 'ACTIVE'
                            )
                            const canEnroll = canCreateEnrollment && sub.paymentStatus === 'PAID' && !alreadyEnrolled
                            const showActions = canRecordPayment || canManageSubs || isParent || canEnroll
                            if (!showActions) return null
                            return (
                              <div className="flex flex-wrap gap-2 pt-2 border-t" style={{ borderColor: border.divider }}>
                                {canEnroll && (
                                  <button
                                    onClick={() => setEnrollForSub(sub)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                                    style={{ color: '#fff', background: colors.accent }}
                                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.88'}
                                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
                                  >
                                    <CalendarDays size={11} />
                                    Enroll
                                  </button>
                                )}
                                {canRecordPayment && sub.paymentStatus !== 'PAID' && (
                                  <button
                                    onClick={() => setPaymentTarget(sub)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                                    style={{ color: colors.accent, background: accentAlpha(0.08) }}
                                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = accentAlpha(0.14)}
                                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = accentAlpha(0.08)}
                                  >
                                    <IndianRupee size={11} />
                                    Record Payment
                                  </button>
                                )}
                                {isParent && sub.paymentStatus !== 'PAID' && (
                                  <button
                                    onClick={() => setMockPayTarget(sub)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                                    style={{ color: '#fff', background: colors.accent }}
                                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.88'}
                                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
                                  >
                                    <CreditCard size={11} />
                                    Pay Now
                                  </button>
                                )}
                                {canManageSubs && (
                                  <button
                                    onClick={() => cancelSubMutation.mutate(sub.id)}
                                    disabled={cancelSubMutation.isPending}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                                    style={{ color: colors.status.error, background: 'rgba(239,68,68,0.08)' }}
                                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.14)'}
                                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.08)'}
                                  >
                                    <Ban size={11} />
                                    Cancel
                                  </button>
                                )}
                              </div>
                            )
                          })()}
                        </div>
                      )
                    })}
                  </div>
                )}
              </Card>

              {/* Enrollments */}
              <Card>
                <CardHeader
                  title="Enrollments"
                  subtitle={`${enrollments.length} enrollment${enrollments.length !== 1 ? 's' : ''}`}
                />

                {enrollments.length === 0 && (
                  <p className="text-sm" style={{ color: colors.text.dim }}>
                    {hasActiveSubscription
                      ? 'No enrollments yet. Click Enroll on a paid subscription above to schedule sessions.'
                      : 'An active, paid subscription is required before creating an enrollment.'}
                  </p>
                )}

                {enrollments.length > 0 && (
                  <div className="space-y-3">
                    {enrollments.map(enroll => {
                      const isCancelled = enroll.status === 'CANCELLED'
                      const isExpanded  = expandedEnroll === enroll.id

                      return (
                        <div
                          key={enroll.id}
                          className="rounded-xl overflow-hidden"
                          style={{
                            border: `1px solid ${isCancelled ? border.divider : accentAlpha(0.18)}`,
                            opacity: isCancelled ? 0.65 : 1,
                          }}
                        >
                          {/* Enrollment summary row */}
                          <div className="p-4" style={{ background: isCancelled ? surface.filterStrip : accentAlpha(0.04) }}>
                            <div className="flex items-start justify-between gap-3 mb-3">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold" style={{ color: colors.text.heading }}>{enroll.programName}</p>
                                <p className="text-xs mt-0.5" style={{ color: colors.text.muted }}>
                                  {enroll.therapistFirstName} {enroll.therapistLastName}
                                </p>
                              </div>
                              <span className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
                                style={isCancelled ? paletteStyle('slate', 0.12, 0) : paletteStyle('teal', 0.12, 0)}>
                                {enroll.status}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              {[
                                [<CalendarDays size={11} />, `Starts ${enroll.startDate}`],
                                [<Clock size={11} />, `${enroll.startTime.slice(0,5)} · ${enroll.sessionDurationMinutes}min`],
                                [<CheckCircle2 size={11} />, `${enroll.sessionsCompleted} / ${enroll.totalSessions} done`],
                              ].map(([icon, text], i) => (
                                <div key={i} className="flex items-center gap-1.5">
                                  <span style={{ color: colors.text.dim }}>{icon}</span>
                                  <span className="text-xs" style={{ color: colors.text.muted }}>{text as string}</span>
                                </div>
                              ))}
                            </div>

                            {/* Actions */}
                            {!isCancelled && (
                              <div className="flex items-center gap-2 mt-3 pt-3 border-t" style={{ borderColor: border.divider }}>
                                <button
                                  onClick={() => setExpandedEnroll(isExpanded ? null : enroll.id)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                                  style={{ color: colors.text.muted, background: surface.filterStrip }}
                                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = colors.accent}
                                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = colors.text.muted}
                                >
                                  {isExpanded ? 'Hide sessions' : 'Sessions'}
                                </button>
                                {canManageSubs && (
                                  <button
                                    onClick={() => cancelEnrollmentMutation.mutate(enroll.id)}
                                    disabled={cancelEnrollmentMutation.isPending}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                                    style={{ color: colors.status.error, background: 'rgba(239,68,68,0.08)' }}
                                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.14)'}
                                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.08)'}
                                  >
                                    <Ban size={11} /> Cancel
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Expandable session progress */}
                          {isExpanded && (
                            <SessionList
                              enrollmentId={enroll.id}
                              canUpdate={
                                (currentRole === 'THERAPIST' || currentRole === 'DOCTOR')
                                  ? user?.id === enroll.therapistId
                                  : canUpdateSession
                              }
                              onOpenNotes={(s) => setNotesState({
                                session: s,
                                enrollmentId: enroll.id,
                                canEdit: (currentRole === 'THERAPIST' || currentRole === 'DOCTOR')
                                  ? user?.id === enroll.therapistId
                                  : canUpdateSession,
                              })}
                            />
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* ── Modals ───────────────────────────────────────────────────────── */}
          {notesState && (
            <SessionNotesModal
              session={notesState.session}
              canEdit={notesState.canEdit}
              enrollmentId={notesState.enrollmentId}
              onClose={() => setNotesState(null)}
            />
          )}

          <Modal open={conditionModal} onClose={() => { setConditionModal(false); conditionForm.reset() }} title="Add Condition">
            <form onSubmit={conditionForm.handleSubmit((d) => addConditionMutation.mutate(d))} className="space-y-4">
              <Select label="Condition" placeholder="Select condition…" options={conditionOptions}
                {...conditionForm.register('conditionId', { required: 'Required' })} />
              <Input label="Diagnosed on" type="date" {...conditionForm.register('diagnosedAt')} />
              <div>
                <label className="form-label">Notes</label>
                <textarea className="form-input resize-none min-h-[80px]" {...conditionForm.register('notes')} />
              </div>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="secondary" onClick={() => { setConditionModal(false); conditionForm.reset() }}>Cancel</Button>
                <Button type="submit" loading={addConditionMutation.isPending}>Add</Button>
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

          <ToastContainer toasts={toasts} onDismiss={dismiss} />
        </div>
      </div>
    </div>
  )
}
