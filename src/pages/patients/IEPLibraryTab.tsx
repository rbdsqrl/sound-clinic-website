import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, ChevronDown, ChevronUp, Pencil, BookOpen } from 'lucide-react'
import { iepTemplatesApi } from '../../api/iep-templates'
import { useAuth } from '../../contexts/AuthContext'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageLoader } from '../../components/ui/Spinner'
import { ToastContainer } from '../../components/ui/Toast'
import { useToast } from '../../hooks/useToast'
import { getApiError } from '../../lib/apiError'
import { colors, border, surface, accentAlpha, paletteStyle } from '../../theme'
import type {
  IEPTemplateResponse,
  IEPTemplateGoalResponse,
  IEPGoalDomain,
} from '../../types'

// ── Constants ─────────────────────────────────────────────────────────────────

const DOMAINS: { value: IEPGoalDomain; label: string }[] = [
  { value: 'AUDITORY',  label: 'Auditory Processing'     },
  { value: 'SPEECH',    label: 'Speech Production'       },
  { value: 'LANGUAGE',  label: 'Language'                },
  { value: 'SENSORY',   label: 'Sensory Processing'      },
  { value: 'MOTOR',     label: 'Motor Skills'            },
  { value: 'SOCIAL',    label: 'Social Communication'    },
  { value: 'COGNITIVE', label: 'Cognitive Skills'        },
  { value: 'LITERACY',  label: 'Literacy'                },
  { value: 'ADAPTIVE',  label: 'Adaptive / Daily Living' },
]

type DomainPalette = 'blue' | 'green' | 'yellow' | 'red' | 'slate'

const DOMAIN_PALETTE: Record<IEPGoalDomain, DomainPalette> = {
  AUDITORY:  'blue',
  SPEECH:    'green',
  LANGUAGE:  'yellow',
  SENSORY:   'red',
  MOTOR:     'blue',
  SOCIAL:    'green',
  COGNITIVE: 'yellow',
  LITERACY:  'red',
  ADAPTIVE:  'slate',
}

function domainLabel(domain: IEPGoalDomain): string {
  return DOMAINS.find(d => d.value === domain)?.label ?? domain
}

type ToastFn = (msg: string, type: 'success' | 'error') => void

// ── Domain badge ──────────────────────────────────────────────────────────────

function DomainBadge({ domain }: { domain: IEPGoalDomain }) {
  const key = DOMAIN_PALETTE[domain]
  return (
    <span
      className="inline-flex items-center text-xs font-medium rounded-full px-2.5 py-0.5 flex-shrink-0"
      style={paletteStyle(key)}
    >
      {domainLabel(domain)}
    </span>
  )
}

// ── Inline goal row ───────────────────────────────────────────────────────────

function GoalItem({
  goal,
  canManage,
  onDelete,
}: {
  goal: IEPTemplateGoalResponse
  canManage: boolean
  onDelete: (id: string) => void
}) {
  return (
    <div
      className="flex items-start gap-3 py-3 px-1 border-b last:border-b-0"
      style={{ borderColor: border.divider }}
    >
      <div className="w-2 h-2 rounded-sm mt-1.5 flex-shrink-0" style={{ background: colors.accent }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium" style={{ color: colors.text.primary }}>{goal.title}</p>
        {goal.goalStatement && (
          <p className="text-xs mt-0.5" style={{ color: colors.text.muted }}>{goal.goalStatement}</p>
        )}
        <div className="flex items-center gap-2 flex-wrap mt-1.5">
          {goal.domain && <DomainBadge domain={goal.domain} />}
          {goal.baseline && (
            <span className="text-xs" style={{ color: colors.text.dim }}>
              Baseline: {goal.baseline}
            </span>
          )}
          {goal.targetCriteria && (
            <span className="text-xs" style={{ color: colors.text.dim }}>
              Target: {goal.targetCriteria}
            </span>
          )}
        </div>
      </div>
      {canManage && (
        <button
          onClick={() => onDelete(goal.id)}
          className="p-1.5 rounded-lg transition-colors flex-shrink-0"
          style={{ color: colors.text.dim }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = colors.status.danger}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = colors.text.dim}
        >
          <Trash2 size={13} />
        </button>
      )}
    </div>
  )
}

