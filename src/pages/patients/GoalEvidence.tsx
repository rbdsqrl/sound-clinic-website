import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Video, Upload, Trash2, CheckCircle2, AlertTriangle, Play } from 'lucide-react'
import { evidenceApi } from '../../api/evidence'
import { iepApi } from '../../api/iep'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Select'
import { Modal } from '../../components/ui/Modal'
import { Badge } from '../../components/ui/Badge'
import { useToast } from '../../hooks/useToast'
import { useAuth } from '../../contexts/AuthContext'
import { getApiError } from '../../lib/apiError'
import { formatDateTimeStr } from '../../lib/format'
import { colors, border, surface, accentAlpha, warningAlpha } from '../../theme'
import type { EvidenceReason, EvidenceResponse, EvidenceSettings, IEPGoalResponse } from '../../types'

export const REASONS: { value: EvidenceReason; label: string }[] = [
  { value: 'DEVICE_PROBLEM',                label: 'Device problem (camera or phone)' },
  { value: 'POOR_NETWORK',                  label: 'Poor or no internet connection' },
  { value: 'STORAGE_FULL',                  label: 'Phone storage is full' },
  { value: 'FILE_TOO_LARGE',                label: 'Video is too large to upload' },
  { value: 'APP_ERROR',                     label: 'App or upload error' },
  { value: 'CHILD_UNWELL_OR_UNCOOPERATIVE', label: 'Child unwell or unable to cooperate' },
  { value: 'NO_CONSENT',                    label: "Parent hasn't given consent to record" },
  { value: 'OTHER',                         label: 'Other (please describe)' },
]
export const reasonLabel = (r: EvidenceReason | null) => REASONS.find(x => x.value === r)?.label ?? '—'

const formatSize = (bytes: number | null) => {
  if (!bytes) return ''
  const mb = bytes / (1024 * 1024)
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}
const formatDuration = (s: number | null) => (s == null ? '' : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`)

/** The organisation's evidence rules; falls back to "1 video, 50 MB, 2 min" until they load. */
export function useEvidenceSettings(): EvidenceSettings {
  const { data } = useQuery({ queryKey: ['evidence-settings'], queryFn: evidenceApi.getSettings, staleTime: 5 * 60 * 1000 })
  return data ?? { videosRequired: 1, maxVideoMb: 50, maxVideoSeconds: 120 }
}

/** The video's length in seconds, or null if the browser can't tell (some phone codecs aren't decodable
 *  here). Never hangs: it gives up after a few seconds so a file the browser can't read still uploads. */
function readVideoDuration(file: File): Promise<number | null> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file)
    const v = document.createElement('video')
    let done = false
    const finish = (value: number | null) => {
      if (done) return
      done = true
      clearTimeout(timer)
      URL.revokeObjectURL(url)
      resolve(value)
    }
    const timer = setTimeout(() => finish(null), 3000)
    v.preload = 'metadata'
    v.onloadedmetadata = () => finish(Number.isFinite(v.duration) ? Math.round(v.duration) : null)
    v.onerror = () => finish(null)
    v.src = url
  })
}

/** Picks a video, checks it against the org's size and length limits, and uploads it right away. */
function VideoUploadButton({ patientId, goalId, rules, onUploaded, onError, label = 'Add video' }: {
  patientId: string
  goalId?: string
  rules: EvidenceSettings
  onUploaded: () => void
  onError: (message: string) => void
  label?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [pct, setPct] = useState<number | null>(null)

  const pick = async (file: File | null) => {
    if (inputRef.current) inputRef.current.value = ''
    if (!file) return
    if (!file.type.startsWith('video/')) { onError('Please choose a video file'); return }
    if (file.size > rules.maxVideoMb * 1024 * 1024) {
      onError(`That video is ${formatSize(file.size)} — the limit is ${rules.maxVideoMb} MB. Trim it, or record why you can't upload.`)
      return
    }
    setPct(-1)
    const duration = await readVideoDuration(file)
    if (duration != null && duration > rules.maxVideoSeconds) {
      setPct(null)
      onError(`That video is ${formatDuration(duration)} long — the limit is ${formatDuration(rules.maxVideoSeconds)}.`)
      return
    }
    setPct(0)
    try {
      await evidenceApi.uploadVideo(patientId, { file, goalId, durationSeconds: duration }, setPct)
      onUploaded()
    } catch (err) {
      onError(getApiError(err, 'The video could not be uploaded. Check your connection and try again.'))
    } finally {
      setPct(null)
    }
  }

  return (
    <label
      className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium cursor-pointer min-h-[44px]"
      style={{ border: `1px solid ${border.divider}`, color: colors.accent, opacity: pct != null ? 0.7 : 1 }}
    >
      <Upload size={14} />
      {pct === -1 ? 'Checking video…' : pct != null ? `Uploading… ${pct}%` : label}
      {/* accept=video/* lets a phone record straight from the camera as well as pick from the gallery */}
      <input ref={inputRef} type="file" accept="video/*" className="hidden" disabled={pct != null}
        onChange={e => pick(e.target.files?.[0] ?? null)} />
    </label>
  )
}

