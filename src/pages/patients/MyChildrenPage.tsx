import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Baby, ChevronRight, Heart, CalendarDays, Clock, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { patientsApi } from '../../api/patients'
import { therapySessionsApi } from '../../api/therapySessions'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageLoader } from '../../components/ui/Spinner'
import { ToastContainer } from '../../components/ui/Toast'
import { useToast } from '../../hooks/useToast'
import { colors, border, accentAlpha } from '../../theme'

function ChildSessions({ childId, childName }: { childId: string; childName: string }) {
  const qc = useQueryClient()
  const { toasts, toast, dismiss } = useToast()
  const [expanded, setExpanded] = useState(false)

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['child-sessions', childId],
    queryFn: () => therapySessionsApi.list({
      patientId: childId,
      from: format(new Date(), 'yyyy-MM-dd'),
    }),
    enabled: expanded,
  })

  const requestMutation = useMutation({
    mutationFn: (sessionId: string) => therapySessionsApi.requestReschedule(sessionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['child-sessions', childId] })
      toast('Reschedule request sent to the clinic', 'success')
    },
    onError: () => toast('Failed to send request', 'error'),
  })

  return (
    <>
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-2 pt-3 mt-3 text-sm font-medium"
        style={{ borderTop: `1px solid ${border.divider}`, color: colors.accent }}
      >
        <CalendarDays size={14} />
        Upcoming sessions
        {expanded ? <ChevronUp size={14} className="ml-auto" /> : <ChevronDown size={14} className="ml-auto" />}
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          {isLoading ? (
            <p className="text-xs text-center py-2" style={{ color: colors.text.muted }}>Loading…</p>
          ) : sessions.filter(s => s.status === 'SCHEDULED' || s.status === 'PENDING_RESCHEDULE').length === 0 ? (
            <p className="text-xs py-2" style={{ color: colors.text.muted }}>No upcoming sessions</p>
          ) : (
            sessions
              .filter(s => s.status === 'SCHEDULED' || s.status === 'PENDING_RESCHEDULE')
              .slice(0, 10)
              .map(s => (
                <div key={s.id}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                  style={{ background: accentAlpha(0.05), border: `1px solid ${border.divider}` }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium" style={{ color: colors.text.primary }}>
                      {format(parseISO(s.sessionDate), 'EEE, d MMM yyyy')}
                    </p>
                    <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: colors.text.muted }}>
                      <Clock size={10} />
                      {s.startTime.slice(0, 5)} · {s.programName} · Session #{s.sessionNumber}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: colors.text.dim }}>
                      {s.therapistFirstName} {s.therapistLastName}
                    </p>
                  </div>

                  {s.status === 'PENDING_RESCHEDULE' ? (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: '#d9770618', color: '#d97706' }}>
                      Rescheduling
                    </span>
                  ) : (
                    <button
                      onClick={() => requestMutation.mutate(s.id)}
                      disabled={requestMutation.isPending}
                      className="flex-shrink-0 flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-lg transition-colors"
                      style={{ background: '#7c3aed18', color: '#7c3aed' }}
                      title="Request reschedule"
                    >
                      <RefreshCw size={11} />
                      Request reschedule
                    </button>
                  )}
                </div>
              ))
          )}
        </div>
      )}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </>
  )
}

export default function MyChildrenPage() {
  const { data: children, isLoading } = useQuery({
    queryKey: ['my-children'],
    queryFn: patientsApi.myChildren,
  })

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: colors.text.heading }}>My Children</h1>
        <p className="mt-1 text-sm" style={{ color: colors.text.muted }}>
          Patients you are linked to as a parent or guardian.
        </p>
      </div>

      {!children?.length ? (
        <Card>
          <EmptyState
            icon={<Baby size={32} />}
            title="No children linked"
            description="Ask your clinic administrator to link your account to your child's patient record."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {children.map((child) => (
            <Card key={child.id}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-full font-semibold text-sm flex-shrink-0"
                    style={{ background: 'rgba(236,72,153,0.10)', color: '#db2777' }}
                  >
                    {child.firstName[0]}{child.lastName[0]}
                  </div>
                  <div>
                    <p className="font-semibold" style={{ color: colors.text.primary }}>
                      {child.firstName} {child.lastName}
                    </p>
                    <div className="mt-0.5 flex items-center gap-3 text-xs" style={{ color: colors.text.muted }}>
                      {child.dateOfBirth && (
                        <span>DOB: {format(new Date(child.dateOfBirth), 'MMM d, yyyy')}</span>
                      )}
                      {child.conditions.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Heart size={11} style={{ color: '#60a5fa' }} />
                          {child.conditions.length} condition{child.conditions.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    {child.conditions.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {child.conditions.map((c) => (
                          <span
                            key={c.id}
                            className="inline-flex rounded-full px-2 py-0.5 text-xs"
                            style={{ background: 'rgba(96,165,250,0.12)', color: '#2563eb' }}
                          >
                            {c.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <Link to={`/patients/${child.id}`}
                  className="p-1.5 rounded-lg flex-shrink-0"
                  style={{ color: colors.text.dim }}
                  title="View full profile"
                >
                  <ChevronRight size={16} />
                </Link>
              </div>

              {child.therapists.length > 0 && (
                <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${border.divider}` }}>
                  <p className="text-xs mb-1.5" style={{ color: colors.text.dim }}>Assigned therapists</p>
                  <div className="flex flex-wrap gap-2">
                    {child.therapists.map((t) => (
                      <span
                        key={t.id}
                        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs"
                        style={{ background: 'rgba(168,85,247,0.10)', color: '#7c3aed' }}
                      >
                        <span
                          className="h-4 w-4 rounded-full flex items-center justify-center font-medium text-[10px]"
                          style={{ background: 'rgba(168,85,247,0.20)', color: '#7c3aed' }}
                        >
                          {t.firstName[0]}
                        </span>
                        {t.firstName} {t.lastName}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <ChildSessions childId={child.id} childName={`${child.firstName} ${child.lastName}`} />
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
