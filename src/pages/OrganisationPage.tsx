import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Building2, Pencil } from 'lucide-react'
import { organisationApi } from '../api/organisation'
import { Card, CardHeader } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { PageLoader } from '../components/ui/Spinner'
import { ToastContainer } from '../components/ui/Toast'
import { useToast } from '../hooks/useToast'
import type { UpdateOrganisationRequest } from '../types'

export default function OrganisationPage() {
  const [editing, setEditing] = useState(false)
  const { toasts, toast, dismiss } = useToast()
  const queryClient = useQueryClient()

  const { data: org, isLoading } = useQuery({
    queryKey: ['organisation'],
    queryFn: organisationApi.get,
  })

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<UpdateOrganisationRequest>()

  const mutation = useMutation({
    mutationFn: organisationApi.update,
    onSuccess: (updated) => {
      queryClient.setQueryData(['organisation'], updated)
      toast('Organisation updated', 'success')
      setEditing(false)
    },
    onError: () => toast('Failed to update organisation', 'error'),
  })

  const startEdit = () => {
    if (org) reset({ name: org.name, contactEmail: org.contactEmail ?? '', contactPhone: org.contactPhone ?? '', address: org.address ?? '', logoUrl: org.logoUrl ?? '', timezone: org.timezone })
    setEditing(true)
  }

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Organisation</h1>
        <p className="mt-1 text-sm text-slate-500">Your organisation profile and settings</p>
      </div>

      <Card>
        <CardHeader
          title="Profile"
          subtitle="Manage your organisation's details"
          action={!editing ? (
            <Button variant="secondary" size="sm" onClick={startEdit}>
              <Pencil size={14} /> Edit
            </Button>
          ) : undefined}
        />

        {!editing ? (
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[
              ['Name', org?.name],
              ['Slug', org?.slug],
              ['Email', org?.contactEmail],
              ['Phone', org?.contactPhone],
              ['Timezone', org?.timezone],
              ['Address', org?.address],
            ].map(([label, value]) => (
              <div key={label as string}>
                <dt className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</dt>
                <dd className="mt-1 text-sm text-slate-700">{value || <span className="text-slate-400">—</span>}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="Name" error={errors.name?.message} {...register('name')} />
              <Input label="Contact Email" type="email" {...register('contactEmail')} />
              <Input label="Contact Phone" {...register('contactPhone')} />
              <Input label="Timezone" {...register('timezone')} />
            </div>
            <Input label="Address" {...register('address')} />
            <Input label="Logo URL" type="url" {...register('logoUrl')} />
            <div className="flex gap-3">
              <Button type="submit" loading={isSubmitting || mutation.isPending}>Save changes</Button>
              <Button type="button" variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </form>
        )}
      </Card>

      {/* Org ID + Slug info */}
      <Card>
        <CardHeader title="Deployment Info" />
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wider text-slate-400">Organisation ID</dt>
            <dd className="mt-1 font-mono text-xs text-slate-600 break-all">{org?.id}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wider text-slate-400">Slug</dt>
            <dd className="mt-1 font-mono text-sm text-slate-600">{org?.slug}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wider text-slate-400">Status</dt>
            <dd className="mt-1">
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${org?.isActive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {org?.isActive ? 'Active' : 'Inactive'}
              </span>
            </dd>
          </div>
        </dl>
      </Card>

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
