import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle, PhoneCall, PhoneOff, CalendarDays, XCircle, BellRing,
  CheckCircle2, UserX, RefreshCw, ArrowRight, X, UserCheck,
} from 'lucide-react'
import { format } from 'date-fns'
import { inquiriesApi } from '../../api/inquiries'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../hooks/useToast'
import { getApiError } from '../../lib/apiError'
import { colors, border, surface, styles, accentAlpha, dangerAlpha, paletteStyle } from '../../theme'
import type { InquiryResponse, InquiryStatus, InquiryActionOutcome } from '../../types'
import { MiniCalendar } from './MiniCalendar'
import { ROUTES } from '../../lib/routes'

// ── Types ──────────────────────────────────────────────────────────────────────

type OutcomeOption = {
  id: InquiryActionOutcome | 'CONVERT'
  label: string
  description: string
  icon: React.ElementType
  palette: 'blue' | 'green' | 'yellow' | 'red' | 'slate'
  requiresAppointment?: boolean
  isConvert?: boolean
}

type StateConfig = {
  actionLabel: string
  actionIcon: React.ElementType
  notesPlaceholder: string
  outcomes: OutcomeOption[]
}

// ── State machine config ───────────────────────────────────────────────────────

const CALL_OUTCOMES: OutcomeOption[] = [
  {
    id: 'NO_ANSWER',
    label: 'No answer',
    description: 'Called but could not reach',
    icon: PhoneOff,
    palette: 'yellow',
  },
  {
    id: 'SPOKE_NO_PROGRESS',
    label: 'Spoke to them',
    description: 'Spoke but needs follow-up',
    icon: PhoneCall,
    palette: 'blue',
  },
  {
    id: 'APPOINTMENT_BOOKED',
    label: 'Appointment booked',
    description: 'Spoke and got a date & time',
    icon: CalendarDays,
    palette: 'green',
    requiresAppointment: true,
  },
  {
    id: 'DROPPED',
    label: 'Drop inquiry',
    description: 'Not interested / wrong number',
    icon: XCircle,
    palette: 'red',
  },
]

const STATE_CONFIG: Partial<Record<InquiryStatus, StateConfig>> = {
  NEW: {
    actionLabel: 'Call Patient',
    actionIcon: PhoneCall,
    notesPlaceholder: 'What happened on this call?',
    outcomes: CALL_OUTCOMES,
  },
  ATTEMPTED_CONTACT: {
    actionLabel: 'Retry Call',
    actionIcon: PhoneCall,
    notesPlaceholder: 'What happened on this retry?',
    outcomes: CALL_OUTCOMES,
  },
  CONTACTED: {
    actionLabel: 'Log Follow-Up',
    actionIcon: RefreshCw,
    notesPlaceholder: 'What happened on this follow-up?',
    outcomes: [
      {
        id: 'SPOKE_NO_PROGRESS',
        label: 'Still in contact',
        description: 'Spoke again, another follow-up needed',
        icon: PhoneCall,
        palette: 'blue',
      },
      {
        id: 'APPOINTMENT_BOOKED',
        label: 'Appointment booked',
        description: 'Got a date & time from patient',
        icon: CalendarDays,
        palette: 'green',
        requiresAppointment: true,
      },
      {
        id: 'DROPPED',
        label: 'Drop inquiry',
        description: 'Patient is no longer interested',
        icon: XCircle,
        palette: 'red',
      },
    ],
  },
  CONSULTATION_SCHEDULED: {
    actionLabel: 'Log Update',
    actionIcon: BellRing,
    notesPlaceholder: 'Add any notes…',
    outcomes: [
      {
        id: 'REMINDER_SENT',
        label: 'Reminder sent',
        description: 'Manually reminded the patient',
        icon: BellRing,
        palette: 'blue',
      },
      {
        id: 'NO_SHOW',
        label: 'No show',
        description: 'Patient did not attend',
        icon: UserX,
        palette: 'yellow',
      },
      {
        id: 'CANCELLED',
        label: 'Cancelled',
        description: 'Patient cancelled the appointment',
        icon: XCircle,
        palette: 'red',
      },
      {
        id: 'CONVERT',
        label: 'Convert to case',
        description: 'Patient attended — create their record and assign a plan',
        icon: UserCheck,
        palette: 'green',
        isConvert: true,
      },
    ],
  },
  VISITED: {
    actionLabel: 'Record Outcome',
    actionIcon: CheckCircle2,
    notesPlaceholder: 'Notes from the visit…',
    outcomes: [
      {
        id: 'APPOINTMENT_BOOKED',
        label: 'Schedule follow-up',
        description: 'Another consultation needed',
        icon: CalendarDays,
        palette: 'blue',
        requiresAppointment: true,
      },
      {
        id: 'CONVERT',
        label: 'Convert to case',
        description: 'Create their case record and assign a plan',
        icon: UserCheck,
        palette: 'green',
        isConvert: true,
      },
      {
        id: 'DROPPED',
        label: 'Not proceeding',
        description: 'Patient decided not to continue',
        icon: XCircle,
        palette: 'red',
      },
    ],
  },
  DROPPED: {
    actionLabel: 'Reopen',
    actionIcon: RefreshCw,
    notesPlaceholder: 'Reason for reopening…',
    outcomes: [
      {
        id: 'REOPEN',
        label: 'Reopen inquiry',
        description: 'Move back to New for follow-up',
        icon: RefreshCw,
        palette: 'blue',
      },
    ],
  },
  DISCONTINUED: {
    actionLabel: 'Reopen',
    actionIcon: RefreshCw,
    notesPlaceholder: 'Reason for reopening…',
    outcomes: [
      {
        id: 'REOPEN',
        label: 'Reopen inquiry',
        description: 'Move back to New for follow-up',
        icon: RefreshCw,
        palette: 'blue',
      },
    ],
  },
}

