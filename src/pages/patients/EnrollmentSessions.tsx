import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2, XCircle, AlertTriangle, Circle, Upload, X, FileText, Search, ChevronRight,
} from 'lucide-react'
import { therapySessionsApi } from '../../api/therapySessions'
import { PerformanceScoreSlider, ScorePill, scoreColor } from '../../components/ui/PerformanceScore'
import { StarRating } from './ReviewMeetings'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../hooks/useToast'
import { getApiError } from '../../lib/apiError'
import { colors, border, surface, accentAlpha, paletteStyle, styles, successAlpha, warningAlpha, dangerAlpha } from '../../theme'
import { isPastDateTime } from '../../lib/schedule'
import { format } from 'date-fns'
import type { TherapySessionResponse, TherapySessionStatus, SessionAttachmentResponse, SessionFeedbackAnswerInput } from '../../types'

// ── Session helpers ────────────────────────────────────────────────────────────

export function ScoreSparkline({ sessions }: { sessions: TherapySessionResponse[] }) {
  const scored = sessions
    .filter(s => s.status === 'COMPLETED' && s.performanceScore != null)
    .sort((a, b) => a.sessionNumber - b.sessionNumber)

  if (scored.length === 0) return null

  const W = 80
  const H = 24
  const barW = Math.min(8, (W - (scored.length - 1) * 2) / scored.length)
  const gap  = scored.length > 1 ? (W - barW * scored.length) / (scored.length - 1) : 0

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="flex-shrink-0">
      {scored.map((s, i) => {
        const score = s.performanceScore!
        const barH  = (score / 100) * (H - 2)
        const x     = i * (barW + gap)
        const y     = H - barH
        return (
          <rect
            key={s.id}
            x={x} y={y}
            width={barW} height={barH}
            rx={2}
            fill={scoreColor(score)}
            opacity={0.85}
          />
        )
      })}
    </svg>
  )
}

export function MiniDonut({ done, total }: { done: number; total: number }) {
  const r    = 18
  const circ = 2 * Math.PI * r
  const dash = total > 0 ? (done / total) * circ : 0
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" className="flex-shrink-0">
      <circle cx="22" cy="22" r={r} fill="none" strokeWidth="4.5" stroke={border.divider} />
      <circle
        cx="22" cy="22" r={r}
        fill="none" strokeWidth="4.5" strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
        transform="rotate(-90 22 22)"
        style={{ stroke: colors.status.success, transition: 'stroke-dasharray 0.35s ease' }}
      />
      <text x="22" y="27" textAnchor="middle" fontSize="9" fontWeight="700"
        style={{ fill: colors.text.primary, fontFamily: 'inherit' }}>
        {done}/{total}
      </text>
    </svg>
  )
}

function sessionRowIcon(status: string) {
  if (status === 'COMPLETED')
    return <CheckCircle2 size={14} className="flex-shrink-0" style={{ color: colors.status.success }} />
  if (status === 'CANCELLED' || status === 'NO_SHOW')
    return <XCircle size={14} className="flex-shrink-0" style={{ color: colors.status.danger }} />
  if (status === 'PENDING_RESCHEDULE')
    return <AlertTriangle size={14} className="flex-shrink-0" style={{ color: colors.status.warning }} />
  if (status === 'CANCELLATION_REQUESTED')
    return <XCircle size={14} className="flex-shrink-0" style={{ color: colors.status.danger }} />
  return <Circle size={14} className="flex-shrink-0" style={{ color: colors.text.dim }} />
}

function sessionRowStatusColor(status: string): string {
  if (status === 'COMPLETED')              return colors.status.success
  if (status === 'CANCELLED' || status === 'NO_SHOW') return colors.status.danger
  if (status === 'PENDING_RESCHEDULE')     return colors.status.warning
  if (status === 'CANCELLATION_REQUESTED') return colors.status.danger
  return colors.text.dim
}

function sessionRowStatusLabel(status: string): string {
  if (status === 'NO_SHOW')                 return 'No show'
  if (status === 'PENDING_RESCHEDULE')      return 'Rescheduling'
  if (status === 'CANCELLATION_REQUESTED')  return 'Cancel requested'
  return status.charAt(0) + status.slice(1).toLowerCase()
}

