import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Inbox, Phone, Mail, Clock, CheckCircle2, XCircle, RefreshCw,
  ChevronRight, CalendarDays, X, Trash2,
  PhoneCall, MessageCircle, AtSign, FileText, UserCheck,
  ArrowRightCircle, Zap, List, Users, BarChart2, Plus, Globe, Footprints, AlertTriangle,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { inquiriesApi } from '../../api/inquiries'
import { clinicsApi } from '../../api/clinics'
import { programsApi } from '../../api/programs'
import { subscriptionsApi } from '../../api/subscriptions'
import { Card } from '../../components/ui/Card'
import { Avatar } from '../../components/shared/Avatar'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { PageLoader } from '../../components/ui/Spinner'
import { ToastContainer } from '../../components/ui/Toast'
import { useToast } from '../../hooks/useToast'
import { getApiError } from '../../lib/apiError'
import { useAuth } from '../../contexts/AuthContext'
import { colors, styles, border, surface, accentAlpha, warningAlpha, paletteStyle, borderAlpha } from '../../theme'
import type {
  InquiryResponse, InquiryStatus, InquiryLogResponse,
  InquiryLogType, CreateInquiryLogRequest, PreferredTime, InquirySource,
} from '../../types'
import { hasRole } from '../../types'
import { ActionModal, hasNextAction, getActionLabel } from './ActionModal'
import { MiniCalendar } from './MiniCalendar'
import { CalendarView } from './CalendarView'

// ── Status metadata ────────────────────────────────────────────────────────────

const STATUS_META: Record<InquiryStatus, {
  label: string
  icon: React.ElementType
  style: React.CSSProperties
}> = {
  NEW:                    { label: 'New',                    icon: Inbox,          style: paletteStyle('blue',   0.12) },
  ATTEMPTED_CONTACT:      { label: 'Attempted Contact',      icon: PhoneCall,      style: paletteStyle('yellow', 0.12) },
  CONTACTED:              { label: 'Contacted',              icon: RefreshCw,      style: paletteStyle('yellow', 0.12) },
  CONSULTATION_SCHEDULED: { label: 'Consultation Scheduled', icon: CalendarDays,   style: paletteStyle('blue',   0.12) },
  VISITED:                { label: 'Visited',                icon: UserCheck,      style: paletteStyle('green',  0.12) },
  CONVERTED:              { label: 'Converted',              icon: CheckCircle2,   style: paletteStyle('green',  0.12) },
  DISCONTINUED:           { label: 'Discontinued',           icon: XCircle,        style: paletteStyle('slate',  0.12) },
  DROPPED:                { label: 'Dropped',                icon: XCircle,        style: paletteStyle('slate',  0.12) },
}

const LOG_META: Record<InquiryLogType, { label: string; icon: React.ElementType; color: string }> = {
  CALL:                    { label: 'Call',                   icon: PhoneCall,        color: '#2B80C8' },
  EMAIL:                   { label: 'Email',                  icon: AtSign,           color: '#7C5CBF' },
  WHATSAPP:                { label: 'WhatsApp',               icon: MessageCircle,    color: '#25D366' },
  NOTE:                    { label: 'Note',                   icon: FileText,         color: '#888' },
  APPOINTMENT_SCHEDULED:   { label: 'Appointment Scheduled',  icon: CalendarDays,     color: '#2B80C8' },
  APPOINTMENT_CANCELLED:   { label: 'Appointment Cancelled',  icon: CalendarDays,     color: '#E05C5C' },
  STATUS_CHANGED:          { label: 'Status Changed',         icon: ArrowRightCircle, color: '#888' },
  CONVERTED:               { label: 'Converted to Case',      icon: UserCheck,        color: '#4CAF50' },
}

const MANUAL_LOG_TYPES: InquiryLogType[] = ['CALL', 'EMAIL', 'WHATSAPP', 'NOTE']

const PREFERRED_TIME_LABEL: Record<string, string> = {
  MORNING: 'Morning', AFTERNOON: 'Afternoon', EVENING: 'Evening',
}

const TIME_SLOTS = Array.from({ length: 22 }, (_, i) => {
  const hour = Math.floor(i / 2) + 8
  const min  = i % 2 === 0 ? '00' : '30'
  const h12  = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
  const label = `${h12}:${min} ${hour >= 12 ? 'PM' : 'AM'}`
  return { value: `${String(hour).padStart(2, '0')}:${min}`, label }
})

const JOURNEY_STATUSES: InquiryStatus[] = [
  'NEW', 'ATTEMPTED_CONTACT', 'CONTACTED',
  'CONSULTATION_SCHEDULED', 'VISITED', 'CONVERTED',
]

const TABS: { label: string; value: InquiryStatus | 'ALL' }[] = [
  { label: 'All',       value: 'ALL' },
  { label: 'New',       value: 'NEW' },
  { label: 'Attempted', value: 'ATTEMPTED_CONTACT' },
  { label: 'Contacted', value: 'CONTACTED' },
  { label: 'Scheduled', value: 'CONSULTATION_SCHEDULED' },
  { label: 'Visited',   value: 'VISITED' },
  { label: 'Converted', value: 'CONVERTED' },
  { label: 'Dropped',   value: 'DROPPED' },
]

// ── Source ─────────────────────────────────────────────────────────────────────

const SOURCE_META: Record<InquirySource, { label: string; icon: React.ElementType }> = {
  WEBSITE: { label: 'Website', icon: Globe },
  WALK_IN: { label: 'Walk-in', icon: Footprints },
  PHONE:   { label: 'Phone',   icon: PhoneCall },
}

/** Quiet by design — the status badge should stay the loudest thing on the row. */
function SourceBadge({ source }: { source: InquirySource }) {
  const meta = SOURCE_META[source] ?? SOURCE_META.WEBSITE
  const Icon = meta.icon
  return (
    <span className="inline-flex items-center gap-1 text-xs whitespace-nowrap"
      style={{ color: colors.text.dim }} title={`Source: ${meta.label}`}>
      <Icon size={11} />{meta.label}
    </span>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: InquiryStatus }) {
  const meta = STATUS_META[status]
  const Icon = meta.icon
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap"
      style={meta.style}>
      <Icon size={11} />{meta.label}
    </span>
  )
}

// ── Activity Timeline ──────────────────────────────────────────────────────────