// ── Time slots ─────────────────────────────────────────────────────────────────

const TIME_SLOTS = Array.from({ length: 22 }, (_, i) => {
  const hour = Math.floor(i / 2) + 8
  const min  = i % 2 === 0 ? '00' : '30'
  const h12  = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
  return { value: `${String(hour).padStart(2, '0')}:${min}`, label: `${h12}:${min} ${hour >= 12 ? 'PM' : 'AM'}` }
})

// ── Component ──────────────────────────────────────────────────────────────────

export function ActionModal({
  inquiry,
  onClose,
  onConverted,
  onRequestConvert,
}: {
  inquiry: InquiryResponse
  onClose: () => void
  onConverted?: (patientId: string) => void
  onRequestConvert?: () => void
}) {
  const qc        = useQueryClient()
  const navigate  = useNavigate()
  const { toast } = useToast()

  const config = STATE_CONFIG[inquiry.status]

  const [selected,     setSelected]     = useState<InquiryActionOutcome | 'CONVERT' | null>(null)
  const [notes,        setNotes]        = useState('')
  const [apptDate,     setApptDate]     = useState<Date | null>(null)
  const [apptTime,     setApptTime]     = useState<string | null>(null)
  const [apptNotes,    setApptNotes]    = useState('')
  const [actionError,  setActionError]  = useState<string | null>(null)

  const selectedOutcome = config?.outcomes.find(o => o.id === selected)
  const needsAppt       = selectedOutcome?.requiresAppointment ?? false
  const isConvert       = selectedOutcome?.isConvert ?? false

  const mutation = useMutation({
    mutationFn: () => {
      let appointmentDate: string | undefined
      if (needsAppt && apptDate && apptTime) {
        appointmentDate = new Date(
          `${format(apptDate, 'yyyy-MM-dd')}T${apptTime}:00`
        ).toISOString()
      }
      return inquiriesApi.nextAction(inquiry.id, {
        outcome: selected! as InquiryActionOutcome,
        notes: notes || undefined,
        appointmentDate,
        appointmentNotes: apptNotes || undefined,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inquiries'] })
      qc.invalidateQueries({ queryKey: ['inquiry-logs', inquiry.id] })
      toast('Updated', 'success')
      onClose()
    },
    onError: (err) => setActionError(getApiError(err, 'Action failed')),
  })

  const canSubmit =
    selected !== null &&
    (!needsAppt || (apptDate !== null && apptTime !== null))

  // CONVERTED state — just show the patient link
  if (inquiry.status === 'CONVERTED') {
    return (
      <Overlay onClose={onClose}>
        <ModalShell title="Inquiry Converted" icon={<UserCheck size={18} />} onClose={onClose}>
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: '#4CAF5022', color: '#4CAF50' }}>
              <CheckCircle2 size={28} />
            </div>
            <p className="text-sm" style={{ color: colors.text.muted }}>
              This inquiry has been converted to a case record.
            </p>
            <Button onClick={() => { onClose(); navigate(ROUTES.patients) }}>
              Go to Cases
            </Button>
          </div>
        </ModalShell>
      </Overlay>
    )
  }

  if (!config) return null

  const ActionIcon = config.actionIcon

  return (
    <Overlay onClose={onClose}>
      <ModalShell
        title={config.actionLabel}
        icon={<ActionIcon size={16} />}
        subtitle={inquiry.name}
        onClose={onClose}
        error={actionError}>

        <div className="flex flex-col gap-4">

          {/* Outcome cards */}
          <div className="grid grid-cols-1 gap-2">
            {config.outcomes.map(opt => {
              const Icon    = opt.icon
              const active  = selected === opt.id
              const ps      = paletteStyle(opt.palette, active ? 0.18 : 0.07)
              return (
                <button key={opt.id} onClick={() => setSelected(opt.id)}
                  className="flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all"
                  style={{
                    ...ps,
                    border: active
                      ? `1.5px solid ${ps.color}`
                      : `1px solid transparent`,
                    outline: 'none',
                  }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: ps.color + '22', color: ps.color }}>
                    <Icon size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: ps.color }}>{opt.label}</p>
                    <p className="text-xs" style={{ color: colors.text.muted }}>{opt.description}</p>
                  </div>
                  {active && (
                    <div className="ml-auto w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background: ps.color, color: '#fff' }}>
                      <CheckCircle2 size={12} />
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Appointment picker — shown when outcome requires it */}
          {needsAppt && (
            <div className="flex flex-col gap-3 rounded-xl p-3"
              style={{ background: surface.rowHover, border: `1px solid ${border.card}` }}>
              <p className="text-xs font-semibold" style={{ color: colors.text.muted }}>
                Select date & time
              </p>
              <MiniCalendar selected={apptDate} onSelect={d => { setApptDate(d); setApptTime(null) }} />
              {apptDate && (
                <div>
                  <p className="text-xs font-medium mb-1.5" style={{ color: colors.text.muted }}>
                    Time — {format(apptDate, 'EEE d MMM')}
                  </p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                    {TIME_SLOTS.map(slot => (
                      <button key={slot.value} onClick={() => setApptTime(slot.value)}
                        className="text-xs rounded-full py-1.5 px-1 text-center font-medium transition-all"
                        style={{
                          background: apptTime === slot.value ? colors.accent : accentAlpha(0.06),
                          color: apptTime === slot.value ? '#fff' : colors.text.primary,
                          border: `1px solid ${apptTime === slot.value ? colors.accent : 'transparent'}`,
                          boxShadow: apptTime === slot.value ? `0 2px 8px ${accentAlpha(0.35)}` : 'none',
                        }}>
                        {slot.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="form-label">Appointment notes (optional)</label>
                <input className="form-input w-full" value={apptNotes}
                  onChange={e => setApptNotes(e.target.value)}
                  placeholder="e.g. bring previous audiogram reports" />
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="form-label">Notes</label>
            <textarea rows={2} className="form-input w-full resize-none"
              value={notes} onChange={e => setNotes(e.target.value)}
              placeholder={config.notesPlaceholder} />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button
              onClick={() => {
                if (isConvert) {
                  onRequestConvert?.()
                  onClose()
                } else {
                  setActionError(null)
                  mutation.mutate()
                }
              }}
              loading={mutation.isPending}
              disabled={!canSubmit}>
              {isConvert ? 'Convert to Case' : 'Save'}
              <ArrowRight size={14} className="ml-1" />
            </Button>
          </div>
        </div>
      </ModalShell>
    </Overlay>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={styles.modalBackdrop}
      onClick={e => e.target === e.currentTarget && onClose()}>
      {children}
    </div>
  )
}

function ModalShell({
  title, icon, subtitle, onClose, children, error,
}: {
  title: string
  icon?: React.ReactNode
  subtitle?: string
  onClose: () => void
  children: React.ReactNode
  /** An operation/API failure tied to this modal — rendered inline below the header instead of
   *  as a floating toast, which can go unnoticed or render behind the modal while it's open. */
  error?: string | null
}) {
  return (
    <div className="rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto"
      style={{ background: surface.card, border: `1px solid ${border.card}` }}>
      <div className="flex items-start justify-between p-5 border-b sticky top-0"
        style={{ borderColor: border.divider, background: surface.card, zIndex: 1 }}>
        <div className="flex items-center gap-2">
          {icon && (
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: accentAlpha(0.12), color: colors.accent }}>
              {icon}
            </div>
          )}
          <div>
            <h3 className="font-semibold text-base" style={{ color: colors.text.primary }}>{title}</h3>
            {subtitle && <p className="text-xs" style={{ color: colors.text.muted }}>{subtitle}</p>}
          </div>
        </div>
        <button onClick={onClose} className="p-2.5 rounded-lg flex-shrink-0" style={{ color: colors.text.muted }}>
          <X size={18} />
        </button>
      </div>
      {error && (
        <div className="flex items-start gap-2 mx-5 mt-4 rounded-xl px-3 py-2.5 text-sm"
          style={{ background: dangerAlpha(0.10), border: `1px solid ${dangerAlpha(0.25)}`, color: colors.status.danger }}>
          <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  )
}

// ── Export config helper (used by InquiriesPage to show/hide button) ───────────

export function hasNextAction(status: InquiryStatus): boolean {
  return status in STATE_CONFIG
}

export function getActionLabel(status: InquiryStatus): string {
  return STATE_CONFIG[status]?.actionLabel ?? ''
}
