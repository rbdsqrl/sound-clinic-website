import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, CheckCircle2, Circle, Clock, MessageSquare, Paperclip,
  ChevronRight, MoreHorizontal, Trash2, X, Upload, FileText, Send,
  ListTodo,
} from 'lucide-react'
import { tasksApi } from '../../api/tasks'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Modal } from '../../components/ui/Modal'
import { UserSearchPicker } from '../../components/ui/UserSearchPicker'
import { PageLoader } from '../../components/ui/Spinner'
import { ToastContainer } from '../../components/ui/Toast'
import { useToast } from '../../hooks/useToast'
import { useAuth } from '../../contexts/AuthContext'
import { colors, border, surface, accentAlpha, paletteStyle, styles, dangerAlpha, warningAlpha } from '../../theme'
import { format, isPast, parseISO, isToday } from 'date-fns'
import type {
  TaskResponse, TaskStatus, TaskPriority,
  TaskCommentResponse, TaskAttachmentResponse,
  UserResponse,
} from '../../types'

// ── Helpers ────────────────────────────────────────────────────────────────────

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'OPEN',        label: 'Open' },
  { status: 'IN_PROGRESS', label: 'In Progress' },
  { status: 'COMPLETED',   label: 'Completed' },
]

function priorityStyle(p: TaskPriority) {
  if (p === 'HIGH')   return { color: 'var(--color-danger)',  dot: dangerAlpha(1) }
  if (p === 'MEDIUM') return { color: 'var(--color-warning)', dot: warningAlpha(1) }
  return { color: 'var(--text-dim)', dot: 'var(--text-dim)' }
}

function dueDateLabel(d: string | null) {
  if (!d) return null
  const date = parseISO(d)
  if (isToday(date))      return { label: 'Today',    overdue: false }
  if (isPast(date))       return { label: format(date, 'MMM d'), overdue: true }
  return { label: format(date, 'MMM d'), overdue: false }
}

function initials(first: string, last: string) {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase()
}

// ── TaskCard ───────────────────────────────────────────────────────────────────