function ActivityTimeline({ logs }: { logs: InquiryLogResponse[] }) {
  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center py-6 gap-1">
        <FileText size={24} style={{ color: colors.text.muted }} />
        <p className="text-sm" style={{ color: colors.text.muted }}>No activity yet</p>
      </div>
    )
  }

  const grouped: { date: string; items: InquiryLogResponse[] }[] = []
  for (const log of logs) {
    const dateKey = format(parseISO(log.createdAt), 'd MMM yyyy')
    const existing = grouped.find(g => g.date === dateKey)
    if (existing) existing.items.push(log)
    else grouped.push({ date: dateKey, items: [log] })
  }

  return (
    <div className="flex flex-col gap-4">
      {grouped.map(group => (
        <div key={group.date}>
          <div className="text-xs font-semibold mb-2 uppercase tracking-wider"
            style={{ color: colors.text.muted }}>{group.date}</div>
          <div className="flex flex-col gap-2 pl-1">
            {group.items.map(log => {
              const meta = LOG_META[log.logType]
              const Icon = meta.icon
              return (
                <div key={log.id} className="flex gap-3 items-start">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5"
                    style={{ background: meta.color + '22', color: meta.color }}>
                    <Icon size={13} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold" style={{ color: colors.text.primary }}>
                        {meta.label}
                      </span>
                      {log.createdByName && (
                        <span className="text-xs" style={{ color: colors.text.muted }}>
                          · {log.createdByName}
                        </span>
                      )}
                      <span className="text-xs ml-auto" style={{ color: colors.text.muted }}>
                        {format(parseISO(log.createdAt), 'h:mm a')}
                      </span>
                    </div>
                    {log.notes && (
                      <p className="text-sm mt-0.5" style={{ color: colors.text.muted }}>{log.notes}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Convert to Patient Modal ───────────────────────────────────────────────────

function ConvertModal({
  inquiry, onClose, onConverted,
}: {
  inquiry: InquiryResponse
  onClose: () => void
  onConverted: (patientId: string) => void
}) {
  const qc = useQueryClient()
  const { toast, toasts, dismiss } = useToast()

  // Patient fields — pre-fill from inquiry name
  const parts = inquiry.name.trim().split(/\s+/)
  const [firstName, setFirstName] = useState(parts[0] ?? '')
  const [lastName,  setLastName]  = useState(parts.slice(1).join(' '))
  const [clinicId,  setClinicId]  = useState('')

  // Linked user fields
  const [linkUser,          setLinkUser]          = useState(false)
  const [linkedEmail,       setLinkedEmail]        = useState(inquiry.email ?? '')
  const [linkedFirstName,   setLinkedFirstName]    = useState(parts[0] ?? '')
  const [linkedLastName,    setLinkedLastName]     = useState(parts.slice(1).join(' '))
  const [linkedRole,        setLinkedRole]         = useState<'PARENT' | 'PATIENT'>('PARENT')

  // Success state — show invite link after conversion
  const [inviteLink,   setInviteLink]   = useState<string | null>(null)
  const [linkError,    setLinkError]    = useState<string | null>(null)
  const [patientName,  setPatientName]  = useState('')
  const [convertedId,  setConvertedId]  = useState('')
  const [copied,       setCopied]       = useState(false)

  // Subscription plan step
  const [showSubscription,  setShowSubscription]  = useState(false)
  const [selectedProgramId, setSelectedProgramId] = useState('')
  const [numSessions,       setNumSessions]       = useState(8)

  const { data: clinics = [] } = useQuery({
    queryKey: ['clinics'],
    queryFn: () => clinicsApi.list(),
  })

  const { data: programs = [] } = useQuery({
    queryKey: ['programs-active'],
    queryFn: () => programsApi.listActive(),
  })

  const selectedProgram = programs.find(p => p.id === selectedProgramId)
  const totalCost = selectedProgram ? selectedProgram.totalCost * numSessions : 0

  const subscriptionMutation = useMutation({
    mutationFn: () => subscriptionsApi.create({
      patientId: convertedId,
      programId: selectedProgramId,
      numSessions,
    }),
    onSuccess: () => {
      toast('Plan assigned', 'success')
      onClose()
      onConverted(convertedId)
    },
    onError: (err) => toast(getApiError(err, 'Failed to assign plan'), 'error'),
  })

  const convertMutation = useMutation({
    mutationFn: () => inquiriesApi.convert(inquiry.id, {
      firstName, lastName, clinicId,
      ...(linkUser && linkedEmail.trim() ? {
        linkedUserEmail:     linkedEmail.trim(),
        linkedUserFirstName: linkedFirstName.trim() || undefined,
        linkedUserLastName:  linkedLastName.trim()  || undefined,
        linkedUserRole:      linkedRole,
      } : {}),
    }),
    onSuccess: data => {
      qc.invalidateQueries({ queryKey: ['inquiries'] })
      qc.invalidateQueries({ queryKey: ['inquiries', 'NEW'] })
      setPatientName(data.patientName)
      setConvertedId(data.patientId)
      if (data.linkedUserError) {
        // The case was created either way — only the parent/patient link failed.
        // Surfaced as its own persistent step, not a toast, so it can't be missed
        // or hidden behind the modal, and re-submitting won't create a duplicate case.
        setLinkError(data.linkedUserError)
      } else if (data.linkedUserInviteLink) {
        setInviteLink(data.linkedUserInviteLink)
      } else {
        toast(`${data.patientName} created as a patient`, 'success')
        setShowSubscription(true)
      }
    },
    onError: (err) => toast(getApiError(err, 'Conversion failed'), 'error'),
  })

  const canSubmit = firstName.trim() && lastName.trim() && clinicId &&
    (!linkUser || linkedEmail.trim())

  function copyLink() {
    const full = `${window.location.origin}${inviteLink}`
    navigator.clipboard.writeText(full).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // ── Step 2: Subscription plan assignment ─────────────────────────────────
  if (showSubscription) {
    return (
      <>
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.55)' }}>
        <div className="rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-y-auto max-h-[90vh]"
          style={{ background: surface.card, border: `1px solid ${border.card}` }}>
          <div className="flex items-start justify-between p-5 border-b" style={{ borderColor: border.divider }}>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: colors.accent }}>
                Step 2 of 2
              </p>
              <h3 className="font-semibold text-base" style={{ color: colors.text.primary }}>
                Assign a Subscription Plan
              </h3>
              <p className="text-xs mt-0.5" style={{ color: colors.text.muted }}>
                {patientName} · Can also be done later from the patient profile
              </p>
            </div>
          </div>

          <div className="p-5 flex flex-col gap-4">
            {programs.length === 0 ? (
              <p className="text-sm text-center py-4" style={{ color: colors.text.muted }}>
                No active programs found. You can assign a plan later from the case profile.
              </p>
            ) : (<>
              <div>
                <label className="form-label">Program</label>
                <select className="form-input w-full" value={selectedProgramId}
                  onChange={e => setSelectedProgramId(e.target.value)}>
                  <option value="">Select a program…</option>
                  {programs.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} — ₹{p.totalCost.toLocaleString()}/session{p.taxName && !p.priceIncludesTax ? ` (incl. ${p.taxName})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">Number of Sessions</label>
                <input
                  type="number"
                  min={1}
                  className="form-input w-full"
                  value={numSessions}
                  onChange={e => setNumSessions(Math.max(1, parseInt(e.target.value) || 1))}
                />
              </div>

              {selectedProgram && (
                <div className="rounded-xl p-3 flex items-center justify-between"
                  style={{ background: accentAlpha(0.08), border: `1px solid ${accentAlpha(0.2)}` }}>
                  <span className="text-sm font-medium" style={{ color: colors.text.primary }}>Total cost</span>
                  <span className="text-lg font-bold" style={{ color: colors.accent }}>
                    ₹{totalCost.toLocaleString()}
                  </span>
                </div>
              )}
            </>)}
          </div>

          <div className="flex justify-end gap-2 p-5 pt-0">
            <Button variant="ghost" onClick={() => { onClose(); onConverted(convertedId) }}>
              Skip for now
            </Button>
            {programs.length > 0 && (
              <Button
                onClick={() => subscriptionMutation.mutate()}
                loading={subscriptionMutation.isPending}
                disabled={!selectedProgramId || numSessions < 1}>
                Assign Plan
              </Button>
            )}
          </div>
        </div>
      </div>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      </>
    )
  }

  // ── Step 1a: Case created, but linking the parent/patient failed ──────────
  if (linkError) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.55)' }}>
        <div className="rounded-2xl shadow-2xl w-full max-w-md mx-4"
          style={{ background: surface.card, border: `1px solid ${border.card}` }}>
          <div className="p-6 flex flex-col items-center text-center gap-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ background: warningAlpha(0.15) }}>
              <AlertTriangle size={22} style={{ color: colors.status.warning }} />
            </div>
            <div>
              <p className="font-semibold text-base" style={{ color: colors.text.primary }}>
                {patientName} was created as a case
              </p>
              <p className="text-sm mt-1" style={{ color: colors.text.muted }}>
                But linking the {linkedRole === 'PARENT' ? 'parent / guardian' : 'patient'} failed:
              </p>
            </div>
            <div className="w-full rounded-xl p-3 text-left"
              style={{ background: warningAlpha(0.08), border: `1px solid ${warningAlpha(0.25)}` }}>
              <p className="text-sm" style={{ color: colors.text.primary }}>{linkError}</p>
            </div>
            <p className="text-xs" style={{ color: colors.text.muted }}>
              The case is otherwise ready to go — you can link the {linkedRole === 'PARENT' ? 'parent' : 'patient'} account
              from the case's profile page at any time.
            </p>
          </div>
          <div className="px-6 pb-6 flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => { onClose(); onConverted(convertedId) }}
            >
              Go to Case
            </Button>
            <Button className="flex-1" onClick={() => { setLinkError(null); setShowSubscription(true) }}>
              Next: Assign Plan
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ── Step 1b: Invite link ──────────────────────────────────────────────────
  if (inviteLink) {
    const fullLink = `${window.location.origin}${inviteLink}`
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.55)' }}>
        <div className="rounded-2xl shadow-2xl w-full max-w-md mx-4"
          style={{ background: surface.card, border: `1px solid ${border.card}` }}>
          <div className="p-6 flex flex-col items-center text-center gap-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ background: accentAlpha(0.12) }}>
              <UserCheck size={22} style={{ color: colors.accent }} />
            </div>
            <div>
              <p className="font-semibold text-base" style={{ color: colors.text.primary }}>
                {patientName} converted successfully
              </p>
              <p className="text-sm mt-1" style={{ color: colors.text.muted }}>
                Share this link with the {linkedRole === 'PARENT' ? 'parent / guardian' : 'patient'} so they can create their account.
                The link expires in 72 hours.
              </p>
            </div>
            <div className="w-full rounded-xl p-3 flex items-center gap-2"
              style={{ background: surface.rowHover, border: `1px solid ${border.divider}` }}>
              <p className="text-xs flex-1 truncate font-mono" style={{ color: colors.text.muted }}>
                {fullLink}
              </p>
              <button
                onClick={copyLink}
                className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                style={{ background: copied ? accentAlpha(0.15) : accentAlpha(0.08), color: colors.accent }}>
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <p className="text-xs" style={{ color: colors.text.muted }}>
              Once they accept, their account will be automatically linked to the case record.
            </p>
          </div>
          <div className="px-6 pb-6">
            <Button className="w-full" onClick={() => { setInviteLink(null); setShowSubscription(true) }}>
              Next: Assign Plan
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ── Convert form ──────────────────────────────────────────────────────────
  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.55)' }}>
      <div className="rounded-2xl shadow-2xl w-full max-w-md mx-4"
        style={{ background: surface.card, border: `1px solid ${border.card}` }}>
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: border.divider }}>
          <div>
            <h3 className="font-semibold text-base" style={{ color: colors.text.primary }}>Convert to Case</h3>
            <p className="text-xs mt-0.5" style={{ color: colors.text.muted }}>
              Creates a new case record from this inquiry
            </p>
          </div>
          <button onClick={onClose} style={{ color: colors.text.muted, borderRadius: 6, padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {/* Patient name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">First Name</label>
              <input className="form-input w-full" value={firstName}
                onChange={e => setFirstName(e.target.value)} placeholder="First name" />
            </div>
            <div>
              <label className="form-label">Last Name</label>
              <input className="form-input w-full" value={lastName}
                onChange={e => setLastName(e.target.value)} placeholder="Last name" />
            </div>
          </div>

          {/* Clinic */}
          <div>
            <label className="form-label">Assign to Clinic</label>
            <select className="form-input w-full" value={clinicId} onChange={e => setClinicId(e.target.value)}>
              <option value="">Select clinic…</option>
              {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Linked user toggle */}
          <div className="rounded-xl border" style={{ borderColor: border.divider }}>
            <button
              type="button"
              onClick={() => setLinkUser(v => !v)}
              className="w-full flex items-center justify-between p-3.5 text-left"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: accentAlpha(0.1) }}>
                  <Users size={15} style={{ color: colors.accent }} />
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: colors.text.primary }}>
                    Link a Parent / Guardian
                  </p>
                  <p className="text-xs" style={{ color: colors.text.muted }}>
                    Send an invite and auto-link them to this case record
                  </p>
                </div>
              </div>
              {/* Toggle pill */}
              <div className="flex-shrink-0 w-9 h-5 rounded-full transition-colors relative"
                style={{ background: linkUser ? colors.accent : border.divider }}>
                <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
                  style={{ left: linkUser ? '18px' : '2px' }} />
              </div>
            </button>

            {linkUser && (
              <div className="px-3.5 pb-3.5 flex flex-col gap-3 border-t" style={{ borderColor: border.divider }}>
                <div className="pt-3 grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label">First Name</label>
                    <input className="form-input w-full" value={linkedFirstName}
                      onChange={e => setLinkedFirstName(e.target.value)} placeholder="First name" />
                  </div>
                  <div>
                    <label className="form-label">Last Name</label>
                    <input className="form-input w-full" value={linkedLastName}
                      onChange={e => setLinkedLastName(e.target.value)} placeholder="Last name" />
                  </div>
                </div>
                <div>
                  <label className="form-label">Email</label>
                  <input className="form-input w-full" type="email" value={linkedEmail}
                    onChange={e => setLinkedEmail(e.target.value)} placeholder="email@example.com" />
                </div>
                <div>
                  <label className="form-label">Account Type</label>
                  <select className="form-input w-full" value={linkedRole}
                    onChange={e => setLinkedRole(e.target.value as 'PARENT' | 'PATIENT')}>
                    <option value="PARENT">Parent / Guardian</option>
                    <option value="PATIENT">Patient (self-referral)</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl p-3 text-xs" style={{ background: accentAlpha(0.08), color: colors.text.muted }}>
            <strong style={{ color: colors.text.primary }}>What happens: </strong>
            The inquiry is marked <em>Converted</em>, a case profile is created at stage <em>Inquiry Converted</em>
            {linkUser && <>, and an invite link is generated for the {linkedRole === 'PARENT' ? 'parent / guardian' : 'patient'} to set up their account — they are auto-linked when they accept</>}.
          </div>
        </div>

        <div className="flex justify-end gap-2 p-5 pt-0">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => convertMutation.mutate()} loading={convertMutation.isPending} disabled={!canSubmit}>
            <UserCheck size={15} className="mr-1.5" />Convert to Case
          </Button>
        </div>
      </div>
    </div>
    <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </>
  )
}

// ── Inquiry Detail Modal ───────────────────────────────────────────────────────

function InquiryModal({ inquiry, onClose }: { inquiry: InquiryResponse; onClose: () => void }) {
  const qc        = useQueryClient()
  const navigate  = useNavigate()
  const { toast } = useToast()
  const { user }  = useAuth()

  const canConvert = user
    && ['BUSINESS_OWNER', 'CLINIC_HEAD'].includes(user.role)
    && inquiry.status !== 'CONVERTED'

  const [status,       setStatus]       = useState<InquiryStatus>(inquiry.status)
  const [adminNotes,   setAdminNotes]   = useState(inquiry.adminNotes ?? '')
  const [logType,      setLogType]      = useState<InquiryLogType>('CALL')
  const [logNote,      setLogNote]      = useState('')
  const [showCalendar, setShowCalendar] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(
    inquiry.appointmentDate ? parseISO(inquiry.appointmentDate) : null
  )
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [apptNotes,    setApptNotes]    = useState(inquiry.appointmentNotes ?? '')
  const [showConvert,  setShowConvert]  = useState(false)

  const { data: logs = [] } = useQuery({
    queryKey: ['inquiry-logs', inquiry.id],
    queryFn: () => inquiriesApi.getLogs(inquiry.id),
  })

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof inquiriesApi.update>[1]) =>
      inquiriesApi.update(inquiry.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inquiries'] })
      qc.invalidateQueries({ queryKey: ['inquiry-logs', inquiry.id] })
      toast('Saved', 'success')
    },
    onError: (err) => toast(getApiError(err, 'Save failed'), 'error'),
  })

  const addLogMutation = useMutation({
    mutationFn: (data: CreateInquiryLogRequest) => inquiriesApi.addLog(inquiry.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inquiry-logs', inquiry.id] })
      setLogNote('')
      toast('Activity logged', 'success')
    },
    onError: (err) => toast(getApiError(err, 'Failed to log activity'), 'error'),
  })

  function handleSave() {
    updateMutation.mutate({ status, adminNotes: adminNotes || undefined })
  }

  function handleScheduleAppointment() {
    if (!selectedDate || !selectedTime) return
    const dateStr = format(selectedDate, 'yyyy-MM-dd')
    const iso = new Date(`${dateStr}T${selectedTime}:00`).toISOString()
    updateMutation.mutate({ appointmentDate: iso, appointmentNotes: apptNotes || undefined })
    setShowCalendar(false)
  }

  function handleClearAppointment() {
    updateMutation.mutate({ clearAppointment: true })
    setSelectedDate(null)
    setSelectedTime(null)
    setApptNotes('')
    setShowCalendar(false)
  }

  const fieldLabel: React.CSSProperties = {
    display: 'block', fontSize: 11.5, fontWeight: 600,
    letterSpacing: '0.06em', textTransform: 'uppercase',
    color: colors.text.muted, marginBottom: 2,
  }

  return (
    <Modal open title={`Inquiry — ${inquiry.name}`} onClose={onClose} size="lg">
      <div className="flex flex-col gap-5">

        {/* Contact info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          <div>
            <span style={fieldLabel}>Phone</span>
            <a href={`tel:${inquiry.phone}`} className="text-sm font-medium flex items-center gap-1.5"
              style={{ color: colors.accent }}>
              <Phone size={13} />{inquiry.phone}
            </a>
          </div>
          {inquiry.email && (
            <div>
              <span style={fieldLabel}>Email</span>
              <a href={`mailto:${inquiry.email}`} className="text-sm font-medium flex items-center gap-1.5"
                style={{ color: colors.accent }}>
                <Mail size={13} />{inquiry.email}
              </a>
            </div>
          )}
          {inquiry.preferredTime && (
            <div>
              <span style={fieldLabel}>Preferred Time</span>
              <p className="text-sm font-medium flex items-center gap-1.5" style={{ color: colors.text.primary }}>
                <Clock size={13} />{PREFERRED_TIME_LABEL[inquiry.preferredTime]}
              </p>
            </div>
          )}
          <div>
            <span style={fieldLabel}>Received</span>
            <p className="text-sm" style={{ color: colors.text.primary }}>
              {format(parseISO(inquiry.createdAt), 'd MMM yyyy, h:mm a')}
            </p>
          </div>
        </div>

        {inquiry.reason && (
          <div>
            <span style={fieldLabel}>Reason / Concern</span>
            <div className="rounded-xl px-3 py-2.5 text-sm"
              style={{ color: colors.text.primary, background: surface.rowHover }}>
              {inquiry.reason}
            </div>
          </div>
        )}

        {/* Status + convert */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label style={fieldLabel}>Status</label>
            {inquiry.status === 'CONVERTED' ? (
              <div className="form-input w-full" style={{ color: colors.text.muted, cursor: 'default' }}>
                {STATUS_META['CONVERTED'].label}
              </div>
            ) : (
              <select className="form-input w-full" value={status}
                onChange={e => setStatus(e.target.value as InquiryStatus)}>
                {(Object.keys(STATUS_META) as InquiryStatus[])
                  .filter(s => s !== 'CONVERTED')
                  .map(s => (
                    <option key={s} value={s}>{STATUS_META[s].label}</option>
                  ))}
              </select>
            )}
          </div>
          {canConvert && (
            <Button onClick={() => setShowConvert(true)} variant="secondary">
              <UserCheck size={14} className="mr-1.5" />Convert to Case
            </Button>
          )}
        </div>

        {/* Admin notes */}
        <div>
          <label style={fieldLabel}>Admin Notes</label>
          <textarea rows={2} className="form-input w-full resize-none" value={adminNotes}
            onChange={e => setAdminNotes(e.target.value)} placeholder="Internal notes…" />
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} loading={updateMutation.isPending} size="sm">
            Save Changes
          </Button>
        </div>

        <div style={{ borderTop: `1px solid ${border.divider}` }} />

        {/* Pre-appointment */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold" style={{ color: colors.text.primary }}>Pre-Appointment</span>
            {inquiry.appointmentDate && !showCalendar ? (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1 font-medium"
                  style={paletteStyle('blue', 0.12)}>
                  <CalendarDays size={11} />
                  {format(parseISO(inquiry.appointmentDate), 'd MMM, h:mm a')}
                </span>
                <button className="text-xs" style={{ color: colors.accent }}
                  onClick={() => setShowCalendar(true)}>Reschedule</button>
                <button style={{ color: colors.status.error }} onClick={handleClearAppointment}>
                  <Trash2 size={13} />
                </button>
              </div>
            ) : !showCalendar ? (
              <button className="text-xs flex items-center gap-1" style={{ color: colors.accent }}
                onClick={() => setShowCalendar(true)}>
                <CalendarDays size={13} /> Schedule
              </button>
            ) : null}
          </div>

          {showCalendar && (
            <div className="flex flex-col gap-3">
              <MiniCalendar selected={selectedDate} onSelect={d => { setSelectedDate(d); setSelectedTime(null) }} />

              {selectedDate && (
                <div>
                  <span style={fieldLabel}>Time Slot — {format(selectedDate, 'EEE d MMM')}</span>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 mt-1">
                    {TIME_SLOTS.map(slot => (
                      <button key={slot.value} onClick={() => setSelectedTime(slot.value)}
                        className="text-xs rounded-full py-1.5 px-1 text-center font-medium transition-all"
                        style={{
                          background: selectedTime === slot.value ? colors.accent : accentAlpha(0.06),
                          color: selectedTime === slot.value ? '#fff' : colors.text.primary,
                          border: `1px solid ${selectedTime === slot.value ? colors.accent : 'transparent'}`,
                          boxShadow: selectedTime === slot.value ? `0 2px 8px ${accentAlpha(0.35)}` : 'none',
                        }}>
                        {slot.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selectedDate && selectedTime && (
                <div>
                  <label style={fieldLabel}>Appointment Notes (optional)</label>
                  <textarea rows={2} className="form-input w-full resize-none" value={apptNotes}
                    onChange={e => setApptNotes(e.target.value)} placeholder="Any notes…" />
                </div>
              )}

              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setShowCalendar(false)}>Cancel</Button>
                <Button size="sm" disabled={!selectedDate || !selectedTime}
                  loading={updateMutation.isPending} onClick={handleScheduleAppointment}>
                  Confirm Appointment
                </Button>
              </div>
            </div>
          )}
        </div>

        <div style={{ borderTop: `1px solid ${border.divider}` }} />

        {/* Activity Log */}
        <div>
          <h4 className="text-sm font-semibold mb-3" style={{ color: colors.text.primary }}>Activity Log</h4>
          <ActivityTimeline logs={logs} />

          {/* Add activity */}
          <div className="mt-4 rounded-xl p-3"
            style={{ background: surface.rowHover, border: `1px solid ${border.card}` }}>
            <p className="text-xs font-semibold mb-2" style={{ color: colors.text.muted }}>Log Activity</p>

            {/* Type selector */}
            <div className="flex gap-1.5 mb-3 flex-wrap">
              {MANUAL_LOG_TYPES.map(t => {
                const m = LOG_META[t]
                const Icon = m.icon
                const active = logType === t
                return (
                  <button key={t} onClick={() => setLogType(t)}
                    className="flex items-center gap-1 text-xs rounded-full px-2.5 py-1 transition-colors"
                    style={{
                      background: active ? m.color + '22' : 'transparent',
                      color: active ? m.color : colors.text.muted,
                      border: `1px solid ${active ? m.color + '66' : borderAlpha(0.3)}`,
                      fontWeight: active ? 600 : 400,
                    }}>
                    <Icon size={11} />{m.label}
                  </button>
                )
              })}
            </div>

            <textarea rows={2} className="form-input w-full resize-none" value={logNote}
              onChange={e => setLogNote(e.target.value)}
              placeholder={`Notes for this ${LOG_META[logType].label.toLowerCase()}…`} />

            <div className="flex justify-end mt-2">
              <Button size="sm" onClick={() => addLogMutation.mutate({ logType, notes: logNote })}
                loading={addLogMutation.isPending} disabled={!logNote.trim()}>
                Log Activity
              </Button>
            </div>
          </div>
        </div>
      </div>

      {showConvert && (
        <ConvertModal
          inquiry={inquiry}
          onClose={() => setShowConvert(false)}
          onConverted={patientId => {
            setShowConvert(false)
            onClose()
            navigate(`/patients/${patientId}`)
          }}
        />
      )}
    </Modal>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────


// ── Add an inquiry taken at the clinic ────────────────────────────────────────

const START_OPTIONS: {
  key: string
  label: string
  hint: string
  source: 'WALK_IN' | 'PHONE'
  status: 'VISITED' | 'CONTACTED' | 'NEW'
}[] = [
  { key: 'walkin', label: 'Walk-in',            hint: 'They are at the clinic now',
    source: 'WALK_IN', status: 'VISITED' },
  { key: 'spoke',  label: 'Phone — spoke to them', hint: 'Call already handled',
    source: 'PHONE',   status: 'CONTACTED' },
  { key: 'follow', label: 'Phone — to follow up',  hint: 'Details taken, nobody has spoken yet',
    source: 'PHONE',   status: 'NEW' },
]

function AddInquiryModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [name, setName]       = useState('')
  const [phone, setPhone]     = useState('')
  const [email, setEmail]     = useState('')
  const [reason, setReason]   = useState('')
  const [preferred, setPreferred] = useState<'' | PreferredTime>('')
  const [choice, setChoice]   = useState(START_OPTIONS[0])
  const [error, setError]     = useState('')

  const mut = useMutation({
    mutationFn: () => inquiriesApi.addManual({
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      reason: reason.trim() || undefined,
      preferredTime: preferred || undefined,
      status: choice.status,
      source: choice.source,
    }),
    onSuccess: onAdded,
    onError: (err: unknown) => setError(getApiError(err, 'Could not add the inquiry')),
  })

  return (
    <Modal open title="Add an inquiry" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="Name" value={name} onChange={e => setName(e.target.value)}
            placeholder="Parent or patient name" />
          <Input label="Phone" value={phone} onChange={e => setPhone(e.target.value)}
            placeholder="+91 98765 43210" />
        </div>

        <Input label="Email (optional)" value={email} onChange={e => setEmail(e.target.value)}
          placeholder="name@example.com" />

        <div>
          <label className="form-label">Reason (optional)</label>
          <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2}
            className="form-input w-full" placeholder="What they came in about" />
        </div>

        <Select
          label="Preferred time (optional)"
          value={preferred}
          onChange={e => setPreferred(e.target.value as PreferredTime | '')}
          placeholder="No preference"
          options={[
            { value: 'MORNING',   label: 'Morning' },
            { value: 'AFTERNOON', label: 'Afternoon' },
            { value: 'EVENING',   label: 'Evening' },
          ]}
        />

        {/* Where it starts in the pipeline — a walk-in is already in front of you,
            so it should not begin at New the way a website enquiry does. */}
        <div>
          <label className="form-label">How did this come in?</label>
          <div className="flex flex-col gap-1.5">
            {START_OPTIONS.map(o => {
              const active = choice.key === o.key
              return (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => setChoice(o)}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left transition-colors"
                  style={{
                    background: active ? accentAlpha(0.08) : surface.filterStrip,
                    border: `1.5px solid ${active ? colors.accent : 'transparent'}`,
                  }}
                >
                  <span className="text-sm font-medium"
                    style={{ color: active ? colors.accent : colors.text.primary }}>
                    {o.label}
                  </span>
                  <span className="text-xs" style={{ color: colors.text.dim }}>{o.hint}</span>
                </button>
              )
            })}
          </div>
        </div>

        {error && <p className="form-error">{error}</p>}
      </div>

      <div className="flex gap-2 justify-end mt-6 pt-4" style={{ borderTop: `1px solid ${border.divider}` }}>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button
          variant="primary"
          loading={mut.isPending}
          onClick={() => {
            if (!name.trim())  { setError('Enter a name'); return }
            if (!phone.trim()) { setError('Enter a phone number'); return }
            setError('')
            mut.mutate()
          }}
        >
          Add inquiry
        </Button>
      </div>
    </Modal>
  )
}

export default function InquiriesPage() {
  const navigate = useNavigate()
  const { user }  = useAuth()

  const canHandleOutcomes = user && ['BUSINESS_OWNER'].includes(user.role)
  // Routes are not role-guarded, so gate the action rather than relying on the
  // sidebar to keep other roles off this page.
  const canAddInquiry = !!user &&
    (hasRole(user, 'BUSINESS_OWNER') || hasRole(user, 'CLINIC_HEAD'))

  const [mainTab,       setMainTab]       = useState<'list' | 'analytics'>('list')
  const [pageView,      setPageView]      = useState<'list' | 'calendar'>('list')
  const [activeTab,     setActiveTab]     = useState<InquiryStatus | 'ALL'>('ALL')
  const [selected,      setSelected]      = useState<InquiryResponse | null>(null)
  const [actionTarget,  setActionTarget]  = useState<InquiryResponse | null>(null)
  const [convertTarget, setConvertTarget] = useState<InquiryResponse | null>(null)
  const [addOpen,       setAddOpen]       = useState(false)
  const qc = useQueryClient()

  const { data: inquiries, isLoading } = useQuery({
    queryKey: ['inquiries'],
    queryFn: () => inquiriesApi.list(),
  })

  const { data: analytics } = useQuery({
    queryKey: ['inquiries-analytics'],
    queryFn: () => inquiriesApi.getAnalytics(),
  })

  if (isLoading) return <PageLoader />

  const all = inquiries ?? []

  const counts = (Object.keys(STATUS_META) as InquiryStatus[]).reduce(
    (acc, s) => ({ ...acc, [s]: all.filter(i => i.status === s).length }),
    {} as Record<InquiryStatus, number>
  )

  const displayed = activeTab === 'ALL' ? all : all.filter(i => i.status === activeTab)

  // Funnel drop-off: percentage relative to total
  const funnelBase = analytics?.totalCount || 1

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold" style={{ color: colors.text.heading }}>Inquiries</h1>
          <p className="text-sm mt-1" style={{ color: colors.text.muted }}>
            Manage consultation requests from the public website.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 self-start">
        {canAddInquiry && (
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-opacity hover:opacity-85"
          style={{ color: '#fff', background: colors.accent }}>
          <Plus size={14} /> Add Inquiry
        </button>
        )}
        {/* Main tab toggle: Inquiries | Analytics */}
        <div className="flex rounded-xl overflow-hidden border"
          style={{ borderColor: border.divider }}>
          <button onClick={() => setMainTab('list')}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors"
            style={mainTab === 'list' ? styles.filterTabActive : styles.filterTabInactive}>
            <List size={14} />Inquiries
          </button>
          <button onClick={() => setMainTab('analytics')}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors"
            style={mainTab === 'analytics' ? styles.filterTabActive : styles.filterTabInactive}>
            <BarChart2 size={14} />Analytics
          </button>
        </div>
        </div>
      </div>

      {addOpen && (
        <AddInquiryModal
          onClose={() => setAddOpen(false)}
          onAdded={() => {
            setAddOpen(false)
            qc.invalidateQueries({ queryKey: ['inquiries'] })
            qc.invalidateQueries({ queryKey: ['inquiry-analytics'] })
          }}
        />
      )}

      {/* ── Inquiries tab ──────────────────────────────────────────── */}
      {mainTab === 'list' && (<>

      {/* Filter tabs + List / Calendar toggle on same row */}
      <div className="flex items-center gap-3">
        {/* Status filter — dropdown on mobile (pills crop there), pill row from sm up */}
        <div className="flex-1 sm:hidden">
          <Select
            value={activeTab}
            onChange={e => setActiveTab(e.target.value as InquiryStatus | 'ALL')}
            options={TABS.map(t => ({
              value: t.value,
              label: `${t.label} (${t.value === 'ALL' ? all.length : (counts[t.value as InquiryStatus] ?? 0)})`,
            }))}
          />
        </div>
        <div className="hidden sm:flex gap-1 overflow-x-auto pb-1 flex-1">
          {TABS.map(t => (
            <button key={t.value} onClick={() => setActiveTab(t.value)}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors"
              style={activeTab === t.value ? styles.filterTabActive : styles.filterTabInactive}>
              {t.label}
              <span className="ml-1.5 opacity-60">
                {t.value === 'ALL' ? all.length : (counts[t.value as InquiryStatus] ?? 0)}
              </span>
            </button>
          ))}
        </div>
        {/* List / Calendar toggle — calendar view isn't useful at mobile width */}
        <div className="hidden sm:flex rounded-xl overflow-hidden border flex-shrink-0"
          style={{ borderColor: border.divider }}>
          <button onClick={() => setPageView('list')}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors"
            style={pageView === 'list' ? styles.filterTabActive : styles.filterTabInactive}>
            <List size={14} />List
          </button>
          <button onClick={() => setPageView('calendar')}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors"
            style={pageView === 'calendar' ? styles.filterTabActive : styles.filterTabInactive}>
            <CalendarDays size={14} />Calendar
          </button>
        </div>
      </div>

      {/* Calendar view */}
      {pageView === 'calendar' && (
        <CalendarView
          inquiries={all}
          onSelect={setSelected}
          onAction={canHandleOutcomes ? setActionTarget : undefined}
        />
      )}

      {/* Table */}
      {pageView === 'list' && (
        <Card padding={false}>
          {displayed.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-2">
              <Inbox size={32} style={{ color: colors.text.muted }} />
              <p className="text-sm" style={{ color: colors.text.muted }}>No inquiries found</p>
            </div>
          ) : (
            <>
              {/* Desktop header */}
              <div className="hidden md:grid grid-cols-[2fr_1fr_2.5fr_1.5fr_1.5fr_44px] gap-5 px-5 py-3 border-b"
                style={{ borderColor: border.divider, background: surface.rowHover }}>
                {['Name', 'Phone', 'Reason', 'Status', 'Next Action', ''].map(h => (
                  <span key={h} className="text-xs font-semibold uppercase tracking-wider"
                    style={{ color: colors.text.muted }}>{h}</span>
                ))}
              </div>

              {displayed.map((inq, idx) => (
                <div key={inq.id}
                  className="w-full transition-colors"
                  style={{ borderBottom: idx < displayed.length - 1 ? `1px solid ${border.divider}` : 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.background = surface.rowHover)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>

                  {/* Desktop */}
                  <div className="hidden md:grid grid-cols-[2fr_1fr_2.5fr_1.5fr_1.5fr_44px] gap-5 items-center px-5 py-4">
                    {/* Name */}
                    <button className="flex items-center gap-2.5 text-left min-w-0" onClick={() => setSelected(inq)}>
                      <Avatar
                        initials={inq.name.charAt(0).toUpperCase()}
                        name={inq.name}
                        bold
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: colors.text.primary }}>{inq.name}</p>
                        <SourceBadge source={inq.source} />
                        {inq.appointmentDate && (
                          <p className="text-xs flex items-center gap-1" style={{ color: colors.accent }}>
                            <CalendarDays size={10} />
                            {format(parseISO(inq.appointmentDate), 'd MMM, h:mm a')}
                          </p>
                        )}
                      </div>
                    </button>
                    {/* Phone */}
                    <button className="flex items-center gap-1.5 text-sm text-left min-w-0" style={{ color: colors.text.muted }}
                      onClick={() => setSelected(inq)}>
                      <Phone size={12} className="flex-shrink-0" />
                      <span className="truncate">{inq.phone}</span>
                    </button>
                    {/* Reason */}
                    <button className="text-sm truncate text-left min-w-0" style={{ color: colors.text.muted }}
                      onClick={() => setSelected(inq)}>
                      {inq.reason ?? <span style={{ color: colors.text.dim }}>—</span>}
                    </button>
                    {/* Status */}
                    <button className="flex items-center" onClick={() => setSelected(inq)}>
                      <StatusBadge status={inq.status} />
                    </button>
                    {/* Next Action */}
                    <div className="flex items-center">
                      {hasNextAction(inq.status) ? (
                        <button
                          onClick={e => { e.stopPropagation(); setActionTarget(inq) }}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1.5 whitespace-nowrap transition-all"
                          style={{
                            background: accentAlpha(0.1),
                            color: colors.accent,
                            border: `1px solid ${accentAlpha(0.25)}`,
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = accentAlpha(0.2))}
                          onMouseLeave={e => (e.currentTarget.style.background = accentAlpha(0.1))}>
                          <Zap size={11} />
                          {getActionLabel(inq.status)}
                        </button>
                      ) : (
                        <span className="text-sm" style={{ color: colors.text.dim }}>—</span>
                      )}
                    </div>
                    {/* Detail chevron */}
                    <button className="flex items-center justify-center w-full h-full" onClick={() => setSelected(inq)}>
                      <ChevronRight size={15} style={{ color: colors.text.muted }} />
                    </button>
                  </div>

                  {/* Mobile */}
                  <div className="md:hidden px-4 py-3">
                    <button className="w-full text-left" onClick={() => setSelected(inq)}>
                      <div className="flex items-start gap-3">
                        <Avatar
                          initials={inq.name.charAt(0).toUpperCase()}
                          name={inq.name}
                          bold
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium truncate" style={{ color: colors.text.primary }}>{inq.name}</p>
                            <StatusBadge status={inq.status} />
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-xs" style={{ color: colors.text.muted }}>
                              {inq.phone} · {format(parseISO(inq.createdAt), 'd MMM yyyy')}
                            </p>
                            <SourceBadge source={inq.source} />
                          </div>
                          {inq.reason && (
                            <p className="text-xs truncate mt-0.5" style={{ color: colors.text.muted }}>{inq.reason}</p>
                          )}
                        </div>
                      </div>
                    </button>
                    {hasNextAction(inq.status) && (
                      <button
                        onClick={() => setActionTarget(inq)}
                        className="mt-2 w-full inline-flex items-center justify-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1.5"
                        style={{ background: accentAlpha(0.1), color: colors.accent, border: `1px solid ${accentAlpha(0.25)}` }}>
                        <Zap size={11} />{getActionLabel(inq.status)}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </Card>
      )}

      </>)} {/* end inquiries tab */}

      {/* ── Analytics tab ──────────────────────────────────────────── */}
      {mainTab === 'analytics' && (<>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="rounded-2xl p-4" style={styles.card}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: colors.text.muted }}>Total</p>
          <p className="text-3xl font-bold" style={{ color: colors.text.primary }}>{analytics?.totalCount ?? '—'}</p>
        </div>

        <div className="rounded-2xl p-4" style={styles.card}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: colors.text.muted }}>Conversion</p>
          <p className="text-3xl font-bold" style={{ color: colors.status.success }}>
            {analytics != null ? `${analytics.conversionRate}%` : '—'}
          </p>
          {analytics && (
            <p className="text-xs mt-0.5" style={{ color: colors.text.muted }}>
              {analytics.convertedCount} of {analytics.totalCount}
            </p>
          )}
        </div>

        <div className="rounded-2xl p-4" style={styles.card}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: colors.text.muted }}>Avg Response</p>
          <p className="text-3xl font-bold" style={{ color: colors.text.primary }}>
            {analytics?.avgResponseTimeHours != null
              ? analytics.avgResponseTimeHours < 1
                ? `${Math.round(analytics.avgResponseTimeHours * 60)}m`
                : `${analytics.avgResponseTimeHours}h`
              : '—'}
          </p>
          <p className="text-xs mt-0.5" style={{ color: colors.text.muted }}>first contact</p>
        </div>

        <div className="rounded-2xl p-4" style={styles.card}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: colors.text.muted }}>Overdue</p>
          <p className="text-3xl font-bold"
            style={{ color: analytics?.overdueCount ? colors.status.error : colors.text.primary }}>
            {analytics?.overdueCount ?? '—'}
          </p>
          <p className="text-xs mt-0.5" style={{ color: colors.text.muted }}>new &gt; 24 hrs</p>
        </div>

        <div className="rounded-2xl p-4" style={styles.card}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: colors.text.muted }}>Ready to Convert</p>
          <p className="text-3xl font-bold"
            style={{ color: analytics?.readyToConvertCount ? colors.status.success : colors.text.primary }}>
            {analytics?.readyToConvertCount ?? '—'}
          </p>
          <p className="text-xs mt-0.5" style={{ color: colors.text.muted }}>visited stage</p>
        </div>
      </div>

      {/* Where inquiries come from, and how well each channel converts */}
      <div className="rounded-2xl p-5" style={styles.card}>
        <h3 className="text-sm font-semibold mb-1" style={{ color: colors.text.primary }}>Where they come from</h3>
        <p className="text-xs mb-4" style={{ color: colors.text.muted }}>
          Volume and conversion by channel. A walk-in behaves differently from a website lead,
          so the aggregate rate can hide a weak channel.
        </p>
        <div className="flex flex-col gap-3">
          {(analytics?.bySource ?? []).map(row => {
            const meta = SOURCE_META[row.source] ?? SOURCE_META.WEBSITE
            const Icon = meta.icon
            const share = (analytics?.totalCount ?? 0) > 0
              ? Math.round((row.count / (analytics!.totalCount)) * 100) : 0
            return (
              <div key={row.source} className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 w-28 sm:w-36 flex-shrink-0">
                  <Icon size={12} style={{ color: colors.text.muted }} />
                  <span className="text-xs font-medium truncate" style={{ color: colors.text.muted }}>
                    {meta.label}
                  </span>
                </div>
                <div className="flex-1 rounded-full h-2 overflow-hidden" style={{ background: border.card }}>
                  <div className="h-full rounded-full transition-all"
                    style={{
                      width: `${share}%`,
                      minWidth: row.count > 0 ? 4 : 0,
                      background: colors.accent,
                    }} />
                </div>
                <span className="text-xs tabular-nums w-10 text-right flex-shrink-0"
                  style={{ color: colors.text.primary }}>{row.count}</span>
                <span className="text-xs tabular-nums w-24 text-right flex-shrink-0"
                  style={{
                    // Green on a 0% rate would read as a good result; it is the opposite.
                    color: row.count === 0 ? colors.text.dim
                         : row.convertedCount > 0 ? colors.status.success
                         : colors.text.muted,
                  }}>
                  {row.count > 0 ? `${row.conversionRate}% converted` : 'no leads'}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Funnel drop-off chart — clicking switches to Inquiries tab with filter applied */}
      <div className="rounded-2xl p-5" style={styles.card}>
        <h3 className="text-sm font-semibold mb-4" style={{ color: colors.text.primary }}>Case Journey Funnel</h3>
        <div className="flex flex-col gap-2.5">
          {JOURNEY_STATUSES.map(s => {
            const meta  = STATUS_META[s]
            const Icon  = meta.icon
            const count = analytics?.countByStatus[s] ?? counts[s] ?? 0
            const pct   = funnelBase > 0 ? Math.round((count / funnelBase) * 100) : 0
            return (
              <button key={s}
                onClick={() => { setActiveTab(activeTab === s ? 'ALL' : s); setMainTab('list') }}
                className="flex items-center gap-3 group text-left w-full" style={{ outline: 'none' }}>
                <div className="flex items-center gap-1.5 w-28 sm:w-40 flex-shrink-0">
                  <Icon size={12} style={{ color: colors.text.muted }} />
                  <span className="text-xs font-medium truncate" style={{ color: colors.text.muted }}>
                    {meta.label}
                  </span>
                </div>
                <div className="flex-1 rounded-full h-2 overflow-hidden" style={{ background: border.card }}>
                  <div className="h-full rounded-full transition-all"
                    style={{
                      width: `${pct}%`,
                      minWidth: count > 0 ? 4 : 0,
                      background: activeTab === s ? colors.accent : meta.style.color as string,
                      opacity: activeTab === s ? 1 : 0.6,
                    }} />
                </div>
                <span className="text-xs font-bold w-6 text-right flex-shrink-0"
                  style={{ color: colors.text.primary }}>{count}</span>
                <span className="text-xs w-9 text-right flex-shrink-0"
                  style={{ color: colors.text.muted }}>{pct}%</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Journey pipeline cards — clicking switches to Inquiries tab with filter applied */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {JOURNEY_STATUSES.map(s => {
          const meta  = STATUS_META[s]
          const Icon  = meta.icon
          const count = counts[s] ?? 0
          return (
            <button key={s}
              onClick={() => { setActiveTab(activeTab === s ? 'ALL' : s); setMainTab('list') }}
              className="rounded-2xl p-3 text-left transition-all"
              style={{
                ...styles.card,
                border: activeTab === s ? `1.5px solid ${colors.accent}` : `1px solid ${border.card}`,
                outline: 'none',
              }}>
              <div className="flex items-center gap-1.5 mb-2">
                <Icon size={12} style={{ color: colors.text.muted }} />
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.text.muted }}>
                  {meta.label}
                </span>
              </div>
              <p className="text-2xl font-bold" style={{ color: colors.text.primary }}>{count}</p>
            </button>
          )
        })}
      </div>

      </>)} {/* end analytics tab */}

      {selected && <InquiryModal inquiry={selected} onClose={() => setSelected(null)} />}

      {actionTarget && (
        <ActionModal
          inquiry={actionTarget}
          onClose={() => setActionTarget(null)}
          onConverted={patientId => {
            setActionTarget(null)
            navigate(`/patients/${patientId}`)
          }}
          onRequestConvert={() => {
            const target = actionTarget
            setActionTarget(null)
            setConvertTarget(target)
          }}
        />
      )}

      {convertTarget && (
        <ConvertModal
          inquiry={convertTarget}
          onClose={() => setConvertTarget(null)}
          onConverted={patientId => {
            setConvertTarget(null)
            navigate(`/patients/${patientId}`)
          }}
        />
      )}
    </div>
  )
}
