import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Mail, Send } from 'lucide-react'
import { invitationsApi } from '../api/invitations'
import { clinicsApi } from '../api/clinics'
import { Card, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Modal } from '../components/ui/Modal'
import { EmptyState } from '../components/ui/EmptyState'
import { statusBadge, roleBadge } from '../components/ui/Badge'
import { ToastContainer } from '../components/ui/Toast'
import { useToast } from '../hooks/useToast'
import { format } from 'date-fns'
import type { InviteRequest, InviteResponse, Role } from '../types'

const INVITABLE_ROLES: { value: Role; label: string }[] = [
  { value: 'BUSINESS_OWNER', label: 'Business Owner' },
  { value: 'THERAPIST',      label: 'Therapist' },
  { value: 'PARENT',         label: 'Parent' },
]

export default function InvitationsPage() {
  const [showModal, setShowModal] = useState(false)
  const [sent, setSent] = useState<InviteResponse[]>([])
  const { toasts, toast, dismiss } = useToast()

  const { data: clinics } = useQuery({ queryKey: ['clinics'], queryFn: clinicsApi.list })

  const { register, handleSubmit, watch, reset, formState: { errors, isSubmitting } } = useForm<InviteRequest>()
  const selectedRole = watch('role') as Role | undefined
  const needsClinic = selectedRole === 'THERAPIST' || selectedRole === 'PARENT'

  const mutation = useMutation({
    mutationFn: invitationsApi.send,
    onSuccess: (res) => {
      setSent((prev) => [res, ...prev])
      toast(`Invitation sent to ${res.email}`, 'success')
      setShowModal(false)
      reset()
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast(msg ?? 'Failed to send invitation', 'error')
    },
  })

  const clinicOptions = (clinics ?? []).map((c) => ({ value: c.id, label: c.name }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Invitations</h1>
          <p className="mt-1 text-sm text-slate-500">Invite team members to your organisation</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Send size={16} /> Send Invitation
        </Button>
      </div>

      <Card>
        <CardHeader title="Sent Invitations" subtitle="Invitations sent this session" />
        {!sent.length ? (
          <EmptyState
            icon={<Mail size={32} />}
            title="No invitations sent yet"
            description="Use the button above to invite a business owner, therapist, or parent."
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 text-xs text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="pb-3 text-left">Email</th>
                <th className="pb-3 text-left">Role</th>
                <th className="pb-3 text-left">Status</th>
                <th className="pb-3 text-left">Expires</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sent.map((inv) => (
                <tr key={inv.id}>
                  <td className="py-3 text-slate-700">{inv.email}</td>
                  <td className="py-3">{roleBadge(inv.role)}</td>
                  <td className="py-3">{statusBadge(inv.status)}</td>
                  <td className="py-3 text-slate-500">
                    {format(new Date(inv.expiresAt), 'MMM d, yyyy')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* How it works */}
      <Card>
        <CardHeader title="How invitations work" />
        <ol className="space-y-3 text-sm text-slate-600">
          <li className="flex gap-3">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700">1</span>
            Send an invitation with the person's email and their role.
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700">2</span>
            They receive an invitation link (valid for 72 hours).
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700">3</span>
            They click the link, enter their name and a password, and their account is created automatically.
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700">4</span>
            <span>
              The accept link format is:{' '}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono">
                {window.location.origin}/accept-invite?token=TOKEN
              </code>
            </span>
          </li>
        </ol>
      </Card>

      <Modal open={showModal} onClose={() => { setShowModal(false); reset() }} title="Send Invitation">
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <Input
            label="Email address"
            type="email"
            placeholder="colleague@clinic.com"
            error={errors.email?.message}
            {...register('email', { required: 'Email is required' })}
          />
          <Select
            label="Role"
            placeholder="Select a role…"
            options={INVITABLE_ROLES}
            error={errors.role?.message}
            {...register('role', { required: 'Role is required' })}
          />
          {needsClinic && (
            <Select
              label="Clinic"
              placeholder="Select a clinic…"
              options={clinicOptions}
              {...register('clinicId')}
            />
          )}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => { setShowModal(false); reset() }}>Cancel</Button>
            <Button type="submit" loading={isSubmitting || mutation.isPending}>
              <Send size={14} /> Send invite
            </Button>
          </div>
        </form>
      </Modal>

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