// ── Add goal form (inline) ────────────────────────────────────────────────────

function AddGoalForm({
  templateId,
  toast,
  onSuccess,
  onCancel,
}: {
  templateId: string
  toast: ToastFn
  onSuccess: () => void
  onCancel: () => void
}) {
  const qc = useQueryClient()

  const [title, setTitle] = useState('')
  const [domain, setDomain] = useState<IEPGoalDomain | ''>('')
  const [goalStatement, setGoalStatement] = useState('')
  const [baseline, setBaseline] = useState('')
  const [targetCriteria, setTargetCriteria] = useState('')

  const addGoalMut = useMutation({
    mutationFn: () =>
      iepTemplatesApi.addGoal(templateId, {
        title,
        domain: domain || undefined,
        goalStatement: goalStatement || undefined,
        baseline: baseline || undefined,
        targetCriteria: targetCriteria || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['iep-templates'] })
      toast('Goal added', 'success')
      onSuccess()
    },
    onError: (err) => toast(getApiError(err, 'Failed to add goal'), 'error'),
  })

  return (
    <div
      className="mt-3 rounded-xl p-4 space-y-3"
      style={{ background: accentAlpha(0.04), border: `1px solid ${accentAlpha(0.12)}` }}
    >
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.text.dim }}>
        New Goal
      </p>

      <input
        className="form-input w-full"
        placeholder="Goal title *"
        value={title}
        onChange={e => setTitle(e.target.value)}
      />

      <select
        className="form-input w-full"
        value={domain}
        onChange={e => setDomain(e.target.value as IEPGoalDomain | '')}
      >
        <option value="">Domain (optional)</option>
        {DOMAINS.map(d => (
          <option key={d.value} value={d.value}>{d.label}</option>
        ))}
      </select>

      <textarea
        className="form-input w-full resize-none"
        placeholder="Goal statement (optional)"
        rows={2}
        value={goalStatement}
        onChange={e => setGoalStatement(e.target.value)}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input
          className="form-input w-full"
          placeholder="Baseline (optional)"
          value={baseline}
          onChange={e => setBaseline(e.target.value)}
        />
        <input
          className="form-input w-full"
          placeholder="Target criteria (optional)"
          value={targetCriteria}
          onChange={e => setTargetCriteria(e.target.value)}
        />
      </div>

      <div className="flex gap-2 pt-1">
        <Button
          size="sm"
          onClick={() => addGoalMut.mutate()}
          loading={addGoalMut.isPending}
          disabled={!title.trim()}
        >
          Add Goal
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

