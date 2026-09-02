import { useSearchParams, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle, Mail, Lock } from 'lucide-react'
import { useState } from 'react'
import { invitationsApi } from '../../api/invitations'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { PageLoader } from '../../components/ui/Spinner'
import { colors, gradient, accentAlpha, dangerAlpha, LOGO_SRC } from '../../theme'
import type { AcceptInviteRequest } from '../../types'
import { ROUTES } from '../../lib/routes'
import { roleLabel } from '../../components/ui/Badge'

export default function AcceptInvitePage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [done, setDone] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const { data: preview, isLoading, error: previewError } = useQuery({
    queryKey: ['invite-preview', token],
    queryFn: () => invitationsApi.preview(token),
    enabled: !!token,
    retry: false,
  })

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Omit<AcceptInviteRequest, 'token'>>()

  const onSubmit = async (data: Omit<AcceptInviteRequest, 'token'>) => {
    setSubmitError('')
    try {
      await invitationsApi.accept({ ...data, token })
      setDone(true)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setSubmitError(msg ?? 'Failed to complete account setup.')
    }
  }

  // ── Invalid / missing token ──────────────────────────────────────────────────

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: gradient.loginBg }}>
        <div className="text-center">
          <p style={{ color: colors.text.muted }}>Invalid or missing sign-up link.</p>
          <Link to={ROUTES.login} className="mt-4 inline-block text-sm" style={{ color: colors.accent }}>Go to login</Link>
        </div>
      </div>
    )
  }

  // ── Loading preview ──────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: gradient.loginBg }}>
        <PageLoader />
      </div>
    )
  }

  // ── Invalid / expired token ──────────────────────────────────────────────────

  if (previewError || !preview) {
    const msg = (previewError as { response?: { data?: { message?: string } } })
      ?.response?.data?.message ?? 'This invitation link is invalid or has expired.'
    return (
      <div className="flex min-h-screen items-center justify-center px-4" style={{ background: gradient.loginBg }}>
        <div className="glass-card w-full max-w-md p-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
            style={{ background: dangerAlpha(0.1) }}>
            <Lock size={26} style={{ color: colors.status.error }} />
          </div>
          <h2 className="text-xl font-bold" style={{ color: colors.text.heading }}>Link unavailable</h2>
          <p className="mt-2 text-sm" style={{ color: colors.text.muted }}>{msg}</p>
          <Link to={ROUTES.login}>
            <Button className="mt-6 w-full" size="lg" variant="secondary">Go to login</Button>
          </Link>
        </div>
      </div>
    )
  }

  // ── Success screen ───────────────────────────────────────────────────────────

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4" style={{ background: gradient.loginBg }}>
        <div className="glass-card w-full max-w-md p-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
            style={{ background: accentAlpha(0.12) }}>
            <CheckCircle size={28} style={{ color: colors.accent }} />
          </div>
          <h2 className="text-xl font-bold" style={{ color: colors.text.heading }}>Account created!</h2>
          <p className="mt-2 text-sm" style={{ color: colors.text.muted }}>Your account is ready. You can now sign in.</p>
          <Link to={ROUTES.login}>
            <Button className="mt-6 w-full" size="lg">Sign in</Button>
          </Link>
        </div>
      </div>
    )
  }

  // ── Main form ────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ background: gradient.loginBg }}>
      <div className="w-full max-w-md">

        {/* Logo + heading */}
        <div className="mb-8 flex flex-col items-center">
          <img src={LOGO_SRC} alt="Simple Hearing And Speech Care" className="h-16 w-auto mb-4 brand-logo" />
          <h1 className="text-2xl font-bold" style={{ color: colors.text.heading }}>Set up your account</h1>
          <p className="mt-1 text-sm text-center" style={{ color: colors.text.muted }}>
            You've been invited to join <strong style={{ color: colors.text.primary }}>{preview.orgName}</strong> as{' '}
            <strong style={{ color: colors.text.primary }}>{roleLabel(preview.role)}</strong>
          </p>
        </div>

        <div className="glass-card p-8">

          {/* Locked email display */}
          <div className="mb-5">
            <p className="form-label">Email</p>
            <div className="flex items-center gap-3 rounded-xl px-4 py-3"
              style={{ background: accentAlpha(0.06), border: `1px solid ${accentAlpha(0.15)}` }}>
              <Mail size={15} style={{ color: colors.accent, flexShrink: 0 }} />
              <span className="text-sm font-medium flex-1" style={{ color: colors.text.primary }}>
                {preview.email}
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
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="First name"
                placeholder="Jane"
                error={errors.firstName?.message}
                {...register('firstName', { required: 'Required' })}
              />
              <Input
                label="Last name"
                placeholder="Smith"
                error={errors.lastName?.message}
                {...register('lastName', { required: 'Required' })}
              />
            </div>
            <Input
              label="Password"
              type="password"
              placeholder="At least 8 characters"
              error={errors.password?.message}
              {...register('password', { required: 'Required', minLength: { value: 8, message: 'Minimum 8 characters' } })}
            />
            <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
              Create account
            </Button>
          </form>
        </div>

      </div>
    </div>
  )
}
