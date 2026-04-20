import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Plus, Building2, ChevronRight } from 'lucide-react'
import { clinicsApi } from '../../api/clinics'
import { Card, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageLoader } from '../../components/ui/Spinner'
import { ToastContainer } from '../../components/ui/Toast'
import { useToast } from '../../hooks/useToast'
import type { CreateClinicRequest } from '../../types'

export default function ClinicsPage() {
  const [showModal, setShowModal] = useState(false)
  const { toasts, toast, dismiss } = useToast()
  const queryClient = useQueryClient()

  const { data: clinics, isLoading } = useQuery({
    queryKey: ['clinics'],
    queryFn: clinicsApi.list,
  })

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<CreateClinicRequest>()

  const createMutation = useMutation({
    mutationFn: clinicsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinics'] })
      toast('Clinic created', 'success')
      setShowModal(false)
      reset()
    },
    onError: () => toast('Failed to create clinic', 'error'),
  })

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Clinics</h1>
          <p className="mt-1 text-sm text-slate-500">{clinics?.length ?? 0} clinic{clinics?.length !== 1 ? 's' : ''} in your organisation</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus size={16} /> New Clinic
        </Button>
      </div>

      {!clinics?.length ? (
        <Card>
          <EmptyState
            icon={<Building2 size={32} />}
            title="No clinics yet"
            description="Create your first clinic to start managing patients and therapists."
            action={{ label: 'Create clinic', onClick: () => setShowModal(true) }}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clinics.map((clinic) => (
            <Link key={clinic.id} to={`/clinics/${clinic.id}`}>
              <Card className="group cursor-pointer hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-primary-50 p-2.5 text-primary-600">
                      <Building2 size={20} />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 group-hover:text-primary-600">{clinic.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{clinic.email ?? 'No email'}</p>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-400 group-hover:text-primary-600 mt-1" />
                </div>
                {clinic.address && (
                  <p className="mt-3 text-xs text-slate-500 truncate">{clinic.address}</p>
                )}
                <div className="mt-3 flex items-center gap-2">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${clinic.isActive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {clinic.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <span className="text-xs text-slate-400">{clinic.timezone}</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => { setShowModal(false); reset() }} title="Create new clinic">
        <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
          <Input label="Clinic name" placeholder="Downtown Branch" error={errors.name?.message}
            {...register('name', { required: 'Clinic name is required' })} />
          <Input label="Email" type="email" placeholder="clinic@example.com" {...register('email')} />
          <Input label="Phone" placeholder="+1 555 0123" {...register('phone')} />
          <Input label="Address" placeholder="123 Main St, City" {...register('address')} />
          <Input label="Timezone" placeholder="UTC" {...register('timezone')} />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => { setShowModal(false); reset() }}>Cancel</Button>
            <Button type="submit" loading={isSubmitting || createMutation.isPending}>Create</Button>
          </div>
        </form>
      </Modal>

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
