import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  MessageSquare, Plus, Star, CalendarClock, CheckCircle2, XCircle, Repeat, ChevronDown,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { reviewMeetingsApi } from '../../api/reviewMeetings'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { TimePicker } from '../../components/ui/TimePicker'
import { useToast } from '../../hooks/useToast'
import { getApiError } from '../../lib/apiError'
import {
  colors, border, surface, accentAlpha, dangerAlpha, paletteStyle, palette,
} from '../../theme'
import type { ReviewMeetingResponse } from '../../types'

export const DEFAULT_REVIEW_INTERVAL_WEEKS = 2

// ── Helpers ────────────────────────────────────────────────────────────────────

function meetingStatusStyle(status: ReviewMeetingResponse['status']) {
  if (status === 'COMPLETED') return paletteStyle('teal', 0.12, 0)
  if (status === 'CANCELLED') return paletteStyle('red', 0.12, 0)
  return paletteStyle('blue', 0.12, 0)
}

/** Sentence case reads quieter than a bold uppercase pill on a row that is
 *  almost always SCHEDULED. */
function statusLabel(status: ReviewMeetingResponse['status']) {
  return status.charAt(0) + status.slice(1).toLowerCase()
}

function StarRating({
  value, onChange, readOnly = false,
}: { value: number; onChange?: (v: number) => void; readOnly?: boolean }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(n)}
          className={readOnly ? 'cursor-default' : 'cursor-pointer transition-transform hover:scale-110'}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
        >
          <Star
            size={readOnly ? 14 : 22}
            style={{
              color: n <= value ? palette.yellow.text : colors.text.dim,
              fill: n <= value ? palette.yellow.text : 'transparent',
            }}
          />
        </button>
      ))}
    </div>
  )
}

// ── Panel ──────────────────────────────────────────────────────────────────────

export function ReviewMeetingsPanel({
  enrollmentId,
  enrollmentStartDate,
  enrollmentEndDate,
  therapistId,
  currentUserId,
  canSchedule,
  canGiveTherapistFeedback,
  isParent,
}: {
  enrollmentId: string
  enrollmentStartDate: string
  enrollmentEndDate: string | null
  therapistId: string
  currentUserId: string
  canSchedule: boolean
  canGiveTherapistFeedback: boolean
  isParent: boolean
}) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [feedbackFor, setFeedbackFor] = useState<ReviewMeetingResponse | null>(null)

  const { data: meetings = [], isLoading } = useQuery({
    queryKey: ['review-meetings', enrollmentId],
    queryFn: () => reviewMeetingsApi.listForEnrollment(enrollmentId),
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['review-meetings', enrollmentId] })

  const cancelMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => reviewMeetingsApi.cancel(id, reason),
    onSuccess: () => { invalidate(); toast('Meeting cancelled — attendees notified', 'success') },
    onError: (err) => toast(getApiError(err, 'Failed to cancel meeting'), 'error'),
  })

  const completeMut = useMutation({
    mutationFn: (id: string) => reviewMeetingsApi.complete(id),
    onSuccess: () => { invalidate(); toast('Meeting marked complete', 'success') },
    onError: (err) => toast(getApiError(err, 'Failed to update meeting'), 'error'),
  })

  const active = meetings.filter(m => m.status !== 'CANCELLED')
  const cancelled = meetings.filter(m => m.status === 'CANCELLED')

  return (
    <div className="px-4 pb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <MessageSquare size={13} style={{ color: colors.accent }} />
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.text.muted }}>
            Review meetings
          </p>
          {active.length > 0 && (
            <span className="text-[11.5px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: accentAlpha(0.10), color: colors.accent }}>
              {active.length}
            </span>
          )}
        </div>
        {canSchedule && (
          <div className="flex items-center gap-1.5">
            {meetings.length === 0 ? (
              <button
                onClick={() => setScheduleOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold"
                style={{ color: '#fff', background: colors.accent }}>
                <Repeat size={11} /> Schedule reviews
              </button>
            ) : (
              <button
                onClick={() => setAddOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium"
                style={{ color: colors.accent, background: accentAlpha(0.08) }}>
                <Plus size={11} /> Add meeting
              </button>
            )}
          </div>
        )}
      </div>

      {isLoading ? (
        <p className="text-xs" style={{ color: colors.text.dim }}>Loading…</p>
      ) : meetings.length === 0 ? (
        <p className="text-xs" style={{ color: colors.text.dim }}>
          No review meetings scheduled for this plan.
        </p>
      ) : (
        <div className="space-y-1.5">
          {active.map(m => (
            <MeetingRow
              key={m.id}
              meeting={m}
              isParent={isParent}
              canGiveTherapistFeedback={canGiveTherapistFeedback && therapistId === currentUserId}
              canManage={canSchedule}
              onFeedback={() => setFeedbackFor(m)}
              onComplete={() => completeMut.mutate(m.id)}
              onCancel={() => {
                const reason = window.prompt('Reason for cancelling this meeting?') ?? ''
                if (reason !== null) cancelMut.mutate({ id: m.id, reason })
              }}
            />
          ))}
          {cancelled.length > 0 && (
            <p className="text-[12.65px] pt-1" style={{ color: colors.text.dim }}>
              {cancelled.length} cancelled meeting{cancelled.length > 1 ? 's' : ''} hidden
            </p>
          )}
        </div>
      )}

      {scheduleOpen && (
        <ScheduleModal
          enrollmentId={enrollmentId}
          enrollmentStartDate={enrollmentStartDate}
          enrollmentEndDate={enrollmentEndDate}
          onClose={() => setScheduleOpen(false)}
          onDone={() => { setScheduleOpen(false); invalidate() }}
        />
      )}

      {addOpen && (
        <AddMeetingModal
          enrollmentId={enrollmentId}
          onClose={() => setAddOpen(false)}
          onDone={() => { setAddOpen(false); invalidate() }}
        />
      )}

      {feedbackFor && (
        <FeedbackModal
          meeting={feedbackFor}
          isParent={isParent}
          onClose={() => setFeedbackFor(null)}
          onDone={() => { setFeedbackFor(null); invalidate() }}
        />
      )}
    </div>
  )
}

