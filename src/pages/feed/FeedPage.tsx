import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Newspaper, Plus, Pencil, Trash2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { feedApi } from '../../api/feed'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { PageLoader } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { ToastContainer } from '../../components/ui/Toast'
import { roleBadge } from '../../components/ui/Badge'
import { useToast } from '../../hooks/useToast'
import { getApiError } from '../../lib/apiError'
import { useAuth } from '../../contexts/AuthContext'
import { colors, border, surface, accentAlpha } from '../../theme'
import type { FeedPostResponse } from '../../types'

// ── Post form modal (create + edit) ─────────────────────────────────────────────

function PostFormModal({ post, onClose }: { post: FeedPostResponse | null; onClose: () => void }) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [title, setTitle] = useState(post?.title ?? '')
  const [body, setBody]   = useState(post?.body ?? '')
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => post
      ? feedApi.update(post.id, { title: title.trim(), body: body.trim() || undefined })
      : feedApi.create({ title: title.trim(), body: body.trim() || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feed'] })
      toast(post ? 'Post updated' : 'Post published', 'success')
      onClose()
    },
    onError: (err) => toast(getApiError(err, `Failed to ${post ? 'update' : 'publish'} post`), 'error'),
  })

  const submit = () => {
    if (!title.trim()) { setError('Title is required'); return }
    setError('')
    mutation.mutate()
  }

  return (
    <Modal open title={post ? 'Edit Post' : 'New Post'} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <Input label="Title" value={title} onChange={e => setTitle(e.target.value)}
          error={error} placeholder="What's the update?" />
        <div>
          <label className="form-label">Details</label>
          <textarea className="form-input w-full resize-none" rows={5}
            placeholder="Optional details…" value={body}
            onChange={e => setBody(e.target.value)} />
        </div>
      </div>
      <div className="flex gap-2 justify-end mt-6 pt-4" style={{ borderTop: `1px solid ${border.divider}` }}>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" loading={mutation.isPending} onClick={submit}>
          {post ? 'Save Changes' : 'Publish'}
        </Button>
      </div>
    </Modal>
  )
}

// ── Post card ────────────────────────────────────────────────────────────────

function PostCard({ post, canManage, onEdit, onDelete }: {
  post: FeedPostResponse
  canManage: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="rounded-2xl p-4 md:p-5" style={{ background: surface.card, border: border.card }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold" style={{ color: colors.text.primary }}>{post.title}</h3>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs" style={{ color: colors.text.muted }}>
              {post.authorFirstName} {post.authorLastName}
            </span>
            {roleBadge(post.authorRole)}
            <span className="text-xs" style={{ color: colors.text.dim }}>
              · {format(parseISO(post.createdAt), 'MMM d, yyyy · h:mm a')}
            </span>
          </div>
        </div>
        {canManage && (
          <div className="flex gap-1 flex-shrink-0">
            <button onClick={onEdit} className="p-1.5 rounded-lg" style={{ color: colors.text.dim }} aria-label="Edit post">
              <Pencil size={14} />
            </button>
            <button onClick={onDelete} className="p-1.5 rounded-lg" style={{ color: colors.status.danger }} aria-label="Delete post">
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>
      {post.body && (
        <p className="text-sm mt-3 whitespace-pre-wrap" style={{ color: colors.text.muted }}>{post.body}</p>
      )}
    </div>
  )
}

// ── FeedPage ─────────────────────────────────────────────────────────────────

export default function FeedPage() {
  const { activeRole } = useAuth()
  const qc = useQueryClient()
  const { toasts, toast, dismiss } = useToast()
  const canManage = activeRole === 'BUSINESS_OWNER' || activeRole === 'CLINIC_HEAD'

  const [showForm, setShowForm]       = useState(false)
  const [editingPost, setEditingPost] = useState<FeedPostResponse | null>(null)
  const [deleting, setDeleting]       = useState<FeedPostResponse | null>(null)

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['feed'],
    queryFn: feedApi.list,
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => feedApi.delete(id),
    onSuccess: (_, id) => {
      qc.setQueryData<FeedPostResponse[]>(['feed'], prev => prev?.filter(p => p.id !== id) ?? [])
      setDeleting(null)
      toast('Post deleted', 'success')
    },
    onError: (err) => toast(getApiError(err, 'Failed to delete post'), 'error'),
  })

  if (isLoading) return <PageLoader />

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-3xl mx-auto">
      <ToastContainer toasts={toasts} onDismiss={dismiss} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div className="flex items-center gap-2">
          <Newspaper size={20} style={{ color: colors.accent }} />
          <h1 className="text-xl font-bold" style={{ color: colors.text.heading }}>Feed</h1>
          <span className="text-sm font-medium px-2 py-0.5 rounded-full"
            style={{ background: accentAlpha(0.08), color: colors.accent }}>
            {posts.length}
          </span>
        </div>
        {canManage && (
          <Button variant="primary" onClick={() => { setEditingPost(null); setShowForm(true) }}>
            <Plus size={15} className="mr-1.5" /> New Post
          </Button>
        )}
      </div>

      {posts.length === 0 ? (
        <EmptyState
          icon={<Newspaper size={22} />}
          title="No posts yet"
          description={canManage
            ? 'Post an update and it will show up here and on everyone’s dashboard.'
            : 'Clinic updates from Business Owner and Clinic Head will show up here.'}
          action={canManage ? { label: 'New Post', onClick: () => { setEditingPost(null); setShowForm(true) } } : undefined}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {posts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              canManage={canManage}
              onEdit={() => { setEditingPost(post); setShowForm(true) }}
              onDelete={() => setDeleting(post)}
            />
          ))}
        </div>
      )}

      {showForm && (
        <PostFormModal post={editingPost} onClose={() => { setShowForm(false); setEditingPost(null) }} />
      )}

      {deleting && (
        <Modal open title="Delete post?" onClose={() => setDeleting(null)}>
          <p className="text-sm" style={{ color: colors.text.muted }}>
            This removes "{deleting.title}" for everyone. This can't be undone.
          </p>
          <div className="flex gap-2 justify-end mt-6 pt-4" style={{ borderTop: `1px solid ${border.divider}` }}>
            <Button variant="ghost" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="danger" loading={deleteMut.isPending} onClick={() => deleteMut.mutate(deleting.id)}>
              Delete
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
