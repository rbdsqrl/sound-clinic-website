import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { ArrowLeft, Plus, X, UserCheck, Heart, Users } from 'lucide-react'
import { patientsApi } from '../../api/patients'
import { clinicsApi } from '../../api/clinics'
import { conditionsApi } from '../../api/conditions'
import { Card, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Modal } from '../../components/ui/Modal'
import { Badge } from '../../components/ui/Badge'
import { PageLoader } from '../../components/ui/Spinner'
import { ToastContainer } from '../../components/ui/Toast'
import { useToast } from '../../hooks/useToast'
import { format } from 'date-fns'
import type { AddConditionRequest, AssignTherapistRequest, LinkParentRequest } from '../../types'

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { toasts, toast, dismiss } = useToast()
  const queryClient = useQueryClient()

  const [conditionModal, setConditionModal] = useState(false)
  const [parentModal, setParentModal] = useState(false)
  const [therapistModal, setTherapistModal] = useState(false)

  const { data: patient, isLoading } = useQuery({
    queryKey: ['patients', id],
    queryFn: () => patientsApi.get(id!),
    enabled: !!id,
  })

  const { data: conditions } = useQuery({ queryKey: ['conditions'], queryFn: conditionsApi.list })
  const { data: clinics } = useQuery({ queryKey: ['clinics'], queryFn: clinicsApi.list })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['patients', id] })

  // Condition form
  const conditionForm = useForm<AddConditionRequest>()
  const addConditionMutation = useMutation({
    mutationFn: (d: AddConditionRequest) => patientsApi.addCondition(id!, d),
    onSuccess: () => { refresh(); toast('Condition added', 'success'); setConditionModal(false); conditionForm.reset() },
    onError: () => toast('Failed to add condition', 'error'),
  })
  const removeConditionMutation = useMutation({
    mutationFn: (conditionId: string) => patientsApi.removeCondition(id!, conditionId),
    onSuccess: () => { refresh(); toast('Condition removed', 'success') },
  })

  // Parent form
  const parentForm = useForm<{ parentId: string }>()
  const linkParentMutation = useMutation({
    mutationFn: (d: LinkParentRequest) => patientsApi.linkParent(id!, d),
    onSuccess: () => { refresh(); toast('Parent linked', 'success'); setParentModal(false); parentForm.reset() },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast(msg ?? 'Failed to link parent', 'error')
    },
  })
  const unlinkParentMutation = useMutation({
    mutationFn: (parentId: string) => patientsApi.unlinkParent(id!, parentId),
    onSuccess: () => { refresh(); toast('Parent unlinked', 'success') },
  })

  // Therapist form
  const therapistForm = useForm<{ therapistId: string }>()
  const assignTherapistMutation = useMutation({
    mutationFn: (d: AssignTherapistRequest) => patientsApi.assignTherapist(id!, d),
    onSuccess: () => { refresh(); toast('Therapist assigned', 'success'); setTherapistModal(false); therapistForm.reset() },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast(msg ?? 'Failed to assign therapist', 'error')
    },
  })
  const unassignTherapistMutation = useMutation({
    mutationFn: (therapistId: string) => patientsApi.unassignTherapist(id!, therapistId),
    onSuccess: () => { refresh(); toast('Therapist unassigned', 'success') },
  })

  if (isLoading) return <PageLoader />
  if (!patient) return <div className="text-slate-500">Patient not found</div>

  const conditionOptions = (conditions ?? [])
    .filter((c) => !patient.conditions.some((pc) => pc.id === c.id))
    .map((c) => ({ value: c.id, label: c.name }))

  const clinicName = clinics?.find((c) => c.id === patient.clinicId)?.name ?? '—'

  return (
    <div className="space-y-6">
      <div>
        <Link to="/patients" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-primary-600">
          <ArrowLeft size={14} /> Back to patients
        </Link>
        <h1 className="text-2xl font-bold text-slate-800">{patient.firstName} {patient.lastName}</h1>
        <p className="mt-1 text-sm text-slate-500">Clinic: {clinicName}</p>
      </div>

      {/* Basic info */}
      <Card>
        <CardHeader title="Patient Info" />
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            ['Date of Birth', patient.dateOfBirth ? format(new Date(patient.dateOfBirth), 'MMM d, yyyy') : null],
            ['Gender', patient.gender?.toLowerCase()],
            ['Clinic', clinicName],
            ['Status', patient.isActive ? 'Active' : 'Inactive'],
          ].map(([label, value]) => (
            <div key={label as string}>
              <dt className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</dt>
              <dd className="mt-1 text-sm text-slate-700 capitalize">{value || <span className="text-slate-400">—</span>}</dd>
            </div>
          ))}
        </dl>
        {patient.notes && (
          <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{patient.notes}</div>
        )}
      </Card>

      {/* Conditions */}
      <Card>
        <CardHeader
          title="Conditions"
          subtitle={`${patient.conditions.length} condition${patient.conditions.length !== 1 ? 's' : ''}`}
          action={<Button size="sm" onClick={() => setConditionModal(true)}><Plus size={14} /> Add</Button>}
        />
        {!patient.conditions.length ? (
          <p className="text-sm text-slate-400">No conditions recorded.</p>
        ) : (
          <div className="space-y-2">
            {patient.conditions.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-xl bg-blue-50 px-4 py-3">
                <div className="flex items-center gap-3">
                  <Heart size={16} className="text-blue-500" />
                  <div>
                    <p className="text-sm font-medium text-slate-800">{c.name}</p>
                    {c.diagnosedAt && <p className="text-xs text-slate-500">Diagnosed {format(new Date(c.diagnosedAt), 'MMM yyyy')}</p>}
                    {c.notes && <p className="text-xs text-slate-500 italic">{c.notes}</p>}
                  </div>
                </div>
                <button onClick={() => removeConditionMutation.mutate(c.id)} className="ml-2 text-slate-400 hover:text-red-500">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Parents */}
      <Card>
        <CardHeader
          title="Parents / Guardians"
          subtitle={`${patient.parents.length} linked`}
          action={<Button size="sm" onClick={() => setParentModal(true)}><Plus size={14} /> Link</Button>}
        />
        {!patient.parents.length ? (
          <p className="text-sm text-slate-400">No parents linked.</p>
        ) : (
          <div className="space-y-2">
            {patient.parents.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl bg-green-50 px-4 py-3">
                <div className="flex items-center gap-3">
                  <Users size={16} className="text-green-500" />
                  <div>
                    <p className="text-sm font-medium text-slate-800">{p.firstName} {p.lastName}</p>
                    <p className="text-xs text-slate-500">{p.email}</p>
                  </div>
                </div>
                <button onClick={() => unlinkParentMutation.mutate(p.id)} className="ml-2 text-slate-400 hover:text-red-500">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Therapists */}
      <Card>
        <CardHeader
          title="Assigned Therapists"
          subtitle={`${patient.therapists.length} assigned`}
          action={<Button size="sm" onClick={() => setTherapistModal(true)}><Plus size={14} /> Assign</Button>}
        />
        {!patient.therapists.length ? (
          <p className="text-sm text-slate-400">No therapists assigned.</p>
        ) : (
          <div className="space-y-2">
            {patient.therapists.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-xl bg-purple-50 px-4 py-3">
                <div className="flex items-center gap-3">
                  <UserCheck size={16} className="text-purple-500" />
                  <div>
                    <p className="text-sm font-medium text-slate-800">{t.firstName} {t.lastName}</p>
                    <p className="text-xs text-slate-500">Assigned {format(new Date(t.assignedAt), 'MMM d, yyyy')}</p>
                  </div>
                </div>
                <button onClick={() => unassignTherapistMutation.mutate(t.id)} className="ml-2 text-slate-400 hover:text-red-500">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Modals */}
      <Modal open={conditionModal} onClose={() => { setConditionModal(false); conditionForm.reset() }} title="Add Condition">
        <form onSubmit={conditionForm.handleSubmit((d) => addConditionMutation.mutate(d))} className="space-y-4">
          <Select label="Condition" placeholder="Select condition…" options={conditionOptions}
            {...conditionForm.register('conditionId', { required: 'Required' })} />
          <Input label="Diagnosed on" type="date" {...conditionForm.register('diagnosedAt')} />
          <div>
            <label className="form-label">Notes</label>
            <textarea className="form-input resize-none min-h-[80px]" {...conditionForm.register('notes')} />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => { setConditionModal(false); conditionForm.reset() }}>Cancel</Button>
            <Button type="submit" loading={addConditionMutation.isPending}>Add</Button>
          </div>
        </form>
      </Modal>

      <Modal open={parentModal} onClose={() => { setParentModal(false); parentForm.reset() }} title="Link Parent by User ID">
        <form onSubmit={parentForm.handleSubmit((d) => linkParentMutation.mutate({ parentId: d.parentId }))} className="space-y-4">
          <Input label="Parent User ID" placeholder="UUID of the parent user"
            hint="The parent must already have an account in your organisation."
            {...parentForm.register('parentId', { required: 'Required' })} />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => { setParentModal(false); parentForm.reset() }}>Cancel</Button>
            <Button type="submit" loading={linkParentMutation.isPending}>Link</Button>
          </div>
        </form>
      </Modal>

      <Modal open={therapistModal} onClose={() => { setTherapistModal(false); therapistForm.reset() }} title="Assign Therapist by User ID">
        <form onSubmit={therapistForm.handleSubmit((d) => assignTherapistMutation.mutate({ therapistId: d.therapistId }))} className="space-y-4">
          <Input label="Therapist User ID" placeholder="UUID of the therapist"
            hint="The therapist must already have an account in your organisation."
            {...therapistForm.register('therapistId', { required: 'Required' })} />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => { setTherapistModal(false); therapistForm.reset() }}>Cancel</Button>
            <Button type="submit" loading={assignTherapistMutation.isPending}>Assign</Button>
          </div>
        </form>
      </Modal>

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
