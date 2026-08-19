import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { MailCheck, ArrowLeft } from 'lucide-react'
import { authApi } from '../../api/auth'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { colors, gradient, accentAlpha, dangerAlpha, LOGO_SRC } from '../../theme'
import type { ForgotPasswordRequest } from '../../types'
import { ROUTES } from '../../lib/routes'

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ForgotPasswordRequest>()

  const onSubmit = async (data: ForgotPasswordRequest) => {
    setError('')
    try {
      await authApi.forgotPassword(data)
      setSent(true)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg ?? 'Could not send the reset link. Please try again.')
    }
  }

  // ── Sent confirmation ────────────────────────────────────────────────────────
  // Shown for every submitted address, registered or not — the page must not
  // reveal which emails belong to real accounts.

  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4" style={{ background: gradient.loginBg }}>
        <div className="glass-card w-full max-w-md p-8 md:p-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
            style={{ background: accentAlpha(0.12) }}>
            <MailCheck size={28} style={{ color: colors.accent }} />
          </div>
          <h2 className="text-xl font-bold" style={{ color: colors.text.heading }}>Check your email</h2>
          <p className="mt-2 text-sm" style={{ color: colors.text.muted }}>
            If that address is registered, a password reset link is on its way. The link expires in 60 minutes.
          </p>
          <p className="mt-4 text-xs" style={{ color: colors.text.dim }}>
            Nothing arrived? Check your spam folder, or try again in a few minutes.
          </p>
          <Link to={ROUTES.login}>
            <Button className="mt-6 w-full" size="lg" variant="secondary">Back to sign in</Button>
          </Link>
        </div>
      </div>
    )
  }

  // ── Request form ─────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ background: gradient.loginBg }}>
      <div className="w-full max-w-md">

        <div className="mb-8 flex flex-col items-center">
          <img src={LOGO_SRC} alt="SimpleHearing" className="h-16 w-auto mb-4 brand-logo" />
          <h1 className="text-2xl font-bold" style={{ color: colors.text.heading }}>Forgot your password?</h1>
          <p className="mt-1.5 text-sm text-center" style={{ color: colors.text.muted }}>
            Enter your registered email and we'll send you a link to set a new one.
          </p>
        </div>

        <div className="glass-card p-8">
          {error && (
            <div className="mb-5 rounded-lg px-4 py-3 text-sm"
              style={{
                background: dangerAlpha(0.08),
                border:     `1px solid ${dangerAlpha(0.20)}`,
                color:      colors.status.danger,
              }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <Input
              label="Email address"
              type="email"
              autoComplete="email"
              placeholder="you@clinic.com"
              error={errors.email?.message}
              {...register('email', { required: 'Email is required' })}
            />
            <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
              Send reset link
            </Button>
          </form>

          <p className="mt-6 flex items-center justify-center gap-1.5 text-sm">
            <ArrowLeft size={14} style={{ color: colors.text.dim }} />
            <Link to={ROUTES.login} className="transition-colors" style={{ color: colors.text.dim }}
              onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.color = colors.accent}
              onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.color = colors.text.dim}
            >
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
