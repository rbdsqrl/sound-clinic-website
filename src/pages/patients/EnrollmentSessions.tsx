import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2, XCircle, AlertTriangle, Circle, Upload, X, FileText,
} from 'lucide-react'
import { therapySessionsApi } from '../../api/therapySessions'
import { PerformanceScoreSlider, ScorePill, scoreColor } from '../../components/ui/PerformanceScore'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../hooks/useToast'
import { getApiError } from '../../lib/apiError'
import { colors, border, surface, accentAlpha, dangerAlpha, paletteStyle } from '../../theme'
import { format } from 'date-fns'
import type { TherapySessionResponse, TherapySessionStatus, SessionAttachmentResponse } from '../../types'

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

  // Sorted by the session's actual date, not its sessionNumber — an ad-hoc session is numbered
  // after the generated block regardless of when it falls, so ordering by number would always
  // push it to the end even when its date sits in the middle of the plan.
  const pastRows = sessions
    .filter(s => s.status !== 'SCHEDULED' && s.status !== 'PENDING_RESCHEDULE' && s.status !== 'CANCELLATION_REQUESTED')
    .sort((a, b) => b.sessionDate.localeCompare(a.sessionDate) || b.sessionNumber - a.sessionNumber)

  const upcomingRows = sessions
    .filter(s => s.status === 'SCHEDULED' || s.status === 'PENDING_RESCHEDULE' || s.status === 'CANCELLATION_REQUESTED')
    .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate) || a.sessionNumber - b.sessionNumber)

  const shownPast     = showAll ? pastRows     : pastRows.slice(0, SESSION_PREVIEW)
  const shownUpcoming = showAll ? upcomingRows : upcomingRows.slice(0, SESSION_PREVIEW)
  const displayRows   = [...shownPast, ...shownUpcoming]

  const hiddenCount = (pastRows.length - shownPast.length) + (upcomingRows.length - shownUpcoming.length)

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

      {/* Session rows */}
      {displayRows.length > 0 && (
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

                <span className="text-[12.65px] font-medium flex-shrink-0"
                  style={{ color: sessionRowStatusColor(s.status) }}>
                  {sessionRowStatusLabel(s.status)}
                </span>

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
            {showAll ? 'Show less' : `Show all ${total} sessions`}
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
}: {
  session: TherapySessionResponse
  canEdit: boolean
  canDirectlyCancel: boolean
  enrollmentId: string
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { toast } = useToast()

  const [feedback, setFeedback]             = useState(session.feedback ?? '')
  const [progressReport, setProgressReport] = useState(session.progressReport ?? '')
  const [notes, setNotes]                   = useState(session.notes ?? '')
  const [score, setScore]                   = useState<number | null>(session.performanceScore ?? null)

  const { data: attachments = [], isLoading: attLoading } = useQuery({
    queryKey: ['session-attachments', session.id],
    queryFn: () => therapySessionsApi.listAttachments(session.id),
  })

  const notesMut = useMutation({
    mutationFn: () => therapySessionsApi.updateNotes(session.id, {
      feedback, progressReport, notes,
      ...(score !== null ? { performanceScore: score } : {}),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions', 'enrollment', enrollmentId] })
      toast('Notes saved', 'success')
      onClose()
    },
    onError: (err) => toast(getApiError(err, 'Failed to save notes'), 'error'),
  })

  const statusMut = useMutation({
    mutationFn: (status: TherapySessionStatus) => therapySessionsApi.updateStatus(session.id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions', 'enrollment', enrollmentId] })
      qc.invalidateQueries({ queryKey: ['enrollments'] })
      toast('Session updated', 'success')
      onClose()
    },
    onError: (err) => toast(getApiError(err, 'Failed to update session'), 'error'),
  })

  const cancelRequestMut = useMutation({
    mutationFn: () => therapySessionsApi.requestCancellation(session.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions', 'enrollment', enrollmentId] })
      toast('Cancellation request sent', 'success')
      onClose()
    },
    onError: (err) => toast(getApiError(err, 'Failed to send request'), 'error'),
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

  return (
    <Modal open title={session.adHoc ? 'Ad-hoc Session Notes' : `Session #${session.sessionNumber} Notes`} onClose={onClose} size="lg">
      {/* Session info strip */}
      <div className="flex items-center gap-3 mb-5 p-3 rounded-xl" style={{ background: accentAlpha(0.05) }}>
        <div className="flex-1">
          <p className="text-sm font-semibold" style={{ color: colors.text.heading }}>{session.sessionDate}</p>
          <p className="text-xs mt-0.5" style={{ color: colors.text.muted }}>
            {session.startTime.slice(0, 5)} · {session.programName}
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
        {/* Status update — only for scheduled sessions */}
        {canEdit && session.status === 'SCHEDULED' && (
          <div>
            <p className="form-label">Mark session as</p>
            <div className="flex gap-2">
              {([
                { value: 'COMPLETED' as TherapySessionStatus, label: 'Completed', color: colors.status.success },
                { value: 'NO_SHOW'   as TherapySessionStatus, label: 'No Show',   color: colors.status.warning },
                ...(canDirectlyCancel
                  ? [{ value: 'CANCELLED' as TherapySessionStatus, label: 'Cancelled', color: colors.status.danger }]
                  : []),
              ]).map(opt => (
                <button
                  key={opt.value}
                  disabled={statusMut.isPending || cancelRequestMut.isPending}
                  onClick={() => statusMut.mutate(opt.value)}
                  className="flex-1 text-xs font-semibold py-2 rounded-xl transition-opacity disabled:opacity-50"
                  style={{ background: opt.color + '18', color: opt.color }}
                >
                  {opt.label}
                </button>
              ))}
              {!canDirectlyCancel && (
                <button
                  disabled={statusMut.isPending || cancelRequestMut.isPending}
                  onClick={() => cancelRequestMut.mutate()}
                  className="flex-1 text-xs font-semibold py-2 rounded-xl transition-opacity disabled:opacity-50"
                  style={{ background: dangerAlpha(0.09), color: colors.status.danger }}
                >
                  Request Cancel
                </button>
              )}
            </div>
          </div>
        )}

        {/* Performance Score */}
        <PerformanceScoreSlider value={score} onChange={setScore} disabled={!canEdit} />

        {/* Feedback */}
        <div>
          <label className="form-label">Feedback</label>
          <textarea
            className="form-input w-full resize-none"
            rows={3}
            placeholder={canEdit ? 'Add session feedback…' : 'No feedback recorded'}
            value={feedback}
            onChange={e => setFeedback(e.target.value)}
            readOnly={!canEdit}
          />
        </div>

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

        {/* Notes */}
        <div>
          <label className="form-label">Notes</label>
          <textarea
            className="form-input w-full resize-none"
            rows={2}
            placeholder={canEdit ? 'Any additional notes…' : 'No notes recorded'}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            readOnly={!canEdit}
          />
        </div>

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
      <div className="flex gap-2 justify-end mt-6 pt-4" style={{ borderTop: `1px solid ${border.divider}` }}>
        <Button variant="ghost" onClick={onClose}>Close</Button>
        {canEdit && (
          <Button variant="primary" loading={notesMut.isPending} onClick={() => notesMut.mutate()}>
            Save Notes
          </Button>
        )}
      </div>
    </Modal>
  )
}
