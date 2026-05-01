import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Mail, Send, Copy, Check, Link2 } from 'lucide-react'
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

function CopyLinkBox({ link }: { link: string }) {
  const [copied, setCopied] = useState(false)
  const fullUrl = `${window.location.origin}${link}`

  const copy = async () => {
    await navigator.clipboard.writeText(fullUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className="rounded-xl border border-primary-200 bg-primary-50 p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary-700">
        Sign-up link — share this with the person
      </p>
      <div className="flex items-center gap-2">
        <code className="flex-1 rounded-lg bg-white px-3 py-2 text-xs font-mono text-slate-700 ring-1 ring-slate-200 break-all select-all">
          {fullUrl}
        </code>
        <button
          type="button"
          onClick={copy}
          className="flex-shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors bg-primary-600 text-white hover:bg-primary-700"
        >
          {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
        </button>
      </div>
      <p className="mt-2 text-xs text-primary-600">
        Valid for 72 hours. The person will set their own name and password when they open it.
      </p>
    </div>
  )
}

export default function InvitationsPage() {
  const [showModal, setShowModal] = useState(false)
  const [linkModal, setLinkModal] = useState<InviteResponse | null>(null)
  const { toasts, toast, dismiss } = useToast()

  const { data: invitations = [], refetch } = useQuery({
    queryKey: ['invitations'],
    queryFn: invitationsApi.list,
  })
  const { data: clinics } = useQuery({ queryKey: ['clinics'], queryFn: clinicsApi.list })

  const { register, handleSubmit, watch, reset, formState: { errors, isSubmitting } } = useForm<InviteRequest>()
  const selectedRole = watch('role') as Role | undefined
  const needsClinic = selectedRole === 'THERAPIST' || selectedRole === 'PARENT'

  const mutation = useMutation({
    mutationFn: invitationsApi.send,
    onSuccess: (res) => {
      refetch()
      setShowModal(false)
      reset()
      setLinkModal(res)
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast(msg ?? 'Failed to add member', 'error')
    },
  })

  const clinicOptions = (clinics ?? []).map((c) => ({ value: c.id, label: c.name }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Add Members</h1>
          <p className="mt-1 text-sm text-slate-500">Add team members to your organisation</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Send size={16} /> Add Member
        </Button>
      </div>

      <Card>
        <CardHeader title="Members" subtitle="All invitations sent for your organisation" />
        {!invitations.length ? (
          <EmptyState
            icon={<Mail size={32} />}
            title="No members added yet"
            description="Use the button above to add a business owner, therapist, or parent."
          />
        ) : (
          <div className="overflow-x-auto -mx-6 sm:mx-0">
            <table className="w-full text-sm min-w-[560px] sm:min-w-0">
              <thead className="border-b border-slate-100 text-xs text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="pb-3 text-left pl-6 sm:pl-0">Email</th>
                  <th className="pb-3 text-left">Role</th>
                  <th className="pb-3 text-left hidden sm:table-cell">Clinic</th>
                  <th className="pb-3 text-left">Status</th>
                  <th className="pb-3 text-left hidden sm:table-cell">Expires</th>
                  <th className="pb-3 text-left pr-6 sm:pr-0">Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {invitations.map((inv) => (
                  <tr key={inv.id}>
                    <td className="py-3 text-slate-700 pl-6 sm:pl-0 max-w-[180px] truncate">{inv.email}</td>
                    <td className="py-3">{roleBadge(inv.role)}</td>
                    <td className="py-3 text-slate-500 hidden sm:table-cell">
                      {inv.clinicName ?? <span className="text-slate-300">—</span>}
                    </td>
                    <td className="py-3">{statusBadge(inv.status)}</td>
                    <td className="py-3 text-slate-500 hidden sm:table-cell">
                      {format(new Date(inv.expiresAt), 'MMM d, yyyy')}
                    </td>
                    <td className="py-3 pr-6 sm:pr-0">
                      {inv.acceptLink ? (
                        <button
                          onClick={() => setLinkModal(inv)}
                          className="flex items-center gap-1 text-xs text-primary-600 hover:underline"
                        >
                          <Link2 size={13} /> View link
                        </button>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* How it works */}
      <Card>
        <CardHeader title="How adding members works" />
        <ol className="space-y-3 text-sm text-slate-600">
          <li className="flex gap-3">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700">1</span>
            Enter the person's email address and select their role.
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700">2</span>
            A unique sign-up link is generated — copy it and share it with the person.
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700">3</span>
            They open the link, enter their name and a password, and their account is created automatically.
          </li>
        </ol>
      </Card>

      {/* Add member modal */}
      <Modal open={showModal} onClose={() => { setShowModal(false); reset() }} title="Add a Member">
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
              <Send size={14} /> Add Member
            </Button>
          </div>
        </form>
      </Modal>

      {/* Sign-up link modal — shown right after adding, and via "View link" */}
      <Modal
        open={!!linkModal}
        onClose={() => setLinkModal(null)}
        title={`Sign-up link for ${linkModal?.email ?? ''}`}
      >
        {linkModal && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Share this link with <strong>{linkModal.email}</strong> so they can set up their account.
              The link expires on{' '}
              <strong>{format(new Date(linkModal.expiresAt), 'MMM d, yyyy \'at\' h:mm a')}</strong>.
            </p>
            <CopyLinkBox link={linkModal.acceptLink ?? ''} />
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setLinkModal(null)}>Done</Button>
            </div>
          </div>
        )}
      </Modal>

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
