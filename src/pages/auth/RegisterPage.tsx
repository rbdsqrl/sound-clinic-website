import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Ear } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
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
      style={{
        background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(0,180,216,0.08) 0%, #ffffff 60%)',
      }}
    >
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage: 'linear-gradient(rgba(200,200,200,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(200,200,200,0.2) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <div className="relative w-full max-w-lg">
        <div className="mb-10 flex flex-col items-center">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl mb-5"
            style={{
              background: 'linear-gradient(135deg, #00b4d8 0%, #0066cc 100%)',
              boxShadow: '0 0 40px rgba(0, 180, 216, 0.4), 0 0 80px rgba(0, 180, 216, 0.1)',
            }}
          >
            <Ear size={26} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#E2EAF8' }}>
            Create your organisation
          </h1>
          <p className="mt-1.5 text-xs font-medium tracking-widest uppercase" style={{ color: '#00b4d8', letterSpacing: '0.2em' }}>
            Clinic Management Portal
          </p>
        </div>

        <div
          className="p-8"
          style={{
            background: 'rgba(10, 22, 40, 0.8)',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            borderRadius: '20px',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 0 60px rgba(0, 180, 216, 0.05)',
          }}
        >
          {error && (
            <div
              className="mb-5 rounded-lg px-4 py-3 text-sm"
              style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                color: '#f87171',
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="pb-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <p
                className="mb-4 text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: '#3E5070' }}
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
                style={{ color: '#3E5070' }}
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

          <p className="mt-6 text-center text-sm" style={{ color: '#3E5070' }}>
            Already have an account?{' '}
            <Link to="/login" className="font-medium" style={{ color: '#00b4d8' }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
