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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-50 to-slate-100 px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-8 flex flex-col items-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-600 shadow-lg mb-4">
            <Ear size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Create your organisation</h1>
          <p className="mt-1 text-sm text-slate-500">Set up your clinic management account</p>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-100">
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="border-b border-slate-100 pb-5">
              <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Organisation</p>
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
              <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Business Owner</p>
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

          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-primary-600 hover:text-primary-700">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
