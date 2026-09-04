import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Plus, Building2, ChevronRight } from 'lucide-react'
import { clinicsApi } from '../../api/clinics'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Modal } from '../../components/ui/Modal'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageLoader } from '../../components/ui/Spinner'
import { useToast } from '../../hooks/useToast'
import { getApiError } from '../../lib/apiError'
import { TIMEZONES } from '../../lib/timezones'
import { colors, styles, accentAlpha } from '../../theme'
import type { CreateClinicRequest } from '../../types'
import { useAuth } from '../../contexts/AuthContext'

const TIMEZONE_GROUPS = Array.from(
  TIMEZONES.reduce((map, tz) => {
    if (!map.has(tz.region)) map.set(tz.region, [])
    map.get(tz.region)!.push({ value: tz.value, label: tz.label })
    return map
  }, new Map<string, { value: string; label: string }[]>()),
  ([group, options]) => ({ group, options })
)

export default function ClinicsPage() {
  const [showModal, setShowModal] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { user, activeRole } = useAuth()
  const canCreateClinic = (activeRole ?? user?.role) !== 'THERAPIST'

  useEffect(() => { if (showModal) setFormError(null) }, [showModal])

  const { data: clinics, isLoading } = useQuery({
    queryKey: ['clinics'],
    queryFn: clinicsApi.list,
  })

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<CreateClinicRequest>({
    defaultValues: { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
  })

  const createMutation = useMutation({
    mutationFn: clinicsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinics'] })
      toast('Clinic created', 'success')
      setShowModal(false)
      reset()
    },
    onError: (err) => setFormError(getApiError(err, 'Failed to create clinic')),
  })

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: colors.text.heading }}>Clinics</h1>
          <p className="mt-1 text-sm" style={{ color: colors.text.muted }}>
            {clinics?.length ?? 0} clinic{clinics?.length !== 1 ? 's' : ''} in your organisation
          </p>
        </div>
        {canCreateClinic && (
          <Button onClick={() => setShowModal(true)}>
            <Plus size={16} /> New Clinic
          </Button>
        )}
      </div>

      {!clinics?.length ? (
        <Card>
          <EmptyState
            icon={<Building2 size={32} />}
            title="No clinics yet"
            description="Create your first clinic to start managing cases and therapists."
            action={canCreateClinic ? { label: 'Create clinic', onClick: () => setShowModal(true) } : undefined}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clinics.map((clinic) => (
            <Link key={clinic.id} to={`/clinics/${clinic.id}`}>
              <div
                className="rounded-2xl p-5 cursor-pointer transition-all"
                style={styles.card}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = `0 0 0 1px var(--color-accent), 0 4px 16px ${accentAlpha(0.12)}`}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = (styles.card as React.CSSProperties).boxShadow as string ?? ''}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl p-2.5" style={{ background: accentAlpha(0.10), color: colors.accent }}>
                      <Building2 size={20} />
                    </div>
                    <div>
                      <p className="font-semibold" style={{ color: colors.text.primary }}>{clinic.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: colors.text.muted }}>{clinic.email ?? 'No email'}</p>
                    </div>
                  </div>
                  <ChevronRight size={16} style={{ color: colors.text.dim }} />
                </div>
                {clinic.address && (
                  <p className="mt-3 text-xs truncate" style={{ color: colors.text.muted }}>{clinic.address}</p>
                )}
                <div className="mt-3 flex items-center gap-2">
                  <span
                    className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                    style={clinic.isActive
                      ? { background: 'rgba(16,185,129,0.10)', color: '#059669' }
                      : { background: 'rgba(239,68,68,0.10)',  color: '#dc2626' }}
                  >
                    {clinic.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <span className="text-xs" style={{ color: colors.text.dim }}>{clinic.timezone}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => { setShowModal(false); reset() }} title="Create new clinic" error={formError}>
        <form onSubmit={handleSubmit((d) => { setFormError(null); createMutation.mutate(d) })} className="space-y-4">
          <Input label="Clinic name" placeholder="Downtown Branch" error={errors.name?.message}
            {...register('name', { required: 'Clinic name is required' })} />
          <Input label="Email" type="email" placeholder="clinic@example.com" {...register('email')} />
          <Input label="Phone" placeholder="+1 555 0123" {...register('phone')} />
          <Input label="Address" placeholder="123 Main St, City" {...register('address')} />
          <Select label="Timezone" placeholder="Select timezone…" options={TIMEZONE_GROUPS} {...register('timezone')} />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => { setShowModal(false); reset() }}>Cancel</Button>
            <Button type="submit" loading={isSubmitting || createMutation.isPending}>Create</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
