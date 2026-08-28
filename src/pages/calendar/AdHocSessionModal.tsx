import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { format } from 'date-fns'
import { patientsApi } from '../../api/patients'
import { enrollmentsApi } from '../../api/enrollments'
import { therapySessionsApi } from '../../api/therapySessions'
import { usersApi } from '../../api/users'
import { Modal } from '../../components/ui/Modal'
import { Select } from '../../components/ui/Select'
import { Button } from '../../components/ui/Button'
import { getApiError } from '../../lib/apiError'
import { colors, surface, border, accentAlpha, warningAlpha } from '../../theme'
import type { PatientResponse, EnrollmentResponse } from '../../types'
import type { SlotSelection } from './types'

/** A plan already known by the caller — skips the patient picker entirely. Used when
 *  booking is started from a specific patient/program, e.g. the Patient page. */
export interface FixedPlan {
  enrollmentId: string
  patientName: string
  programName: string
  therapistId: string
  therapistFirstName: string
  therapistLastName: string
}

// ── Book a one-off therapy session ────────────────────────────────────────────

export default function AdHocSessionModal({
  slot, fixedPlan, onClose, onDone,
}: {
  /** Prefilled when opened by dragging a slot on the calendar. */
  slot?: SlotSelection
  /** Prefilled when opened from a specific patient/program — see {@link FixedPlan}. */
  fixedPlan?: FixedPlan
  onClose: () => void
  onDone: () => void
}) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const [patientId, setPatientId] = useState('')
  const [date, setDate]           = useState(slot?.date ?? today)
  const [start, setStart]         = useState(slot?.start ?? '09:00')
  const [end, setEnd]             = useState(slot?.end ?? '10:00')
  const [therapistId, setTherapistId] = useState('')
  const [billing, setBilling] = useState<'plan' | 'chargeable' | 'free'>('plan')
  const [notes, setNotes]         = useState('')
  const [error, setError]         = useState('')

  const { data: patients = [] } = useQuery({
    queryKey: ['patients'],
    queryFn:  () => patientsApi.list(),
    enabled:  !fixedPlan,
  })

  // The session hangs off a therapy plan, so a patient without one cannot be booked.
  const { data: enrollments = [], isFetching: loadingPlans } = useQuery({
    queryKey: ['enrollments', patientId],
    queryFn:  () => enrollmentsApi.listForPatient(patientId),
    enabled:  !fixedPlan && !!patientId,
  })
  const activePlan = fixedPlan ? null : enrollments.find((e: EnrollmentResponse) => e.status !== 'CANCELLED') ?? null

  const planEnrollmentId = fixedPlan?.enrollmentId ?? activePlan?.id ?? null
  const planTherapistId  = fixedPlan?.therapistId ?? activePlan?.therapistId ?? null
  const planTherapistName = fixedPlan
    ? `${fixedPlan.therapistFirstName} ${fixedPlan.therapistLastName}`
    : activePlan ? `${activePlan.therapistFirstName} ${activePlan.therapistLastName}` : null

  // A one-off session doesn't have to stay with the plan's own therapist — e.g. covering
  // for someone on leave. Left blank, the backend defaults to the plan's therapist.
  const { data: therapists = [] } = useQuery({
    queryKey: ['therapists'],
    queryFn:  () => usersApi.listTherapists(),
  })
  const therapistOptions = therapists
    .filter(t => t.id !== planTherapistId)
    .map(t => ({ value: t.id, label: `${t.firstName} ${t.lastName}` }))

  const mut = useMutation({
    mutationFn: () => therapySessionsApi.createAdHoc({
      enrollmentId: planEnrollmentId!,
      sessionDate: date,
      startTime: start,
      endTime: end,
      therapistId: therapistId || undefined,
      countsTowardPlan: billing === 'plan',
      requiresPayment: billing === 'chargeable',
      notes: notes.trim() || undefined,
    }),
    onSuccess: onDone,
    onError: (err: unknown) => setError(getApiError(err, 'Could not book the session')),
  })

  return (
    <Modal open title="Book a therapy session" onClose={onClose}>
      <div className="flex flex-col gap-4">
        {fixedPlan ? (
          <div className="rounded-xl px-3 py-2.5 text-xs"
            style={{ background: surface.rowHover, color: colors.text.muted }}>
            <span style={{ color: colors.text.primary, fontWeight: 600 }}>{fixedPlan.patientName}</span>
            {' · '}{fixedPlan.programName}
          </div>
        ) : (
          <>
            <Select
              label="Patient"
              value={patientId}
              onChange={e => setPatientId(e.target.value)}
              placeholder="Choose a patient"
              options={patients.map((pt: PatientResponse) => ({
                value: pt.id, label: `${pt.firstName} ${pt.lastName}`,
              }))}
            />

            {patientId && !loadingPlans && !activePlan && (
              <p className="text-xs rounded-xl px-3 py-2.5"
                style={{ background: warningAlpha(0.10), color: colors.status.warning }}>
                This patient has no active therapy plan. Set one up on their record first — a session
                has to belong to a plan.
              </p>
            )}

            {activePlan && (
              <div className="rounded-xl px-3 py-2.5 text-xs"
                style={{ background: surface.rowHover, color: colors.text.muted }}>
                Plan: <span style={{ color: colors.text.primary, fontWeight: 600 }}>{activePlan.programName}</span>
                {' · '}with {activePlan.therapistFirstName} {activePlan.therapistLastName}
              </div>
            )}
          </>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="form-label">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="form-input w-full" />
          </div>
          <div>
            <label className="form-label">Starts</label>
            <input type="time" value={start} onChange={e => setStart(e.target.value)} className="form-input w-full" />
          </div>
          <div>
            <label className="form-label">Ends</label>
            <input type="time" value={end} onChange={e => setEnd(e.target.value)} className="form-input w-full" />
          </div>
        </div>

        <Select
          label="Substitute therapist (optional)"
          placeholder={planTherapistName ? `Keep ${planTherapistName}…` : 'Keep the plan’s therapist…'}
          options={therapistOptions}
          value={therapistId}
          onChange={e => setTherapistId(e.target.value)}
        />

        {/* Billing decision, asked per booking */}
        <div>
          <label className="form-label">How is this session paid for?</label>
          <div className="flex flex-col gap-1.5">
            {([
              { v: 'plan',       label: 'From the plan',     hint: 'Uses one of the paid sessions' },
              { v: 'chargeable', label: 'Extra — chargeable', hint: 'On top of the plan, family pays' },
              { v: 'free',       label: 'Extra — no charge',  hint: 'On top of the plan, at no cost' },
            ] as const).map(o => (
              <button
                key={o.v}
                type="button"
                onClick={() => setBilling(o.v)}
                className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left transition-colors"
                style={{
                  background: billing === o.v ? accentAlpha(0.08) : surface.filterStrip,
                  border: `1.5px solid ${billing === o.v ? colors.accent : 'transparent'}`,
                }}
              >
                <span className="text-sm font-medium"
                  style={{ color: billing === o.v ? colors.accent : colors.text.primary }}>
                  {o.label}
                </span>
                <span className="text-xs" style={{ color: colors.text.dim }}>{o.hint}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="form-label">Notes (optional)</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            className="form-input w-full" placeholder="Why this session was added" />
        </div>

        {error && <p className="form-error">{error}</p>}
      </div>

      <div className="flex gap-2 justify-end mt-6 pt-4" style={{ borderTop: `1px solid ${border.divider}` }}>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button
          variant="primary"
          loading={mut.isPending}
          onClick={() => {
            if (!planEnrollmentId) { setError('Pick a patient with an active therapy plan'); return }
            if (end <= start)      { setError('End time must be after the start time'); return }
            setError('')
            mut.mutate()
          }}
        >
          Book session
        </Button>
      </div>
    </Modal>
  )
}
