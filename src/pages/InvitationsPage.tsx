import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Mail, Send, Copy, Check, Link2, Users, CalendarDays } from 'lucide-react'
import { invitationsApi } from '../api/invitations'
import { clinicsApi } from '../api/clinics'
import { Card, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Modal } from '../components/ui/Modal'
import { EmptyState } from '../components/ui/EmptyState'
import { colors, border, surface, accentAlpha, styles } from '../theme'
import { statusBadge, roleBadge } from '../components/ui/Badge'
import { ToastContainer } from '../components/ui/Toast'
import { useToast } from '../hooks/useToast'
import { format } from 'date-fns'
import type { InviteRequest, InviteResponse, Role } from '../types'

const INVITABLE_ROLES: { value: Role; label: string }[] = [
  { value: 'ADMIN',          label: 'Admin' },
  { value: 'OFFICE_ADMIN',   label: 'Office Admin' },
  { value: 'DOCTOR',         label: 'Doctor' },
  { value: 'THERAPIST',      label: 'Therapist' },
  { value: 'PARENT',         label: 'Parent' },
  { value: 'BUSINESS_OWNER', label: 'Business Owner' },
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
    <div className="rounded-xl p-4" style={{ border: border.card, background: accentAlpha(0.08) }}>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: colors.text.primary }}>
        Sign-up link — share this with the person
      </p>
      <div className="flex items-center gap-2">
        <code className="flex-1 rounded-lg px-3 py-2 text-xs font-mono break-all select-all"
          style={{ background: surface.filterStrip, color: colors.text.primary, border: border.card }}>
          {fullUrl}
        </code>
        <button
          type="button"
          onClick={copy}
          className="flex-shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors"
          style={{ background: colors.accent, color: '#fff' }}
        >
          {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
        </button>
      </div>
      <p className="mt-2 text-xs" style={{ color: colors.text.muted }}>
        Valid for 72 hours. The person will set their own name and password when they open it.
      </p>
    </div>
  )
}

