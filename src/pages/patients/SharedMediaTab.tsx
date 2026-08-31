import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Video, Upload, X, Trash2, FileVideo } from 'lucide-react'
import { format } from 'date-fns'
import { sharedMediaApi } from '../../api/sharedMedia'
import { Card, CardHeader } from '../../components/ui/Card'
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
        <CardHeader title="Share a Video or Note" subtitle="Video is optional — you can share a note on its own" />

        <div className="flex flex-col gap-3">
          {video ? (
            <div className="flex items-center gap-3 rounded-xl p-3" style={{ background: accentAlpha(0.06), border: `1px solid ${accentAlpha(0.18)}` }}>
              <FileVideo size={18} style={{ color: colors.accent, flexShrink: 0 }} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate" style={{ color: colors.text.primary }}>{video.name}</p>
                <p className="text-xs" style={{ color: colors.text.dim }}>{formatSize(video.size)}</p>
              </div>
              <button
                type="button"
                onClick={() => { setVideo(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                className="p-1.5 rounded-lg flex-shrink-0"
                style={{ color: colors.text.muted }}
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <label
              className="flex flex-col items-center justify-center gap-2 rounded-xl py-6 cursor-pointer text-center"
              style={{ border: `1.5px dashed ${border.divider}` }}
            >
              <Upload size={20} style={{ color: colors.text.dim }} />
              <span className="text-sm font-medium" style={{ color: colors.text.primary }}>Click to add a video</span>
              <span className="text-xs" style={{ color: colors.text.dim }}>Optional — MP4, MOV, etc.</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={e => setVideo(e.target.files?.[0] ?? null)}
              />
            </label>
          )}

          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={3}
            placeholder="Add a note (optional if you're attaching a video)…"
            className="form-input w-full resize-none"
          />

          <div className="flex justify-end">
            <Button
              onClick={() => uploadMut.mutate()}
              disabled={!canSubmit}
              loading={uploadMut.isPending}
            >
              {uploadMut.isPending ? 'Sharing…' : 'Share'}
            </Button>
          </div>
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
