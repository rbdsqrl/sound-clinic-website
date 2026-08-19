import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Baby, ChevronRight, Clock, RefreshCw, UserCheck } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { patientsApi } from '../../api/patients'
import { therapySessionsApi } from '../../api/therapySessions'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageLoader } from '../../components/ui/Spinner'
import { ToastContainer } from '../../components/ui/Toast'
import { useToast } from '../../hooks/useToast'
import { getApiError } from '../../lib/apiError'
import { colors, border, surface, accentAlpha, palette, paletteStyle } from '../../theme'

function ChildSessions({ childId }: { childId: string }) {
  const qc = useQueryClient()
  const { toasts, toast, dismiss } = useToast()
  const [showAll, setShowAll] = useState(false)

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['child-sessions', childId],
    queryFn: () => therapySessionsApi.list({
      patientId: childId,
      from: format(new Date(), 'yyyy-MM-dd'),
    }),
  })

  const requestMutation = useMutation({
    mutationFn: (sessionId: string) => therapySessionsApi.requestReschedule(sessionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['child-sessions', childId] })
      toast('Reschedule request sent to the clinic', 'success')
    },
    onError: (err) => toast(getApiError(err, 'Failed to send request'), 'error'),
  })

  const upcoming = sessions.filter(s => s.status === 'SCHEDULED' || s.status === 'PENDING_RESCHEDULE')
  const visible   = showAll ? upcoming : upcoming.slice(0, 3)

  return (
    <>
      <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${border.divider}` }}>
        <p className="text-[11.5px] font-medium uppercase tracking-wider mb-2" style={{ color: colors.text.dim }}>
          Upcoming Sessions
        </p>

        {isLoading ? (
          <p className="text-xs py-1" style={{ color: colors.text.muted }}>Loading…</p>
        ) : upcoming.length === 0 ? (
          <p className="text-xs py-1" style={{ color: colors.text.dim }}>No upcoming sessions scheduled.</p>
        ) : (
          <div className="space-y-1.5">
            {visible.map(s => (
              <div
                key={s.id}
                className="flex items-center gap-3 rounded-xl px-3 py-2"
                style={{ background: accentAlpha(0.04), border: `1px solid ${border.divider}` }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="text-xs font-semibold" style={{ color: colors.text.primary }}>
                      {format(parseISO(s.sessionDate), 'EEE, d MMM')}
                    </span>
                    <span className="text-xs flex items-center gap-1" style={{ color: colors.text.muted }}>
                      <Clock size={10} />
                      {s.startTime.slice(0, 5)}
                    </span>
                    <span className="text-xs" style={{ color: colors.text.muted }}>
                      · {s.programName} #{s.sessionNumber}
                    </span>
                    <span className="text-xs" style={{ color: colors.text.dim }}>
                      · {s.therapistFirstName} {s.therapistLastName}
                    </span>
                  </div>
                </div>

                {s.status === 'PENDING_RESCHEDULE' ? (
                  <span
                    className="flex-shrink-0 text-[11.5px] font-semibold px-2 py-0.5 rounded-full"
                    style={paletteStyle('amber', 0.10, 0.15)}
                  >
                    Rescheduling
                  </span>
                ) : (
                  <button
                    onClick={() => requestMutation.mutate(s.id)}
                    disabled={requestMutation.isPending}
                    className="flex-shrink-0 flex items-center gap-1 text-[12.65px] font-medium px-2 py-1 rounded-lg transition-colors disabled:opacity-50"
                    style={paletteStyle('purple', 0.08, 0.12)}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = `rgba(${palette.purple.raw}, 0.14)`}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = `rgba(${palette.purple.raw}, 0.08)`}
                  >
                    <RefreshCw size={10} /> Reschedule
                  </button>
                )}
              </div>
            ))}

            {upcoming.length > 3 && (
              <button
                onClick={() => setShowAll(v => !v)}
                className="w-full text-center text-xs py-1.5 transition-colors"
                style={{ color: colors.accent }}
              >
                {showAll ? 'Show less' : `+${upcoming.length - 3} more session${upcoming.length - 3 !== 1 ? 's' : ''}`}
              </button>
            )}
          </div>
        )}
      </div>
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
              {/* Compact header row */}
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div
                  className="h-10 w-10 rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0"
                  style={{
                    background: `rgba(${palette.pink.raw}, 0.12)`,
                    color: palette.pink.text,
                  }}
                >
                  {child.firstName[0]}{child.lastName[0]}
                </div>

                {/* Name + meta */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-sm" style={{ color: colors.text.heading }}>
                      {child.firstName} {child.lastName}
                    </p>
                    <Link
                      to={`/patients/${child.id}`}
                      className="flex-shrink-0 flex items-center gap-0.5 text-xs font-medium transition-opacity hover:opacity-75"
                      style={{ color: colors.accent }}
                    >
                      View profile <ChevronRight size={13} />
                    </Link>
                  </div>

                  {/* DOB + therapists inline */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs" style={{ color: colors.text.muted }}>
                    {child.dateOfBirth && (
                      <span>Born {format(new Date(child.dateOfBirth), 'MMM d, yyyy')}</span>
                    )}
                    {child.therapists.length > 0 && (
                      <span className="flex items-center gap-1">
                        <UserCheck size={10} style={{ color: colors.text.dim }} />
                        {child.therapists.map(t => `${t.firstName} ${t.lastName}`).join(', ')}
                      </span>
                    )}
                  </div>

                  {/* Conditions as chips */}
                  {child.conditions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {child.conditions.map((c) => (
                        <span
                          key={c.id}
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-[12.65px] font-medium"
                          style={paletteStyle('blue', 0.08, 0.14)}
                        >
                          {c.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Sessions — always visible */}
              <ChildSessions childId={child.id} />
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
