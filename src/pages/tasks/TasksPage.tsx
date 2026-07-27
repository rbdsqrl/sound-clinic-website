import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, CheckCircle2, Circle, Clock, MessageSquare, Paperclip,
  ChevronRight, MoreHorizontal, Trash2, X, Upload, FileText, Send,
  ListTodo, Search, Check, Users, Pencil, Activity,
} from 'lucide-react'
import { tasksApi } from '../../api/tasks'
import { usersApi } from '../../api/users'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Modal } from '../../components/ui/Modal'
import { PageLoader } from '../../components/ui/Spinner'
import { ToastContainer } from '../../components/ui/Toast'
import { useToast } from '../../hooks/useToast'
import { getApiError } from '../../lib/apiError'
import { useAuth } from '../../contexts/AuthContext'
import { colors, border, surface, accentAlpha, paletteStyle, styles, dangerAlpha, warningAlpha } from '../../theme'
import { roleLabel } from '../../components/ui/Badge'
import { format, isPast, parseISO, isToday } from 'date-fns'
import type {
  TaskResponse, TaskStatus, TaskPriority, TaskAssignee,
  TaskCommentResponse, TaskAttachmentResponse, TaskLogResponse,
  UserResponse,
} from '../../types'

// ── Helpers ────────────────────────────────────────────────────────────────────

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'OPEN',        label: 'Open' },
  { status: 'IN_PROGRESS', label: 'In Progress' },
  { status: 'COMPLETED',   label: 'Completed' },
]

const PAGE_SIZE = 8

function priorityStyle(p: TaskPriority) {
  if (p === 'HIGH')   return { color: 'var(--color-danger)',  dot: dangerAlpha(1) }
  if (p === 'MEDIUM') return { color: 'var(--color-warning)', dot: warningAlpha(1) }
  return { color: 'var(--text-dim)', dot: 'var(--text-dim)' }
}

function dueDateLabel(d: string | null, status?: TaskStatus) {
  if (!d) return null
  const date = parseISO(d)
  const done = status === 'COMPLETED' || status === 'CANCELLED'
  if (isToday(date))           return { label: 'Today',             overdue: false }
  if (isPast(date) && !done)   return { label: format(date, 'MMM d'), overdue: true }
  return { label: format(date, 'MMM d'), overdue: false }
}

function initials(first: string, last: string) {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase()
}

function logIcon(logType: TaskLogResponse['logType']) {
  switch (logType) {
    case 'STATUS_CHANGED':      return <CheckCircle2 size={12} />
    case 'PRIORITY_CHANGED':    return <Circle size={12} />
    case 'ASSIGNEE_CHANGED':    return <Users size={12} />
    case 'ATTACHMENT_ADDED':
    case 'ATTACHMENT_DELETED':  return <Paperclip size={12} />
    case 'NAME_CHANGED':
    case 'DESCRIPTION_CHANGED': return <Pencil size={12} />
    default:                    return <Activity size={12} />
  }
}

function AssigneeChips({ assignees, max = 3 }: { assignees: TaskAssignee[]; max?: number }) {
  const visible = assignees.slice(0, max)
  const rest = assignees.length - visible.length
  return (
    <div className="flex items-center">
      {visible.map((a, idx) => (
        <span
          key={a.id}
          title={`${a.firstName} ${a.lastName}`}
          className="text-[10px] font-bold h-5 w-5 rounded-full flex items-center justify-center border"
          style={{
            background: accentAlpha(0.12),
            color: colors.accent,
            borderColor: surface.card,
            marginLeft: idx > 0 ? -4 : 0,
            zIndex: visible.length - idx,
            position: 'relative',
          }}
        >
          {a.firstName[0]}{a.lastName[0]}
        </span>
      ))}
      {rest > 0 && (
        <span className="text-[10px] font-bold h-5 w-5 rounded-full flex items-center justify-center border ml-[-4px]"
          style={{ background: accentAlpha(0.08), color: colors.text.dim, borderColor: surface.card }}>
          +{rest}
        </span>
      )}
    </div>
  )
}

// ── MemberPickerModal ──────────────────────────────────────────────────────────

