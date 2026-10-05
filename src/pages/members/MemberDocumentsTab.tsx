import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Upload, X, Trash2, FileText, Image as ImageIcon, Download, FolderOpen } from 'lucide-react'
import { memberDocumentsApi } from '../../api/memberDocuments'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Modal } from '../../components/ui/Modal'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageLoader } from '../../components/ui/Spinner'
import { Panel } from '../analytics/components'
import { useToast } from '../../hooks/useToast'
import { getApiError } from '../../lib/apiError'
import { viewFile } from '../../lib/fileActions'
import { formatDateStr } from '../../lib/format'
import { colors, border, styles, accentAlpha } from '../../theme'
import type { PaletteKey } from '../../theme'
import type { MemberDocumentCategory, MemberDocumentResponse } from '../../types'

const CATEGORIES: { value: MemberDocumentCategory; label: string; badge: PaletteKey }[] = [
  { value: 'IDENTITY_PROOF',      label: 'Identity Proof',      badge: 'blue' },
  { value: 'QUALIFICATION',       label: 'Qualification',       badge: 'green' },
  { value: 'CERTIFICATION',       label: 'Certification',       badge: 'teal' },
  { value: 'EMPLOYMENT_CONTRACT', label: 'Employment Contract', badge: 'purple' },
  { value: 'OTHER',               label: 'Other',               badge: 'slate' },
]
const categoryMeta = (c: MemberDocumentCategory) => CATEGORIES.find(x => x.value === c) ?? CATEGORIES[CATEGORIES.length - 1]

// Mirrors the backend's MemberDocumentController allowlist and size limit.
const MAX_BYTES = 25 * 1024 * 1024
const ACCEPTED = [
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'text/csv',
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic',
].join(',')

