import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useAuth } from '../../contexts/AuthContext'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { colors, gradient, dangerAlpha, LOGO_SRC } from '../../theme'
import type { LoginRequest } from '../../types'
import { ROUTES } from '../../lib/routes'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginRequest>()

  const onSubmit = async (data: LoginRequest) => {
    setError('')
    try {
      await login(data)
      navigate(ROUTES.dashboard)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg ?? 'Invalid email or password')
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{ background: gradient.loginBg }}
    >
      {/* Subtle grid overlay */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage: 'linear-gradient(rgba(180,200,220,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(180,200,220,0.15) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="mb-10 flex flex-col items-center">
          <img src={LOGO_SRC} alt="Simple Hearing And Speech Care" className="h-20 w-auto mb-5 brand-logo" />
          <h1 className="brand-name text-lg sm:text-xl" style={{ color: colors.text.heading }}>
            Simple Hearing And Speech Care
          </h1>
          <p className="mt-1.5 text-xs font-medium tracking-widest uppercase" style={{ color: colors.brandFixed, letterSpacing: '0.2em' }}>
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
            <Input
              label="Email address"
              type="email"
              autoComplete="email"
              placeholder="you@clinic.com"
              error={errors.email?.message}
              {...register('email', { required: 'Email is required' })}
            />
            <div>
              <Input
                label="Password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                error={errors.password?.message}
                {...register('password', { required: 'Password is required' })}
              />
              <div className="mt-1.5 flex justify-end">
                <Link to={ROUTES.forgotPassword} className="text-xs font-medium transition-colors"
                  style={{ color: colors.text.dim }}
                  onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.color = colors.accent}
                  onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.color = colors.text.dim}
                >
                  Forgot password?
                </Link>
              </div>
            </div>
            <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
              Sign in
            </Button>
          </form>

          <p className="mt-6 text-center text-sm" style={{ color: colors.text.dim }}>
            <Link to="/" className="transition-colors" style={{ color: colors.text.dim }}
              onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.color = colors.accent}
              onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.color = colors.text.dim}
            >
              ← Back to website
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
