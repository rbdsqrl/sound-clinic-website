import { useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle, Mail, Lock } from 'lucide-react'
import { authApi } from '../../api/auth'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { PageLoader } from '../../components/ui/Spinner'
import { colors, gradient, accentAlpha, dangerAlpha, LOGO_SRC } from '../../theme'
import { ROUTES } from '../../lib/routes'

interface ResetFormValues {
  password: string
  confirmPassword: string
}

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [done, setDone] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const { data: preview, isLoading, error: previewError } = useQuery({
    queryKey: ['reset-token', token],
    queryFn: () => authApi.validateResetToken(token),
    enabled: !!token,
    retry: false,
  })

  const { register, handleSubmit, getValues, formState: { errors, isSubmitting } } = useForm<ResetFormValues>()

  const onSubmit = async (data: ResetFormValues) => {
    setSubmitError('')
    try {
      await authApi.resetPassword({ ...data, token })
      setDone(true)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setSubmitError(msg ?? 'Could not update your password. Please try again.')
    }
  }

  // ── Missing token ────────────────────────────────────────────────────────────

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4" style={{ background: gradient.loginBg }}>
        <div className="text-center">
          <p style={{ color: colors.text.muted }}>Invalid or missing password reset link.</p>
          <Link to={ROUTES.forgotPassword} className="mt-4 inline-block text-sm" style={{ color: colors.accent }}>
            Request a new link
          </Link>
        </div>
      </div>
    )
  }

  // ── Validating the link ──────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: gradient.loginBg }}>
        <PageLoader />
      </div>
    )
  }

  // ── Invalid / expired / already used ─────────────────────────────────────────

  if (previewError || !preview) {
    const msg = (previewError as { response?: { data?: { message?: string } } })
      ?.response?.data?.message ?? 'This password reset link is invalid or has expired.'
    return (
      <div className="flex min-h-screen items-center justify-center px-4" style={{ background: gradient.loginBg }}>
        <div className="glass-card w-full max-w-md p-8 md:p-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
            style={{ background: dangerAlpha(0.1) }}>
            <Lock size={26} style={{ color: colors.status.error }} />
          </div>
          <h2 className="text-xl font-bold" style={{ color: colors.text.heading }}>Link unavailable</h2>
          <p className="mt-2 text-sm" style={{ color: colors.text.muted }}>{msg}</p>
          <Link to={ROUTES.forgotPassword}>
            <Button className="mt-6 w-full" size="lg">Request a new link</Button>
          </Link>
          <Link to={ROUTES.login} className="mt-4 inline-block text-sm" style={{ color: colors.text.dim }}>
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  // ── Success ──────────────────────────────────────────────────────────────────

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4" style={{ background: gradient.loginBg }}>
        <div className="glass-card w-full max-w-md p-8 md:p-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
            style={{ background: accentAlpha(0.12) }}>
            <CheckCircle size={28} style={{ color: colors.accent }} />
          </div>
          <h2 className="text-xl font-bold" style={{ color: colors.text.heading }}>Password updated</h2>
          <p className="mt-2 text-sm" style={{ color: colors.text.muted }}>
            You've been signed out on all devices. Sign in with your new password to continue.
          </p>
          <Link to={ROUTES.login}>
            <Button className="mt-6 w-full" size="lg">Sign in</Button>
          </Link>
        </div>
      </div>
    )
  }

  // ── Set new password ─────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ background: gradient.loginBg }}>
      <div className="w-full max-w-md">

        <div className="mb-8 flex flex-col items-center">
          <img src={LOGO_SRC} alt="SimpleHearing" className="h-16 w-auto mb-4 brand-logo" />
          <h1 className="text-2xl font-bold" style={{ color: colors.text.heading }}>Set a new password</h1>
          <p className="mt-1.5 text-sm text-center" style={{ color: colors.text.muted }}>
            Choose a new password for your account.
          </p>
        </div>

        <div className="glass-card p-8">

          {/* Which account this link belongs to */}
          <div className="mb-5">
            <p className="form-label">Account</p>
            <div className="flex items-center gap-3 rounded-xl px-4 py-3"
              style={{ background: accentAlpha(0.06), border: `1px solid ${accentAlpha(0.15)}` }}>
              <Mail size={15} style={{ color: colors.accent, flexShrink: 0 }} />
              <span className="text-sm font-medium flex-1 truncate" style={{ color: colors.text.primary }}>
                {preview.maskedEmail}
              </span>
              <Lock size={13} style={{ color: colors.text.dim, flexShrink: 0 }} />
            </div>
          </div>

          {submitError && (
            <div className="mb-4 rounded-xl px-4 py-3 text-sm"
              style={{ background: dangerAlpha(0.08), color: colors.status.error, border: `1px solid ${dangerAlpha(0.20)}` }}>
              {submitError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="New password"
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              error={errors.password?.message}
              {...register('password', {
                required: 'Password is required',
                minLength: { value: 8, message: 'Minimum 8 characters' },
              })}
            />
            <Input
              label="Confirm new password"
              type="password"
              autoComplete="new-password"
              placeholder="Re-enter your password"
              error={errors.confirmPassword?.message}
              {...register('confirmPassword', {
                required: 'Please confirm your password',
                validate: (value) => value === getValues('password') || 'Passwords do not match',
              })}
            />
            <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
              Update password
            </Button>
          </form>

          <p className="mt-6 text-center text-xs" style={{ color: colors.text.dim }}>
            Updating your password signs you out everywhere else.
          </p>
        </div>

      </div>
    </div>
  )
}
