import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Plus, Users, ChevronRight } from 'lucide-react'
import { patientsApi } from '../../api/patients'
import { clinicsApi } from '../../api/clinics'
import { Card, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Modal } from '../../components/ui/Modal'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageLoader } from '../../components/ui/Spinner'
import { Badge } from '../../components/ui/Badge'
import { ToastContainer } from '../../components/ui/Toast'
import { useToast } from '../../hooks/useToast'
import type { CreatePatientRequest, Gender } from '../../types'
import { format } from 'date-fns'

const GENDERS: { value: Gender; label: string }[] = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER', label: 'Other' },
]

export default function PatientsPage() {
  const [showModal, setShowModal] = useState(false)
  const { toasts, toast, dismiss } = useToast()
  const queryClient = useQueryClient()

  const { data: patients, isLoading } = useQuery({ queryKey: ['patients'], queryFn: patientsApi.list })
  const { data: clinics } = useQuery({ queryKey: ['clinics'], queryFn: clinicsApi.list })

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<CreatePatientRequest>()

  const createMutation = useMutation({
    mutationFn: patientsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      toast('Patient created', 'success')
      setShowModal(false)
      reset()
    },
    onError: () => toast('Failed to create patient', 'error'),
  })

  const clinicOptions = (clinics ?? []).map((c) => ({ value: c.id, label: c.name }))
  const clinicMap = Object.fromEntries((clinics ?? []).map((c) => [c.id, c.name]))

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Patients</h1>
          <p className="mt-1 text-sm text-slate-500">{patients?.length ?? 0} patient{patients?.length !== 1 ? 's' : ''} registered</p>
        </div>
        <Button onClick={() => setShowModal(true)}><Plus size={16} /> Add Patient</Button>
      </div>

      {!patients?.length ? (
        <Card>
          <EmptyState
            icon={<Users size={32} />}
            title="No patients yet"
            description="Add your first patient to start managing care."
            action={{ label: 'Add patient', onClick: () => setShowModal(true) }}
          />
        </Card>
      ) : (
        <>
          {/* Card list — mobile */}
          <div className="space-y-3 sm:hidden">
            {patients.map((p) => (
              <Link key={p.id} to={`/patients/${p.id}`}>
                <Card className="active:bg-slate-50">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 flex-shrink-0 rounded-full bg-primary-100 text-primary-700 font-semibold text-sm flex items-center justify-center">
                        {p.firstName[0]}{p.lastName[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800 truncate">{p.firstName} {p.lastName}</p>
                        <p className="text-xs text-slate-500 truncate">{clinicMap[p.clinicId] ?? '—'}</p>
                      </div>
                    </div>
                    <ChevronRight size={16} className="flex-shrink-0 text-slate-400" />
                  </div>
                  {(p.conditions.length > 0 || p.dateOfBirth) && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      {p.dateOfBirth && (
                        <span className="text-xs text-slate-400">{format(new Date(p.dateOfBirth), 'MMM d, yyyy')}</span>
                      )}
                      {p.conditions.slice(0, 2).map((c) => (
                        <Badge key={c.id} variant="blue">{c.name}</Badge>
                      ))}
                      {p.conditions.length > 2 && <Badge variant="slate">+{p.conditions.length - 2}</Badge>}
                    </div>
                  )}
                </Card>
              </Link>
            ))}
          </div>

          {/* Table — sm and up */}
          <Card padding={false} className="hidden sm:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3 text-left">Patient</th>
                    <th className="px-6 py-3 text-left">Clinic</th>
                    <th className="px-6 py-3 text-left">Conditions</th>
                    <th className="px-6 py-3 text-left">Therapists</th>
                    <th className="px-6 py-3 text-left">DOB</th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {patients.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <p className="font-medium text-slate-800">{p.firstName} {p.lastName}</p>
                        {p.gender && <p className="text-xs text-slate-400 capitalize">{p.gender.toLowerCase()}</p>}
                      </td>
                      <td className="px-6 py-4 text-slate-500">{clinicMap[p.clinicId] ?? '—'}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {p.conditions.length === 0 ? <span className="text-slate-400">—</span>
                            : p.conditions.slice(0, 2).map((c) => <Badge key={c.id} variant="blue">{c.name}</Badge>)}
                          {p.conditions.length > 2 && <Badge variant="slate">+{p.conditions.length - 2}</Badge>}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-500">{p.therapists.length}</td>
                      <td className="px-6 py-4 text-slate-500">
                        {p.dateOfBirth ? format(new Date(p.dateOfBirth), 'MMM d, yyyy') : '—'}
                      </td>
                      <td className="px-6 py-4">
                        <Link to={`/patients/${p.id}`} className="inline-flex items-center gap-1 text-xs text-primary-600 hover:underline">
                          View <ChevronRight size={12} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      <Modal open={showModal} onClose={() => { setShowModal(false); reset() }} title="Add Patient" size="md">
        <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
          <Select label="Clinic" placeholder="Select clinic…" options={clinicOptions} error={errors.clinicId?.message}
            {...register('clinicId', { required: 'Clinic is required' })} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="First name" placeholder="Alex" error={errors.firstName?.message}
              {...register('firstName', { required: 'Required' })} />
            <Input label="Last name" placeholder="Johnson" error={errors.lastName?.message}
              {...register('lastName', { required: 'Required' })} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Date of birth" type="date" {...register('dateOfBirth')} />
            <Select label="Gender" placeholder="Select…" options={GENDERS} {...register('gender')} />
          </div>
          <div>
            <label className="form-label">Notes</label>
            <textarea className="form-input min-h-[80px] resize-none" {...register('notes')} />
          </div>
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
