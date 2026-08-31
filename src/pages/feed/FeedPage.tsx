import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import DOMPurify from 'dompurify'
import {
  Newspaper, Plus, Pencil, Trash2, Bold, Italic, List, ListOrdered,
  ImagePlus, X, Heart, MessageCircle, Eye, Send,
} from 'lucide-react'
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
import type { FeedPostResponse, FeedPostImageResponse, FeedCommentResponse } from '../../types'

// ── Rich text toolbar ────────────────────────────────────────────────────────

function ToolbarButton({ active, onClick, children, label }: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="p-1.5 rounded-lg transition-colors"
      style={active ? { background: accentAlpha(0.14), color: colors.accent } : { color: colors.text.dim }}
    >
      {children}
    </button>
  )
}

function RichTextToolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null
  return (
    <div className="flex items-center gap-0.5 mb-2 pb-2 flex-wrap" style={{ borderBottom: `1px solid ${border.divider}` }}>
      <ToolbarButton label="Bold" active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={14} /></ToolbarButton>
      <ToolbarButton label="Italic" active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={14} /></ToolbarButton>
      <ToolbarButton label="Bullet list" active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={14} /></ToolbarButton>
      <ToolbarButton label="Numbered list" active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={14} /></ToolbarButton>
    </div>
  )
}

// ── Post form modal (create + edit) ─────────────────────────────────────────────

