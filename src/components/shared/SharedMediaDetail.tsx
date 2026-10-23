import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2, FileVideo, Image as ImageIcon, FileText, Download, Check } from 'lucide-react'
import { sharedMediaApi } from '../../api/sharedMedia'
import { Button } from '../ui/Button'
import { Badge, roleBadge } from '../ui/Badge'
import { Modal } from '../ui/Modal'
import { viewFile } from '../../lib/fileActions'
import { formatDateTimeStr } from '../../lib/format'
import { colors, border, surface } from '../../theme'
import type { Role, SharedMediaResponse } from '../../types'

export function formatSize(bytes: number | null): string {
  if (!bytes) return ''
  const mb = bytes / (1024 * 1024)
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`
}

export function directionBadge(direction: SharedMediaResponse['direction']) {
  return direction === 'PARENT_TO_CLINIC'
    ? <Badge variant="blue">Shared with clinic</Badge>
    : <Badge variant="green">Shared with family</Badge>
}

export function fileKind(contentType: string | null): 'video' | 'image' | 'document' {
  if (contentType?.startsWith('video/')) return 'video'
  if (contentType?.startsWith('image/')) return 'image'
  return 'document'
}

export function fileIcon(contentType: string | null) {
  const kind = fileKind(contentType)
  if (kind === 'video') return <FileVideo size={13} className="flex-shrink-0" />
  if (kind === 'image') return <ImageIcon size={13} className="flex-shrink-0" />
  return <FileText size={13} className="flex-shrink-0" />
}

/** Whether the viewer, in their active role, is who the post was shared *with* — the parent for a
 *  post from the care team, an assigned therapist for a post from a family. Only they can mark it read. */
export function isRecipient(item: Pick<SharedMediaResponse, 'direction' | 'uploadedById'>, role: Role | null | undefined, userId?: string): boolean {
  if (item.uploadedById === userId) return false
  return (item.direction === 'CLINIC_TO_PARENT' && role === 'PARENT')
      || (item.direction === 'PARENT_TO_CLINIC' && role === 'THERAPIST')
}

export function isUnreadForViewer(item: SharedMediaResponse, role: Role | null | undefined, userId?: string): boolean {
  return !item.readAt && isRecipient(item, role, userId)
}

/** A small accent dot marking a post the viewer hasn't opened yet. */
export function UnreadDot({ size = 8 }: { size?: number }) {
  return (
    <span
      aria-label="Unread"
      title="Unread"
      className="inline-block rounded-full flex-shrink-0"
      style={{ width: size, height: size, background: colors.accent }}
    />
  )
}

/** "Unread" or "Read · 23 Oct, 2026, 3:10 PM" — shown to everyone who can see the post. */
export function ReadStatus({ item, withReader = false }: { item: SharedMediaResponse; withReader?: boolean }) {
  if (!item.readAt) {
    return <span className="text-[11px] font-medium" style={{ color: colors.accent }}>Unread</span>
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: colors.text.dim }}>
      <Check size={11} style={{ color: colors.status.success }} />
      Read{withReader && item.readByName ? ` by ${item.readByName}` : ''} · {formatDateTimeStr(item.readAt)}
    </span>
  )
}

/** Opening a post marks it read when the viewer is its recipient; `onUpdated` receives the fresh copy
 *  (with its read time) so an open modal can show it straight away. */
export function useMarkSharedMediaRead(onUpdated?: (item: SharedMediaResponse) => void) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (item: SharedMediaResponse) => sharedMediaApi.markRead(item.patientId, item.id),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['shared-media', updated.patientId] })
      qc.invalidateQueries({ queryKey: ['shared-media-inbox'] })
      onUpdated?.(updated)
    },
  })
}

/** The "Shared note" popup used by the Media & Notes tab and the dashboard notes card. */
export function SharedMediaDetailModal({ item, onClose, title = 'Shared note', onDelete, deleting, error }: {
  item: SharedMediaResponse & { evidence?: { title: string } }
  onClose: () => void
  title?: string
  /** Shown only when given — the tab passes it for posts the viewer may delete. */
  onDelete?: () => void
  deleting?: boolean
  error?: string | null
}) {
  const selected = item
  return (
    <Modal open title={selected.evidence ? 'Video evidence' : title} onClose={onClose} size="md" error={error}>
      {selected.evidence && (
        <p className="text-sm font-semibold mb-3" style={{ color: colors.accent }}>{selected.evidence.title}</p>
      )}
      {selected.patientName && (
        <p className="text-xs mb-2" style={{ color: colors.text.muted }}>About {selected.patientName}</p>
      )}
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold" style={{ color: colors.text.heading }}>{selected.uploadedByName}</p>
          {selected.uploadedByRole && roleBadge(selected.uploadedByRole, selected.uploadedByCustomRole)}
          {directionBadge(selected.direction)}
        </div>
        <span className="text-xs flex-shrink-0" style={{ color: colors.text.dim }}>
          {formatDateTimeStr(selected.createdAt)}
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
        <button
          type="button"
          onClick={() => selected.fileUrl && viewFile(selected.fileUrl)}
          className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 mb-3 transition-colors w-full text-left"
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
        </button>
      )}

      {selected.note && (
        <p className="text-sm whitespace-pre-wrap" style={{ color: colors.text.primary }}>{selected.note}</p>
      )}

      {!selected.evidence && (
        <div className="mt-4"><ReadStatus item={selected} withReader /></div>
      )}

      {onDelete && (
        <div className="flex justify-end mt-5 pt-4" style={{ borderTop: `1px solid ${border.divider}` }}>
          <Button variant="danger" loading={deleting} onClick={onDelete}>
            <Trash2 size={14} /> Delete
          </Button>
        </div>
      )}
    </Modal>
  )
}
