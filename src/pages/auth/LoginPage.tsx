import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Ear } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { colors, styles, shadow, gradient, rgba, RAW } from '../../theme'
import type { LoginRequest } from '../../types'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginRequest>()

  const onSubmit = async (data: LoginRequest) => {
    setError('')
    try {
      await login(data)
      navigate('/dashboard')
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg ?? 'Invalid email or password')
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{
        background: `radial-gradient(ellipse 80% 60% at 50% -10%, ${rgba(RAW.accent, 0.08)} 0%, #ffffff 60%)`,
      }}
    >
      {/* Subtle grid overlay */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage: 'linear-gradient(rgba(200,200,200,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(200,200,200,0.2) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="mb-10 flex flex-col items-center">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-2xl mb-5"
            style={{
              background: gradient.primaryButton,
              boxShadow: `${shadow.glowLg}, 0 0 80px ${rgba(RAW.accent, 0.10)}`,
            }}
          >
            <Ear size={30} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: colors.text.heading }}>
            SimpleHearing
          </h1>
          <p className="mt-1.5 text-xs font-medium tracking-widest uppercase" style={{ color: colors.accent, letterSpacing: '0.2em' }}>
            Clinic Management Portal
          </p>
        </div>

        {/* Card */}
        <div
          className="p-8"
          style={{
            background: 'rgba(10, 22, 40, 0.8)',
            border: `1px solid ${rgba(RAW.white, 0.07)}`,
            borderRadius: '20px',
            backdropFilter: 'blur(20px)',
            boxShadow: `0 0 60px ${rgba(RAW.accent, 0.05)}`,
          }}
        >
          {error && (
            <div
              className="mb-5 rounded-lg px-4 py-3 text-sm"
              style={{
                background: rgba(RAW.danger, 0.08),
                border:     `1px solid ${rgba(RAW.danger, 0.20)}`,
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
            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              error={errors.password?.message}
              {...register('password', { required: 'Password is required' })}
            />
            <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
              Sign in
            </Button>
          </form>

          <p className="mt-6 text-center text-sm" style={{ color: colors.text.dim }}>
            New organisation?{' '}
            <Link to="/register" className="font-medium transition-colors" style={{ color: colors.accent }}>
              Register here
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