// ── Row ────────────────────────────────────────────────────────────────────────

function MeetingRow({
  meeting, isParent, canGiveTherapistFeedback, canManage, onFeedback, onComplete, onCancel,
}: {
  meeting: ReviewMeetingResponse
  isParent: boolean
  canGiveTherapistFeedback: boolean
  canManage: boolean
  onFeedback: () => void
  onComplete: () => void
  onCancel: () => void
}) {
  const [open, setOpen] = useState(false)

  const mine = isParent ? meeting.parentFeedbackAt : meeting.therapistFeedbackAt
  const canWrite = isParent || canGiveTherapistFeedback

  const responded = [
    meeting.therapistFeedbackAt ? 'therapist' : null,
    meeting.parentFeedbackAt ? 'parent' : null,
  ].filter(Boolean) as string[]

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: surface.card, border: border.card }}>
      <button
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors"
        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = surface.rowHover)}
        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
      >
        <CalendarClock size={14} className="flex-shrink-0" style={{ color: colors.text.dim }} />

        {/* Date and meeting number sit together so the row reads as one unit
            instead of stranding a lone badge on the far side of the card. */}
        <span className="text-sm font-medium truncate" style={{ color: colors.text.primary }}>
          {format(parseISO(meeting.meetingDate), 'EEE, d MMM yyyy')}
        </span>
        <span className="text-xs flex-shrink-0" style={{ color: colors.text.muted }}>
          {meeting.startTime.slice(0, 5)}
        </span>
        <span className="text-xs flex-shrink-0" style={{ color: colors.text.dim }}>
          · Review #{meeting.meetingNumber}
        </span>
        {responded.length > 0 && (
          <span className="text-xs truncate hidden sm:inline" style={{ color: colors.text.dim }}>
            · {responded.join(' & ')} responded
          </span>
        )}

        <span className="flex-1" />

        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full flex-shrink-0"
          style={meetingStatusStyle(meeting.status)}>
          {statusLabel(meeting.status)}
        </span>
        <ChevronDown
          size={14}
          className="flex-shrink-0 transition-transform"
          style={{ color: colors.text.dim, transform: open ? 'rotate(180deg)' : 'none' }}
        />
      </button>

      {open && (
        <div className="px-3 pb-3 pt-1" style={{ borderTop: `1px solid ${border.divider}` }}>

          {/* Therapist's side */}
          <div className="mt-2.5">
            <p className="text-[11.5px] uppercase tracking-wider font-semibold mb-1" style={{ color: colors.text.dim }}>
              Therapist feedback
            </p>
            {meeting.therapistSummary ? (
              <>
                <p className="text-sm" style={{ color: colors.text.primary }}>{meeting.therapistSummary}</p>
                {meeting.therapistProgressNotes && (
                  <p className="text-xs mt-1" style={{ color: colors.text.muted }}>
                    {meeting.therapistProgressNotes}
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs" style={{ color: colors.text.dim }}>
                {meeting.therapistFeedbackAt
                  ? 'Shared — visible once you add your own feedback'
                  : 'Not yet shared'}
              </p>
            )}
          </div>

          {/* Parent's side */}
          <div className="mt-3">
            <p className="text-[11.5px] uppercase tracking-wider font-semibold mb-1" style={{ color: colors.text.dim }}>
              Parent feedback
            </p>
            {meeting.parentRating != null ? (
              <>
                <StarRating value={meeting.parentRating} readOnly />
                {meeting.parentComments && (
                  <p className="text-sm mt-1" style={{ color: colors.text.primary }}>{meeting.parentComments}</p>
                )}
              </>
            ) : (
              <p className="text-xs" style={{ color: colors.text.dim }}>
                {meeting.parentFeedbackAt
                  ? 'Shared — visible once you add your own feedback'
                  : 'Not yet shared'}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {canWrite && meeting.status !== 'CANCELLED' && (
              <button
                onClick={onFeedback}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold"
                style={{ color: '#fff', background: colors.accent }}>
                <MessageSquare size={11} /> {mine ? 'Edit my feedback' : 'Add my feedback'}
              </button>
            )}
            {canManage && meeting.status === 'SCHEDULED' && (
              <>
                <button
                  onClick={onComplete}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium"
                  style={{ color: colors.text.muted, background: surface.filterStrip }}>
                  <CheckCircle2 size={11} /> Mark complete
                </button>
                <button
                  onClick={onCancel}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium"
                  style={{ color: colors.status.error }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = dangerAlpha(0.08)}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                  <XCircle size={11} /> Cancel
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Schedule a recurring series ────────────────────────────────────────────────

export function ScheduleModal({
  enrollmentId, enrollmentStartDate, enrollmentEndDate, onClose, onDone,
}: {
  enrollmentId: string
  enrollmentStartDate: string
  enrollmentEndDate: string | null
  onClose: () => void
  onDone: () => void
}) {
  const { toast } = useToast()
  const [intervalWeeks, setIntervalWeeks] = useState(DEFAULT_REVIEW_INTERVAL_WEEKS)
  const [startTime, setStartTime] = useState('16:00')
  const [duration, setDuration] = useState(30)
  const [firstDate, setFirstDate] = useState('')
  const [endDate, setEndDate] = useState(enrollmentEndDate ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const mut = useMutation({
    mutationFn: () => reviewMeetingsApi.generateSchedule(enrollmentId, {
      startTime,
      durationMinutes: duration,
      intervalWeeks,
      firstMeetingDate: firstDate || undefined,
      endDate: endDate || undefined,
    }),
    onSuccess: (created) => {
      toast(`${created.length} review meeting${created.length !== 1 ? 's' : ''} scheduled — invites sent`, 'success')
      onDone()
    },
    onError: (err) => toast(getApiError(err, 'Failed to schedule review meetings'), 'error'),
  })

  const submit = () => {
    const e: Record<string, string> = {}
    if (!startTime) e.time = 'Pick a time'
    if (!endDate) e.end = 'Pick an end date'
    if (endDate && firstDate && endDate < firstDate) e.end = 'End date is before the first meeting'
    setErrors(e)
    if (Object.keys(e).length === 0) mut.mutate()
  }

  return (
    <Modal open title="Schedule review meetings" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="text-xs" style={{ color: colors.text.muted }}>
          Meetings repeat on this rhythm until the end date, skipping public holidays.
          The therapist and every linked parent get a calendar invite.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label">Repeat every</label>
            <div className="flex items-center gap-2">
              <input
                type="number" min={1} max={26} value={intervalWeeks}
                onChange={e => setIntervalWeeks(Math.max(1, Number(e.target.value)))}
                className="form-input w-full"
              />
              <span className="text-sm" style={{ color: colors.text.muted }}>weeks</span>
            </div>
          </div>
          <div>
            <label className="form-label">Duration</label>
            <div className="flex items-center gap-2">
              <input
                type="number" min={15} max={240} step={15} value={duration}
                onChange={e => setDuration(Math.max(15, Number(e.target.value)))}
                className="form-input w-full"
              />
              <span className="text-sm" style={{ color: colors.text.muted }}>min</span>
            </div>
          </div>
        </div>

        <TimePicker label="Time" value={startTime} onChange={setStartTime} error={errors.time} />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label">First meeting</label>
            <input
              type="date" value={firstDate} min={enrollmentStartDate}
              onChange={e => setFirstDate(e.target.value)}
              className="form-input w-full"
            />
            <p className="text-[12.65px] mt-1" style={{ color: colors.text.dim }}>
              Defaults to {intervalWeeks} week{intervalWeeks > 1 ? 's' : ''} after the therapy starts
            </p>
          </div>
          <div>
            <label className="form-label">Until</label>
            <input
              type="date" value={endDate} min={firstDate || enrollmentStartDate}
              onChange={e => setEndDate(e.target.value)}
              className="form-input w-full"
            />
            {errors.end && <p className="form-error mt-1">{errors.end}</p>}
          </div>
        </div>
      </div>

      <div className="flex gap-2 justify-end mt-6 pt-4" style={{ borderTop: `1px solid ${border.divider}` }}>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" loading={mut.isPending} onClick={submit}>Schedule</Button>
      </div>
    </Modal>
  )
}

// ── Add one meeting ────────────────────────────────────────────────────────────

function AddMeetingModal({
  enrollmentId, onClose, onDone,
}: { enrollmentId: string; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast()
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('16:00')
  const [duration, setDuration] = useState(30)
  const [error, setError] = useState('')

  const mut = useMutation({
    mutationFn: () => reviewMeetingsApi.create({
      enrollmentId, meetingDate: date, startTime, durationMinutes: duration,
    }),
    onSuccess: () => { toast('Meeting scheduled — invites sent', 'success'); onDone() },
    onError: (err) => toast(getApiError(err, 'Failed to schedule meeting'), 'error'),
  })

  return (
    <Modal open title="Add a review meeting" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div>
          <label className="form-label">Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="form-input w-full" />
          {error && <p className="form-error mt-1">{error}</p>}
        </div>
        <TimePicker label="Time" value={startTime} onChange={setStartTime} />
        <div>
          <label className="form-label">Duration (minutes)</label>
          <input
            type="number" min={15} max={240} step={15} value={duration}
            onChange={e => setDuration(Math.max(15, Number(e.target.value)))}
            className="form-input w-full"
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end mt-6 pt-4" style={{ borderTop: `1px solid ${border.divider}` }}>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button
          variant="primary"
          loading={mut.isPending}
          onClick={() => { if (!date) { setError('Pick a date'); return } setError(''); mut.mutate() }}>
          Schedule
        </Button>
      </div>
    </Modal>
  )
}

// ── Feedback ───────────────────────────────────────────────────────────────────

function FeedbackModal({
  meeting, isParent, onClose, onDone,
}: {
  meeting: ReviewMeetingResponse
  isParent: boolean
  onClose: () => void
  onDone: () => void
}) {
  const { toast } = useToast()
  const [rating, setRating] = useState(meeting.parentRating ?? 0)
  const [comments, setComments] = useState(meeting.parentComments ?? '')
  const [summary, setSummary] = useState(meeting.therapistSummary ?? '')
  const [progressNotes, setProgressNotes] = useState(meeting.therapistProgressNotes ?? '')
  const [error, setError] = useState('')

  const mut = useMutation({
    mutationFn: () => isParent
      ? reviewMeetingsApi.submitParentFeedback(meeting.id, { rating, comments })
      : reviewMeetingsApi.submitTherapistFeedback(meeting.id, { summary, progressNotes }),
    onSuccess: () => { toast('Feedback saved', 'success'); onDone() },
    onError: (err) => toast(getApiError(err, 'Failed to save feedback'), 'error'),
  })

  const submit = () => {
    if (isParent && rating < 1) { setError('Pick a rating'); return }
    if (!isParent && !summary.trim()) { setError('A summary is required'); return }
    setError('')
    mut.mutate()
  }

  return (
    <Modal open title={isParent ? 'Your feedback' : 'Share feedback'} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="text-xs" style={{ color: colors.text.muted }}>
          Review meeting on {format(parseISO(meeting.meetingDate), 'd MMM yyyy')} with {meeting.therapistName}.
        </p>

        {isParent ? (
          <>
            <div>
              <label className="form-label">How was the therapy?</label>
              <StarRating value={rating} onChange={setRating} />
            </div>
            <div>
              <label className="form-label">Comments</label>
              <textarea
                className="form-input w-full resize-none" rows={4}
                placeholder="What has gone well, and what could be better?"
                value={comments}
                onChange={e => setComments(e.target.value)}
              />
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="form-label">Summary</label>
              <textarea
                className="form-input w-full resize-none" rows={3}
                placeholder="How has the patient progressed over this period?"
                value={summary}
                onChange={e => setSummary(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Progress notes</label>
              <textarea
                className="form-input w-full resize-none" rows={3}
                placeholder="Optional detail — goals met, areas to work on…"
                value={progressNotes}
                onChange={e => setProgressNotes(e.target.value)}
              />
            </div>
          </>
        )}

        {error && <p className="form-error">{error}</p>}

        <p className="text-[12.65px]" style={{ color: colors.text.dim }}>
          The other side's feedback becomes visible to you once you submit yours.
        </p>
      </div>

      <div className="flex gap-2 justify-end mt-6 pt-4" style={{ borderTop: `1px solid ${border.divider}` }}>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" loading={mut.isPending} onClick={submit}>Save</Button>
      </div>
    </Modal>
  )
}
