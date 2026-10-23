import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { IndianRupee, ChevronDown, Plus } from 'lucide-react'
import { subscriptionsApi } from '../../api/subscriptions'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../hooks/useToast'
import { getApiError } from '../../lib/apiError'
import { formatDateStr } from '../../lib/format'
import { colors, border, accentAlpha, surface } from '../../theme'
import type { AddPaymentRequest, PaymentMode, SubscriptionPaymentResponse, SubscriptionResponse } from '../../types'

const rupees = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`

export const PAYMENT_MODE_LABEL: Record<PaymentMode, string> = {
  CASH: 'Cash', UPI: 'UPI', CARD: 'Card', BANK_TRANSFER: 'Bank transfer', CHEQUE: 'Cheque', OTHER: 'Other',
}
const MODE_OPTIONS = (Object.keys(PAYMENT_MODE_LABEL) as PaymentMode[]).map(m => ({ value: m, label: PAYMENT_MODE_LABEL[m] }))

export interface PaymentEntryValue { amount: string; paidOn: string; mode: PaymentMode | ''; note: string }

export const todayStr = () => new Date().toISOString().slice(0, 10)

export const emptyPayment = (amount = ''): PaymentEntryValue => ({ amount, paidOn: todayStr(), mode: '', note: '' })

/** Turns the form state into the API body, or an error message when the amount isn't usable. */
export function toPaymentRequest(v: PaymentEntryValue): { request?: AddPaymentRequest; error?: string } {
  const amount = parseFloat(v.amount)
  if (isNaN(amount) || amount < 1) return { error: 'Enter the amount received (at least ₹1)' }
  return {
    request: {
      amount,
      paidOn: v.paidOn || undefined,
      mode: v.mode || undefined,
      note: v.note.trim() || undefined,
    },
  }
}

/** The four fields of one payment — amount, date, mode and note. Shared by the renewal dialog and "Add payment". */
export function PaymentEntryFields({ value, onChange, error }: {
  value: PaymentEntryValue
  onChange: (v: PaymentEntryValue) => void
  error?: string
}) {
  const set = (patch: Partial<PaymentEntryValue>) => onChange({ ...value, ...patch })
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="relative">
          <Input
            label="Amount received (₹)"
            type="number" min="1" step="1"
            value={value.amount}
            onChange={e => set({ amount: e.target.value })}
            error={error}
            className="pl-8"
          />
          <IndianRupee size={13} className="absolute left-3 bottom-[11px]" style={{ color: colors.text.muted, pointerEvents: 'none' }} />
        </div>
        <Input label="Date" type="date" max={todayStr()} value={value.paidOn} onChange={e => set({ paidOn: e.target.value })} />
      </div>
      <Select
        label="Paid by (optional)"
        placeholder="Select…"
        options={MODE_OPTIONS}
        value={value.mode}
        onChange={e => set({ mode: e.target.value as PaymentMode | '' })}
      />
      <div>
        <label className="form-label">Note (optional)</label>
        <textarea
          value={value.note}
          onChange={e => set({ note: e.target.value })}
          rows={2}
          placeholder="e.g. receipt #123"
          className="form-input w-full resize-none"
        />
      </div>
    </div>
  )
}

/** "Add payment" — one more payment against a plan, added to what's already been paid. */
export function AddPaymentModal({ subscription, onClose, onSaved }: {
  subscription: SubscriptionResponse
  onClose: () => void
  onSaved: (sub: SubscriptionResponse) => void
}) {
  const { toast } = useToast()
  const remaining = Math.max(0, subscription.totalAmount - subscription.amountPaid)
  const [value, setValue] = useState<PaymentEntryValue>(emptyPayment(remaining > 0 ? String(remaining) : ''))
  const [fieldError, setFieldError] = useState<string>()
  const [formError, setFormError] = useState<string | null>(null)

  const mut = useMutation({
    mutationFn: (req: AddPaymentRequest) => subscriptionsApi.addPayment(subscription.id, req),
    onSuccess: sub => { toast('Payment added', 'success'); onSaved(sub) },
    onError: err => setFormError(getApiError(err, 'Failed to add payment')),
  })

  const submit = () => {
    setFormError(null)
    const { request, error } = toPaymentRequest(value)
    setFieldError(error)
    if (request) mut.mutate(request)
  }

  return (
    <Modal open title="Add payment" onClose={onClose} size="sm" error={formError}
      footer={
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={mut.isPending}>Save payment</Button>
        </div>
      }>
      <p className="text-sm mb-1" style={{ color: colors.text.muted }}>{subscription.programName}</p>
      <p className="text-xs mb-4" style={{ color: colors.text.dim }}>
        {rupees(subscription.amountPaid)} paid of {rupees(subscription.totalAmount)} · {rupees(remaining)} remaining
      </p>
      <PaymentEntryFields value={value} onChange={setValue} error={fieldError} />
    </Modal>
  )
}

/** A plan's payments as a collapsible list, with an "Add payment" shortcut — admin roles only. */
export function PaymentHistory({ subscription, onChanged }: {
  subscription: SubscriptionResponse
  /** Called after a payment is added so the plan's totals refetch. */
  onChanged: () => void
}) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['subscription-payments', subscription.id],
    queryFn: () => subscriptionsApi.listPayments(subscription.id),
    enabled: open,
  })

  const logged = payments.reduce((sum, p) => sum + p.amount, 0)
  // Money taken before payments were itemised (or set outright on the Record Payment screen) has no entry.
  const earlier = Math.round(subscription.amountPaid - logged)

  const row = (p: SubscriptionPaymentResponse) => (
    <div key={p.id} className="flex items-start justify-between gap-3 py-2" style={{ borderTop: `1px solid ${border.divider}` }}>
      <div className="min-w-0">
        <p className="text-xs font-medium" style={{ color: colors.text.primary }}>
          {formatDateStr(p.paidOn)}
          {p.mode && <span style={{ color: colors.text.muted }}> · {PAYMENT_MODE_LABEL[p.mode]}</span>}
        </p>
        {(p.note || p.recordedByName) && (
          <p className="text-[11px] truncate" style={{ color: colors.text.dim }}>
            {[p.note, p.recordedByName && `by ${p.recordedByName}`].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>
      <span className="text-xs font-semibold flex-shrink-0 tabular-nums"
        style={{ color: p.amount < 0 ? colors.status.warning : colors.text.primary }}>
        {p.amount < 0 ? '−' : ''}{rupees(Math.abs(p.amount))}
      </span>
    </div>
  )

  return (
    <div className="mb-4 rounded-xl px-3 py-2" style={{ background: surface.filterStrip }}>
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => setOpen(o => !o)}
          className="flex items-center gap-1.5 text-xs font-medium py-1" style={{ color: colors.text.muted }}>
          <ChevronDown size={13} style={{ transform: open ? 'rotate(0)' : 'rotate(-90deg)', transition: 'transform .15s' }} />
          Payment history
        </button>
        {subscription.status !== 'CANCELLED' && (
          <button type="button" onClick={() => setAdding(true)}
            className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg"
            style={{ color: colors.accent, background: accentAlpha(0.08) }}>
            <Plus size={12} /> Add payment
          </button>
        )}
      </div>

      {open && (
        <div className="mt-1">
          {isLoading ? (
            <p className="text-xs py-2" style={{ color: colors.text.dim }}>Loading…</p>
          ) : (
            <>
              {payments.map(row)}
              {earlier !== 0 && (
                <div className="flex items-center justify-between gap-3 py-2" style={{ borderTop: `1px solid ${border.divider}` }}>
                  <p className="text-xs" style={{ color: colors.text.muted }}>Earlier payments (before itemised history)</p>
                  <span className="text-xs font-semibold tabular-nums" style={{ color: colors.text.primary }}>{rupees(earlier)}</span>
                </div>
              )}
              {payments.length === 0 && earlier === 0 && (
                <p className="text-xs py-2" style={{ color: colors.text.dim }}>No payments recorded yet.</p>
              )}
            </>
          )}
        </div>
      )}

      {adding && (
        <AddPaymentModal
          subscription={subscription}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false)
            setOpen(true)
            qc.invalidateQueries({ queryKey: ['subscription-payments', subscription.id] })
            onChanged()
          }}
        />
      )}
    </div>
  )
}