// ── Template card ─────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  canManage,
  toast,
  onEdit,
  onDelete,
  onGoalDelete,
}: {
  template: IEPTemplateResponse
  canManage: boolean
  toast: ToastFn
  onEdit: (template: IEPTemplateResponse) => void
  onDelete: (id: string) => void
  onGoalDelete: (goalId: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [addingGoal, setAddingGoal] = useState(false)

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ border: `1px solid ${border.divider}`, background: surface.card }}
    >
      <div className="flex items-start gap-3 px-5 py-4">
        <button
          className="flex-1 min-w-0 text-left"
          onClick={() => setExpanded(v => !v)}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold" style={{ color: colors.text.heading }}>
              {template.name}
            </span>
            <span
              className="text-xs rounded-full px-2 py-0.5"
              style={{ background: accentAlpha(0.08), color: colors.accent, border: `1px solid ${accentAlpha(0.18)}` }}
            >
              {template.goalCount} {template.goalCount === 1 ? 'goal' : 'goals'}
            </span>
          </div>

          {template.description && (
            <p className="text-xs mt-1" style={{ color: colors.text.muted }}>
              {template.description}
            </p>
          )}

          {template.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {template.tags.map(tag => (
                <span
                  key={tag}
                  className="text-xs rounded-full px-2 py-0.5"
                  style={{ background: accentAlpha(0.06), color: colors.text.muted, border: `1px solid ${border.divider}` }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </button>

        <div className="flex items-center gap-1 flex-shrink-0">
          {canManage && (
            <button
              onClick={() => onEdit(template)}
              className="p-2 rounded-lg transition-colors"
              style={{ color: colors.text.dim }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = colors.accent}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = colors.text.dim}
            >
              <Pencil size={14} />
            </button>
          )}
          {canManage && (
            <button
              onClick={() => onDelete(template.id)}
              className="p-2 rounded-lg transition-colors"
              style={{ color: colors.text.dim }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = colors.status.danger}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = colors.text.dim}
            >
              <Trash2 size={14} />
            </button>
          )}
          <button
            onClick={() => setExpanded(v => !v)}
            className="p-2 rounded-lg transition-colors"
            style={{ color: colors.text.dim }}
          >
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div
          className="px-5 pb-4"
          style={{ borderTop: `1px solid ${border.divider}` }}
        >
          {template.goals.length === 0 && !addingGoal && (
            <p className="text-xs py-3" style={{ color: colors.text.dim }}>
              No goals yet.{canManage ? ' Add the first goal below.' : ''}
            </p>
          )}

          {template.goals.map(goal => (
            <GoalItem
              key={goal.id}
              goal={goal}
              canManage={canManage}
              onDelete={onGoalDelete}
            />
          ))}

          {addingGoal ? (
            <AddGoalForm
              templateId={template.id}
              toast={toast}
              onSuccess={() => setAddingGoal(false)}
              onCancel={() => setAddingGoal(false)}
            />
          ) : (
            canManage && (
              <div className="pt-3">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setAddingGoal(true)}
                >
                  <Plus size={13} /> Add Goal
                </Button>
              </div>
            )
          )}
        </div>
      )}
    </div>
  )
}

// ── Create / Edit modal ───────────────────────────────────────────────────────

