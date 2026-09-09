import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { activitiesApi } from '../../api/activities'
import { patientsApi } from '../../api/patients'
import { usersApi } from '../../api/users'
import { useAuth } from '../../contexts/AuthContext'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Select } from '../ui/Select'
import { Input } from '../ui/Input'
import { useToast } from '../../hooks/useToast'
import { getApiError } from '../../lib/apiError'
import type { AssignActivityRequest } from '../../types'

/** Assign an existing Activity to a case — shared between the Activity detail page and the
 *  Activities list card, so both start from the same defaults and validation. A Therapist doing
 *  the assigning is pre-selected as the assigned therapist (still changeable), since they're the
 *  overwhelmingly common case rather than an admin assigning on someone else's behalf. */
export function AssignActivityModal({ activityId, activityTitle, onClose, onAssigned }: {
  activityId: string
  activityTitle?: string
  onClose: () => void
  onAssigned?: () => void
}) {
  const { toast } = useToast()
  const qc = useQueryClient()
  const { user, activeRole } = useAuth()
  const currentRole = activeRole ?? user?.role
  const isTherapist = currentRole === 'THERAPIST'

  const { data: patients = [] } = useQuery({ queryKey: ['patients'], queryFn: patientsApi.list })
  const { data: staff = [] } = useQuery({ queryKey: ['assignable'], queryFn: () => usersApi.listAssignable() })
  const therapists = staff.filter((u) => u.role === 'THERAPIST')

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<AssignActivityRequest>({
    defaultValues: { assignedTherapistId: isTherapist ? user?.id : undefined },
  })

  // The therapist list loads async — the default above can't see it yet, so confirm the
  // logged-in therapist is actually in it before locking the field to their own id.
  useEffect(() => {
    if (isTherapist && user?.id && therapists.some(t => t.id === user.id)) {
      setValue('assignedTherapistId', user.id)
    }
  }, [isTherapist, user?.id, therapists, setValue])

  const assignMut = useMutation({
    mutationFn: (data: AssignActivityRequest) => activitiesApi.assign(activityId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['activity-assignments-scan'] })
      qc.invalidateQueries({ queryKey: ['patient-activity-assignments'] })
      toast('Activity assigned', 'success')
      reset()
      onAssigned?.()
      onClose()
    },
  })

  return (
    <Modal
      open
      onClose={() => { onClose(); reset() }}
      title={activityTitle ? `Assign “${activityTitle}” to a case` : 'Assign to Case'}
      error={assignMut.isError ? getApiError(assignMut.error, 'Failed to assign activity') : null}
    >
      <form onSubmit={handleSubmit((d) => assignMut.mutate(d))} className="space-y-4">
        <Select label="Case" placeholder="Select a case…" error={errors.patientId?.message}
          options={patients.map((p) => ({ value: p.id, label: `${p.firstName} ${p.lastName}` }))}
          {...register('patientId', { required: 'Choose a case' })} />
        <Select
          label={isTherapist ? 'Assign to therapist' : 'Assign to therapist (optional)'}
          placeholder="No specific therapist"
          options={therapists.map((t) => ({ value: t.id, label: `${t.firstName} ${t.lastName}` }))}
          {...register('assignedTherapistId')}
        />
        <Input label="Start date" type="date" {...register('startDate')} />
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => { onClose(); reset() }}>Cancel</Button>
          <Button type="submit" loading={isSubmitting || assignMut.isPending}>Assign</Button>
        </div>
      </form>
    </Modal>
  )
}
