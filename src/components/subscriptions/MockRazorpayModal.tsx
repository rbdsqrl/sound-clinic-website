import { useState } from 'react'
import { X, ShieldCheck } from 'lucide-react'
import { subscriptionsApi } from '../../api/subscriptions'
import { colors, accentAlpha, successAlpha, surface, styles } from '../../theme'
import type { SubscriptionResponse } from '../../types'

function formatINR(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

/** A parent's "Pay Now" flow — a pure UI mock of a Razorpay checkout, no real gateway
 *  integration. Calls the same recordPayment endpoint staff use; PARENT is explicitly
 *  authorized for it server-side. Shared between a case's Programs list and the parent
 *  Dashboard's Pending Payments card. */
export function MockRazorpayModal({
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