// ── SessionList (row-based, lazy-loaded per enrollment) ───────────────────────

const SESSION_PREVIEW = 5

export function SessionList({
  enrollmentId,
  canUpdate,
  onOpenNotes,
}: {
  enrollmentId: string
  canUpdate: boolean
  onOpenNotes: (s: TherapySessionResponse) => void
}) {
  const [tab, setTab] = useState<'completed' | 'upcoming'>('upcoming')
  const [showAll, setShowAll] = useState(false)

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['sessions', 'enrollment', enrollmentId],
    queryFn: () => therapySessionsApi.byEnrollment(enrollmentId),
    staleTime: 60 * 1000,
  })

  if (isLoading) return (
    <div className="px-4 py-4 flex justify-center" style={{ borderTop: `1px solid ${border.divider}` }}>
      <div className="h-4 w-4 animate-spin rounded-full border-2"
        style={{ borderColor: `${colors.accent}30`, borderTopColor: colors.accent }} />
    </div>
  )

  const completed = sessions.filter(s => s.status === 'COMPLETED').length
  const missed    = sessions.filter(s => s.status === 'NO_SHOW' || s.status === 'CANCELLED').length
  const upcoming  = sessions.filter(s => s.status === 'SCHEDULED' || s.status === 'PENDING_RESCHEDULE' || s.status === 'CANCELLATION_REQUESTED').length
  const total     = sessions.length
  const pct       = total > 0 ? Math.round((completed / total) * 100) : 0

  // A SCHEDULED session whose own end time has already passed — nobody marked it
  // done/missed or wrote it up yet. Based on end time, not start, so a session
  // still in progress isn't flagged as overdue.
  const isOverdue = (s: TherapySessionResponse) =>
    s.status === 'SCHEDULED' && isPastDateTime(s.sessionDate, s.endTime.slice(0, 5))
  const pendingNotesCount = sessions.filter(isOverdue).length

  // Sorted by the session's actual date, not its sessionNumber — an ad-hoc session is numbered
  // after the generated block regardless of when it falls, so ordering by number would always
  // push it to the end even when its date sits in the middle of the plan.
  const completedRows = sessions
    .filter(s => s.status !== 'SCHEDULED' && s.status !== 'PENDING_RESCHEDULE' && s.status !== 'CANCELLATION_REQUESTED')
    .sort((a, b) => b.sessionDate.localeCompare(a.sessionDate) || b.sessionNumber - a.sessionNumber)

  const upcomingRows = sessions
    .filter(s => s.status === 'SCHEDULED' || s.status === 'PENDING_RESCHEDULE' || s.status === 'CANCELLATION_REQUESTED')
    .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate) || a.sessionNumber - b.sessionNumber)

  const rowsForTab  = tab === 'completed' ? completedRows : upcomingRows
  const displayRows = showAll ? rowsForTab : rowsForTab.slice(0, SESSION_PREVIEW)
  const hiddenCount = rowsForTab.length - displayRows.length

  return (
    <div style={{ borderTop: `1px solid ${border.divider}` }}>
      {/* Stats header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <MiniDonut done={completed} total={total} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mb-2">
            <span className="text-xs font-medium" style={{ color: colors.status.success }}>{completed} done</span>
            {missed > 0 && (
              <span className="text-xs font-medium" style={{ color: colors.status.danger }}>{missed} missed</span>
            )}
            <span className="text-xs" style={{ color: colors.text.dim }}>{upcoming} upcoming</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: surface.filterStrip }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, background: colors.status.success }}
              />
            </div>
            <span className="text-[11.5px] font-semibold tabular-nums flex-shrink-0" style={{ color: colors.text.muted }}>
              {pct}%
            </span>
          </div>
        </div>
        <ScoreSparkline sessions={sessions} />
      </div>

      {pendingNotesCount > 0 && (
        <div className="mx-4 mb-3 flex items-center gap-2 rounded-lg px-3 py-2"
          style={{ background: warningAlpha(0.09) }}>
          <AlertTriangle size={13} className="flex-shrink-0" style={{ color: colors.status.warning }} />
          <p className="text-xs font-medium" style={{ color: colors.status.warning }}>
            {pendingNotesCount} session{pendingNotesCount !== 1 ? 's' : ''} past its scheduled time still {pendingNotesCount !== 1 ? 'need' : 'needs'} notes
          </p>
        </div>
      )}

      {/* Completed / Upcoming tabs */}
      <div className="flex gap-2 px-4 pb-3">
        {([
          { key: 'upcoming' as const,  label: 'Upcoming',  count: upcomingRows.length },
          { key: 'completed' as const, label: 'Completed', count: completedRows.length },
        ]).map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => { setTab(t.key); setShowAll(false) }}
            className="rounded-full px-3 py-1.5 text-xs font-medium transition-all"
            style={tab === t.key ? styles.filterTabActive : styles.filterTabInactive}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {/* Session rows */}
      {displayRows.length === 0 ? (
        <div className="px-4 py-6 text-center" style={{ borderTop: `1px solid ${border.divider}` }}>
          <p className="text-xs" style={{ color: colors.text.dim }}>
            {tab === 'completed' ? 'No completed sessions yet.' : 'No upcoming sessions.'}
          </p>
        </div>
      ) : (
        <div style={{ borderTop: `1px solid ${border.divider}` }}>
          {displayRows.map((s, i) => {
            const hasNotes  = !!(s.feedback || s.progressReport || s.notes)
            const clickable = canUpdate
            return (
              <div
                key={s.id}
                onClick={() => clickable && onOpenNotes(s)}
                className="flex items-center gap-3 px-4 py-2.5 transition-colors"
                style={{
                  borderBottom: i < displayRows.length - 1 ? `1px solid ${border.divider}` : 'none',
                  cursor: clickable ? 'pointer' : 'default',
                }}
                onMouseEnter={e => { if (clickable) (e.currentTarget as HTMLElement).style.background = surface.rowHover }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                {sessionRowIcon(s.status)}

                {/* Ad-hoc sessions sit outside the plan's numbered sequence (see the sort
                    comment above) — showing a number for them would imply a chronological
                    ordering promise the data doesn't have, so the "Ad-hoc" badge below
                    labels them instead. */}
                <span className="text-xs font-medium w-8 flex-shrink-0 tabular-nums"
                  style={{ color: colors.text.muted }}>
                  {!s.adHoc && `#${s.sessionNumber}`}
                </span>

                <span className="text-xs truncate" style={{ color: colors.text.muted }}>
                  {format(new Date(s.sessionDate + 'T00:00:00'), 'EEE d MMM')}
                </span>

                {/* An ad-hoc session sits outside the generated block, and how it is paid
                    for is a separate question from whether it happened. */}
                {s.adHoc && (
                  <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
                    style={paletteStyle('blue', 0.12, 0)}>
                    Ad-hoc
                  </span>
                )}
                {s.adHoc && !s.countsTowardPlan && (
                  <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
                    style={s.requiresPayment
                      ? paletteStyle('amber', 0.14, 0)
                      : paletteStyle('green', 0.12, 0)}
                    title={s.requiresPayment
                      ? 'Extra session — the family is charged for this'
                      : 'Extra session — offered at no cost'}>
                    {s.requiresPayment ? 'Payment due' : 'No charge'}
                  </span>
                )}

                <span className="flex-1" />

                {isOverdue(s) ? (
                  <span className="flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: warningAlpha(0.14), color: colors.status.warning }}
                    title="This session's time has passed and it hasn't been marked done — notes are pending">
                    <AlertTriangle size={10} /> Notes overdue
                  </span>
                ) : (
                  <span className="text-[12.65px] font-medium flex-shrink-0"
                    style={{ color: sessionRowStatusColor(s.status) }}>
                    {sessionRowStatusLabel(s.status)}
                  </span>
                )}

                {s.performanceScore != null && <ScorePill score={s.performanceScore} />}

                {hasNotes && (
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: colors.accent }} />
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Show all / show less */}
      {(hiddenCount > 0 || showAll) && (
        <div className="px-4 py-3 flex justify-center" style={{ borderTop: `1px solid ${border.divider}` }}>
          <Button variant="secondary" size="sm" onClick={() => setShowAll(v => !v)}>
            {showAll ? 'Show less' : `Show all ${rowsForTab.length} sessions`}
          </Button>
        </div>
      )}
    </div>
  )
}

// ── SessionNotesModal ──────────────────────────────────────────────────────────

export function SessionNotesModal({
  session,
  canEdit,
  canDirectlyCancel,
  enrollmentId,
  onClose,
  onReschedule,
  cancellationRequested,
  onApproveCancellation,
  onRejectCancellation,
}: {
  session: TherapySessionResponse
  canEdit: boolean
  canDirectlyCancel: boolean
  enrollmentId: string
  onClose: () => void
  /** Calendar-only: renders a "Reschedule session" action when provided. */
  onReschedule?: () => void
  /** Calendar-only: renders the approve/reject block when true and handlers are provided. */
  cancellationRequested?: boolean
  onApproveCancellation?: () => void
  onRejectCancellation?: () => void
}) {
  const qc = useQueryClient()
  const { toast } = useToast()

  const parsedRating = session.feedback ? parseInt(session.feedback, 10) : NaN
  const [rating, setRating]                 = useState(Number.isNaN(parsedRating) ? 0 : parsedRating)
  const [progressReport, setProgressReport] = useState(session.progressReport ?? '')
  const [score, setScore]                   = useState<number | null>(session.performanceScore ?? null)
  const [pendingAction, setPendingAction]   = useState<TherapySessionStatus | 'REQUEST_CANCEL' | null>(null)

  const { data: attachments = [], isLoading: attLoading } = useQuery({
    queryKey: ['session-attachments', session.id],
    queryFn: () => therapySessionsApi.listAttachments(session.id),
  })

  const { data: feedback, isLoading: feedbackLoading } = useQuery({
    queryKey: ['session-feedback', session.id],
    queryFn: () => therapySessionsApi.getFeedback(session.id),
  })

  const [checklistAnswers, setChecklistAnswers] = useState<Map<string, string[]>>(new Map())
  const [checklistNotes, setChecklistNotes]     = useState('')
  const [checklistLoaded, setChecklistLoaded]   = useState(false)
  const [checklistSearch, setChecklistSearch]   = useState('')
  const [detailedOpen, setDetailedOpen]         = useState(false)

  useEffect(() => {
    if (feedback && !checklistLoaded) {
      setChecklistAnswers(new Map(feedback.answers.map(a => [a.questionId, a.selectedOptionIds])))
      setChecklistNotes(feedback.checklistNotes ?? '')
      setChecklistLoaded(true)
    }
  }, [feedback, checklistLoaded])

  const toggleChecklistOption = (questionId: string, optionId: string) => {
    setChecklistAnswers(prev => {
      const next = new Map(prev)
      const current = next.get(questionId) ?? []
      next.set(questionId, current.includes(optionId)
        ? current.filter(id => id !== optionId)
        : [...current, optionId])
      return next
    })
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      if (pendingAction === 'REQUEST_CANCEL') {
        await therapySessionsApi.requestCancellation(session.id)
      } else if (pendingAction) {
        await therapySessionsApi.updateStatus(session.id, { status: pendingAction })
      }
      if (feedback && feedback.template.length > 0) {
        const answers: SessionFeedbackAnswerInput[] = feedback.template.map(q => ({
          questionId: q.id,
          selectedOptionIds: checklistAnswers.get(q.id) ?? [],
        }))
        await therapySessionsApi.updateFeedback(session.id, { answers, checklistNotes })
      }
      return therapySessionsApi.updateNotes(session.id, {
        feedback: rating > 0 ? String(rating) : undefined,
        progressReport,
        ...(score !== null ? { performanceScore: score } : {}),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions', 'enrollment', enrollmentId] })
      qc.invalidateQueries({ queryKey: ['enrollments'] })
      qc.invalidateQueries({ queryKey: ['session-feedback', session.id] })
      toast(pendingAction === 'REQUEST_CANCEL' ? 'Cancellation request sent' : 'Session updated', 'success')
      onClose()
    },
    onError: (err) => toast(getApiError(err, 'Failed to save'), 'error'),
  })

  const uploadMut = useMutation({
    mutationFn: (file: File) => therapySessionsApi.uploadAttachment(session.id, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['session-attachments', session.id] }),
    onError: (err) => toast(getApiError(err, 'Upload failed'), 'error'),
  })

  const deleteMut = useMutation({
    mutationFn: (attachmentId: string) => therapySessionsApi.deleteAttachment(session.id, attachmentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['session-attachments', session.id] }),
    onError: (err) => toast(getApiError(err, 'Delete failed'), 'error'),
  })

  const handleFiles = (files: FileList | null) => {
    if (!files) return
    Array.from(files).forEach(f => uploadMut.mutate(f))
  }

  // Performance Score and Rating are the two fields every session write-up must carry;
  // the checklist below them is optional, additional detail.
  const missingRequired = canEdit && (score === null || rating === 0)

  // Filters the checklist as the therapist types: a header match keeps all its options,
  // otherwise only options whose own text matches are kept (header stays for context).
  const checklistSearchTerm = checklistSearch.trim().toLowerCase()
  const visibleTemplate = feedback && checklistSearchTerm
    ? feedback.template
        .map(q => {
          const headerMatches = q.questionText.toLowerCase().includes(checklistSearchTerm)
          return {
            ...q,
            options: headerMatches ? q.options : q.options.filter(o => o.optionText.toLowerCase().includes(checklistSearchTerm)),
          }
        })
        .filter(q => q.options.length > 0)
    : feedback?.template ?? []

  return (
    <Modal open title={session.adHoc ? 'Ad-hoc Session Notes' : `Session #${session.sessionNumber} Notes`} onClose={onClose} size="lg">
      {/* Session info strip */}
      <div className="flex items-center gap-3 mb-5 p-3 rounded-xl" style={{ background: accentAlpha(0.05) }}>
        <div className="flex-1">
          <p className="text-sm font-semibold" style={{ color: colors.text.heading }}>{session.sessionDate}</p>
          <p className="text-xs mt-0.5" style={{ color: colors.text.muted }}>
            {session.startTime.slice(0, 5)} · {session.programName}
          </p>
          <p className="text-xs mt-0.5" style={{ color: colors.text.muted }}>
            {session.patientFirstName} {session.patientLastName} · {session.therapistFirstName} {session.therapistLastName}
          </p>
        </div>
        <span className="text-[11.5px] px-2 py-1 rounded-full font-medium"
          style={
            session.status === 'COMPLETED' ? paletteStyle('teal', 0.12, 0)
            : session.status === 'CANCELLED' || session.status === 'NO_SHOW' || session.status === 'CANCELLATION_REQUESTED' ? paletteStyle('red', 0.12, 0)
            : paletteStyle('blue', 0.10, 0)
          }>
          {session.status.replace('_', ' ')}
        </span>
      </div>

      <div className="flex flex-col gap-4">
        {/* Performance Score */}
        <PerformanceScoreSlider value={score} onChange={setScore} disabled={!canEdit} required={canEdit} />

        {/* Rating */}
        <div>
          <label className="form-label">
            Rating{canEdit && <span style={{ color: colors.status.danger }}> *</span>}
          </label>
          <div className="flex items-center gap-2">
            <StarRating value={rating} onChange={canEdit ? setRating : undefined} readOnly={!canEdit} />
            {!canEdit && rating === 0 && (
              <span className="text-xs" style={{ color: colors.text.dim }}>Not rated</span>
            )}
          </div>
        </div>

        {missingRequired && (
          <p className="text-xs" style={{ color: colors.status.danger }}>
            Performance Score and Rating are required before this session can be saved.
          </p>
        )}

        {/* Progress Report */}
        <div>
          <label className="form-label">Progress Report</label>
          <textarea
            className="form-input w-full resize-none"
            rows={3}
            placeholder={canEdit ? 'Describe patient progress…' : 'No progress report recorded'}
            value={progressReport}
            onChange={e => setProgressReport(e.target.value)}
            readOnly={!canEdit}
          />
        </div>

        {/* Detailed Feedback Options — the checklist, additional to Performance Score/Rating above;
            only shown when the session's program has a template configured, collapsed by default
            since it's supplementary detail rather than something every save needs to touch. */}
        {!feedbackLoading && feedback && feedback.template.length > 0 && (
          <div className="rounded-xl overflow-hidden" style={{ border: border.card }}>
            <button
              type="button"
              onClick={() => setDetailedOpen(o => !o)}
              className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold transition-colors"
              style={{ color: colors.text.primary, background: detailedOpen ? surface.filterStrip : surface.rowHover }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = accentAlpha(0.08)}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = detailedOpen ? surface.filterStrip : surface.rowHover}
            >
              <span className="flex items-center gap-2">
                Detailed Feedback Options
                {!detailedOpen && (
                  <span className="text-xs font-normal" style={{ color: colors.text.dim }}>
                    ({feedback.template.length} question{feedback.template.length !== 1 ? 's' : ''})
                  </span>
                )}
              </span>
              <ChevronRight
                size={15}
                style={{
                  transform: detailedOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform 0.15s ease',
                  flexShrink: 0,
                }}
              />
            </button>

            {detailedOpen && (
              <div className="flex flex-col gap-4 px-3 pb-3 pt-1" style={{ borderTop: `1px solid ${border.divider}` }}>
                <div className="relative mt-2">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: colors.text.dim }} />
                  <input
                    value={checklistSearch}
                    onChange={e => setChecklistSearch(e.target.value)}
                    placeholder="Search checklist…"
                    className="form-input w-full pl-8"
                  />
                </div>

                {visibleTemplate.length === 0 ? (
                  <p className="text-xs text-center py-3" style={{ color: colors.text.dim }}>No matching items</p>
                ) : visibleTemplate.map(question => (
                  <div key={question.id}>
                    <p className="text-sm font-semibold mb-2" style={{ color: colors.text.primary }}>
                      {question.questionText}
                    </p>
                    <div className="flex flex-col gap-1.5 pl-1">
                      {question.options.map(option => {
                        const checked = (checklistAnswers.get(question.id) ?? []).includes(option.id)
                        return (
                          <label key={option.id} className="flex items-center gap-2 text-sm"
                            style={{ color: colors.text.muted, cursor: canEdit ? 'pointer' : 'default' }}>
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={!canEdit}
                              onChange={() => toggleChecklistOption(question.id, option.id)}
                            />
                            {option.optionText}
                          </label>
                        )
                      })}
                    </div>
                  </div>
                ))}
                <div>
                  <label className="form-label">Additional Notes</label>
                  <textarea
                    className="form-input w-full resize-none"
                    rows={2}
                    placeholder={canEdit ? 'Anything else worth noting…' : 'No additional notes'}
                    value={checklistNotes}
                    onChange={e => setChecklistNotes(e.target.value)}
                    readOnly={!canEdit}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Attachments */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="form-label mb-0">Attachments</label>
            {canEdit && (
              <label className="cursor-pointer flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                style={{ color: colors.accent, background: accentAlpha(0.08) }}>
                {uploadMut.isPending
                  ? <div className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
                  : <Upload size={12} />}
                Upload
                <input
                  type="file"
                  accept="image/*,video/*,.pdf,.doc,.docx"
                  multiple
                  className="hidden"
                  onChange={e => handleFiles(e.target.files)}
                />
              </label>
            )}
          </div>

          {attLoading ? (
            <div className="flex justify-center py-6">
              <div className="h-5 w-5 animate-spin rounded-full border-2" style={{ borderColor: `${colors.accent}30`, borderTopColor: colors.accent }} />
            </div>
          ) : attachments.length === 0 ? (
            <p className="text-xs text-center py-5" style={{ color: colors.text.dim }}>No attachments yet</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {attachments.map((att: SessionAttachmentResponse) => (
                <div key={att.id} className="relative rounded-xl overflow-hidden" style={{ border: border.card }}>
                  {att.contentType?.startsWith('image/') ? (
                    <a href={att.fileUrl} target="_blank" rel="noopener noreferrer">
                      <img src={att.fileUrl} alt={att.fileName} className="w-full h-24 object-cover" />
                    </a>
                  ) : (
                    <a href={att.fileUrl} target="_blank" rel="noopener noreferrer"
                      className="w-full h-24 flex flex-col items-center justify-center gap-1.5 transition-colors"
                      style={{ background: accentAlpha(0.04) }}>
                      <FileText size={20} style={{ color: colors.accent }} />
                      <p className="text-[11.5px] truncate px-2 w-full text-center" style={{ color: colors.text.muted }}>{att.fileName}</p>
                    </a>
                  )}
                  {canEdit && (
                    <button
                      onClick={() => deleteMut.mutate(att.id)}
                      className="absolute top-1 right-1 p-1 rounded-full"
                      style={{ background: 'rgba(0,0,0,0.55)', color: '#fff' }}
                      title="Delete attachment"
                    >
                      <X size={10} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 pt-4" style={{ borderTop: `1px solid ${border.divider}` }}>
        {canEdit && session.status === 'SCHEDULED' && (
          <div className="mb-4">
            <p className="form-label">Mark session as</p>
            <div className="flex gap-2">
              {([
                { value: 'COMPLETED' as TherapySessionStatus, label: 'Completed', color: colors.status.success, alpha: successAlpha },
                { value: 'NO_SHOW'   as TherapySessionStatus, label: 'No Show',   color: colors.status.warning, alpha: warningAlpha },
                ...(canDirectlyCancel
                  ? [{ value: 'CANCELLED' as TherapySessionStatus, label: 'Cancelled', color: colors.status.danger, alpha: dangerAlpha }]
                  : [{ value: 'REQUEST_CANCEL' as const, label: 'Request Cancel', color: colors.status.danger, alpha: dangerAlpha }]),
              ]).map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPendingAction(prev => prev === opt.value ? null : opt.value)}
                  className="flex-1 text-xs font-semibold py-2 rounded-xl border transition-all"
                  style={pendingAction === opt.value
                    ? { background: opt.color, color: '#fff', border: `1px solid ${opt.color}` }
                    : { background: opt.alpha(0.12), color: opt.color, border: `1px solid ${opt.alpha(0.35)}` }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {pendingAction && (
              <p className="text-xs mt-2" style={{ color: colors.text.dim }}>
                Will be {pendingAction === 'REQUEST_CANCEL' ? 'requested for cancellation' : `marked ${pendingAction.replace('_', ' ').toLowerCase()}`} when you save.
              </p>
            )}
          </div>
        )}

        {/* Calendar-only: moving a planned session */}
        {onReschedule && session.status === 'SCHEDULED' && (
          <button
            onClick={onReschedule}
            className="w-full text-sm font-semibold px-3 py-2.5 rounded-xl mb-4 transition-colors"
            style={{ background: accentAlpha(0.10), color: colors.accent }}
          >
            Reschedule session
          </button>
        )}

        {/* Calendar-only: admin approve/reject a pending cancellation */}
        {cancellationRequested && onApproveCancellation && onRejectCancellation && (
          <div className="mb-4">
            <p className="form-label" style={{ color: colors.status.danger }}>Cancellation requested</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={onApproveCancellation}
                className="text-sm font-medium px-3 py-2 rounded-xl text-left"
                style={{ background: dangerAlpha(0.10), color: colors.status.danger }}>
                Approve — Cancel session
              </button>
              <button
                onClick={onRejectCancellation}
                className="text-sm font-medium px-3 py-2 rounded-xl text-left"
                style={{ background: successAlpha(0.10), color: colors.status.success }}>
                Reject — Keep scheduled
              </button>
            </div>
          </div>
        )}

        {saveMut.isError && (
          <div className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm mb-3"
            style={{ background: dangerAlpha(0.08), border: `1px solid ${dangerAlpha(0.2)}` }}>
            <AlertTriangle size={14} style={{ color: colors.status.danger, flexShrink: 0, marginTop: 1 }} />
            <span style={{ color: colors.text.primary }}>
              {getApiError(saveMut.error, 'Failed to save. Nothing was changed — please try again.')}
            </span>
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={onClose}>Close</Button>
          {canEdit && (
            <Button variant="primary" loading={saveMut.isPending} disabled={missingRequired} onClick={() => saveMut.mutate()}>
              Save
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}