function PostFormModal({ post, onClose }: { post: FeedPostResponse | null; onClose: () => void }) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [title, setTitle]   = useState(post?.title ?? '')
  const [error, setError]   = useState('')
  const [images, setImages] = useState<FeedPostImageResponse[]>(post?.images ?? [])
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [uploading, setUploading]       = useState(false)

  const editor = useEditor({
    extensions: [StarterKit, Placeholder.configure({ placeholder: "What's the update?" })],
    content: post?.body ?? '',
  })

  const uploadImagesMut = useMutation({
    mutationFn: (files: File[]) => feedApi.uploadImages(post!.id, files),
    onSuccess: (uploaded) => setImages(prev => [...prev, ...uploaded]),
    onError: (err) => toast(getApiError(err, 'Failed to upload image'), 'error'),
  })

  const deleteImageMut = useMutation({
    mutationFn: (imageId: string) => feedApi.deleteImage(post!.id, imageId),
    onError: (err) => toast(getApiError(err, 'Failed to remove image'), 'error'),
  })

  const mutation = useMutation({
    mutationFn: async () => {
      const body = editor && !editor.isEmpty ? editor.getHTML() : undefined
      if (post) {
        return feedApi.update(post.id, { title: title.trim(), body })
      }
      const created = await feedApi.create({ title: title.trim(), body })
      if (pendingFiles.length > 0) {
        await feedApi.uploadImages(created.id, pendingFiles)
      }
      return created
    },
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

  const onFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const picked = Array.from(files)
    if (post) {
      setUploading(true)
      await uploadImagesMut.mutateAsync(picked)
      setUploading(false)
    } else {
      setPendingFiles(prev => [...prev, ...picked])
    }
  }

  const removeExistingImage = (imageId: string) => {
    deleteImageMut.mutate(imageId)
    setImages(prev => prev.filter(i => i.id !== imageId))
  }

  const removePendingFile = (idx: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== idx))
  }

  return (
    <Modal open title={post ? 'Edit Post' : 'New Post'} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <Input label="Title" value={title} onChange={e => setTitle(e.target.value)}
          error={error} placeholder="What's the update?" />

        <div>
          <label className="form-label">Details</label>
          <div className="rich-text-editor form-input">
            <RichTextToolbar editor={editor} />
            <EditorContent editor={editor} />
          </div>
        </div>

        <div>
          <label className="form-label">Images</label>
          <div className="flex flex-wrap gap-2">
            {images.map(img => (
              <div key={img.id} className="relative h-16 w-16 rounded-lg overflow-hidden flex-shrink-0" style={{ border: border.card }}>
                <img src={img.fileUrl} alt={img.fileName} className="h-full w-full object-cover" />
                <button type="button" onClick={() => removeExistingImage(img.id)}
                  className="absolute top-0.5 right-0.5 rounded-full p-0.5"
                  style={{ background: 'rgba(0,0,0,0.55)', color: '#fff' }} aria-label="Remove image">
                  <X size={11} />
                </button>
              </div>
            ))}
            {pendingFiles.map((file, idx) => (
              <div key={idx} className="relative h-16 w-16 rounded-lg overflow-hidden flex-shrink-0" style={{ border: border.card }}>
                <img src={URL.createObjectURL(file)} alt={file.name} className="h-full w-full object-cover" />
                <button type="button" onClick={() => removePendingFile(idx)}
                  className="absolute top-0.5 right-0.5 rounded-full p-0.5"
                  style={{ background: 'rgba(0,0,0,0.55)', color: '#fff' }} aria-label="Remove image">
                  <X size={11} />
                </button>
              </div>
            ))}
            <label className="h-16 w-16 rounded-lg flex items-center justify-center cursor-pointer flex-shrink-0 transition-colors"
              style={{ border: `1px dashed ${border.card}`, color: colors.text.dim }}>
              {uploading ? <div className="h-4 w-4 animate-spin rounded-full border border-current border-t-transparent" /> : <ImagePlus size={18} />}
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
                onChange={e => onFilesSelected(e.target.files)} />
            </label>
          </div>
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

// ── Image gallery + lightbox ────────────────────────────────────────────────

function ImageGallery({ images }: { images: FeedPostImageResponse[] }) {
  const [lightbox, setLightbox] = useState<FeedPostImageResponse | null>(null)
  if (images.length === 0) return null

  return (
    <>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-3">
        {images.map(img => (
          <button key={img.id} onClick={() => setLightbox(img)}
            className="aspect-square rounded-lg overflow-hidden" style={{ border: border.card }}>
            <img src={img.fileUrl} alt={img.fileName} className="h-full w-full object-cover" />
          </button>
        ))}
      </div>

      {lightbox && (
        <Modal open title={lightbox.fileName} onClose={() => setLightbox(null)} size="lg">
          <img src={lightbox.fileUrl} alt={lightbox.fileName} className="w-full h-auto rounded-lg" />
        </Modal>
      )}
    </>
  )
}

// ── Comments ─────────────────────────────────────────────────────────────────

function CommentsSection({ postId, canManage, currentUserId }: {
  postId: string
  canManage: boolean
  currentUserId: string
}) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [text, setText] = useState('')

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ['feed-comments', postId],
    queryFn: () => feedApi.listComments(postId),
  })

  const addMut = useMutation({
    mutationFn: () => feedApi.addComment(postId, text.trim()),
    onSuccess: (created) => {
      qc.setQueryData<FeedCommentResponse[]>(['feed-comments', postId], prev => [...(prev ?? []), created])
      qc.setQueryData<FeedPostResponse[]>(['feed'], prev =>
        prev?.map(p => p.id === postId ? { ...p, commentCount: p.commentCount + 1 } : p) ?? [])
      setText('')
    },
    onError: (err) => toast(getApiError(err, 'Failed to add comment'), 'error'),
  })

  const deleteMut = useMutation({
    mutationFn: (commentId: string) => feedApi.deleteComment(postId, commentId),
    onSuccess: (_, commentId) => {
      qc.setQueryData<FeedCommentResponse[]>(['feed-comments', postId], prev => prev?.filter(c => c.id !== commentId) ?? [])
      qc.setQueryData<FeedPostResponse[]>(['feed'], prev =>
        prev?.map(p => p.id === postId ? { ...p, commentCount: Math.max(0, p.commentCount - 1) } : p) ?? [])
    },
    onError: (err) => toast(getApiError(err, 'Failed to delete comment'), 'error'),
  })

  return (
    <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${border.divider}` }}>
      {isLoading ? (
        <p className="text-xs" style={{ color: colors.text.dim }}>Loading comments…</p>
      ) : (
        <div className="flex flex-col gap-2.5 mb-3">
          {comments.map(c => (
            <div key={c.id} className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium" style={{ color: colors.text.primary }}>
                  {c.authorFirstName} {c.authorLastName}
                  <span className="font-normal ml-1.5" style={{ color: colors.text.dim }}>
                    {format(parseISO(c.createdAt), 'MMM d, h:mm a')}
                  </span>
                </p>
                <p className="text-sm mt-0.5" style={{ color: colors.text.muted }}>{c.body}</p>
              </div>
              {(canManage || c.authorId === currentUserId) && (
                <button onClick={() => deleteMut.mutate(c.id)} className="p-1 rounded-lg flex-shrink-0" style={{ color: colors.text.dim }} aria-label="Delete comment">
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}
          {comments.length === 0 && (
            <p className="text-xs" style={{ color: colors.text.dim }}>No comments yet.</p>
          )}
        </div>
      )}

      <div className="flex gap-2 items-center">
        <input
          className="form-input flex-1 text-sm py-1.5"
          placeholder="Add a comment…"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && text.trim()) addMut.mutate() }}
        />
        <button disabled={!text.trim() || addMut.isPending} onClick={() => addMut.mutate()}
          className="p-2 rounded-lg flex-shrink-0 disabled:opacity-40" style={{ background: accentAlpha(0.08), color: colors.accent }}
          aria-label="Send comment">
          <Send size={14} />
        </button>
      </div>
    </div>
  )
}

// ── Post card ────────────────────────────────────────────────────────────────

function PostCard({ post, canManage, currentUserId, onEdit, onDelete }: {
  post: FeedPostResponse
  canManage: boolean
  currentUserId: string
  onEdit: () => void
  onDelete: () => void
}) {
  const qc = useQueryClient()
  const [showComments, setShowComments] = useState(false)

  useEffect(() => {
    feedApi.recordView(post.id).catch(() => {})
    // Fire once per mount — the endpoint is idempotent server-side, so a re-render never double-counts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id])

  const likeMut = useMutation({
    mutationFn: () => post.likedByMe ? feedApi.unlike(post.id) : feedApi.like(post.id),
    onMutate: () => {
      qc.setQueryData<FeedPostResponse[]>(['feed'], prev =>
        prev?.map(p => p.id === post.id
          ? { ...p, likedByMe: !p.likedByMe, likeCount: p.likeCount + (p.likedByMe ? -1 : 1) }
          : p) ?? [])
    },
    onSuccess: (updated) => {
      qc.setQueryData<FeedPostResponse[]>(['feed'], prev => prev?.map(p => p.id === updated.id ? updated : p) ?? [])
    },
  })

  const sanitizedBody = post.body ? DOMPurify.sanitize(post.body) : ''

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

      {sanitizedBody && (
        <div className="rich-text mt-3" style={{ color: colors.text.muted }} dangerouslySetInnerHTML={{ __html: sanitizedBody }} />
      )}

      <ImageGallery images={post.images} />

      <div className="flex items-center gap-4 mt-3 pt-3" style={{ borderTop: `1px solid ${border.divider}` }}>
        <button onClick={() => likeMut.mutate()} className="flex items-center gap-1.5 text-xs font-medium transition-colors"
          style={{ color: post.likedByMe ? colors.status.danger : colors.text.dim }}>
          <Heart size={14} fill={post.likedByMe ? 'currentColor' : 'none'} />
          {post.likeCount}
        </button>
        <button onClick={() => setShowComments(v => !v)} className="flex items-center gap-1.5 text-xs font-medium"
          style={{ color: showComments ? colors.accent : colors.text.dim }}>
          <MessageCircle size={14} />
          {post.commentCount}
        </button>
        <span className="flex items-center gap-1.5 text-xs" style={{ color: colors.text.dim }}>
          <Eye size={14} />
          {post.viewCount}
        </span>
      </div>

      {showComments && <CommentsSection postId={post.id} canManage={canManage} currentUserId={currentUserId} />}
    </div>
  )
}

// ── FeedPage ─────────────────────────────────────────────────────────────────

export default function FeedPage() {
  const { user, activeRole } = useAuth()
  const qc = useQueryClient()
  const { toasts, toast, dismiss } = useToast()
  const canManage = activeRole === 'BUSINESS_OWNER' || activeRole === 'CLINIC_HEAD'
  // Office Admin can post but not edit/delete/moderate — that stays canManage-only.
  const canPost = canManage || activeRole === 'OFFICE_ADMIN'

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
    <div className="max-w-7xl mx-auto">
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
        {canPost && (
          <Button variant="primary" onClick={() => { setEditingPost(null); setShowForm(true) }}>
            <Plus size={15} className="mr-1.5" /> New Post
          </Button>
        )}
      </div>

      <div className="max-w-3xl">
        {posts.length === 0 ? (
          <EmptyState
            icon={<Newspaper size={22} />}
            title="No posts yet"
            description={canPost
              ? 'Post an update and it will show up here and on everyone’s dashboard.'
              : 'Clinic updates from Business Owner and Clinic Head will show up here.'}
            action={canPost ? { label: 'New Post', onClick: () => { setEditingPost(null); setShowForm(true) } } : undefined}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {posts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                canManage={canManage}
                currentUserId={user?.id ?? ''}
                onEdit={() => { setEditingPost(post); setShowForm(true) }}
                onDelete={() => setDeleting(post)}
              />
            ))}
          </div>
        )}
      </div>

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
