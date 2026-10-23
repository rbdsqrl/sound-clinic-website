import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Paperclip, Upload, X, FileVideo, FileText, Pin, Play } from 'lucide-react'
import { sharedMediaApi } from '../../api/sharedMedia'
import { evidenceApi } from '../../api/evidence'
import { iepApi } from '../../api/iep'
import { GoalEvidenceDialog } from './GoalEvidence'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageLoader } from '../../components/ui/Spinner'
import { useToast } from '../../hooks/useToast'
import { getApiError } from '../../lib/apiError'
import { formatDateTimeStr } from '../../lib/format'
import {
  SharedMediaDetailModal, ReadStatus, UnreadDot, useMarkSharedMediaRead,
  directionBadge, fileKind, fileIcon, formatSize, isUnreadForViewer,
} from '../../components/shared/SharedMediaDetail'
import { useAuth } from '../../contexts/AuthContext'
import { colors, border, surface, accentAlpha, styles } from '../../theme'
import type { SharedMediaResponse } from '../../types'

/** A Media & Notes card: a shared file/note, or video evidence recorded against an IEP goal. */
type BoardItem = SharedMediaResponse & { evidence?: { title: string } }

/** Ad hoc evidence from the Media & Notes tab — optionally tied to one of the child's IEP goals. */
function AdHocEvidenceDialog({ patientId, onClose }: { patientId: string; onClose: () => void }) {
  const { data: plans = [] } = useQuery({ queryKey: ['iep', patientId], queryFn: () => iepApi.listPlans(patientId) })
  const goalOptions = plans.flatMap(p => p.goals.map(g => ({ id: g.id, label: `${p.title} - ${g.title}` })))
  return <GoalEvidenceDialog patientId={patientId} goalOptions={goalOptions} canEdit onClose={onClose} />
}

// Mirrors the backend's SharedMediaController#SUPPORTED_DOCUMENT_TYPES allowlist.
const ACCEPTED_FILE_TYPES = [
  'video/*', 'image/*',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'text/csv',
].join(',')

/** Small deterministic tilt per note, so the board looks pinned rather than perfectly gridded. */
function tiltFor(id: string): number {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0
  return ((Math.abs(hash) % 7) - 3) * 0.9 // ~ -2.7deg .. 2.7deg
}

