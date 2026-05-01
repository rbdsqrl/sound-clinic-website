import { useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { CheckCircle, Ear } from 'lucide-react'
import { invitationsApi } from '../../api/invitations'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
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
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500">Invalid or missing sign-up link.</p>
          <Link to="/login" className="mt-4 inline-block text-primary-600 hover:underline text-sm">Go to login</Link>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-50 to-slate-100 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-10 shadow-sm ring-1 ring-slate-100 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
            <CheckCircle size={28} className="text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-800">Account created!</h2>
          <p className="mt-2 text-sm text-slate-500">Your account is ready. You can now sign in.</p>
          <Link to="/login">
            <Button className="mt-6 w-full" size="lg">Sign in</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-50 to-slate-100 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-600 shadow-lg mb-4">
            <Ear size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Set up your account</h1>
          <p className="mt-1 text-sm text-slate-500">Complete your details to get started</p>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-100">
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">{error}</div>
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
