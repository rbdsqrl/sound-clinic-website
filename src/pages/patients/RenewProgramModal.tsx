import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { enrollmentsApi } from '../../api/enrollments'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../hooks/useToast'
import { getApiError } from '../../lib/apiError'
import { colors, border, surface, accentAlpha } from '../../theme'
import { PaymentEntryFields, emptyPayment, toPaymentRequest, todayStr, type PaymentEntryValue } from './PaymentEntry'
import type { EnrollmentResponse, SubscriptionResponse } from '../../types'

const rupees = (n: number) => `₹${Math.round(Math.max(0, n)).toLocaleString('en-IN')}`

/** Renew Program — add more sessions to the same plan, and optionally register a payment for them. */
export function RenewProgramModal({ enrollment, subscription, onClose, onRenewed }: {
  enrollment: EnrollmentResponse
  subscription: SubscriptionResponse
  onClose: () => void
  onRenewed: () => void
}) {
  const { toast } = useToast()
  const qc = useQueryClient()

  const [sessions, setSessions] = useState('')
  const [amountInput, setAmountInput] = useState<string | null>(null)   // null = follow the usual amount
  const [startDate, setStartDate] = useState('')
  const [withPayment, setWithPayment] = useState(false)
  const [payment, setPayment] = useState<PaymentEntryValue>(emptyPayment())
  const [errors, setErrors] = useState<{ sessions?: string; payment?: string; startDate?: string; total?: string }>({})
  const [formError, setFormError] = useState<string | null>(null)

  const n = parseInt(sessions, 10)
  const validN = !isNaN(n) && n >= 1
  const factor = 1 - subscription.discountPercent / 100
  const addedCost = validN ? Math.round(subscription.perSessionCost * n * factor) : 0
  // What the added sessions cost at the plan's usual rate; the admin can overwrite it to give an ad hoc discount.
  const typedAmount = amountInput === null || amountInput.trim() === '' ? NaN : parseFloat(amountInput)
  const renewalAmount = isNaN(typedAmount) ? addedCost : Math.round(typedAmount)
  const adjustment = renewalAmount - addedCost            // negative = discount
  const paidNow = withPayment ? (parseFloat(payment.amount) || 0) : 0
  const remaining = renewalAmount - paidNow

  const mut = useMutation({
    mutationFn: () => {
      const paid = withPayment ? toPaymentRequest(payment).request : undefined
      return enrollmentsApi.renew(enrollment.id, {
        additionalSessions: n,
        startDate: startDate || undefined,
        // The plan keeps one total for all its sessions: what it is now plus what was agreed for the new ones.
        planTotal: adjustment !== 0 ? Math.round(subscription.totalAmount) + renewalAmount : undefined,
        payment: paid,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subscription-payments', subscription.id] })
      toast(`Program renewed — ${n} session${n === 1 ? '' : 's'} added`, 'success')
      onRenewed()
    },
    onError: err => setFormError(getApiError(err, 'Failed to renew the program')),
  })

  const submit = () => {
    setFormError(null)
    const e: typeof errors = {}
    if (!validN) e.sessions = 'Enter how many sessions to add'
    else if (n > 200) e.sessions = 'At most 200 sessions at a time'
    if (amountInput !== null && amountInput.trim() !== '' && (isNaN(typedAmount) || typedAmount < 0)) e.total = 'Enter a valid amount'
    if (startDate && startDate < todayStr()) e.startDate = "The new sessions can't start in the past"
    if (withPayment) e.payment = toPaymentRequest(payment).error
    setErrors(e)
    if (Object.values(e).some(Boolean)) return
    mut.mutate()
  }

  const row = (label: string, value: string, strong = false) => (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs" style={{ color: colors.text.muted }}>{label}</span>
      <span className={`text-sm tabular-nums ${strong ? 'font-bold' : 'font-medium'}`} style={{ color: strong ? colors.accent : colors.text.primary }}>{value}</span>
    </div>
  )

  return (
    <Modal open title="Renew Program" onClose={onClose} size="md" error={formError}
      footer={
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={mut.isPending}>Renew program</Button>
        </div>
      }>
      <p className="text-sm font-medium" style={{ color: colors.text.primary }}>{subscription.programName}</p>
      <p className="text-xs mb-4" style={{ color: colors.text.muted }}>
        {enrollment.sessionsCompleted} of {subscription.numSessions} sessions completed · with {enrollment.therapistFirstName} {enrollment.therapistLastName}
        {enrollment.status === 'COMPLETED' && ' · marked completed — renewing reopens it'}
      </p>

      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Sessions to add"
            type="number" min="1" max="200" step="1"
            value={sessions}
            onChange={e => setSessions(e.target.value)}
            error={errors.sessions}
            autoFocus
          />
          <Input
            label="Start from (optional)"
            type="date" min={todayStr()}
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            error={errors.startDate}
            hint="Leave empty to continue after the last session"
          />
        </div>
        <p className="text-xs" style={{ color: colors.text.dim }}>
          New sessions keep the same therapist, time and days as this program.
        </p>

        {/* Where the plan stands today — kept visually apart from what the renewal will change */}
        <div className="rounded-xl p-3 space-y-1.5" style={{ background: surface.filterStrip, border: `1px solid ${border.divider}` }}>
          <p className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: colors.text.dim }}>Current plan</p>
          {row(`${subscription.numSessions} sessions`, rupees(subscription.totalAmount))}
          {row('Paid so far', rupees(subscription.amountPaid))}
          {row('Balance', rupees(subscription.totalAmount - subscription.amountPaid))}
        </div>

        {validN ? (
          <div className="rounded-xl p-3 space-y-3" style={{ background: accentAlpha(0.06), border: `1px solid ${accentAlpha(0.15)}` }}>
            <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: colors.accent }}>After renewal</p>
            <Input
              label={`Amount for ${n} new session${n === 1 ? '' : 's'} (₹)`}
              type="number" min="0" step="1"
              value={amountInput ?? String(addedCost)}
              onChange={e => setAmountInput(e.target.value)}
              error={errors.total}
              hint={adjustment < 0
                ? `${rupees(-adjustment)} discount from the usual ${rupees(addedCost)} (${n} × ${rupees(subscription.perSessionCost * factor)})`
                : adjustment > 0
                  ? `${rupees(adjustment)} more than the usual ${rupees(addedCost)}`
                  : `${n} × ${rupees(subscription.perSessionCost * factor)} — edit to give an ad hoc discount`}
            />
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs" style={{ color: colors.text.muted }}>{withPayment ? 'Balance after this payment' : 'To pay for this renewal'}</span>
              <span className="text-sm font-bold tabular-nums" style={{ color: colors.accent }}>{rupees(remaining)}</span>
            </div>
          </div>
        ) : (
          <div className="rounded-xl p-3 text-center text-xs" style={{ border: `1px dashed ${border.divider}`, color: colors.text.dim }}>
            Enter the sessions to add to see the new cost
          </div>
        )}

        <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: colors.text.primary }}>
          <input
            type="checkbox"
            checked={withPayment}
            onChange={e => {
              setWithPayment(e.target.checked)
              if (e.target.checked && !payment.amount && renewalAmount > 0) setPayment({ ...payment, amount: String(renewalAmount) })
            }}
          />
          Register a payment now
        </label>
        {withPayment && <PaymentEntryFields value={payment} onChange={setPayment} error={errors.payment} />}
      </div>
    </Modal>
  )
}