function CannotUploadFields({ reason, text, onReason, onText }: {
  reason: EvidenceReason | ''
  text: string
  onReason: (r: EvidenceReason | '') => void
  onText: (t: string) => void
}) {
  return (
    <div className="space-y-3">
      <Select
        label="Why can't you upload a video?"
        placeholder="Select a reason…"
        value={reason}
        onChange={e => onReason(e.target.value as EvidenceReason | '')}
        options={REASONS.map(r => ({ value: r.value, label: r.label }))}
      />
      {reason && (
        <textarea
          rows={2}
          className="form-input w-full resize-none"
          placeholder={reason === 'OTHER' ? 'Describe what happened (required)' : 'Add detail (optional)'}
          value={text}
          onChange={e => onText(e.target.value)}
        />
      )}
    </div>
  )
}

const goalEvidenceKey = (patientId: string, goalId: string) => ['evidence', patientId, 'goal', goalId]

// ── Completing a goal ─────────────────────────────────────────────────────────

/**
 * The guided way to mark a goal completed. The organisation decides how many videos a goal needs;
 * the therapist adds them here, or records why they can't — both are kept and show up in analytics.
 */
export function CompleteGoalDialog({ patientId, goal, onClose, onCompleted }: {
  patientId: string
  goal: IEPGoalResponse
  onClose: () => void
  onCompleted: () => void
}) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const rules = useEvidenceSettings()
  const [cannot, setCannot] = useState(false)
  const [reason, setReason] = useState<EvidenceReason | ''>('')
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  const { data: items = [] } = useQuery({
    queryKey: goalEvidenceKey(patientId, goal.id),
    queryFn: () => evidenceApi.list(patientId, goal.id),
  })
  const videos = items.filter(i => i.kind === 'VIDEO')
  const required = rules.videosRequired
  const enough = videos.length >= required
  const alreadyExplained = items.some(i => i.kind === 'CANNOT_UPLOAD')
  const reasonOk = !!reason && (reason !== 'OTHER' || text.trim().length > 0)
  const canComplete = required === 0 || enough || alreadyExplained || (cannot && reasonOk)

  const refresh = () => qc.invalidateQueries({ queryKey: ['evidence', patientId] })

  const removeMut = useMutation({
    mutationFn: (id: string) => evidenceApi.remove(patientId, id),
    onSuccess: refresh,
    onError: (err) => setError(getApiError(err, 'Could not remove the video')),
  })

  const completeMut = useMutation({
    mutationFn: async () => {
      if (required > 0 && !enough && !alreadyExplained && cannot) {
        await evidenceApi.cannotUpload(patientId, { reasonCode: reason as EvidenceReason, reasonText: text.trim() || undefined, goalId: goal.id })
      }
      await iepApi.updateGoal(goal.id, { status: 'COMPLETED' })
    },
    onSuccess: () => {
      refresh()
      toast('Goal completed', 'success')
      onCompleted()
    },
    onError: (err) => setError(getApiError(err, 'Could not complete the goal')),
  })

  return (
    <Modal
      open
      onClose={onClose}
      title="Complete goal"
      error={error}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => { setError(null); completeMut.mutate() }} disabled={!canComplete} loading={completeMut.isPending}>
            <CheckCircle2 size={14} /> Complete goal
          </Button>
        </div>
      }
    >
      <p className="text-sm mb-4" style={{ color: colors.text.primary }}>{goal.goalStatement || goal.title}</p>

      {required > 0 ? (
        <div className="rounded-xl p-3 mb-4" style={{ background: accentAlpha(0.06), border: `1px solid ${accentAlpha(0.18)}` }}>
          <p className="text-sm font-medium" style={{ color: colors.text.heading }}>
            Video evidence: {Math.min(videos.length, required)} of {required} added
          </p>
          <p className="text-xs mt-0.5" style={{ color: colors.text.muted }}>
            Record the child working on this goal. Up to {rules.maxVideoMb} MB and {formatDuration(rules.maxVideoSeconds)} each.
          </p>
        </div>
      ) : (
        <p className="text-xs mb-4" style={{ color: colors.text.dim }}>
          Video evidence is optional for this organisation — you can still add some.
        </p>
      )}

      {videos.length > 0 && (
        <div className="space-y-2 mb-3">
          {videos.map(v => (
            <div key={v.id} className="flex items-center justify-between gap-2 rounded-lg px-3 py-2" style={{ border: `1px solid ${border.divider}` }}>
              <div className="min-w-0 flex items-center gap-2">
                <Video size={14} className="flex-shrink-0" style={{ color: colors.accent }} />
                <span className="text-sm truncate" style={{ color: colors.text.primary }}>{v.fileName}</span>
                <span className="text-xs flex-shrink-0" style={{ color: colors.text.dim }}>{formatSize(v.fileSizeBytes)}</span>
              </div>
              <button type="button" aria-label="Remove video" className="p-2 rounded-lg" style={{ color: colors.text.dim }}
                onClick={() => { setError(null); removeMut.mutate(v.id) }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <VideoUploadButton patientId={patientId} goalId={goal.id} rules={rules}
        onUploaded={() => { setError(null); refresh() }} onError={setError}
        label={videos.length > 0 ? 'Add another video' : 'Add video'} />

      {required > 0 && !enough && (
        <div className="mt-5 pt-4" style={{ borderTop: `1px solid ${border.divider}` }}>
          {alreadyExplained ? (
            <p className="text-xs flex items-center gap-1.5" style={{ color: colors.text.muted }}>
              <AlertTriangle size={13} /> You've already recorded why a video couldn't be uploaded for this goal.
            </p>
          ) : (
            <>
              <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: colors.text.primary }}>
                <input type="checkbox" checked={cannot} onChange={e => setCannot(e.target.checked)} />
                I can't upload a video for this goal
              </label>
              {cannot && (
                <div className="mt-3">
                  <CannotUploadFields reason={reason} text={text} onReason={setReason} onText={setText} />
                  <p className="text-xs mt-2" style={{ color: colors.text.dim }}>
                    This is recorded against your name and shown to the clinic in the evidence report.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </Modal>
  )
}

// ── Viewing and adding evidence ───────────────────────────────────────────────

/** A goal's evidence (or, with no goal, general ad hoc evidence): watch, add, record "can't upload", delete. */
export function GoalEvidenceDialog({ patientId, goal, goalOptions, canEdit, onClose }: {
  patientId: string
  /** Show only this goal's evidence and attach new evidence to it. */
  goal?: IEPGoalResponse
  /** Ad hoc mode: let the person pick which goal (or none) a new video belongs to. */
  goalOptions?: { id: string; label: string }[]
  canEdit: boolean
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { user, activeRole } = useAuth()
  const { toast } = useToast()
  const rules = useEvidenceSettings()
  const [chosenGoalId, setChosenGoalId] = useState('')
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [showCannot, setShowCannot] = useState(false)
  const [reason, setReason] = useState<EvidenceReason | ''>('')
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  const targetGoalId = goal?.id ?? (chosenGoalId || undefined)
  const { data: items = [], isLoading } = useQuery({
    queryKey: goal ? goalEvidenceKey(patientId, goal.id) : ['evidence', patientId],
    queryFn: () => evidenceApi.list(patientId, goal?.id),
  })
  const refresh = () => qc.invalidateQueries({ queryKey: ['evidence', patientId] })

  const removeMut = useMutation({
    mutationFn: (id: string) => evidenceApi.remove(patientId, id),
    onSuccess: () => { refresh(); toast('Evidence deleted', 'success') },
    onError: (err) => setError(getApiError(err, 'Could not delete this')),
  })
  const cannotMut = useMutation({
    mutationFn: () => evidenceApi.cannotUpload(patientId, { reasonCode: reason as EvidenceReason, reasonText: text.trim() || undefined, goalId: targetGoalId }),
    onSuccess: () => { refresh(); setShowCannot(false); setReason(''); setText(''); toast('Recorded', 'success') },
    onError: (err) => setError(getApiError(err, 'Could not save this')),
  })

  const canDelete = (e: EvidenceResponse) => canEdit && (e.therapistId === user?.id || activeRole === 'BUSINESS_OWNER' || activeRole === 'CLINIC_HEAD')
  const reasonOk = !!reason && (reason !== 'OTHER' || text.trim().length > 0)

  return (
    <Modal open onClose={onClose} size="lg" error={error}
      title={goal ? 'Video evidence' : 'Add video evidence'}>
      {goal && <p className="text-sm mb-4" style={{ color: colors.text.primary }}>{goal.goalStatement || goal.title}</p>}

      {canEdit && (
        <div className="mb-4 space-y-3">
          {!goal && goalOptions && (
            <Select
              label="Goal (optional)"
              placeholder="Not linked to a goal"
              value={chosenGoalId}
              onChange={e => setChosenGoalId(e.target.value)}
              options={goalOptions.map(g => ({ value: g.id, label: g.label }))}
            />
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <VideoUploadButton patientId={patientId} goalId={targetGoalId} rules={rules}
              onUploaded={() => { setError(null); refresh(); toast('Video added', 'success') }} onError={setError} />
            <Button size="sm" variant="ghost" onClick={() => setShowCannot(v => !v)}>I can't upload a video</Button>
            <span className="text-xs" style={{ color: colors.text.dim }}>
              Up to {rules.maxVideoMb} MB and {formatDuration(rules.maxVideoSeconds)} each
            </span>
          </div>
          {showCannot && (
            <div className="rounded-xl p-3" style={{ border: `1px solid ${border.divider}` }}>
              <CannotUploadFields reason={reason} text={text} onReason={setReason} onText={setText} />
              <div className="flex justify-end mt-3">
                <Button size="sm" disabled={!reasonOk} loading={cannotMut.isPending} onClick={() => { setError(null); cannotMut.mutate() }}>Save reason</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {isLoading ? null : items.length === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: colors.text.dim }}>No evidence recorded yet.</p>
      ) : (
        <div className="space-y-3">
          {items.map(e => (
            <div key={e.id} className="rounded-xl p-3" style={{ border: `1px solid ${border.divider}`, background: surface.card }}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium" style={{ color: colors.text.primary }}>{e.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: colors.text.dim }}>
                    {e.therapistName} · {formatDateTimeStr(e.createdAt)}
                    {e.kind === 'VIDEO' && (e.fileSizeBytes || e.durationSeconds) ? ` · ${[formatDuration(e.durationSeconds), formatSize(e.fileSizeBytes)].filter(Boolean).join(' · ')}` : ''}
                  </p>
                </div>
                {canDelete(e) && (
                  <button type="button" aria-label="Delete" className="p-2 rounded-lg flex-shrink-0" style={{ color: colors.text.dim }}
                    onClick={() => { setError(null); removeMut.mutate(e.id) }}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              {e.kind === 'VIDEO' && e.fileUrl && (
                playingId === e.id ? (
                  <video controls autoPlay className="w-full rounded-lg mt-2" style={{ maxHeight: 320, background: '#000' }}>
                    <source src={e.fileUrl} type={e.contentType ?? undefined} />
                  </video>
                ) : (
                  <button type="button" onClick={() => setPlayingId(e.id)}
                    className="mt-2 flex items-center gap-2 text-xs font-medium rounded-lg px-3 py-2.5"
                    style={{ background: accentAlpha(0.08), color: colors.accent }}>
                    <Play size={13} /> Play video
                  </button>
                )
              )}

              {e.kind === 'CANNOT_UPLOAD' && (
                <div className="mt-2 rounded-lg px-3 py-2 text-xs" style={{ background: warningAlpha(0.10), color: colors.text.primary }}>
                  <Badge variant="amber">Couldn't upload</Badge>
                  <span className="ml-2">{reasonLabel(e.reasonCode)}{e.reasonText ? ` — ${e.reasonText}` : ''}</span>
                </div>
              )}
              {e.note && <p className="text-xs mt-2 whitespace-pre-wrap" style={{ color: colors.text.muted }}>{e.note}</p>}
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