function TemplateModal({
  open,
  onClose,
  editing,
  toast,
}: {
  open: boolean
  onClose: () => void
  editing: IEPTemplateResponse | null
  toast: ToastFn
}) {
  const qc = useQueryClient()

  const [name, setName] = useState(editing?.name ?? '')
  const [description, setDescription] = useState(editing?.description ?? '')
  const [tagsRaw, setTagsRaw] = useState(editing?.tags.join(', ') ?? '')

  const parseTags = (raw: string) =>
    raw.split(',').map(t => t.trim()).filter(Boolean)

  const createMut = useMutation({
    mutationFn: () =>
      iepTemplatesApi.create({ name, description: description || undefined, tags: parseTags(tagsRaw) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['iep-templates'] })
      toast('Template created', 'success')
      onClose()
    },
    onError: (err) => toast(getApiError(err, 'Failed to create template'), 'error'),
  })

  const updateMut = useMutation({
    mutationFn: () =>
      iepTemplatesApi.update(editing!.id, { name, description: description || undefined, tags: parseTags(tagsRaw) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['iep-templates'] })
      toast('Template updated', 'success')
      onClose()
    },
    onError: (err) => toast(getApiError(err, 'Failed to update template'), 'error'),
  })

  const isPending = createMut.isPending || updateMut.isPending

  const handleSubmit = () => {
    if (!name.trim()) return
    if (editing) updateMut.mutate()
    else createMut.mutate()
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Template' : 'New IEP Template'}>
      <div className="space-y-4">
        <div>
          <label className="form-label">Template name *</label>
          <input
            className="form-input w-full"
            placeholder="e.g. Annual Speech-Language IEP"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>

        <div>
          <label className="form-label">Description</label>
          <textarea
            className="form-input w-full resize-none"
            placeholder="Brief description of this template's purpose"
            rows={3}
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>

        <div>
          <label className="form-label">Tags (comma-separated)</label>
          <input
            className="form-input w-full"
            placeholder="e.g. speech, language, preschool"
            value={tagsRaw}
            onChange={e => setTagsRaw(e.target.value)}
          />
          {tagsRaw.trim() && (
            <div className="flex flex-wrap gap-1 mt-2">
              {parseTags(tagsRaw).map(tag => (
                <span
                  key={tag}
                  className="text-xs rounded-full px-2 py-0.5"
                  style={{ background: accentAlpha(0.08), color: colors.text.muted, border: `1px solid ${border.divider}` }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-1">
          <Button onClick={handleSubmit} loading={isPending} disabled={!name.trim()}>
            {editing ? 'Save Changes' : 'Create Template'}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function IEPLibraryTab() {
  const { user } = useAuth()
  const { toasts, toast, dismiss } = useToast()
  const qc = useQueryClient()

  const canManage = user?.role === 'BUSINESS_OWNER' || user?.role === 'ADMIN'

  const [modalOpen, setModalOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<IEPTemplateResponse | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { data: templates, isLoading } = useQuery({
    queryKey: ['iep-templates'],
    queryFn: () => iepTemplatesApi.list(),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => iepTemplatesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['iep-templates'] })
      toast('Template deleted', 'success')
      setDeletingId(null)
    },
    onError: (err) => toast(getApiError(err, 'Failed to delete template'), 'error'),
  })

  const deleteGoalMut = useMutation({
    mutationFn: (goalId: string) => iepTemplatesApi.deleteGoal(goalId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['iep-templates'] })
      toast('Goal removed', 'success')
    },
    onError: (err) => toast(getApiError(err, 'Failed to remove goal'), 'error'),
  })

  if (isLoading) return <PageLoader />

  const list = templates ?? []

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold" style={{ color: colors.text.heading }}>
            IEP Template Library
          </h2>
          <p className="text-xs mt-0.5" style={{ color: colors.text.muted }}>
            Reusable IEP plan templates for your organisation
          </p>
        </div>
        {canManage && (
          <Button
            size="sm"
            onClick={() => { setEditingTemplate(null); setModalOpen(true) }}
          >
            <Plus size={14} /> New Template
          </Button>
        )}
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={32} />}
          title="No templates yet"
          description={canManage
            ? 'Create reusable IEP templates for your organisation.'
            : 'No IEP templates have been created yet.'}
        />
      ) : (
        <div className="space-y-3">
          {list.map(template => (
            <TemplateCard
              key={template.id}
              template={template}
              canManage={canManage}
              toast={toast}
              onEdit={(t) => { setEditingTemplate(t); setModalOpen(true) }}
              onDelete={(id) => setDeletingId(id)}
              onGoalDelete={(goalId) => deleteGoalMut.mutate(goalId)}
            />
          ))}
        </div>
      )}

      <TemplateModal
        key={editingTemplate?.id ?? 'new'}
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingTemplate(null) }}
        editing={editingTemplate}
        toast={toast}
      />

      <Modal
        open={deletingId !== null}
        onClose={() => setDeletingId(null)}
        title="Delete Template"
        size="sm"
      >
        <p className="text-sm mb-5" style={{ color: colors.text.primary }}>
          Are you sure you want to delete this template? All goals inside it will be removed.
        </p>
        <div className="flex gap-3">
          <Button
            variant="danger"
            loading={deleteMut.isPending}
            onClick={() => deletingId && deleteMut.mutate(deletingId)}
          >
            Delete
          </Button>
          <Button variant="ghost" onClick={() => setDeletingId(null)}>
            Cancel
          </Button>
        </div>
      </Modal>

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
