import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { ChevronRight, Pencil, UserPlus, Clock, Users2, Globe, Link2 } from 'lucide-react'
import { activitiesApi } from '../../api/activities'
import { patientsApi } from '../../api/patients'
import { usersApi } from '../../api/users'
import { Card, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Select'
import { Input } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageLoader } from '../../components/ui/Spinner'
import { ToastContainer } from '../../components/ui/Toast'
import { useToast } from '../../hooks/useToast'
import { getApiError } from '../../lib/apiError'
import { colors, border } from '../../theme'
import { ROUTES } from '../../lib/routes'
import type { AssignActivityRequest, ActivityDifficulty, AssignmentStatus } from '../../types'

const DIFFICULTY_VARIANT: Record<ActivityDifficulty, 'green' | 'yellow' | 'red'> = {
  EASY: 'green', MEDIUM: 'yellow', HARD: 'red',
}

const STATUS_VARIANT: Record<AssignmentStatus, 'slate' | 'blue' | 'green' | 'red'> = {
  ASSIGNED: 'slate', IN_PROGRESS: 'blue', COMPLETED: 'green', DISCONTINUED: 'red',
}

export default function ActivityDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [assignOpen, setAssignOpen] = useState(false)
  const { toasts, toast, dismiss } = useToast()
  const qc = useQueryClient()

  const { data: activity, isLoading } = useQuery({
    queryKey: ['activity', id],
    queryFn: () => activitiesApi.get(id!),
    enabled: !!id,
  })

  const { data: patients = [] } = useQuery({ queryKey: ['patients'], queryFn: patientsApi.list })
  const { data: staff = [] } = useQuery({ queryKey: ['assignable'], queryFn: () => usersApi.listAssignable() })
  const therapists = staff.filter((u) => u.role === 'THERAPIST' || u.role === 'DOCTOR')

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<AssignActivityRequest>()

  const assignMut = useMutation({
    mutationFn: (data: AssignActivityRequest) => activitiesApi.assign(id!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['activity-assignments-scan'] })
      toast('Activity assigned', 'success')
      setAssignOpen(false)
      reset()
    },
    onError: (err) => toast(getApiError(err, 'Failed to assign activity'), 'error'),
  })

  if (isLoading || !activity) return <PageLoader />

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center gap-1.5 text-sm min-w-0" style={{ color: colors.text.dim }}>
        <Link to={ROUTES.activities} className="hover:underline flex-shrink-0">My Activities</Link>
        <ChevronRight size={14} className="flex-shrink-0" />
        <span className="truncate" style={{ color: colors.text.primary }}>{activity.title}</span>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold" style={{ color: colors.text.heading }}>{activity.title}</h1>
            <Badge variant={DIFFICULTY_VARIANT[activity.difficulty]}>{activity.difficulty}</Badge>
            {activity.isShared && <Badge variant="blue"><Globe size={11} className="inline mr-1" />Shared</Badge>}
          </div>
          {activity.programName && <p className="text-sm mt-1" style={{ color: colors.text.dim }}>{activity.programName}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={ROUTES.editActivity(activity.id)}>
            <Button variant="secondary"><Pencil size={14} /> Edit</Button>
          </Link>
          <Button onClick={() => setAssignOpen(true)}><UserPlus size={14} /> Assign to Patient</Button>
        </div>
      </div>

      <Card>
        <p className="text-sm" style={{ color: colors.text.primary }}>{activity.aboutActivity}</p>
        <div className="flex items-center gap-4 mt-4 text-xs" style={{ color: colors.text.dim }}>
          <span className="inline-flex items-center gap-1"><Clock size={13} /> {activity.durationWeeks} weeks</span>
          <span className="inline-flex items-center gap-1">
            <Users2 size={13} /> {activity.ageMinValue} {activity.ageMinUnit.toLowerCase()} – {activity.ageMaxValue} {activity.ageMaxUnit.toLowerCase()}
          </span>
        </div>
        {(activity.skills.length > 0 || activity.languages.length > 0 || activity.props.length > 0) && (
          <div className="mt-4 space-y-2">
            {activity.skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5">{activity.skills.map((s) => <Badge key={s.id}>{s.name}</Badge>)}</div>
            )}
            {activity.languages.length > 0 && (
              <div className="flex flex-wrap gap-1.5">{activity.languages.map((l) => <Badge key={l.id} variant="blue">{l.name}</Badge>)}</div>
            )}
            {activity.props.length > 0 && (
              <div className="flex flex-wrap gap-1.5">{activity.props.map((p) => <Badge key={p.id} variant="purple">{p.name}</Badge>)}</div>
            )}
          </div>
        )}
      </Card>

      {activity.instructions.length > 0 && (
        <Card>
          <CardHeader title="Instructions" />
          <ol className="space-y-2 list-decimal list-inside">
            {activity.instructions.map((text, i) => (
              <li key={i} className="text-sm" style={{ color: colors.text.primary }}>{text}</li>
            ))}
          </ol>
        </Card>
      )}

      {activity.checklist.length > 0 && (
        <Card>
          <CardHeader title="Checklist" />
          <div className="space-y-3">
            {activity.checklist.map((q, i) => (
              <div key={q.id}>
                <p className="text-sm font-medium" style={{ color: colors.text.primary }}>{i + 1}. {q.questionText}</p>
                {q.options.length > 0 && (
                  <p className="text-xs mt-0.5" style={{ color: colors.text.dim }}>{q.options.map((o) => o.optionText).join(' · ')}</p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {(activity.tipsAndSuggestions || activity.links.length > 0) && (
        <Card>
          {activity.tipsAndSuggestions && (
            <>
              <CardHeader title="Tips and Suggestions" />
              <p className="text-sm" style={{ color: colors.text.primary }}>{activity.tipsAndSuggestions}</p>
            </>
          )}
          {activity.links.length > 0 && (
            <div className="mt-4 space-y-1.5">
              {activity.links.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm hover:underline" style={{ color: colors.accent }}>
                  <Link2 size={13} /> {url}
                </a>
              ))}
            </div>
          )}
        </Card>
      )}

      <Card>
        <CardHeader title="Assigned Patients" subtitle="Manage progress from a patient's Activities tab" />
        <PatientAssignmentsList activityId={activity.id} />
      </Card>

      <Modal open={assignOpen} onClose={() => { setAssignOpen(false); reset() }} title="Assign to Patient">
        <form onSubmit={handleSubmit((d) => assignMut.mutate(d))} className="space-y-4">
          <Select label="Patient" placeholder="Select a patient…" error={errors.patientId?.message}
            options={patients.map((p) => ({ value: p.id, label: `${p.firstName} ${p.lastName}` }))}
            {...register('patientId', { required: 'Choose a patient' })} />
          <Select label="Assign to therapist (optional)" placeholder="No specific therapist"
            options={therapists.map((t) => ({ value: t.id, label: `${t.firstName} ${t.lastName}` }))}
            {...register('assignedTherapistId')} />
          <Input label="Start date" type="date" {...register('startDate')} />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => { setAssignOpen(false); reset() }}>Cancel</Button>
            <Button type="submit" loading={isSubmitting || assignMut.isPending}>Assign</Button>
          </div>
        </form>
      </Modal>

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}

/** Assignments are fetched per-patient by the API, so this section resolves them by scanning
 *  each patient's assignment list rather than a dedicated "by activity" endpoint. */
function PatientAssignmentsList({ activityId }: { activityId: string }) {
  const { data: patients = [] } = useQuery({ queryKey: ['patients'], queryFn: patientsApi.list })
  const { data: allAssignments = [], isLoading } = useQuery({
    queryKey: ['activity-assignments-scan', activityId, patients.map((p) => p.id).join(',')],
    queryFn: async () => {
      const lists = await Promise.all(patients.map((p) => activitiesApi.listAssignments(p.id)))
      return lists.flat().filter((a) => a.activityId === activityId)
    },
    enabled: patients.length > 0,
  })

  if (isLoading) return <PageLoader />
  if (allAssignments.length === 0) {
    return <EmptyState icon={<UserPlus size={22} />} title="Not assigned yet" description="Assign this activity to a patient to start tracking progress." />
  }

  return (
    <div className="space-y-2">
      {allAssignments.map((a) => (
        <Link
          key={a.id}
          to={ROUTES.patient(a.patientId)}
          className="flex items-center justify-between gap-3 rounded-xl p-3 hover:opacity-80 transition-opacity"
          style={{ border: `1px solid ${border.divider}` }}
        >
          <div className="min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: colors.text.primary }}>{a.patientName}</p>
            <p className="text-xs" style={{ color: colors.text.dim }}>{a.attemptCount} attempt{a.attemptCount !== 1 ? 's' : ''} logged</p>
          </div>
          <div className="flex-shrink-0">
            <Badge variant={STATUS_VARIANT[a.status]}>{a.status.replace('_', ' ')}</Badge>
          </div>
        </Link>
      ))}
    </div>
  )
}
