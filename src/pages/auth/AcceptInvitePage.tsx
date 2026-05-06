import { useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { CheckCircle } from 'lucide-react'
import { invitationsApi } from '../../api/invitations'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { colors, styles, gradient, accentAlpha, dangerAlpha, LOGO_SRC } from '../../theme'
import type { AcceptInviteRequest } from '../../types'

export default function AcceptInvitePage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Omit<AcceptInviteRequest, 'token'>>()

  const onSubmit = async (data: Omit<AcceptInviteRequest, 'token'>) => {
    setError('')
    try {
      await invitationsApi.accept({ ...data, token })
      setDone(true)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg ?? 'Failed to complete account setup.')
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: gradient.loginBg }}>
        <div className="text-center">
          <p style={{ color: colors.text.muted }}>Invalid or missing sign-up link.</p>
          <Link to="/login" className="mt-4 inline-block text-sm" style={{ color: colors.accent }}>Go to login</Link>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4" style={{ background: gradient.loginBg }}>
        <div className="glass-card w-full max-w-md p-10 text-center">
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
            style={{ background: accentAlpha(0.12) }}
          >
            <CheckCircle size={28} style={{ color: colors.accent }} />
          </div>
          <h2 className="text-xl font-bold" style={{ color: colors.text.heading }}>Account created!</h2>
          <p className="mt-2 text-sm" style={{ color: colors.text.muted }}>Your account is ready. You can now sign in.</p>
          <Link to="/login">
            <Button className="mt-6 w-full" size="lg">Sign in</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ background: gradient.loginBg }}>
      <div className="w-full max-w-md">

        {/* Logo + heading */}
        <div className="mb-8 flex flex-col items-center">
          <img src={LOGO_SRC} alt="SimpleHearing" className="h-16 w-auto mb-4 brand-logo" />
          <h1 className="text-2xl font-bold" style={{ color: colors.text.heading }}>Set up your account</h1>
          <p className="mt-1 text-sm" style={{ color: colors.text.muted }}>Complete your details to get started</p>
        </div>

        <div className="glass-card p-8">
          {error && (
            <div
              className="mb-4 rounded-xl px-4 py-3 text-sm"
              style={{ background: dangerAlpha(0.08), color: colors.status.error, border: `1px solid ${dangerAlpha(0.20)}` }}
            >
              {error}
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
