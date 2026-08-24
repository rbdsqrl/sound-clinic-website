import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ClipboardList, ChevronDown, ChevronUp, Plus, History } from 'lucide-react'
import { format } from 'date-fns'
import { activitiesApi } from '../../api/activities'
import { Card, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Select'
import { Modal } from '../../components/ui/Modal'
import { Badge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageLoader } from '../../components/ui/Spinner'
import { ToastContainer } from '../../components/ui/Toast'
import { useToast } from '../../hooks/useToast'
import { getApiError } from '../../lib/apiError'
import { colors, border } from '../../theme'
import { ROUTES } from '../../lib/routes'
import type { ActivityAssignmentResponse, AssignmentStatus, AttemptAnswerInput } from '../../types'

const STATUS_OPTIONS: { value: AssignmentStatus; label: string }[] = [
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'DISCONTINUED', label: 'Discontinued' },
]

const STATUS_VARIANT: Record<AssignmentStatus, 'slate' | 'blue' | 'green' | 'red'> = {
  ASSIGNED: 'slate', IN_PROGRESS: 'blue', COMPLETED: 'green', DISCONTINUED: 'red',
}

export default function ActivitiesTab({ patientId }: { patientId: string }) {
  const { toasts, toast, dismiss } = useToast()
  const [logFor, setLogFor] = useState<ActivityAssignmentResponse | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const qc = useQueryClient()

  const { data: assignments, isLoading } = useQuery({
    queryKey: ['patient-activity-assignments', patientId],
    queryFn: () => activitiesApi.listAssignments(patientId),
  })

  const statusMut = useMutation({
    mutationFn: ({ assignmentId, status }: { assignmentId: string; status: AssignmentStatus }) =>
      activitiesApi.updateAssignmentStatus(assignmentId, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patient-activity-assignments', patientId] })
      toast('Status updated', 'success')
    },
    onError: (err) => toast(getApiError(err, 'Failed to update status'), 'error'),
  })

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Assigned Activities"
          subtitle="Assign activities from the Activities module, then log progress here"
          action={<Link to={ROUTES.activities}><Button size="sm" variant="secondary"><Plus size={14} /> Assign from Activities</Button></Link>}
        />
        {!assignments || assignments.length === 0 ? (
          <EmptyState icon={<ClipboardList size={24} />} title="No activities assigned yet"
            description="Go to Activities to assign one to this patient." />
        ) : (
          <div className="space-y-3">
            {assignments.map((a) => (
              <div key={a.id} className="rounded-xl p-4" style={{ border: `1px solid ${border.divider}` }}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <Link to={ROUTES.activity(a.activityId)} className="text-sm font-semibold hover:underline" style={{ color: colors.text.primary }}>
                      {a.activityTitle}
                    </Link>
                    <p className="text-xs mt-0.5" style={{ color: colors.text.dim }}>
                      {a.startDate && `Started ${format(new Date(a.startDate), 'd MMM yyyy')} · `}
                      {a.attemptCount} attempt{a.attemptCount !== 1 ? 's' : ''} logged
                      {a.assignedTherapistName && ` · ${a.assignedTherapistName}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={STATUS_VARIANT[a.status]}>{a.status.replace('_', ' ')}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <div className="w-40">
                    <Select
                      value={a.status}
                      onChange={(e) => statusMut.mutate({ assignmentId: a.id, status: e.target.value as AssignmentStatus })}
                      options={STATUS_OPTIONS}
                    />
                  </div>
                  <Button size="sm" onClick={() => setLogFor(a)}>Log Attempt</Button>
                  <button
                    className="inline-flex items-center gap-1 text-xs font-medium py-2.5 px-1 -m-1"
                    style={{ color: colors.accent }}
                    onClick={() => setExpanded((prev) => (prev === a.id ? null : a.id))}
                  >
                    <History size={13} /> History {expanded === a.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>
                </div>
                {expanded === a.id && <AttemptHistory assignmentId={a.id} />}
              </div>
            ))}
          </div>
        )}
      </Card>

      {logFor && (
        <LogAttemptModal
          assignment={logFor}
          onClose={() => setLogFor(null)}
          onLogged={() => {
            setLogFor(null)
            qc.invalidateQueries({ queryKey: ['patient-activity-assignments', patientId] })
          }}
        />
      )}

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}

function AttemptHistory({ assignmentId }: { assignmentId: string }) {
  const { data: attempts, isLoading } = useQuery({
    queryKey: ['activity-attempts', assignmentId],
    queryFn: () => activitiesApi.listAttempts(assignmentId),
  })

  if (isLoading) return null
  if (!attempts || attempts.length === 0) {
    return <p className="text-xs mt-3" style={{ color: colors.text.dim }}>No attempts logged yet.</p>
  }

  return (
    <div className="mt-3 space-y-2 pl-1 border-l-2" style={{ borderColor: border.divider }}>
      {attempts.map((att) => (
        <div key={att.id} className="pl-3">
          <p className="text-xs font-medium" style={{ color: colors.text.primary }}>
            {format(new Date(att.attemptDate), 'd MMM yyyy')} — {att.loggedByName ?? 'Staff'}
          </p>
          {att.note && <p className="text-xs" style={{ color: colors.text.muted }}>{att.note}</p>}
          {att.answers.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {att.answers.map((ans, i) => (
                <li key={i} className="text-xs" style={{ color: colors.text.dim }}>
                  {ans.questionText}: {ans.selectedOptionTexts.length > 0 ? ans.selectedOptionTexts.join(', ') : (ans.textAnswer || '—')}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}

function LogAttemptModal({ assignment, onClose, onLogged }: {
  assignment: ActivityAssignmentResponse; onClose: () => void; onLogged: () => void
}) {
  const { toast, toasts, dismiss } = useToast()
  const { data: activity } = useQuery({
    queryKey: ['activity', assignment.activityId],
    queryFn: () => activitiesApi.get(assignment.activityId),
  })

  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [note, setNote] = useState('')
  const [answers, setAnswers] = useState<Record<string, { selected: string[]; text: string }>>({})

  const logMut = useMutation({
    mutationFn: () => {
      const payload: AttemptAnswerInput[] = Object.entries(answers).map(([questionId, v]) => ({
        questionId, selectedOptionIds: v.selected, textAnswer: v.text || undefined,
      }))
      return activitiesApi.logAttempt(assignment.id, { attemptDate: date, note: note || undefined, answers: payload })
    },
    onSuccess: () => { toast('Attempt logged', 'success'); onLogged() },
    onError: (err) => toast(getApiError(err, 'Failed to log attempt'), 'error'),
  })

  const setSingle = (qid: string, optionId: string) =>
    setAnswers((prev) => ({ ...prev, [qid]: { selected: [optionId], text: '' } }))
  const toggleMulti = (qid: string, optionId: string) =>
    setAnswers((prev) => {
      const cur = prev[qid]?.selected ?? []
      const next = cur.includes(optionId) ? cur.filter((v) => v !== optionId) : [...cur, optionId]
      return { ...prev, [qid]: { selected: next, text: '' } }
    })
  const setText = (qid: string, text: string) =>
    setAnswers((prev) => ({ ...prev, [qid]: { selected: [], text } }))

  return (
    <Modal open onClose={onClose} title={`Log Attempt — ${assignment.activityTitle}`} size="lg">
      <div className="space-y-4">
        <div>
          <label className="form-label">Date</label>
          <input type="date" className="form-input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        {!activity ? (
          <PageLoader />
        ) : activity.checklist.length === 0 ? (
          <p className="text-sm" style={{ color: colors.text.dim }}>This activity has no checklist — just add a note if needed.</p>
        ) : (
          <div className="space-y-4 max-h-[50vh] overflow-y-auto">
            {activity.checklist.map((q, i) => (
              <div key={q.id}>
                <p className="text-sm font-medium mb-1.5" style={{ color: colors.text.primary }}>{i + 1}. {q.questionText}</p>
                {q.questionType === 'TEXT' ? (
                  <input className="form-input" value={answers[q.id]?.text ?? ''} onChange={(e) => setText(q.id, e.target.value)} />
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {q.options.map((opt) => {
                      const selected = answers[q.id]?.selected.includes(opt.id) ?? false
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => q.questionType === 'MULTI_CHOICE' ? toggleMulti(q.id, opt.id) : setSingle(q.id, opt.id)}
                          className="px-3 py-1.5 rounded-full text-sm font-medium"
                          style={selected
                            ? { background: 'var(--color-accent)', color: '#fff' }
                            : { background: 'transparent', color: colors.text.primary, border: `1px solid ${border.divider}` }}
                        >
                          {opt.optionText}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div>
          <label className="form-label">Note (optional)</label>
          <textarea className="form-input resize-none min-h-[70px]" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => logMut.mutate()} loading={logMut.isPending}>Save Attempt</Button>
        </div>
      </div>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </Modal>
  )
}
