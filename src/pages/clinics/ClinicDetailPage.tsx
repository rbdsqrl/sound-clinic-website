import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { ArrowLeft, Pencil } from 'lucide-react'
import { clinicsApi } from '../../api/clinics'
import { Card, CardHeader } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { PageLoader } from '../../components/ui/Spinner'
import { ToastContainer } from '../../components/ui/Toast'
import { useToast } from '../../hooks/useToast'
import { colors, border } from '../../theme'
import type { CreateClinicRequest } from '../../types'

export default function ClinicDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [editing, setEditing] = useState(false)
  const { toasts, toast, dismiss } = useToast()
  const queryClient = useQueryClient()

  const { data: clinic, isLoading } = useQuery({
    queryKey: ['clinics', id],
    queryFn: () => clinicsApi.get(id!),
    enabled: !!id,
  })

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<CreateClinicRequest>()

  const mutation = useMutation({
    mutationFn: (data: Partial<CreateClinicRequest>) => clinicsApi.update(id!, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(['clinics', id], updated)
      queryClient.invalidateQueries({ queryKey: ['clinics'] })
      toast('Clinic updated', 'success')
      setEditing(false)
    },
    onError: () => toast('Failed to update clinic', 'error'),
  })

  const startEdit = () => {
    if (clinic) reset({ name: clinic.name, email: clinic.email ?? '', phone: clinic.phone ?? '', address: clinic.address ?? '', timezone: clinic.timezone })
    setEditing(true)
  }

  if (isLoading) return <PageLoader />
  if (!clinic) return <p className="text-sm" style={{ color: colors.text.muted }}>Clinic not found</p>

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/clinics"
          className="mb-4 inline-flex items-center gap-1 text-sm transition-colors"
          style={{ color: colors.text.muted }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = colors.accent}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = colors.text.muted}
        >
          <ArrowLeft size={14} /> Back to clinics
        </Link>
        <h1 className="text-2xl font-bold" style={{ color: colors.text.heading }}>{clinic.name}</h1>
        <p className="mt-1 text-sm" style={{ color: colors.text.muted }}>Clinic details and settings</p>
      </div>

      <Card>
        <CardHeader
          title="Details"
          action={!editing ? (
            <Button variant="secondary" size="sm" onClick={startEdit}><Pencil size={14} /> Edit</Button>
          ) : undefined}
        />

        {!editing ? (
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[
              ['Name', clinic.name],
              ['Email', clinic.email],
              ['Phone', clinic.phone],
              ['Timezone', clinic.timezone],
              ['Address', clinic.address],
              ['Status', clinic.isActive ? 'Active' : 'Inactive'],
            ].map(([label, value]) => (
              <div key={label as string}>
                <dt className="text-xs font-medium uppercase tracking-wider" style={{ color: colors.text.dim }}>{label}</dt>
                <dd className="mt-1 text-sm" style={{ color: colors.text.primary }}>
                  {value || <span style={{ color: colors.text.dim }}>—</span>}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="Name"     {...register('name')} />
              <Input label="Email"    type="email" {...register('email')} />
              <Input label="Phone"    {...register('phone')} />
              <Input label="Timezone" {...register('timezone')} />
            </div>
            <Input label="Address" {...register('address')} />
            <div className="flex gap-3">
              <Button type="submit" loading={isSubmitting || mutation.isPending}>Save</Button>
              <Button type="button" variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </form>
        )}
      </Card>

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