function formatSize(bytes: number | null): string {
  if (!bytes) return ''
  const mb = bytes / (1024 * 1024)
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

/**
 * The "Documents" tab on a member's profile — ID proof, qualifications, contracts and any other
 * file kept on their record. HR-sensitive, so the page only mounts this for Business Owner and
 * Clinic Head (the backend enforces the same).
 */
export default function MemberDocumentsTab({ memberId }: { memberId: string }) {
  const { toast } = useToast()
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [filter, setFilter] = useState<MemberDocumentCategory | 'ALL'>('ALL')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [category, setCategory] = useState<MemberDocumentCategory>('IDENTITY_PROOF')
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<MemberDocumentResponse | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['member-documents', memberId],
    queryFn: () => memberDocumentsApi.list(memberId),
    // Download links are presigned for an hour — don't let a long-open tab hand out stale ones.
    staleTime: 30 * 60 * 1000,
  })

  const resetForm = () => {
    setCategory('IDENTITY_PROOF'); setTitle(''); setNotes(''); setFile(null); setUploadError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }
  const closeUpload = () => { setUploadOpen(false); resetForm() }

  const pickFile = (f: File | null) => {
    if (f && f.size > MAX_BYTES) {
      setUploadError('File is too large — the limit is 25 MB')
      if (fileInputRef.current) fileInputRef.current.value = ''
      setFile(null)
      return
    }
    setUploadError(null)
    setFile(f)
  }

  const uploadMut = useMutation({
    mutationFn: () => memberDocumentsApi.upload(memberId, {
      file: file!, category, title: title.trim() || undefined, notes: notes.trim() || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['member-documents', memberId] })
      toast('Document added', 'success')
      closeUpload()
    },
    onError: (err) => setUploadError(getApiError(err, 'Could not upload the document')),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => memberDocumentsApi.remove(memberId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['member-documents', memberId] })
      toast('Document deleted', 'success')
      setToDelete(null)
    },
    onError: (err) => setDeleteError(getApiError(err, 'Could not delete the document')),
  })

  if (isLoading) return <PageLoader />

  const countBy = (c: MemberDocumentCategory) => docs.filter(d => d.category === c).length
  const visible = filter === 'ALL' ? docs : docs.filter(d => d.category === filter)

  return (
    <>
      <Panel
        title={`Documents (${docs.length})`}
        subtitle="Identity proofs, qualifications, contracts and other files kept on this member's record"
        action={<Button size="sm" onClick={() => setUploadOpen(true)}><Upload size={14} /> Upload</Button>}
      >
        {docs.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1 mb-3 flex-wrap">
            {([{ value: 'ALL', label: `All (${docs.length})` },
              ...CATEGORIES.filter(c => countBy(c.value) > 0).map(c => ({ value: c.value, label: `${c.label} (${countBy(c.value)})` })),
            ] as { value: MemberDocumentCategory | 'ALL'; label: string }[]).map(f => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all"
                style={filter === f.value ? styles.filterTabActive : styles.filterTabInactive}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {docs.length === 0 ? (
          <EmptyState
            icon={<FolderOpen size={22} />}
            title="No documents yet"
            description="Upload an ID proof, qualification certificate, contract or any other file for this member."
          />
        ) : (
          <div className="divide-subtle">
            {visible.map(d => {
              const meta = categoryMeta(d.category)
              const isImage = d.contentType?.startsWith('image/')
              return (
                <div key={d.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: accentAlpha(0.08), color: colors.accent }}>
                      {isImage ? <ImageIcon size={16} /> : <FileText size={16} />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium break-words" style={{ color: colors.text.primary }}>{d.title}</p>
                      <div className="flex items-center gap-2 flex-wrap mt-0.5">
                        <Badge variant={meta.badge}>{meta.label}</Badge>
                        <span className="text-xs" style={{ color: colors.text.dim }}>
                          {[formatSize(d.fileSizeBytes), `Added ${formatDateStr(d.createdAt)} by ${d.uploadedByName}`].filter(Boolean).join(' · ')}
                        </span>
                      </div>
                      {d.title !== d.fileName && (
                        <p className="text-xs mt-0.5 break-all" style={{ color: colors.text.dim }}>{d.fileName}</p>
                      )}
                      {d.notes && (
                        <p className="text-xs mt-1 whitespace-pre-wrap" style={{ color: colors.text.muted }}>{d.notes}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 sm:ml-3">
                    <Button size="sm" variant="secondary" onClick={() => viewFile(d.fileUrl)}>
                      <Download size={13} /> View
                    </Button>
                    <Button size="sm" variant="ghost" aria-label={`Delete ${d.title}`}
                      onClick={() => { setDeleteError(null); setToDelete(d) }}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Panel>

      <Modal
        open={uploadOpen}
        onClose={closeUpload}
        title="Upload document"
        error={uploadError}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={closeUpload}>Cancel</Button>
            <Button onClick={() => uploadMut.mutate()} disabled={!file} loading={uploadMut.isPending}>Upload</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Select
            label="Category"
            value={category}
            onChange={e => setCategory(e.target.value as MemberDocumentCategory)}
            options={CATEGORIES.map(c => ({ value: c.value, label: c.label }))}
          />
          <Input
            label="Title (optional)"
            placeholder="Defaults to the file name"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
          <div>
            <span className="form-label">File</span>
            {file ? (
              <div className="inline-flex items-center gap-1.5 rounded-lg pl-2.5 pr-1.5 py-1.5 text-xs font-medium max-w-full"
                style={{ background: accentAlpha(0.08), color: colors.accent }}>
                <FileText size={13} className="flex-shrink-0" />
                <span className="truncate max-w-[220px]">{file.name}</span>
                <span className="flex-shrink-0" style={{ color: colors.text.dim }}>{formatSize(file.size)}</span>
                <button type="button" aria-label="Remove file" className="p-0.5 rounded flex-shrink-0"
                  onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}>
                  <X size={12} />
                </button>
              </div>
            ) : (
              <label className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium cursor-pointer"
                style={{ border: `1px solid ${border.divider}`, color: colors.text.muted }}>
                <Upload size={14} /> Choose a file
                <input ref={fileInputRef} type="file" accept={ACCEPTED} className="hidden"
                  onChange={e => pickFile(e.target.files?.[0] ?? null)} />
              </label>
            )}
            <p className="text-xs mt-1.5" style={{ color: colors.text.dim }}>
              PDF, Word, Excel, PowerPoint, text or image files up to 25 MB.
            </p>
          </div>
          <div>
            <label className="form-label" htmlFor="member-doc-notes">Notes (optional)</label>
            <textarea id="member-doc-notes" rows={2} className="form-input w-full resize-none"
              placeholder="e.g. Valid until March 2028" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>
      </Modal>

      <Modal
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="Delete document"
        size="sm"
        error={deleteError}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setToDelete(null)}>Cancel</Button>
            <Button variant="danger" loading={deleteMut.isPending} onClick={() => toDelete && deleteMut.mutate(toDelete.id)}>
              <Trash2 size={14} /> Delete
            </Button>
          </div>
        }
      >
        <p className="text-sm" style={{ color: colors.text.primary }}>
          Delete <strong>{toDelete?.title}</strong>? The file is removed permanently and can't be recovered.
        </p>
      </Modal>
    </>
  )
}