export default function InvitationsPage() {
  const [mainTab,     setMainTab]     = useState<'invite' | 'members'>('invite')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED'>('ALL')
  const [linkModal, setLinkModal] = useState<InviteResponse | null>(null)
  const { toasts, toast, dismiss } = useToast()

  const { data: invitations = [], refetch } = useQuery({
    queryKey: ['invitations'],
    queryFn: invitationsApi.list,
  })
  const { data: clinics } = useQuery({ queryKey: ['clinics'], queryFn: clinicsApi.list })

  const { register, handleSubmit, watch, reset, formState: { errors, isSubmitting } } = useForm<InviteRequest>()
  const selectedRole = watch('role') as Role | undefined
  const needsClinic = selectedRole === 'THERAPIST' || selectedRole === 'DOCTOR' || selectedRole === 'PARENT'

  const mutation = useMutation({
    mutationFn: invitationsApi.send,
    onSuccess: (res) => {
      refetch()
      reset()
      setLinkModal(res)
      setMainTab('members')
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast(msg ?? 'Failed to add member', 'error')
    },
  })

  const clinicOptions = (clinics ?? []).map((c) => ({ value: c.id, label: c.name }))

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold" style={{ color: colors.text.heading }}>Add Members</h1>
        <p className="mt-1 text-sm" style={{ color: colors.text.muted }}>Add team members to your organisation</p>
      </div>

      {/* Tab toggle */}
      <div className="flex rounded-xl overflow-hidden border self-start" style={{ borderColor: border.card }}>
        <button
          onClick={() => setMainTab('invite')}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors"
          style={mainTab === 'invite' ? styles.filterTabActive : styles.filterTabInactive}
        >
          <Send size={14} />
          Invite
        </button>
        <button
          onClick={() => setMainTab('members')}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors"
          style={mainTab === 'members' ? styles.filterTabActive : styles.filterTabInactive}
        >
          <Users size={14} />
          Members
          {invitations.length > 0 && (
            <span className="ml-0.5 opacity-60">{invitations.length}</span>
          )}
        </button>
      </div>

      {/* ── Members tab ─────────────────────────────────────────────── */}
      {mainTab === 'members' && (() => {
        const STATUS_FILTERS = [
          { value: 'ALL',       label: 'All' },
          { value: 'PENDING',   label: 'Pending' },
          { value: 'ACCEPTED',  label: 'Accepted' },
          { value: 'EXPIRED',   label: 'Expired' },
          { value: 'CANCELLED', label: 'Cancelled' },
        ] as const

        const displayed = statusFilter === 'ALL'
          ? invitations
          : invitations.filter(i => i.status === statusFilter)

        return invitations.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Mail size={32} />}
              title="No members added yet"
              description='Switch to the Invite tab to add your first team member.'
            />
          </Card>
        ) : (<>

          {/* Status filter tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {STATUS_FILTERS.map(f => {
              const count = f.value === 'ALL'
                ? invitations.length
                : invitations.filter(i => i.status === f.value).length
              return (
                <button
                  key={f.value}
                  onClick={() => setStatusFilter(f.value)}
                  className="flex-shrink-0 px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors"
                  style={statusFilter === f.value ? styles.filterTabActive : styles.filterTabInactive}
                >
                  {f.label}
                  <span className="ml-1.5 opacity-60">{count}</span>
                </button>
              )
            })}
          </div>

          {displayed.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Mail size={32} />}
                title={`No ${statusFilter.toLowerCase()} invitations`}
                description="Try a different filter."
              />
            </Card>
          ) : (<>

          {/* Mobile — card list */}
          <div className="flex flex-col gap-3 md:hidden">
            {displayed.map(inv => (
              <div key={inv.id} className="rounded-2xl p-4" style={styles.card}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate" style={{ color: colors.text.primary }}>
                      {inv.email}
                    </p>
                    {inv.clinicName && (
                      <p className="text-xs mt-0.5 truncate" style={{ color: colors.text.muted }}>
                        {inv.clinicName}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    {statusBadge(inv.status)}
                    {roleBadge(inv.role)}
                  </div>
                </div>

                <div className="flex items-center justify-between mt-3 pt-3"
                  style={{ borderTop: `1px solid ${border.divider}` }}>
                  <p className="flex items-center gap-1 text-xs" style={{ color: colors.text.muted }}>
                    <CalendarDays size={11} />
                    Expires {format(new Date(inv.expiresAt), 'MMM d, yyyy')}
                  </p>
                  {inv.acceptLink ? (
                    <button
                      onClick={() => setLinkModal(inv)}
                      className="flex items-center gap-1 text-xs font-medium min-h-[36px] px-2"
                      style={{ color: colors.accent }}
                    >
                      <Link2 size={12} /> View link
                    </button>
                  ) : (
                    <span className="text-xs" style={{ color: colors.text.dim }}>No link</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop — table */}
          <div className="hidden md:block">
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b text-xs uppercase tracking-wider"
                    style={{ borderColor: border.divider, color: colors.text.dim }}>
                    <tr>
                      <th className="pb-3 text-left">Email</th>
                      <th className="pb-3 text-left">Role</th>
                      <th className="pb-3 text-left">Clinic</th>
                      <th className="pb-3 text-left">Status</th>
                      <th className="pb-3 text-left">Expires</th>
                      <th className="pb-3 text-left">Link</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: border.divider }}>
                    {displayed.map((inv) => (
                      <tr key={inv.id}>
                        <td className="py-3 max-w-[200px] truncate" style={{ color: colors.text.primary }}>
                          {inv.email}
                        </td>
                        <td className="py-3">{roleBadge(inv.role)}</td>
                        <td className="py-3" style={{ color: colors.text.muted }}>
                          {inv.clinicName ?? <span style={{ color: colors.text.dim }}>—</span>}
                        </td>
                        <td className="py-3">{statusBadge(inv.status)}</td>
                        <td className="py-3" style={{ color: colors.text.muted }}>
                          {format(new Date(inv.expiresAt), 'MMM d, yyyy')}
                        </td>
                        <td className="py-3">
                          {inv.acceptLink ? (
                            <button
                              onClick={() => setLinkModal(inv)}
                              className="flex items-center gap-1 text-xs hover:underline"
                              style={{ color: colors.accent }}
                            >
                              <Link2 size={13} /> View link
                            </button>
                          ) : (
                            <span className="text-xs" style={{ color: colors.text.dim }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

        </>)}
      </>)
    })()}

      {/* ── Invite tab ──────────────────────────────────────────────── */}
      {mainTab === 'invite' && (
        <div className="flex flex-col gap-6">

          {/* Inline invite form */}
          <Card>
            <CardHeader title="Invite a team member" subtitle="A sign-up link will be generated for them to create their account." />
            <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="flex flex-col gap-4 mt-2">
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
              <div className="flex justify-end">
                <Button type="submit" loading={isSubmitting || mutation.isPending}>
                  <Send size={14} /> Send Invite
                </Button>
              </div>
            </form>
          </Card>

          {/* Guide */}
          <Card>
            <CardHeader title="How it works" />
            <ol className="space-y-3 text-sm" style={{ color: colors.text.muted }}>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                  style={{ background: accentAlpha(0.12), color: colors.accent }}>1</span>
                Enter the person's email address and select their role.
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                  style={{ background: accentAlpha(0.12), color: colors.accent }}>2</span>
                A unique sign-up link is generated — copy it and share it with the person.
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                  style={{ background: accentAlpha(0.12), color: colors.accent }}>3</span>
                They open the link, enter their name and a password, and their account is created automatically.
              </li>
            </ol>
          </Card>

        </div>
      )}

      {/* Sign-up link modal — shown after invite or via "View link" */}
      <Modal
        open={!!linkModal}
        onClose={() => setLinkModal(null)}
        title={`Sign-up link for ${linkModal?.email ?? ''}`}
      >
        {linkModal && (
          <div className="space-y-4">
            <p className="text-sm" style={{ color: colors.text.muted }}>
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