function MemberPickerModal({
  selected,
  onConfirm,
  onClose,
}: {
  selected: UserResponse[]
  onConfirm: (members: UserResponse[]) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const [page, setPage]     = useState(0)
  const [draft, setDraft]   = useState<UserResponse[]>(selected)

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['org-members'],
    queryFn: usersApi.listMembers,
    staleTime: 60_000,
  })

  const filtered = members.filter(m =>
    `${m.firstName} ${m.lastName}`.toLowerCase().includes(search.toLowerCase())
  )

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const clampedPage = Math.min(page, totalPages - 1)
  const visible = filtered.slice(clampedPage * PAGE_SIZE, (clampedPage + 1) * PAGE_SIZE)

  const isSelected = (m: UserResponse) => draft.some(d => d.id === m.id)
  const toggle = (m: UserResponse) =>
    setDraft(prev => isSelected(m) ? prev.filter(d => d.id !== m.id) : [...prev, m])

  useEffect(() => setPage(0), [search])

  return (
    <Modal open title="Assign to members" onClose={onClose}>
      {/* Search */}
      <div className="relative mb-3">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: colors.text.dim }} />
        <input
          className="form-input pl-8 w-full text-sm"
          placeholder="Search by name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
        />
      </div>

      {/* Selected chips */}
      {draft.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3 pb-3" style={{ borderBottom: `1px solid ${border.divider}` }}>
          {draft.map(m => (
            <span key={m.id} className="flex items-center gap-1 text-xs px-2 py-1 rounded-full"
              style={{ background: accentAlpha(0.10), color: colors.accent }}>
              {m.firstName} {m.lastName}
              <button
                type="button"
                onClick={() => toggle(m)}
                className="ml-0.5 rounded-full hover:opacity-70">
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Member list */}
      <div className="rounded-xl overflow-hidden" style={{ border: border.card, minHeight: 200 }}>
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent"
              style={{ color: colors.accent }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <Users size={24} style={{ color: colors.text.dim }} />
            <p className="text-sm" style={{ color: colors.text.dim }}>No members found</p>
          </div>
        ) : (
          visible.map((m, i) => (
            <button
              key={m.id}
              type="button"
              onClick={() => toggle(m)}
              className="w-full flex items-center gap-3 px-4 py-3 transition-colors text-left"
              style={{
                borderBottom: i < visible.length - 1 ? `1px solid ${border.divider}` : undefined,
                background: isSelected(m) ? accentAlpha(0.06) : 'transparent',
              }}
              onMouseEnter={e => {
                if (!isSelected(m)) (e.currentTarget as HTMLElement).style.background = surface.rowHover
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = isSelected(m) ? accentAlpha(0.06) : 'transparent'
              }}
            >
              {/* Checkbox */}
              <span className="flex-shrink-0 h-4 w-4 rounded flex items-center justify-center"
                style={{
                  border: isSelected(m) ? 'none' : `2px solid ${border.divider}`,
                  background: isSelected(m) ? colors.accent : 'transparent',
                }}>
                {isSelected(m) && <Check size={10} style={{ color: '#fff' }} />}
              </span>

              {/* Avatar */}
              <span className="h-8 w-8 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0"
                style={{ background: accentAlpha(0.12), color: colors.accent }}>
                {m.firstName[0]}{m.lastName[0]}
              </span>

              {/* Name + role */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: colors.text.primary }}>
                  {m.firstName} {m.lastName}
                </p>
                <p className="text-xs" style={{ color: colors.text.muted }}>
                  {roleLabel(m.role)}
                </p>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 text-xs" style={{ color: colors.text.muted }}>
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={clampedPage === 0}
            className="px-3 py-1.5 rounded-lg font-medium disabled:opacity-40 transition-colors"
            style={{ background: accentAlpha(0.08), color: colors.accent }}>
            ← Prev
          </button>
          <span>Page {clampedPage + 1} of {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={clampedPage >= totalPages - 1}
            className="px-3 py-1.5 rounded-lg font-medium disabled:opacity-40 transition-colors"
            style={{ background: accentAlpha(0.08), color: colors.accent }}>
            Next →
          </button>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-4" style={{ borderTop: `1px solid ${border.divider}` }}>
        <span className="text-sm" style={{ color: colors.text.muted }}>
          {draft.length > 0 ? `${draft.length} member${draft.length > 1 ? 's' : ''} selected` : 'No one selected yet'}
        </span>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={draft.length === 0}
            onClick={() => { onConfirm(draft); onClose() }}>
            Confirm{draft.length > 0 ? ` (${draft.length})` : ''}
          </Button>
        </div>
      </div>
    </Modal>
  )
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
  const due = dueDateLabel(task.dueDate, task.status)
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

      {/* Assignees + meta row */}
      <div className="flex items-center gap-2 mt-2.5">
        <AssigneeChips assignees={task.assignees} />
        {task.assignees.length > 0 && (
          <span className="text-[11px] truncate" style={{ color: colors.text.muted }}>
            {task.assignees[0].firstName}
            {task.assignees.length > 1 && ` +${task.assignees.length - 1} more`}
          </span>
        )}
        {due && (
          <span className="ml-auto flex items-center gap-1 text-[10px] font-medium flex-shrink-0"
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
  status, label, tasks, canManage, isDragOver,
  onDragOver, onDragLeave, onDrop, onCardDragStart, onCardOpen, onCardDelete, onAddTask,
}: {
  status: TaskStatus; label: string; tasks: TaskResponse[]; canManage: boolean; isDragOver: boolean
  onDragOver: (e: React.DragEvent) => void; onDragLeave: () => void; onDrop: (e: React.DragEvent) => void
  onCardDragStart: (e: React.DragEvent, task: TaskResponse) => void
  onCardOpen: (task: TaskResponse) => void; onCardDelete: (task: TaskResponse) => void; onAddTask?: () => void
}) {
  const colColor = status === 'OPEN' ? 'var(--color-info)'
    : status === 'IN_PROGRESS' ? 'var(--color-warning)' : 'var(--color-success)'

  return (
    <div
      className="flex flex-col rounded-2xl min-h-[200px] transition-colors"
      style={{
        background: isDragOver ? accentAlpha(0.04) : surface.filterStrip,
        border: isDragOver ? `2px dashed ${colors.accent}` : `2px solid transparent`,
      }}
      onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
    >
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: colColor }} />
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.text.muted }}>{label}</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
            style={{ background: accentAlpha(0.08), color: colors.accent }}>{tasks.length}</span>
        </div>
        {canManage && status === 'OPEN' && onAddTask && (
          <button onClick={onAddTask} className="p-1 rounded-lg transition-colors" style={{ color: colors.text.dim }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = colors.accent}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = colors.text.dim}>
            <Plus size={14} />
          </button>
        )}
      </div>
      <div className="flex flex-col gap-2 px-2 pb-3 flex-1">
        {tasks.map(t => (
          <TaskCard key={t.id} task={t} canManage={canManage}
            onOpen={() => onCardOpen(t)} onDelete={() => onCardDelete(t)}
            onDragStart={e => onCardDragStart(e, t)} />
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
  task, canManage, currentUserId, onClose, onStatusChange, onUpdate,
}: {
  task: TaskResponse; canManage: boolean; currentUserId: string
  onClose: () => void
  onStatusChange: (status: TaskStatus) => void
  onUpdate?: (updated: TaskResponse) => void
}) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [commentText, setCommentText] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // inline edit state
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft]     = useState(task.title)
  const [editingDesc, setEditingDesc]   = useState(false)
  const [descDraft, setDescDraft]       = useState(task.description ?? '')
  const [showAssigneePicker, setShowAssigneePicker] = useState(false)
  const [assigneeDraft, setAssigneeDraft] = useState<UserResponse[]>([])
  const [showAssigneeNames, setShowAssigneeNames] = useState(false)
  const [detailTab, setDetailTab] = useState<'comments' | 'activity'>('comments')

  const { data: allMembers = [] } = useQuery({
    queryKey: ['org-members'],
    queryFn: usersApi.listMembers,
    staleTime: 60_000,
    enabled: canManage,
  })

  const { data: comments = [] } = useQuery({
    queryKey: ['task-comments', task.id],
    queryFn: () => tasksApi.listComments(task.id),
  })
  const { data: attachments = [] } = useQuery({
    queryKey: ['task-attachments', task.id],
    queryFn: () => tasksApi.listAttachments(task.id),
  })
  const { data: logs = [] } = useQuery({
    queryKey: ['task-logs', task.id],
    queryFn: () => tasksApi.listLogs(task.id),
  })

  const updateMut = useMutation({
    mutationFn: (data: Parameters<typeof tasksApi.update>[1]) => tasksApi.update(task.id, data),
    onSuccess: (updated) => {
      qc.setQueryData<TaskResponse[]>(['tasks'], prev =>
        prev?.map(t => t.id === updated.id ? updated : t) ?? [])
      qc.invalidateQueries({ queryKey: ['task-logs', task.id] })
      onUpdate?.(updated)
      toast('Updated', 'success')
    },
    onError: (err) => toast(getApiError(err, 'Failed to update task'), 'error'),
  })

  const commentMut = useMutation({
    mutationFn: () => tasksApi.addComment(task.id, commentText),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-comments', task.id] })
      qc.invalidateQueries({ queryKey: ['tasks'] })
      setCommentText('')
    },
    onError: (err) => toast(getApiError(err, 'Failed to post comment'), 'error'),
  })
  const deleteCommentMut = useMutation({
    mutationFn: (commentId: string) => tasksApi.deleteComment(task.id, commentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-comments', task.id] })
      qc.invalidateQueries({ queryKey: ['tasks'] })
    },
    onError: (err) => toast(getApiError(err, 'Failed to delete comment'), 'error'),
  })
  const uploadMut = useMutation({
    mutationFn: (file: File) => tasksApi.uploadAttachment(task.id, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-attachments', task.id] })
      qc.invalidateQueries({ queryKey: ['task-logs', task.id] })
      qc.invalidateQueries({ queryKey: ['tasks'] })
    },
    onError: (err) => toast(getApiError(err, 'Upload failed'), 'error'),
  })
  const deleteAttMut = useMutation({
    mutationFn: (attId: string) => tasksApi.deleteAttachment(task.id, attId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-attachments', task.id] })
      qc.invalidateQueries({ queryKey: ['task-logs', task.id] })
      qc.invalidateQueries({ queryKey: ['tasks'] })
    },
    onError: (err) => toast(getApiError(err, 'Failed to delete file'), 'error'),
  })

  const due = dueDateLabel(task.dueDate, task.status)
  const pStyle = priorityStyle(task.priority)
  const canEdit = canManage || task.assignees.some(a => a.id === currentUserId)

  const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
    { value: 'OPEN',        label: 'Open' },
    { value: 'IN_PROGRESS', label: 'In Progress' },
    { value: 'COMPLETED',   label: 'Completed' },
  ]

  const saveTitle = () => {
    const trimmed = titleDraft.trim()
    if (!trimmed || trimmed === task.title) { setEditingTitle(false); return }
    updateMut.mutate({ title: trimmed })
    setEditingTitle(false)
  }

  const saveDesc = () => {
    const trimmed = descDraft.trim()
    if (trimmed === (task.description ?? '')) { setEditingDesc(false); return }
    updateMut.mutate({ description: trimmed })
    setEditingDesc(false)
  }

  const openAssigneePicker = () => {
    const current = allMembers.filter(m => task.assignees.some(a => a.id === m.id))
    setAssigneeDraft(current)
    setShowAssigneePicker(true)
  }

  const confirmAssignees = (members: UserResponse[]) => {
    updateMut.mutate({ assignedTo: members.map(m => m.id) })
  }

  // Build modal title: editable for managers, plain text otherwise
  const modalTitle = canManage ? (
    editingTitle ? (
      <div className="flex items-center gap-2 flex-1 mr-2" onClick={e => e.stopPropagation()}>
        <input
          autoFocus
          className="form-input text-sm font-semibold flex-1 py-1"
          value={titleDraft}
          onChange={e => setTitleDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') saveTitle()
            if (e.key === 'Escape') { setEditingTitle(false); setTitleDraft(task.title) }
          }}
        />
        <button onClick={saveTitle} className="text-xs px-2 py-1 rounded-lg font-medium flex-shrink-0"
          style={styles.buttonPrimary}>Save</button>
        <button onClick={() => { setEditingTitle(false); setTitleDraft(task.title) }}
          className="text-xs px-2 py-1 rounded-lg font-medium flex-shrink-0"
          style={{ background: accentAlpha(0.06), color: colors.text.muted }}>Cancel</button>
      </div>
    ) : (
      <div className="flex items-center gap-2 group/title">
        <span>{task.title}</span>
        <button
          onClick={e => { e.stopPropagation(); setTitleDraft(task.title); setEditingTitle(true) }}
          className="opacity-0 group-hover/title:opacity-100 p-0.5 rounded transition-opacity"
          style={{ color: colors.text.dim }}>
          <Pencil size={13} />
        </button>
      </div>
    )
  ) : task.title

  return (
    <>
      <Modal open title={modalTitle} onClose={onClose} size="lg">
        {/* Meta strip */}
        <div className="flex flex-wrap items-start gap-x-5 gap-y-3 mb-5 pb-5" style={{ borderBottom: `1px solid ${border.divider}` }}>

          {/* Status */}
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-[10px] uppercase font-semibold tracking-wide" style={{ color: colors.text.dim }}>Status</span>
            {canEdit ? (
              <select className="text-xs rounded-lg px-2 py-1 font-medium cursor-pointer border-0 outline-none"
                style={{ background: accentAlpha(0.06), color: colors.text.primary }}
                value={task.status} onChange={e => onStatusChange(e.target.value as TaskStatus)}>
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
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-[10px] uppercase font-semibold tracking-wide" style={{ color: colors.text.dim }}>Priority</span>
            {canManage ? (
              <select
                className="text-xs rounded-lg px-2 py-1 font-medium cursor-pointer border-0 outline-none"
                style={{ background: accentAlpha(0.06), color: pStyle.color }}
                value={task.priority}
                onChange={e => updateMut.mutate({ priority: e.target.value as TaskPriority })}
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            ) : (
              <span className="text-xs font-medium" style={{ color: pStyle.color }}>● {task.priority}</span>
            )}
          </div>

          {/* Assignees */}
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-1">
              <span className="text-[10px] uppercase font-semibold tracking-wide" style={{ color: colors.text.dim }}>
                Assigned to
              </span>
              {canManage && (
                <button onClick={openAssigneePicker}
                  className="p-0.5 rounded transition-colors"
                  style={{ color: colors.text.dim }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = colors.accent}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = colors.text.dim}>
                  <Pencil size={10} />
                </button>
              )}
            </div>
            {task.assignees.length === 0 ? (
              <span className="text-xs" style={{ color: colors.text.dim }}>Unassigned</span>
            ) : showAssigneeNames ? (
              <div className="flex flex-col gap-1">
                {task.assignees.map(a => (
                  <div key={a.id} className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: accentAlpha(0.12), color: colors.accent }}>
                      {a.firstName[0]}{a.lastName[0]}
                    </span>
                    <span className="text-xs" style={{ color: colors.text.primary }}>
                      {a.firstName} {a.lastName}
                    </span>
                  </div>
                ))}
                <button onClick={() => setShowAssigneeNames(false)}
                  className="text-[10px] text-left mt-0.5"
                  style={{ color: colors.accent }}>
                  collapse
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <AssigneeChips assignees={task.assignees} max={3} />
                <button onClick={() => setShowAssigneeNames(true)}
                  className="text-[10px]"
                  style={{ color: colors.accent }}>
                  expand
                </button>
              </div>
            )}
          </div>

          {/* Due date */}
          {due && (
            <div className="flex flex-col gap-1 min-w-0">
              <span className="text-[10px] uppercase font-semibold tracking-wide" style={{ color: colors.text.dim }}>Due</span>
              <span className="flex items-center gap-1 text-xs font-medium"
                style={{ color: due.overdue ? 'var(--color-danger)' : colors.text.muted }}>
                <Clock size={11} /> {due.label}{due.overdue ? ' — overdue' : ''}
              </span>
            </div>
          )}

          {/* Completed at */}
          {task.completedAt && (
            <div className="flex flex-col gap-1 min-w-0">
              <span className="text-[10px] uppercase font-semibold tracking-wide" style={{ color: colors.text.dim }}>Completed</span>
              <span className="flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--color-success)' }}>
                <CheckCircle2 size={11} /> {format(new Date(task.completedAt), 'MMM d, yyyy')}
              </span>
            </div>
          )}
        </div>

        {/* Description */}
        <div className="mb-5">
          {canManage ? (
            editingDesc ? (
              <div className="flex flex-col gap-2">
                <textarea
                  autoFocus
                  className="form-input w-full resize-none text-sm"
                  rows={4}
                  value={descDraft}
                  onChange={e => setDescDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Escape') { setEditingDesc(false); setDescDraft(task.description ?? '') } }}
                  placeholder="Add a description…"
                />
                <div className="flex gap-2">
                  <Button variant="primary" onClick={saveDesc} loading={updateMut.isPending}>Save</Button>
                  <Button variant="ghost" onClick={() => { setEditingDesc(false); setDescDraft(task.description ?? '') }}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="group/desc flex items-start gap-2">
                <div className="flex-1">
                  {task.description ? (
                    <p className="text-sm" style={{ color: colors.text.primary, whiteSpace: 'pre-wrap' }}>{task.description}</p>
                  ) : (
                    <p className="text-sm italic" style={{ color: colors.text.dim }}>No description — click to add one</p>
                  )}
                </div>
                <button
                  onClick={() => { setDescDraft(task.description ?? ''); setEditingDesc(true) }}
                  className="opacity-0 group-hover/desc:opacity-100 p-1 rounded transition-opacity flex-shrink-0"
                  style={{ color: colors.text.dim }}>
                  <Pencil size={13} />
                </button>
              </div>
            )
          ) : (
            task.description && (
              <p className="text-sm" style={{ color: colors.text.primary, whiteSpace: 'pre-wrap' }}>{task.description}</p>
            )
          )}
        </div>

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

        {/* Comments / Activity tabs */}
        <div className="mb-4">
          {/* Tab bar */}
          <div className="flex gap-1 mb-4" style={{ borderBottom: `1px solid ${border.divider}` }}>
            {([
              { key: 'comments', label: 'Comments', count: comments.length },
              { key: 'activity', label: 'Activity',  count: logs.length },
            ] as const).map(tab => (
              <button
                key={tab.key}
                onClick={() => setDetailTab(tab.key)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors relative"
                style={{ color: detailTab === tab.key ? colors.accent : colors.text.muted }}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: accentAlpha(0.08), color: colors.accent }}>
                    {tab.count}
                  </span>
                )}
                {detailTab === tab.key && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full"
                    style={{ background: colors.accent }} />
                )}
              </button>
            ))}
          </div>

          {/* Comments panel */}
          {detailTab === 'comments' && (
            comments.length === 0 ? (
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
            )
          )}

          {/* Activity panel */}
          {detailTab === 'activity' && (
            logs.length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: colors.text.dim }}>No activity yet</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {logs.map((log: TaskLogResponse) => (
                  <div key={log.id} className="flex items-start gap-2.5">
                    <span className="h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: accentAlpha(0.08), color: colors.text.dim }}>
                      {logIcon(log.logType)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs leading-snug" style={{ color: colors.text.muted }}>
                        <span className="font-medium" style={{ color: colors.text.primary }}>{log.actorName}</span>
                        {' '}{log.details}
                      </p>
                      <p className="text-[10px] mt-0.5" style={{ color: colors.text.dim }}>
                        {format(new Date(log.createdAt), 'MMM d, h:mm a')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        {/* Comment input — only on comments tab */}
        {detailTab === 'comments' && (
        <div className="flex gap-2 items-end pt-4" style={{ borderTop: `1px solid ${border.divider}` }}>
          <textarea className="form-input flex-1 resize-none text-sm" rows={2} placeholder="Add a comment…"
            value={commentText} onChange={e => setCommentText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && commentText.trim()) {
                e.preventDefault(); commentMut.mutate()
              }
            }} />
          <div className="flex flex-col gap-1.5">
            <label className="cursor-pointer p-2 rounded-lg flex items-center justify-center transition-colors"
              style={{ background: accentAlpha(0.06), color: colors.accent }} title="Attach file">
              {uploadMut.isPending
                ? <div className="h-4 w-4 animate-spin rounded-full border border-current border-t-transparent" />
                : <Upload size={15} />}
              <input ref={fileInputRef} type="file" accept="image/*,video/*,.pdf,.doc,.docx" multiple className="hidden"
                onChange={e => { if (e.target.files) Array.from(e.target.files).forEach(f => uploadMut.mutate(f)) }} />
            </label>
            <button disabled={!commentText.trim() || commentMut.isPending}
              onClick={() => commentMut.mutate()}
              className="p-2 rounded-lg flex items-center justify-center transition-colors disabled:opacity-40"
              style={styles.buttonPrimary} title="Post comment (⌘+Enter)">
              {commentMut.isPending
                ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                : <Send size={15} />}
            </button>
          </div>
        </div>
        )}
      </Modal>

      {showAssigneePicker && (
        <MemberPickerModal
          selected={assigneeDraft}
          onConfirm={confirmAssignees}
          onClose={() => setShowAssigneePicker(false)}
        />
      )}
    </>
  )
}

// ── CreateTaskModal ────────────────────────────────────────────────────────────

function CreateTaskModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [title, setTitle]             = useState('')
  const [description, setDescription] = useState('')
  const [assignees, setAssignees]     = useState<UserResponse[]>([])
  const [showPicker, setShowPicker]   = useState(false)
  const [dueDate, setDueDate]         = useState('')
  const [priority, setPriority]       = useState<TaskPriority>('MEDIUM')
  const [errors, setErrors]           = useState<Record<string, string>>({})

  const createMut = useMutation({
    mutationFn: () => tasksApi.create({
      title: title.trim(),
      description: description.trim() || undefined,
      assignedTo: assignees.map(a => a.id),
      dueDate: dueDate || undefined,
      priority,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      toast('Task created', 'success')
      onClose()
    },
    onError: (err) => toast(getApiError(err, 'Failed to create task'), 'error'),
  })

  const submit = () => {
    const e: Record<string, string> = {}
    if (!title.trim())      e.title    = 'Title is required'
    if (assignees.length === 0) e.assignees = 'Assign to at least one person'
    setErrors(e)
    if (Object.keys(e).length === 0) createMut.mutate()
  }

  return (
    <>
      <Modal open title="New Task" onClose={onClose}>
        <div className="flex flex-col gap-4">
          <Input label="Title" value={title} onChange={e => setTitle(e.target.value)}
            error={errors.title} placeholder="What needs to be done?" />
          <div>
            <label className="form-label">Description</label>
            <textarea className="form-input w-full resize-none" rows={3}
              placeholder="Optional details…" value={description}
              onChange={e => setDescription(e.target.value)} />
          </div>

          {/* Assignee picker */}
          <div>
            <label className="form-label">Assign to</label>
            {assignees.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {assignees.map(a => (
                  <span key={a.id} className="flex items-center gap-1 text-xs px-2 py-1 rounded-full"
                    style={{ background: accentAlpha(0.10), color: colors.accent }}>
                    {a.firstName} {a.lastName}
                    <button type="button"
                      onClick={() => setAssignees(prev => prev.filter(x => x.id !== a.id))}
                      className="ml-0.5 hover:opacity-70">
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => setShowPicker(true)}
              className="w-full text-left text-sm px-3 py-2.5 rounded-xl transition-colors"
              style={{
                border: `1px solid ${errors.assignees ? 'var(--color-danger)' : border.card}`,
                color: assignees.length ? colors.text.primary : colors.text.dim,
                background: 'transparent',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = colors.accent}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = errors.assignees ? 'var(--color-danger)' : border.card}
            >
              {assignees.length > 0
                ? `${assignees.length} member${assignees.length > 1 ? 's' : ''} selected — click to change`
                : 'Choose members…'}
            </button>
            {errors.assignees && <p className="form-error mt-1">{errors.assignees}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Due Date" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            <Select label="Priority" value={priority} onChange={e => setPriority(e.target.value as TaskPriority)}
              options={[
                { value: 'LOW',    label: 'Low' },
                { value: 'MEDIUM', label: 'Medium' },
                { value: 'HIGH',   label: 'High' },
              ]} />
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-6 pt-4" style={{ borderTop: `1px solid ${border.divider}` }}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={createMut.isPending} onClick={submit}>Create Task</Button>
        </div>
      </Modal>

      {showPicker && (
        <MemberPickerModal
          selected={assignees}
          onConfirm={setAssignees}
          onClose={() => setShowPicker(false)}
        />
      )}
    </>
  )
}

// ── TasksPage ──────────────────────────────────────────────────────────────────

export default function TasksPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const { toasts, toast, dismiss } = useToast()

  const canManage = user?.role === 'BUSINESS_OWNER' || user?.role === 'ADMIN'

  const [showCreate, setShowCreate]     = useState(false)
  const [selectedTask, setSelectedTask] = useState<TaskResponse | null>(null)
  const [mobileTab, setMobileTab]       = useState<TaskStatus>('OPEN')
  const [dragOverCol, setDragOverCol]   = useState<TaskStatus | null>(null)
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
        prev?.map(t => t.id === updated.id ? updated : t) ?? [])
      if (selectedTask?.id === updated.id) setSelectedTask(updated)
      qc.invalidateQueries({ queryKey: ['task-logs', updated.id] })
    },
    onError: (err) => toast(getApiError(err, 'Failed to update task'), 'error'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => tasksApi.delete(id),
    onSuccess: (_, id) => {
      qc.setQueryData<TaskResponse[]>(['tasks'], prev => prev?.filter(t => t.id !== id) ?? [])
      if (selectedTask?.id === id) setSelectedTask(null)
      toast('Task deleted', 'success')
    },
    onError: (err) => toast(getApiError(err, 'Failed to delete task'), 'error'),
  })

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
    if (task && task.status !== status) statusMut.mutate({ id: task.id, status })
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

      {/* ── Desktop kanban ── */}
      <div className="hidden lg:grid grid-cols-3 gap-4">
        {COLUMNS.map(col => (
          <KanbanColumn key={col.status} status={col.status} label={col.label}
            tasks={grouped[col.status] ?? []} canManage={canManage}
            isDragOver={dragOverCol === col.status}
            onDragOver={e => handleDragOver(e, col.status)}
            onDragLeave={() => setDragOverCol(null)}
            onDrop={e => handleDrop(e, col.status)}
            onCardDragStart={handleDragStart}
            onCardOpen={setSelectedTask}
            onCardDelete={t => deleteMut.mutate(t.id)}
            onAddTask={() => setShowCreate(true)} />
        ))}
      </div>

      {/* ── Mobile ── */}
      <div className="lg:hidden">
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 mb-4">
          {COLUMNS.map(col => {
            const count = grouped[col.status]?.length ?? 0
            const active = mobileTab === col.status
            return (
              <button key={col.status} onClick={() => setMobileTab(col.status)}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                style={active ? styles.filterTabActive : styles.filterTabInactive}>
                {col.label}
                <span className="text-[10px] font-bold px-1 py-0.5 rounded-full"
                  style={{ background: active ? 'rgba(255,255,255,0.25)' : accentAlpha(0.08), color: active ? '#fff' : colors.accent }}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>

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
                        {task.assignees.map(a => a.firstName).join(', ') || 'Unassigned'}
                      </span>
                      {dueDateLabel(task.dueDate, task.status) && (
                        <span className="flex items-center gap-1 text-xs"
                          style={{ color: dueDateLabel(task.dueDate, task.status)!.overdue ? 'var(--color-danger)' : colors.text.dim }}>
                          <Clock size={10} /> {dueDateLabel(task.dueDate, task.status)!.label}
                        </span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => setSelectedTask(task)}
                    className="p-1.5 rounded-lg flex-shrink-0" style={{ color: colors.text.dim }}>
                    <ChevronRight size={16} />
                  </button>
                </div>
                {(canManage || task.assignees.some(a => a.id === user?.id)) && (
                  <div className="flex gap-2 mt-3 pt-3" style={{ borderTop: `1px solid ${border.divider}` }}>
                    {task.status === 'OPEN' && (<>
                      <button onClick={() => statusMut.mutate({ id: task.id, status: 'IN_PROGRESS' })}
                        className="flex-1 py-1.5 rounded-lg text-xs font-medium"
                        style={{ background: accentAlpha(0.08), color: colors.accent }}>Start</button>
                      <button onClick={() => statusMut.mutate({ id: task.id, status: 'COMPLETED' })}
                        className="flex-1 py-1.5 rounded-lg text-xs font-medium"
                        style={{ background: 'rgba(var(--color-success-raw),0.10)', color: 'var(--color-success)' }}>Done</button>
                    </>)}
                    {task.status === 'IN_PROGRESS' && (
                      <button onClick={() => statusMut.mutate({ id: task.id, status: 'COMPLETED' })}
                        className="flex-1 py-1.5 rounded-lg text-xs font-medium"
                        style={{ background: 'rgba(var(--color-success-raw),0.10)', color: 'var(--color-success)' }}>Mark Done</button>
                    )}
                    {task.status === 'COMPLETED' && (
                      <button onClick={() => statusMut.mutate({ id: task.id, status: 'OPEN' })}
                        className="flex-1 py-1.5 rounded-lg text-xs font-medium"
                        style={{ background: accentAlpha(0.06), color: colors.text.muted }}>Reopen</button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreate && <CreateTaskModal onClose={() => setShowCreate(false)} />}
      {selectedTask && (
        <TaskDetailModal task={selectedTask} canManage={canManage} currentUserId={user?.id ?? ''}
          onClose={() => setSelectedTask(null)}
          onStatusChange={status => statusMut.mutate({ id: selectedTask.id, status })}
          onUpdate={setSelectedTask} />
      )}
    </div>
  )
}
