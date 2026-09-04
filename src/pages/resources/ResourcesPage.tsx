import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Folder, FolderPlus, Plus, Link2, Video, Image as ImageIcon,
  ChevronRight, Home, Pencil, Trash2, Paperclip, Download, FileText,
} from 'lucide-react'
import { resourcesApi } from '../../api/resources'
import { useAuth } from '../../contexts/AuthContext'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Modal } from '../../components/ui/Modal'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageLoader } from '../../components/ui/Spinner'
import { useToast } from '../../hooks/useToast'
import { ToastContainer } from '../../components/ui/Toast'
import { getApiError } from '../../lib/apiError'
import { colors, border, surface, accentAlpha, styles, paletteStyle, type PaletteKey } from '../../theme'
import type { ResourceResponse, ResourceType, ResourceFolderResponse } from '../../types'

const TYPE_META: Record<ResourceType, { icon: typeof Link2; label: string; color: PaletteKey }> = {
  LINK:  { icon: Link2,     label: 'Link',  color: 'pink' },
  VIDEO: { icon: Video,     label: 'Video', color: 'amber' },
  IMAGE: { icon: ImageIcon, label: 'Image', color: 'blue' },
}

const gridCardStyle = 'rounded-2xl p-4 flex items-center gap-3 cursor-pointer transition-colors'