export default function SharedMediaTab({ patientId, readOnly = false }: { patientId: string; readOnly?: boolean }) {
  const { toast } = useToast()
  const { user, activeRole } = useAuth()
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [note, setNote] = useState('')
  const [selected, setSelected] = useState<BoardItem | null>(null)
  const [adHocOpen, setAdHocOpen] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Opening a post the viewer is the recipient of records it as read; the modal then shows the read time.
  const markRead = useMarkSharedMediaRead(updated =>
    setSelected(cur => (cur && cur.id === updated.id ? { ...cur, readAt: updated.readAt, readById: updated.readById, readByName: updated.readByName } : cur)))
  const openItem = (item: BoardItem) => {
    setDeleteError(null)
    setSelected(item)
    if (!item.evidence && isUnreadForViewer(item, activeRole, user?.id)) markRead.mutate(item)
  }

  const { data: items, isLoading } = useQuery({
    queryKey: ['shared-media', patientId],
    queryFn: () => sharedMediaApi.list(patientId),
  })

  const uploadMut = useMutation({
    mutationFn: () => sharedMediaApi.upload(patientId, { file: file ?? undefined, note: note.trim() || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shared-media', patientId] })
      setFile(null)
      setNote('')
      if (fileInputRef.current) fileInputRef.current.value = ''
      toast('Shared', 'success')
    },
    onError: (err) => toast(getApiError(err, 'Failed to share'), 'error'),
  })

  // Video evidence recorded against this child's IEP goals appears here too, titled "IEP Plan - Goal".
  // Families see the videos; the "couldn't upload" records stay internal.
  const canSeeEvidence = ['BUSINESS_OWNER', 'CLINIC_HEAD', 'THERAPIST', 'PARENT'].includes(activeRole ?? '')
  const canAddEvidence = !readOnly && ['BUSINESS_OWNER', 'CLINIC_HEAD', 'THERAPIST'].includes(activeRole ?? '')
  const { data: evidence = [] } = useQuery({
    queryKey: ['evidence', patientId],
    queryFn: () => evidenceApi.list(patientId),
    enabled: canSeeEvidence,
  })

  const deleteMut = useMutation({
    mutationFn: (item: BoardItem) => item.evidence
      ? evidenceApi.remove(patientId, item.id.replace(/^ev-/, ''))
      : sharedMediaApi.remove(patientId, item.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shared-media', patientId] })
      qc.invalidateQueries({ queryKey: ['evidence', patientId] })
      toast('Deleted', 'success')
      setSelected(null)
    },
    onError: (err) => setDeleteError(getApiError(err, 'Failed to delete')),
  })

  if (isLoading) return <PageLoader />

  const evidenceItems: BoardItem[] = evidence
    .filter(e => e.kind === 'VIDEO' && e.fileUrl)
    .map(e => ({
      id: `ev-${e.id}`, patientId: e.patientId, direction: 'CLINIC_TO_PARENT' as const,
      fileName: e.fileName, fileUrl: e.fileUrl, contentType: e.contentType, fileSizeBytes: e.fileSizeBytes,
      note: e.note, uploadedById: e.therapistId, uploadedByName: e.therapistName, uploadedByRole: null,
      createdAt: e.createdAt, evidence: { title: e.title },
    }))
  const board: BoardItem[] = [...(items ?? []), ...evidenceItems]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const canSubmit = !!file || note.trim().length > 0
  const canDelete = (item: BoardItem) => !readOnly && !!user && (
    user.id === item.uploadedById || user.role === 'BUSINESS_OWNER' || user.role === 'CLINIC_HEAD'
  )

  return (
    <div className="space-y-6">
      {!readOnly && (
      <Card>
        <p className="text-sm font-semibold mb-2" style={{ color: colors.text.primary }}>Share a file and/or a note</p>
        <p className="text-xs mb-3" style={{ color: colors.text.muted }}>Videos, documents and images are all supported.</p>

        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={2}
          placeholder="Add a note…"
          className="form-input w-full resize-none mb-2"
        />

        <div className="flex items-center justify-between gap-2 flex-wrap">
          {file ? (
            <div className="inline-flex items-center gap-1.5 rounded-lg pl-2.5 pr-1.5 py-1.5 text-xs font-medium max-w-full"
              style={{ background: accentAlpha(0.08), color: colors.accent }}>
              {fileIcon(file.type)}
              <span className="truncate max-w-[160px]">{file.name}</span>
              <span className="flex-shrink-0" style={{ color: colors.text.dim }}>{formatSize(file.size)}</span>
              <button
                type="button"
                onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                className="p-0.5 rounded flex-shrink-0"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <label
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium cursor-pointer flex-shrink-0"
              style={{ border: `1px solid ${border.divider}`, color: colors.text.muted }}
            >
              <Upload size={13} /> Add video, document or image
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_FILE_TYPES}
                className="hidden"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          )}

          <Button
            size="sm"
            onClick={() => uploadMut.mutate()}
            disabled={!canSubmit}
            loading={uploadMut.isPending}
          >
            {uploadMut.isPending ? 'Sharing…' : 'Share'}
          </Button>
        </div>
      </Card>
      )}

      {canAddEvidence && (
        <div className="flex justify-end">
          <Button size="sm" variant="secondary" onClick={() => setAdHocOpen(true)}>
            <FileVideo size={13} /> Add video evidence
          </Button>
        </div>
      )}

      {board.length === 0 ? (
        <EmptyState
          icon={<Paperclip size={24} />}
          title="Nothing shared yet"
          description="Files and notes shared here are visible to the family and the assigned care team."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-8 pt-2">
          {board.map(item => {
            const kind = item.fileUrl ? fileKind(item.contentType) : null
            const unread = !item.evidence && isUnreadForViewer(item, activeRole, user?.id)
            return (
              <div
                key={item.id}
                onClick={() => openItem(item)}
                role="button"
                tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter') openItem(item) }}
                className="relative rounded-2xl p-4 pt-6 cursor-pointer transition-all hover:-translate-y-1"
                style={{
                  ...styles.card,
                  ...(unread ? { background: accentAlpha(0.14), border: `1px solid ${colors.accent}` } : {}),
                  transform: `rotate(${tiltFor(item.id)}deg) translateZ(0)`,
                  boxShadow: '0 8px 20px -8px rgba(0,0,0,0.35)',
                }}
              >
                {/* Pin */}
                <div
                  className="absolute -top-2.5 left-1/2 -translate-x-1/2 h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: colors.accent, boxShadow: '0 2px 5px rgba(0,0,0,0.35)' }}
                >
                  <Pin size={10} fill="#fff" style={{ color: '#fff' }} />
                </div>

                {unread && (
                  <span className="absolute top-3 right-3"><UnreadDot size={10} /></span>
                )}

                {item.evidence && (
                  <p className="text-xs font-semibold mb-1.5 line-clamp-2" style={{ color: colors.accent }}>{item.evidence.title}</p>
                )}
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <p className="text-xs font-semibold truncate" style={{ color: colors.text.heading }}>{item.uploadedByName}</p>
                  {item.evidence ? <Badge variant="purple">Video evidence</Badge> : directionBadge(item.direction)}
                </div>

                {kind === 'image' && item.fileUrl && (
                  <img src={item.fileUrl} alt={item.fileName ?? 'Shared image'}
                    className="w-full h-28 object-cover rounded-lg mb-2.5" style={{ background: surface.filterStrip }} />
                )}

                {kind === 'video' && (
                  <div className="relative w-full h-28 rounded-lg mb-2.5 flex items-center justify-center" style={{ background: '#000' }}>
                    <div className="h-9 w-9 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
                      <Play size={16} fill="#fff" style={{ color: '#fff', marginLeft: 2 }} />
                    </div>
                  </div>
                )}

                {kind === 'document' && (
                  <div className="flex items-center gap-2 rounded-lg px-2.5 py-2 mb-2.5" style={{ border: `1px solid ${border.divider}` }}>
                    <FileText size={14} className="flex-shrink-0" style={{ color: colors.accent }} />
                    <span className="text-xs font-medium truncate" style={{ color: colors.text.primary }}>{item.fileName ?? 'Document'}</span>
                  </div>
                )}

                {item.note ? (
                  <p className="text-sm line-clamp-4 whitespace-pre-wrap" style={{ color: colors.text.primary }}>{item.note}</p>
                ) : (
                  <p className="text-sm italic" style={{ color: colors.text.dim }}>No note — just a file</p>
                )}

                <p className="text-[11px] mt-2.5" style={{ color: colors.text.dim }}>
                  {formatDateTimeStr(item.createdAt)}
                </p>
                {!item.evidence && <div className="mt-1"><ReadStatus item={item} /></div>}
              </div>
            )
          })}
        </div>
      )}

      {selected && (
        <SharedMediaDetailModal
          item={selected}
          onClose={() => setSelected(null)}
          error={deleteError}
          onDelete={canDelete(selected) ? () => { setDeleteError(null); deleteMut.mutate(selected) } : undefined}
          deleting={deleteMut.isPending}
        />
      )}

      {adHocOpen && <AdHocEvidenceDialog patientId={patientId} onClose={() => setAdHocOpen(false)} />}
    </div>
  )
}
