import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Video, Upload, X, Trash2, FileVideo } from 'lucide-react'
import { format } from 'date-fns'
import { sharedMediaApi } from '../../api/sharedMedia'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge, roleBadge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageLoader } from '../../components/ui/Spinner'
import { ToastContainer } from '../../components/ui/Toast'
import { useToast } from '../../hooks/useToast'
import { getApiError } from '../../lib/apiError'
import { useAuth } from '../../contexts/AuthContext'
import { colors, border, accentAlpha } from '../../theme'
import type { SharedMediaResponse } from '../../types'

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

export default function SharedMediaTab({ patientId }: { patientId: string }) {
  const { toasts, toast, dismiss } = useToast()
  const { user } = useAuth()
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [video, setVideo] = useState<File | null>(null)
  const [note, setNote] = useState('')

  const { data: items, isLoading } = useQuery({
    queryKey: ['shared-media', patientId],
    queryFn: () => sharedMediaApi.list(patientId),
  })

  const uploadMut = useMutation({
    mutationFn: () => sharedMediaApi.upload(patientId, { video: video ?? undefined, note: note.trim() || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shared-media', patientId] })
      setVideo(null)
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
    },
    onError: (err) => toast(getApiError(err, 'Failed to delete'), 'error'),
  })

  if (isLoading) return <PageLoader />

  const canSubmit = !!video || note.trim().length > 0

  return (
    <div className="space-y-4">
      <ToastContainer toasts={toasts} onDismiss={dismiss} />

      <Card>
        <p className="text-sm font-semibold mb-2" style={{ color: colors.text.primary }}>Share a video and/or a note</p>

        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={2}
          placeholder="Add a note…"
          className="form-input w-full resize-none mb-2"
        />

        <div className="flex items-center justify-between gap-2 flex-wrap">
          {video ? (
            <div className="inline-flex items-center gap-1.5 rounded-lg pl-2.5 pr-1.5 py-1.5 text-xs font-medium max-w-full"
              style={{ background: accentAlpha(0.08), color: colors.accent }}>
              <FileVideo size={13} className="flex-shrink-0" />
              <span className="truncate max-w-[160px]">{video.name}</span>
              <span className="flex-shrink-0" style={{ color: colors.text.dim }}>{formatSize(video.size)}</span>
              <button
                type="button"
                onClick={() => { setVideo(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
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
              <Upload size={13} /> Add video
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={e => setVideo(e.target.files?.[0] ?? null)}
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
          icon={<Video size={24} />}
          title="Nothing shared yet"
          description="Videos and notes shared here are visible to the family and the assigned care team."
        />
      ) : (
        <div className="space-y-3">
          {items.map(item => {
            const canDelete = !!user && (
              user.id === item.uploadedById || user.role === 'BUSINESS_OWNER' || user.role === 'CLINIC_HEAD'
            )
            return (
              <div key={item.id} className="rounded-xl p-4" style={{ border: `1px solid ${border.divider}` }}>
                <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold" style={{ color: colors.text.heading }}>{item.uploadedByName}</p>
                    {item.uploadedByRole && roleBadge(item.uploadedByRole)}
                    {directionBadge(item.direction)}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs" style={{ color: colors.text.dim }}>
                      {format(new Date(item.createdAt), 'd MMM yyyy, h:mm a')}
                    </span>
                    {canDelete && (
                      <button
                        onClick={() => deleteMut.mutate(item.id)}
                        className="p-1.5 rounded-lg"
                        style={{ color: colors.status.danger }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {item.fileUrl && (
                  <video controls className="w-full rounded-xl mb-2" style={{ maxHeight: 360, background: '#000' }}>
                    <source src={item.fileUrl} type={item.contentType ?? undefined} />
                  </video>
                )}

                {item.note && (
                  <p className="text-sm whitespace-pre-wrap" style={{ color: colors.text.primary }}>{item.note}</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
