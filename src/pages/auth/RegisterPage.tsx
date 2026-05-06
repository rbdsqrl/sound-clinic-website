import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Ear } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { colors, gradient, shadow, border, accentAlpha, dangerAlpha } from '../../theme'
import type { RegisterRequest } from '../../types'

export default function RegisterPage() {
  const { register: registerUser } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterRequest>()

  const onSubmit = async (data: RegisterRequest) => {
    setError('')
    try {
      await registerUser(data)
      navigate('/dashboard')
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg ?? 'Registration failed. Please try again.')
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 py-12"
      style={{ background: gradient.loginBg }}
    >
      {/* Subtle grid overlay */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage: `linear-gradient(${accentAlpha(0.05)} 1px, transparent 1px), linear-gradient(90deg, ${accentAlpha(0.05)} 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
        }}
      />

      <div className="relative w-full max-w-lg">
        {/* Logo */}
        <div className="mb-10 flex flex-col items-center">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl mb-5"
            style={{
              background: gradient.logo,
              boxShadow: shadow.glowLg,
            }}
          >
            <Ear size={26} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: colors.text.heading }}>
            Create your organisation
          </h1>
          <p className="mt-1.5 text-xs font-medium tracking-widest uppercase" style={{ color: colors.accent, letterSpacing: '0.2em' }}>
            Clinic Management Portal
          </p>
        </div>

        {/* Card */}
        <div className="glass-card p-8">
          {error && (
            <div
              className="mb-5 rounded-lg px-4 py-3 text-sm"
              style={{
                background: dangerAlpha(0.08),
                border:     `1px solid ${dangerAlpha(0.20)}`,
                color:      colors.status.danger,
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="pb-5" style={{ borderBottom: `1px solid ${border.divider}` }}>
              <p
                className="mb-4 text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: colors.text.muted }}
              >
                Organisation
              </p>
              <div className="space-y-4">
                <Input
                  label="Organisation name"
                  placeholder="City Hearing Clinic"
                  error={errors.orgName?.message}
                  {...register('orgName', { required: 'Organisation name is required' })}
                />
                <Input
                  label="Slug"
                  placeholder="city-hearing"
                  hint="URL-safe identifier — lowercase letters, digits, hyphens (3–50 chars)"
                  error={errors.slug?.message}
                  {...register('slug', {
                    required: 'Slug is required',
                    pattern: { value: /^[a-z0-9-]{3,50}$/, message: 'Lowercase letters, digits, and hyphens only' },
                  })}
                />
              </div>
            </div>

            <div>
              <p
                className="mb-4 text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: colors.text.muted }}
              >
                Business Owner
              </p>
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
              <div className="mt-4 space-y-4">
                <Input
                  label="Email address"
                  type="email"
                  placeholder="jane@cityhearing.com"
                  error={errors.email?.message}
                  {...register('email', { required: 'Email is required' })}
                />
                <Input
                  label="Password"
                  type="password"
                  placeholder="At least 8 characters"
                  error={errors.password?.message}
                  {...register('password', { required: 'Password is required', minLength: { value: 8, message: 'Minimum 8 characters' } })}
                />
              </div>
            </div>

            <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
              Create organisation
            </Button>
          </form>

          <p className="mt-6 text-center text-sm" style={{ color: colors.text.dim }}>
            Already have an account?{' '}
            <Link to="/login" className="font-medium" style={{ color: colors.accent }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
