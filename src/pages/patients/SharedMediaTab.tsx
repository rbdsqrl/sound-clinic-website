import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Paperclip, Upload, X, Trash2, FileVideo, Image as ImageIcon, FileText, Download, Pin, Play } from 'lucide-react'
import { format } from 'date-fns'
import { sharedMediaApi } from '../../api/sharedMedia'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge, roleBadge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageLoader } from '../../components/ui/Spinner'
import { useToast } from '../../hooks/useToast'
import { getApiError } from '../../lib/apiError'
import { useAuth } from '../../contexts/AuthContext'
import { colors, border, surface, accentAlpha, styles } from '../../theme'
import type { SharedMediaResponse } from '../../types'

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

function formatSize(bytes: number | null): string {
  if (!bytes) return ''
  const mb = bytes / (1024 * 1024)
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`
}

function directionBadge(direction: SharedMediaResponse['direction']) {
  return direction === 'PARENT_TO_CLINIC'
    ? <Badge variant="blue">Shared with clinic</Badge>
    : <Badge variant="green">Shared with family</Badge>
}

function fileKind(contentType: string | null): 'video' | 'image' | 'document' {
  if (contentType?.startsWith('video/')) return 'video'
  if (contentType?.startsWith('image/')) return 'image'
  return 'document'
}

function fileIcon(contentType: string | null) {
  const kind = fileKind(contentType)
  if (kind === 'video') return <FileVideo size={13} className="flex-shrink-0" />
  if (kind === 'image') return <ImageIcon size={13} className="flex-shrink-0" />
  return <FileText size={13} className="flex-shrink-0" />
}

/** Small deterministic tilt per note, so the board looks pinned rather than perfectly gridded. */
function tiltFor(id: string): number {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0
  return ((Math.abs(hash) % 7) - 3) * 0.9 // ~ -2.7deg .. 2.7deg
}

export default function SharedMediaTab({ patientId }: { patientId: string }) {
  const { toast } = useToast()
  const { user } = useAuth()
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [note, setNote] = useState('')
  const [selected, setSelected] = useState<SharedMediaResponse | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

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

  const deleteMut = useMutation({
    mutationFn: (id: string) => sharedMediaApi.remove(patientId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shared-media', patientId] })
      toast('Deleted', 'success')
      setSelected(null)
    },
    onError: (err) => setDeleteError(getApiError(err, 'Failed to delete')),
  })

  if (isLoading) return <PageLoader />

  const canSubmit = !!file || note.trim().length > 0
  const canDelete = (item: SharedMediaResponse) => !!user && (
    user.id === item.uploadedById || user.role === 'BUSINESS_OWNER' || user.role === 'CLINIC_HEAD'
  )

  return (
    <div className="space-y-6">
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

      {!items || items.length === 0 ? (
        <EmptyState
          icon={<Paperclip size={24} />}
          title="Nothing shared yet"
          description="Files and notes shared here are visible to the family and the assigned care team."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-8 pt-2">
          {items.map(item => {
            const kind = item.fileUrl ? fileKind(item.contentType) : null
            return (
              <div
                key={item.id}
                onClick={() => { setDeleteError(null); setSelected(item) }}
                role="button"
                tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter') { setDeleteError(null); setSelected(item) } }}
                className="relative rounded-2xl p-4 pt-6 cursor-pointer transition-all hover:-translate-y-1"
                style={{
                  ...styles.card,
                  transform: `rotate(${tiltFor(item.id)}deg)`,
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

                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <p className="text-xs font-semibold truncate" style={{ color: colors.text.heading }}>{item.uploadedByName}</p>
                  {directionBadge(item.direction)}
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
                  {format(new Date(item.createdAt), 'd MMM yyyy, h:mm a')}
                </p>
              </div>
            )
          })}
        </div>
      )}

      {selected && (
        <Modal open title="Shared note" onClose={() => setSelected(null)} size="md" error={deleteError}>
          <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold" style={{ color: colors.text.heading }}>{selected.uploadedByName}</p>
              {selected.uploadedByRole && roleBadge(selected.uploadedByRole)}
              {directionBadge(selected.direction)}
            </div>
            <span className="text-xs flex-shrink-0" style={{ color: colors.text.dim }}>
              {format(new Date(selected.createdAt), 'd MMM yyyy, h:mm a')}
            </span>
          </div>

          {selected.fileUrl && fileKind(selected.contentType) === 'video' && (
            <video controls className="w-full rounded-xl mb-3" style={{ maxHeight: 360, background: '#000' }}>
              <source src={selected.fileUrl} type={selected.contentType ?? undefined} />
            </video>
          )}

          {selected.fileUrl && fileKind(selected.contentType) === 'image' && (
            <img
              src={selected.fileUrl}
              alt={selected.fileName ?? 'Shared image'}
              className="w-full rounded-xl mb-3 object-contain"
              style={{ maxHeight: 360, background: surface.filterStrip }}
            />
          )}

          {selected.fileUrl && fileKind(selected.contentType) === 'document' && (
            <a
              href={selected.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 mb-3 transition-colors"
              style={{ border: `1px solid ${border.divider}` }}
            >
              <FileText size={16} className="flex-shrink-0" style={{ color: colors.accent }} />
              <span className="text-sm font-medium truncate flex-1" style={{ color: colors.text.primary }}>
                {selected.fileName ?? 'Document'}
              </span>
              <span className="text-xs flex-shrink-0" style={{ color: colors.text.dim }}>
                {formatSize(selected.fileSizeBytes)}
              </span>
              <Download size={13} className="flex-shrink-0" style={{ color: colors.text.muted }} />
            </a>
          )}

          {selected.note && (
            <p className="text-sm whitespace-pre-wrap" style={{ color: colors.text.primary }}>{selected.note}</p>
          )}

          {canDelete(selected) && (
            <div className="flex justify-end mt-5 pt-4" style={{ borderTop: `1px solid ${border.divider}` }}>
              <Button variant="danger" loading={deleteMut.isPending} onClick={() => { setDeleteError(null); deleteMut.mutate(selected.id) }}>
                <Trash2 size={14} /> Delete
              </Button>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