export default function ResourcesPage() {
  const { activeRole, user } = useAuth()
  const currentRole = activeRole ?? user?.role
  const canManage = ['BUSINESS_OWNER', 'CLINIC_HEAD', 'OFFICE_ADMIN'].includes(currentRole ?? '')

  const [searchParams, setSearchParams] = useSearchParams()
  const folderId = searchParams.get('folder') ?? undefined

  const [folderModalOpen, setFolderModalOpen] = useState(false)
  const [resourceModal, setResourceModal] = useState<{ mode: 'create' } | { mode: 'edit'; resource: ResourceResponse } | null>(null)
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<ResourceFolderResponse | null>(null)
  const [deleteResourceTarget, setDeleteResourceTarget] = useState<ResourceResponse | null>(null)
  const [viewerTarget, setViewerTarget] = useState<ResourceResponse | null>(null)

  const qc = useQueryClient()
  const { toasts, toast, dismiss } = useToast()

  const { data, isLoading } = useQuery({
    queryKey: ['resources', folderId ?? 'root'],
    queryFn: () => resourcesApi.browse(folderId),
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['resources'] })

  const openFolder = (id?: string) => setSearchParams(id ? { folder: id } : {}, { replace: false })

  const deleteFolderMut = useMutation({
    mutationFn: (id: string) => resourcesApi.deleteFolder(id),
    onSuccess: () => { toast('Folder deleted', 'success'); setDeleteFolderTarget(null); invalidate() },
    onError: (err) => toast(getApiError(err, 'Failed to delete folder'), 'error'),
  })

  const deleteResourceMut = useMutation({
    mutationFn: (id: string) => resourcesApi.delete(id),
    onSuccess: () => { toast('Resource deleted', 'success'); setDeleteResourceTarget(null); invalidate() },
    onError: (err) => toast(getApiError(err, 'Failed to delete resource'), 'error'),
  })

  if (isLoading) return <PageLoader />

  const folder = data?.folder ?? null
  const breadcrumb = data?.breadcrumb ?? []
  const subfolders = data?.subfolders ?? []
  const resources = data?.resources ?? []
  const isEmpty = subfolders.length === 0 && resources.length === 0

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg md:text-xl font-bold" style={{ color: colors.text.heading }}>Resources</h1>
          <p className="text-sm mt-0.5" style={{ color: colors.text.muted }}>
            Activities, printables and worksheets for take-home practice
          </p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button variant="secondary" size="sm" onClick={() => setFolderModalOpen(true)}>
              <FolderPlus size={14} /> New Folder
            </Button>
            <Button size="sm" onClick={() => setResourceModal({ mode: 'create' })}>
              <Plus size={14} /> Add Resource
            </Button>
          </div>
        )}
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 flex-wrap text-sm">
        <button
          onClick={() => openFolder(undefined)}
          className="flex items-center gap-1 px-2 py-1 rounded-lg transition-colors"
          style={{ color: folder ? colors.text.muted : colors.accent, fontWeight: folder ? 400 : 600 }}
        >
          <Home size={13} /> Resources
        </button>
        {breadcrumb.map(b => (
          <span key={b.id} className="flex items-center gap-1.5">
            <ChevronRight size={13} style={{ color: colors.text.dim }} />
            <button
              onClick={() => openFolder(b.id)}
              className="px-2 py-1 rounded-lg transition-colors"
              style={{ color: colors.text.muted }}
            >
              {b.name}
            </button>
          </span>
        ))}
        {folder && (
          <span className="flex items-center gap-1.5">
            <ChevronRight size={13} style={{ color: colors.text.dim }} />
            <span className="px-2 py-1 font-semibold" style={{ color: colors.accent }}>{folder.name}</span>
          </span>
        )}
      </div>

      {isEmpty ? (
        <Card>
          <EmptyState
            icon={<Folder size={22} />}
            title="Nothing here yet"
            description={canManage
              ? 'Add a folder to organize resources, or add a link, video, or image directly.'
              : 'No resources have been added here yet.'}
            action={canManage ? { label: 'Add Resource', onClick: () => setResourceModal({ mode: 'create' }) } : undefined}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Resources (links/videos/images) first, folders last within every hierarchy level */}
          {resources.map(r => {
            const meta = TYPE_META[r.type]
            const Icon = meta.icon
            const content = (
              <>
                <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0" style={paletteStyle(meta.color, 0.14, 0)}>
                  <Icon size={17} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate" style={{ color: colors.text.primary }}>{r.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: colors.text.muted }}>{meta.label}</p>
                </div>
                {canManage && (
                  <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.preventDefault()}>
                    <button
                      onClick={() => setResourceModal({ mode: 'edit', resource: r })}
                      className="p-2 rounded-lg transition-colors"
                      style={{ color: colors.text.dim }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = colors.accent}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = colors.text.dim}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => setDeleteResourceTarget(r)}
                      className="p-2 rounded-lg transition-colors"
                      style={{ color: colors.text.dim }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = colors.status.danger}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = colors.text.dim}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </>
            )

            // Files we host (uploaded via "Upload a file instead") open in an in-app viewer
            // with a download option — video/image preview inline. A pasted external link
            // (YouTube, Google Drive, etc.) can't be reliably embedded, so it still opens
            // in a new tab.
            if (r.hosted) {
              return (
                <div
                  key={r.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setViewerTarget(r)}
                  onKeyDown={e => { if (e.key === 'Enter') setViewerTarget(r) }}
                  className={gridCardStyle}
                  style={styles.card}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = surface.rowHover}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = surface.card}
                >
                  {content}
                </div>
              )
            }

            return (
              <a
                key={r.id}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className={gridCardStyle}
                style={styles.card}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = surface.rowHover}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = surface.card}
              >
                {content}
              </a>
            )
          })}

          {subfolders.map(f => (
            <div
              key={f.id}
              onClick={() => openFolder(f.id)}
              role="button"
              tabIndex={0}
              className={gridCardStyle}
              style={styles.card}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = surface.rowHover}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = surface.card}
            >
              <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: accentAlpha(0.10) }}>
                <Folder size={17} style={{ color: colors.accent }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate" style={{ color: colors.text.primary }}>{f.name}</p>
                <p className="text-xs mt-0.5" style={{ color: colors.text.muted }}>
                  {f.subfolderCount > 0 && `${f.subfolderCount} folder${f.subfolderCount !== 1 ? 's' : ''}`}
                  {f.subfolderCount > 0 && f.resourceCount > 0 && ' · '}
                  {(f.resourceCount > 0 || f.subfolderCount === 0) && `${f.resourceCount} resource${f.resourceCount !== 1 ? 's' : ''}`}
                </p>
              </div>
              {canManage && (
                <button
                  onClick={e => { e.stopPropagation(); setDeleteFolderTarget(f) }}
                  className="p-2 rounded-lg transition-colors flex-shrink-0"
                  style={{ color: colors.text.dim }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = colors.status.danger}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = colors.text.dim}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {folderModalOpen && (
        <CreateFolderModal
          parentFolderId={folderId}
          onClose={() => setFolderModalOpen(false)}
          onCreated={() => { setFolderModalOpen(false); invalidate() }}
        />
      )}

      {resourceModal && (
        <ResourceFormModal
          folderId={folderId}
          existing={resourceModal.mode === 'edit' ? resourceModal.resource : undefined}
          onClose={() => setResourceModal(null)}
          onSaved={() => { setResourceModal(null); invalidate() }}
        />
      )}

      {viewerTarget && (
        <ResourceViewerModal resource={viewerTarget} onClose={() => setViewerTarget(null)} />
      )}

      {deleteFolderTarget && (
        <Modal open title="Delete folder" onClose={() => setDeleteFolderTarget(null)}>
          <p className="text-sm" style={{ color: colors.text.muted }}>
            Delete <span style={{ color: colors.text.primary, fontWeight: 600 }}>{deleteFolderTarget.name}</span>?
            {(deleteFolderTarget.subfolderCount > 0 || deleteFolderTarget.resourceCount > 0) && (
              <> This also deletes everything inside it — {deleteFolderTarget.subfolderCount} folder{deleteFolderTarget.subfolderCount !== 1 ? 's' : ''} and {deleteFolderTarget.resourceCount} resource{deleteFolderTarget.resourceCount !== 1 ? 's' : ''}.</>
            )}
          </p>
          <div className="flex gap-2 justify-end mt-6 pt-4" style={{ borderTop: `1px solid ${border.divider}` }}>
            <Button variant="ghost" onClick={() => setDeleteFolderTarget(null)}>Cancel</Button>
            <Button variant="danger" loading={deleteFolderMut.isPending} onClick={() => deleteFolderMut.mutate(deleteFolderTarget.id)}>
              Delete
            </Button>
          </div>
        </Modal>
      )}

      {deleteResourceTarget && (
        <Modal open title="Delete resource" onClose={() => setDeleteResourceTarget(null)}>
          <p className="text-sm" style={{ color: colors.text.muted }}>
            Delete <span style={{ color: colors.text.primary, fontWeight: 600 }}>{deleteResourceTarget.name}</span>?
          </p>
          <div className="flex gap-2 justify-end mt-6 pt-4" style={{ borderTop: `1px solid ${border.divider}` }}>
            <Button variant="ghost" onClick={() => setDeleteResourceTarget(null)}>Cancel</Button>
            <Button variant="danger" loading={deleteResourceMut.isPending} onClick={() => deleteResourceMut.mutate(deleteResourceTarget.id)}>
              Delete
            </Button>
          </div>
        </Modal>
      )}

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}

// ── View a hosted resource in-app ────────────────────────────────────────────

function ResourceViewerModal({ resource, onClose }: { resource: ResourceResponse; onClose: () => void }) {
  return (
    <Modal open title={resource.name} onClose={onClose} size="md">
      {resource.type === 'VIDEO' && (
        <video controls className="w-full rounded-xl mb-3" style={{ maxHeight: 360, background: '#000' }}>
          <source src={resource.url} />
        </video>
      )}

      {resource.type === 'IMAGE' && (
        <img
          src={resource.url}
          alt={resource.name}
          className="w-full rounded-xl mb-3 object-contain"
          style={{ maxHeight: 360, background: surface.filterStrip }}
        />
      )}

      {resource.type === 'LINK' && (
        <div className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 mb-3" style={{ border: `1px solid ${border.divider}` }}>
          <FileText size={16} className="flex-shrink-0" style={{ color: colors.accent }} />
          <span className="text-sm font-medium truncate flex-1" style={{ color: colors.text.primary }}>{resource.name}</span>
        </div>
      )}

      <a
        href={resource.url}
        download
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-all"
        style={{ color: colors.text.muted, border: `1px solid ${border.card}` }}
      >
        <Download size={12} /> Download
      </a>
    </Modal>
  )
}

// ── Create folder ──────────────────────────────────────────────────────────────

function CreateFolderModal({ parentFolderId, onClose, onCreated }: {
  parentFolderId?: string
  onClose: () => void
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const { toast } = useToast()

  const mut = useMutation({
    mutationFn: () => resourcesApi.createFolder({ name: name.trim(), parentFolderId }),
    onSuccess: () => { toast('Folder created', 'success'); onCreated() },
    onError: (err) => setError(getApiError(err, 'Failed to create folder')),
  })

  return (
    <Modal open title="New folder" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <Input label="Folder name" value={name} onChange={e => setName(e.target.value)}
          placeholder="e.g. Alphabet" error={error} autoFocus />
      </div>
      <div className="flex gap-2 justify-end mt-6 pt-4" style={{ borderTop: `1px solid ${border.divider}` }}>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button
          loading={mut.isPending}
          onClick={() => { if (!name.trim()) { setError('Give the folder a name'); return } setError(''); mut.mutate() }}
        >
          Create
        </Button>
      </div>
    </Modal>
  )
}

// ── Create / edit resource ──────────────────────────────────────────────────────

const TYPE_OPTIONS = [
  { value: 'LINK', label: 'Link' },
  { value: 'VIDEO', label: 'Video' },
  { value: 'IMAGE', label: 'Image' },
]

function ResourceFormModal({ folderId, existing, onClose, onSaved }: {
  folderId?: string
  existing?: ResourceResponse
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(existing?.name ?? '')
  const [type, setType] = useState<ResourceType>(existing?.type ?? 'LINK')
  const [url, setUrl] = useState(existing?.url ?? '')
  const [errors, setErrors] = useState<{ name?: string; url?: string }>({})
  const { toast } = useToast()

  const uploadMut = useMutation({
    mutationFn: (file: File) => resourcesApi.uploadFile(file),
    onSuccess: (uploadedUrl) => setUrl(uploadedUrl),
    onError: (err) => toast(getApiError(err, 'Failed to upload file'), 'error'),
  })

  const mut = useMutation({
    mutationFn: () => existing
      ? resourcesApi.update(existing.id, { name: name.trim(), type, url: url.trim() })
      : resourcesApi.create({ name: name.trim(), type, url: url.trim(), folderId }),
    onSuccess: () => { toast(existing ? 'Resource updated' : 'Resource added', 'success'); onSaved() },
    onError: (err) => toast(getApiError(err, 'Failed to save resource'), 'error'),
  })

  function submit() {
    const e: { name?: string; url?: string } = {}
    if (!name.trim()) e.name = 'Give it a readable name'
    if (!url.trim()) e.url = 'A URL is required'
    setErrors(e)
    if (Object.keys(e).length === 0) mut.mutate()
  }

  return (
    <Modal open title={existing ? 'Edit resource' : 'Add resource'} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <Input label="Name" value={name} onChange={e => setName(e.target.value)}
          placeholder="e.g. Alphabet Tracing Worksheets" error={errors.name} autoFocus />
        <Select label="Type" value={type} onChange={e => setType(e.target.value as ResourceType)} options={TYPE_OPTIONS} />
        <Input label="URL" value={url} onChange={e => setUrl(e.target.value)}
          placeholder="https://drive.google.com/..." error={errors.url} />
        <div>
          <label className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border cursor-pointer transition-all"
            style={{ color: colors.text.muted, border: `1px solid ${border.card}` }}>
            <Paperclip size={12} />
            {uploadMut.isPending ? 'Uploading…' : 'Upload a file instead'}
            <input
              type="file"
              className="hidden"
              disabled={uploadMut.isPending}
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) uploadMut.mutate(file)
                e.target.value = ''
              }}
            />
          </label>
          <p className="text-xs mt-2" style={{ color: colors.text.dim }}>
            Opens in a new tab — paste a Google Drive/YouTube/direct link above, or upload any file (image, video, PDF, doc) directly.
          </p>
        </div>
      </div>
      <div className="flex gap-2 justify-end mt-6 pt-4" style={{ borderTop: `1px solid ${border.divider}` }}>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button loading={mut.isPending} onClick={submit}>{existing ? 'Save' : 'Add'}</Button>
      </div>
    </Modal>
  )
}