function TaskCard({
  task,
  canManage,
  onOpen,
  onDelete,
  onDragStart,
}: {
  task: TaskResponse
  canManage: boolean
  onOpen: () => void
  onDelete: () => void
  onDragStart: (e: React.DragEvent) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const due = dueDateLabel(task.dueDate)
  const pStyle = priorityStyle(task.priority)

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onOpen}
      className="rounded-xl p-3 cursor-pointer select-none group transition-shadow"
      style={{
        background: surface.card,
        border: border.card,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      {/* Priority dot + title */}
      <div className="flex items-start gap-2">
        <span className="mt-1.5 h-2 w-2 rounded-full flex-shrink-0" style={{ background: pStyle.dot }} />
        <p className="text-sm font-medium leading-snug flex-1 line-clamp-2" style={{ color: colors.text.primary }}>
          {task.title}
        </p>
        {canManage && (
          <div className="relative flex-shrink-0" onClick={e => { e.stopPropagation(); setMenuOpen(v => !v) }}>
            <button className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ color: colors.text.dim }}>
              <MoreHorizontal size={14} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-6 z-20 rounded-lg py-1 min-w-[110px]"
                style={{ background: surface.card, border: border.card, boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}>
                <button
                  onClick={e => { e.stopPropagation(); setMenuOpen(false); onDelete() }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs transition-colors"
                  style={{ color: 'var(--color-danger)' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = dangerAlpha(0.06)}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                >
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Assignee + meta row */}
      <div className="flex items-center gap-2 mt-2.5 flex-wrap">
        {/* Assignee avatar */}
        <span className="text-[10px] font-bold h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: accentAlpha(0.12), color: colors.accent }}>
          {initials(task.assignedToFirstName, task.assignedToLastName)}
        </span>
        <span className="text-[11px] truncate" style={{ color: colors.text.muted }}>
          {task.assignedToFirstName}
        </span>

        {due && (
          <span className="ml-auto flex items-center gap-1 text-[10px] font-medium"
            style={{ color: due.overdue ? 'var(--color-danger)' : colors.text.dim }}>
            <Clock size={10} />
            {due.label}
          </span>
        )}
      </div>

      {/* Comment / attachment counts */}
      {(task.commentCount > 0 || task.attachmentCount > 0) && (
        <div className="flex items-center gap-3 mt-2 pt-2" style={{ borderTop: `1px solid ${border.divider}` }}>
          {task.commentCount > 0 && (
            <span className="flex items-center gap-1 text-[10px]" style={{ color: colors.text.dim }}>
              <MessageSquare size={10} /> {task.commentCount}
            </span>
          )}
          {task.attachmentCount > 0 && (
            <span className="flex items-center gap-1 text-[10px]" style={{ color: colors.text.dim }}>
              <Paperclip size={10} /> {task.attachmentCount}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ── KanbanColumn ───────────────────────────────────────────────────────────────

function KanbanColumn({
  status,
  label,
  tasks,
  canManage,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onCardDragStart,
  onCardOpen,
  onCardDelete,
  onAddTask,
}: {
  status: TaskStatus
  label: string
  tasks: TaskResponse[]
  canManage: boolean
  isDragOver: boolean
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent) => void
  onCardDragStart: (e: React.DragEvent, task: TaskResponse) => void
  onCardOpen: (task: TaskResponse) => void
  onCardDelete: (task: TaskResponse) => void
  onAddTask?: () => void
}) {
  const colColor = status === 'OPEN'
    ? 'var(--color-info)'
    : status === 'IN_PROGRESS'
    ? 'var(--color-warning)'
    : 'var(--color-success)'

  return (
    <div
      className="flex flex-col rounded-2xl min-h-[200px] transition-colors"
      style={{
        background: isDragOver ? accentAlpha(0.04) : surface.filterStrip,
        border: isDragOver ? `2px dashed ${colors.accent}` : `2px solid transparent`,
      }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: colColor }} />
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.text.muted }}>
            {label}
          </span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
            style={{ background: accentAlpha(0.08), color: colors.accent }}>
            {tasks.length}
          </span>
        </div>
        {canManage && status === 'OPEN' && onAddTask && (
          <button onClick={onAddTask}
            className="p-1 rounded-lg transition-colors"
            style={{ color: colors.text.dim }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = colors.accent}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = colors.text.dim}>
            <Plus size={14} />
          </button>
        )}
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2 px-2 pb-3 flex-1">
        {tasks.map(t => (
          <TaskCard
            key={t.id}
            task={t}
            canManage={canManage}
            onOpen={() => onCardOpen(t)}
            onDelete={() => onCardDelete(t)}
            onDragStart={e => onCardDragStart(e, t)}
          />
        ))}
        {tasks.length === 0 && (
          <div className="flex-1 flex items-center justify-center py-8">
            <p className="text-xs" style={{ color: colors.text.dim }}>No tasks</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── TaskDetailModal ────────────────────────────────────────────────────────────

function TaskDetailModal({
  task,
  canManage,
  currentUserId,
  onClose,
  onStatusChange,
}: {
  task: TaskResponse
  canManage: boolean
  currentUserId: string
  onClose: () => void
  onStatusChange: (status: TaskStatus) => void
}) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [commentText, setCommentText] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: comments = [] } = useQuery({
    queryKey: ['task-comments', task.id],
    queryFn: () => tasksApi.listComments(task.id),
  })

  const { data: attachments = [] } = useQuery({
    queryKey: ['task-attachments', task.id],
    queryFn: () => tasksApi.listAttachments(task.id),
  })

  const commentMut = useMutation({
    mutationFn: () => tasksApi.addComment(task.id, commentText),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-comments', task.id] })
      qc.invalidateQueries({ queryKey: ['tasks'] })
      setCommentText('')
    },
    onError: () => toast('Failed to post comment', 'error'),
  })

  const deleteCommentMut = useMutation({
    mutationFn: (commentId: string) => tasksApi.deleteComment(task.id, commentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-comments', task.id] })
      qc.invalidateQueries({ queryKey: ['tasks'] })
    },
    onError: () => toast('Failed to delete comment', 'error'),
  })

  const uploadMut = useMutation({
    mutationFn: (file: File) => tasksApi.uploadAttachment(task.id, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-attachments', task.id] })
      qc.invalidateQueries({ queryKey: ['tasks'] })
    },
    onError: () => toast('Upload failed', 'error'),
  })

  const deleteAttMut = useMutation({
    mutationFn: (attId: string) => tasksApi.deleteAttachment(task.id, attId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-attachments', task.id] })
      qc.invalidateQueries({ queryKey: ['tasks'] })
    },
    onError: () => toast('Failed to delete file', 'error'),
  })

  const due = dueDateLabel(task.dueDate)
  const pStyle = priorityStyle(task.priority)
  const canEdit = canManage || task.assignedTo === currentUserId

  const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
    { value: 'OPEN',        label: 'Open' },
    { value: 'IN_PROGRESS', label: 'In Progress' },
    { value: 'COMPLETED',   label: 'Completed' },
  ]

  return (
    <Modal open title={task.title} onClose={onClose} size="lg">
      {/* Meta strip */}
      <div className="flex flex-wrap gap-3 mb-5 pb-5" style={{ borderBottom: `1px solid ${border.divider}` }}>
        {/* Status */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase font-semibold tracking-wide" style={{ color: colors.text.dim }}>Status</span>
          {canEdit ? (
            <select
              className="text-xs rounded-lg px-2 py-1.5 font-medium cursor-pointer border-0 outline-none"
              style={{ background: accentAlpha(0.06), color: colors.text.primary }}
              value={task.status}
              onChange={e => onStatusChange(e.target.value as TaskStatus)}
            >
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ) : (
            <span className="text-xs px-2 py-1 rounded-lg font-medium"
              style={task.status === 'COMPLETED' ? paletteStyle('teal', 0.12, 0)
                   : task.status === 'IN_PROGRESS' ? paletteStyle('yellow', 0.12, 0)
                   : paletteStyle('blue', 0.10, 0)}>
              {task.status.replace('_', ' ')}
            </span>
          )}
        </div>

        {/* Priority */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase font-semibold tracking-wide" style={{ color: colors.text.dim }}>Priority</span>
          <span className="text-xs font-medium px-2 py-1.5" style={{ color: pStyle.color }}>
            ● {task.priority}
          </span>
        </div>

        {/* Assigned to */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase font-semibold tracking-wide" style={{ color: colors.text.dim }}>Assigned to</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold h-5 w-5 rounded-full flex items-center justify-center"
              style={{ background: accentAlpha(0.12), color: colors.accent }}>
              {initials(task.assignedToFirstName, task.assignedToLastName)}
            </span>
            <span className="text-xs" style={{ color: colors.text.primary }}>
              {task.assignedToFirstName} {task.assignedToLastName}
            </span>
          </div>
        </div>

        {/* Due date */}
        {due && (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase font-semibold tracking-wide" style={{ color: colors.text.dim }}>Due</span>
            <span className="flex items-center gap-1 text-xs font-medium"
              style={{ color: due.overdue ? 'var(--color-danger)' : colors.text.muted }}>
              <Clock size={11} /> {due.label}{due.overdue ? ' — overdue' : ''}
            </span>
          </div>
        )}
      </div>

      {/* Description */}
      {task.description && (
        <div className="mb-5">
          <p className="text-sm" style={{ color: colors.text.primary, whiteSpace: 'pre-wrap' }}>{task.description}</p>
        </div>
      )}

      {/* Attachments */}
      {attachments.length > 0 && (
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.text.dim }}>Attachments</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {attachments.map((att: TaskAttachmentResponse) => (
              <div key={att.id} className="relative rounded-xl overflow-hidden" style={{ border: border.card }}>
                {att.contentType?.startsWith('image/') ? (
                  <a href={att.fileUrl} target="_blank" rel="noopener noreferrer">
                    <img src={att.fileUrl} alt={att.fileName} className="w-full h-20 object-cover" />
                  </a>
                ) : (
                  <a href={att.fileUrl} target="_blank" rel="noopener noreferrer"
                    className="w-full h-20 flex flex-col items-center justify-center gap-1"
                    style={{ background: accentAlpha(0.04) }}>
                    <FileText size={18} style={{ color: colors.accent }} />
                    <p className="text-[9px] truncate px-1 w-full text-center" style={{ color: colors.text.muted }}>{att.fileName}</p>
                  </a>
                )}
                {(canManage || att.uploadedBy === currentUserId) && (
                  <button onClick={() => deleteAttMut.mutate(att.id)}
                    className="absolute top-1 right-1 p-0.5 rounded-full"
                    style={{ background: 'rgba(0,0,0,0.55)', color: '#fff' }}>
                    <X size={9} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comments */}
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: colors.text.dim }}>
          Comments {comments.length > 0 && `(${comments.length})`}
        </p>
        {comments.length === 0 ? (
          <p className="text-xs text-center py-4" style={{ color: colors.text.dim }}>No comments yet</p>
        ) : (
          <div className="flex flex-col gap-3">
            {comments.map((c: TaskCommentResponse) => (
              <div key={c.id} className="flex gap-2.5 group">
                <span className="text-[10px] font-bold h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: accentAlpha(0.10), color: colors.accent }}>
                  {initials(c.authorFirstName, c.authorLastName)}
                </span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold" style={{ color: colors.text.primary }}>
                      {c.authorFirstName} {c.authorLastName}
                    </span>
                    <span className="text-[10px]" style={{ color: colors.text.dim }}>
                      {format(new Date(c.createdAt), 'MMM d, h:mm a')}
                    </span>
                    {(canManage || c.authorId === currentUserId) && (
                      <button onClick={() => deleteCommentMut.mutate(c.id)}
                        className="ml-auto opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity"
                        style={{ color: colors.text.dim }}>
                        <X size={11} />
                      </button>
                    )}
                  </div>
                  <p className="text-sm mt-0.5" style={{ color: colors.text.muted, whiteSpace: 'pre-wrap' }}>{c.body}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="flex gap-2 items-end pt-4" style={{ borderTop: `1px solid ${border.divider}` }}>
        <textarea
          className="form-input flex-1 resize-none text-sm"
          rows={2}
          placeholder="Add a comment…"
          value={commentText}
          onChange={e => setCommentText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && commentText.trim()) {
              e.preventDefault()
              commentMut.mutate()
            }
          }}
        />
        <div className="flex flex-col gap-1.5">
          <label className="cursor-pointer p-2 rounded-lg flex items-center justify-center transition-colors"
            style={{ background: accentAlpha(0.06), color: colors.accent }}
            title="Attach file">
            {uploadMut.isPending
              ? <div className="h-4 w-4 animate-spin rounded-full border border-current border-t-transparent" />
              : <Upload size={15} />}
            <input ref={fileInputRef} type="file" accept="image/*,video/*,.pdf,.doc,.docx" multiple className="hidden"
              onChange={e => {
                if (e.target.files) Array.from(e.target.files).forEach(f => uploadMut.mutate(f))
              }} />
          </label>
          <button
            disabled={!commentText.trim() || commentMut.isPending}
            onClick={() => commentMut.mutate()}
            className="p-2 rounded-lg flex items-center justify-center transition-colors disabled:opacity-40"
            style={styles.buttonPrimary}
            title="Post comment (⌘+Enter)">
            {commentMut.isPending
              ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              : <Send size={15} />}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── CreateTaskModal ────────────────────────────────────────────────────────────

function CreateTaskModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [title, setTitle]             = useState('')
  const [description, setDescription] = useState('')
  const [assignee, setAssignee]       = useState<UserResponse | null>(null)
  const [dueDate, setDueDate]         = useState('')
  const [priority, setPriority]       = useState<TaskPriority>('MEDIUM')
  const [errors, setErrors]           = useState<Record<string, string>>({})

  const createMut = useMutation({
    mutationFn: () => tasksApi.create({
      title: title.trim(),
      description: description.trim() || undefined,
      assignedTo: assignee!.id,
      dueDate: dueDate || undefined,
      priority,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      toast('Task created', 'success')
      onClose()
    },
    onError: () => toast('Failed to create task', 'error'),
  })

  const submit = () => {
    const e: Record<string, string> = {}
    if (!title.trim()) e.title = 'Title is required'
    if (!assignee)     e.assignee = 'Select an assignee'
    setErrors(e)
    if (Object.keys(e).length === 0) createMut.mutate()
  }

  return (
    <Modal open title="New Task" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <Input
          label="Title"
          value={title}
          onChange={e => setTitle(e.target.value)}
          error={errors.title}
          placeholder="What needs to be done?"
        />
        <div>
          <label className="form-label">Description</label>
          <textarea
            className="form-input w-full resize-none"
            rows={3}
            placeholder="Optional details…"
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>
        <div>
          <label className="form-label">Assign to</label>
          <UserSearchPicker
            selected={assignee}
            onSelect={setAssignee}
            onClear={() => setAssignee(null)}
            placeholder="Search by name or email…"
          />
          {errors.assignee && <p className="form-error mt-1">{errors.assignee}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Due Date"
            type="date"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
          />
          <Select
            label="Priority"
            value={priority}
            onChange={e => setPriority(e.target.value as TaskPriority)}
            options={[
              { value: 'LOW',    label: 'Low' },
              { value: 'MEDIUM', label: 'Medium' },
              { value: 'HIGH',   label: 'High' },
            ]}
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end mt-6 pt-4" style={{ borderTop: `1px solid ${border.divider}` }}>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" loading={createMut.isPending} onClick={submit}>Create Task</Button>
      </div>
    </Modal>
  )
}

// ── TasksPage ──────────────────────────────────────────────────────────────────

export default function TasksPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const { toasts, toast, dismiss } = useToast()

  const canManage = user?.role === 'BUSINESS_OWNER' || user?.role === 'ADMIN'

  const [showCreate, setShowCreate]         = useState(false)
  const [selectedTask, setSelectedTask]     = useState<TaskResponse | null>(null)
  const [mobileTab, setMobileTab]           = useState<TaskStatus>('OPEN')
  const [dragOverCol, setDragOverCol]       = useState<TaskStatus | null>(null)
  const draggingId = useRef<string | null>(null)

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: tasksApi.list,
  })

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) =>
      tasksApi.updateStatus(id, { status }),
    onSuccess: (updated) => {
      qc.setQueryData<TaskResponse[]>(['tasks'], prev =>
        prev?.map(t => t.id === updated.id ? updated : t) ?? []
      )
      if (selectedTask?.id === updated.id) setSelectedTask(updated)
    },
    onError: () => toast('Failed to update task', 'error'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => tasksApi.delete(id),
    onSuccess: (_, id) => {
      qc.setQueryData<TaskResponse[]>(['tasks'], prev => prev?.filter(t => t.id !== id) ?? [])
      if (selectedTask?.id === id) setSelectedTask(null)
      toast('Task deleted', 'success')
    },
    onError: () => toast('Failed to delete task', 'error'),
  })

  // DnD handlers
  const handleDragStart = (e: React.DragEvent, task: TaskResponse) => {
    draggingId.current = task.id
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverCol(status)
  }

  const handleDrop = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault()
    setDragOverCol(null)
    if (!draggingId.current) return
    const task = tasks.find(t => t.id === draggingId.current)
    if (task && task.status !== status) {
      statusMut.mutate({ id: task.id, status })
    }
    draggingId.current = null
  }

  if (isLoading) return <PageLoader />

  const grouped = Object.fromEntries(
    COLUMNS.map(c => [c.status, tasks.filter(t => t.status === c.status)])
  ) as Record<TaskStatus, TaskResponse[]>

  const mobileVisible = tasks.filter(t => t.status === mobileTab)

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      <ToastContainer toasts={toasts} onDismiss={dismiss} />

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div className="flex items-center gap-2">
          <ListTodo size={20} style={{ color: colors.accent }} />
          <h1 className="text-xl font-bold" style={{ color: colors.text.heading }}>
            {canManage ? 'Tasks' : 'My Tasks'}
          </h1>
          <span className="text-sm font-medium px-2 py-0.5 rounded-full"
            style={{ background: accentAlpha(0.08), color: colors.accent }}>
            {tasks.filter(t => t.status !== 'COMPLETED' && t.status !== 'CANCELLED').length} active
          </span>
        </div>
        {canManage && (
          <Button variant="primary" onClick={() => setShowCreate(true)}>
            <Plus size={15} className="mr-1.5" /> New Task
          </Button>
        )}
      </div>

      {/* ── Desktop kanban board ── */}
      <div className="hidden lg:grid grid-cols-3 gap-4">
        {COLUMNS.map(col => (
          <KanbanColumn
            key={col.status}
            status={col.status}
            label={col.label}
            tasks={grouped[col.status] ?? []}
            canManage={canManage}
            isDragOver={dragOverCol === col.status}
            onDragOver={e => handleDragOver(e, col.status)}
            onDragLeave={() => setDragOverCol(null)}
            onDrop={e => handleDrop(e, col.status)}
            onCardDragStart={handleDragStart}
            onCardOpen={setSelectedTask}
            onCardDelete={t => deleteMut.mutate(t.id)}
            onAddTask={() => setShowCreate(true)}
          />
        ))}
      </div>

      {/* ── Mobile tab + list ── */}
      <div className="lg:hidden">
        {/* Tab pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 mb-4">
          {COLUMNS.map(col => {
            const count = grouped[col.status]?.length ?? 0
            const active = mobileTab === col.status
            return (
              <button
                key={col.status}
                onClick={() => setMobileTab(col.status)}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                style={active ? styles.filterTabActive : styles.filterTabInactive}
              >
                {col.label}
                <span className="text-[10px] font-bold px-1 py-0.5 rounded-full"
                  style={{ background: active ? 'rgba(255,255,255,0.25)' : accentAlpha(0.08), color: active ? '#fff' : colors.accent }}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Card list */}
        {mobileVisible.length === 0 ? (
          <div className="flex flex-col items-center py-12 gap-2">
            <CheckCircle2 size={32} style={{ color: colors.text.dim }} />
            <p className="text-sm" style={{ color: colors.text.dim }}>No tasks here</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {mobileVisible.map(task => (
              <div key={task.id} className="rounded-2xl p-4" style={{ background: surface.card, border: border.card }}>
                <div className="flex items-start gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full flex-shrink-0"
                    style={{ background: priorityStyle(task.priority).dot }} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold leading-snug" style={{ color: colors.text.primary }}>{task.title}</p>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <span className="text-xs" style={{ color: colors.text.muted }}>
                        {task.assignedToFirstName} {task.assignedToLastName}
                      </span>
                      {dueDateLabel(task.dueDate) && (
                        <span className="flex items-center gap-1 text-xs"
                          style={{ color: dueDateLabel(task.dueDate)!.overdue ? 'var(--color-danger)' : colors.text.dim }}>
                          <Clock size={10} /> {dueDateLabel(task.dueDate)!.label}
                        </span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => setSelectedTask(task)}
                    className="p-1.5 rounded-lg flex-shrink-0"
                    style={{ color: colors.text.dim }}>
                    <ChevronRight size={16} />
                  </button>
                </div>
                {/* Quick status actions */}
                {(canManage || task.assignedTo === user?.id) && (
                  <div className="flex gap-2 mt-3 pt-3" style={{ borderTop: `1px solid ${border.divider}` }}>
                    {task.status === 'OPEN' && (
                      <>
                        <button onClick={() => statusMut.mutate({ id: task.id, status: 'IN_PROGRESS' })}
                          className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors"
                          style={{ background: accentAlpha(0.08), color: colors.accent }}>
                          Start
                        </button>
                        <button onClick={() => statusMut.mutate({ id: task.id, status: 'COMPLETED' })}
                          className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors"
                          style={{ background: 'rgba(var(--color-success-raw),0.10)', color: 'var(--color-success)' }}>
                          Done
                        </button>
                      </>
                    )}
                    {task.status === 'IN_PROGRESS' && (
                      <button onClick={() => statusMut.mutate({ id: task.id, status: 'COMPLETED' })}
                        className="flex-1 py-1.5 rounded-lg text-xs font-medium"
                        style={{ background: 'rgba(var(--color-success-raw),0.10)', color: 'var(--color-success)' }}>
                        Mark Done
                      </button>
                    )}
                    {task.status === 'COMPLETED' && (
                      <button onClick={() => statusMut.mutate({ id: task.id, status: 'OPEN' })}
                        className="flex-1 py-1.5 rounded-lg text-xs font-medium"
                        style={{ background: accentAlpha(0.06), color: colors.text.muted }}>
                        Reopen
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreate && <CreateTaskModal onClose={() => setShowCreate(false)} />}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          canManage={canManage}
          currentUserId={user?.id ?? ''}
          onClose={() => setSelectedTask(null)}
          onStatusChange={status => statusMut.mutate({ id: selectedTask.id, status })}
        />
      )}
    </div>
  )
}
