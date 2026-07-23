import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Plus, Trash2, ChevronDown, ChevronUp, Pencil, BookOpen, Upload } from 'lucide-react'
import { iepTemplatesApi } from '../../api/iep-templates'
import { useAuth } from '../../contexts/AuthContext'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Modal } from '../../components/ui/Modal'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageLoader } from '../../components/ui/Spinner'
import { useToast } from '../../hooks/useToast'
import { ToastContainer } from '../../components/ui/Toast'
import { getApiError } from '../../lib/apiError'
import { colors, border, surface, accentAlpha, paletteStyle } from '../../theme'
import type {
  IEPTemplateResponse,
  IEPTemplateGoalResponse,
  IEPGoalDomain,
  CreateIEPTemplateGoalRequest,
} from '../../types'

// ── CSV parser ────────────────────────────────────────────────────────────────

type CsvGoal = {
  goalTitle: string
  domain: IEPGoalDomain
  goalStatement: string
  baseline: string
  targetCriteria: string
}

type CsvTemplate = {
  name: string
  description: string
  tags: string[]
  goals: CsvGoal[]
}

const VALID_DOMAINS = new Set(['AUDITORY','SPEECH','LANGUAGE','SENSORY','MOTOR','SOCIAL','COGNITIVE','LITERACY','ADAPTIVE'])

function parseCsvTemplates(text: string): CsvTemplate[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []

  // naive CSV split that handles quoted fields
  const splitRow = (line: string): string[] => {
    const cols: string[] = []
    let cur = ''
    let inQ = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') { inQ = !inQ }
      else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = '' }
      else cur += ch
    }
    cols.push(cur.trim())
    return cols
  }

  const map = new Map<string, CsvTemplate>()
  for (let i = 1; i < lines.length; i++) {
    const cols = splitRow(lines[i])
    const [name, description, tagsRaw, goalTitle, domainRaw, goalStatement, baseline, targetCriteria] = cols
    if (!name || !goalTitle) continue
    const domain = domainRaw?.toUpperCase() as IEPGoalDomain
    if (!VALID_DOMAINS.has(domain)) continue

    if (!map.has(name)) {
      map.set(name, {
        name,
        description: description || '',
        tags: tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [],
        goals: [],
      })
    }
    map.get(name)!.goals.push({ goalTitle, domain, goalStatement: goalStatement || '', baseline: baseline || '', targetCriteria: targetCriteria || '' })
  }
  return Array.from(map.values())
}

// ── Domain config ─────────────────────────────────────────────────────────────

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

const DOMAIN_PALETTE: Record<IEPGoalDomain, 'blue' | 'green' | 'yellow' | 'red' | 'slate'> = {
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

function domainLabel(d: IEPGoalDomain) {
  return DOMAINS.find(x => x.value === d)?.label ?? d
}

type ToastFn = (msg: string, type: 'success' | 'error') => void

// ── Domain badge ──────────────────────────────────────────────────────────────

function DomainBadge({ domain }: { domain: IEPGoalDomain }) {
  return (
    <span
      className="inline-flex items-center text-xs font-medium rounded-full px-2.5 py-0.5 flex-shrink-0"
      style={paletteStyle(DOMAIN_PALETTE[domain])}
    >
      {domainLabel(domain)}
    </span>
  )
}

// ── Goal row ──────────────────────────────────────────────────────────────────

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
          <p className="text-xs mt-0.5 leading-relaxed" style={{ color: colors.text.muted }}>{goal.goalStatement}</p>
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

// ── Add Goal modal ────────────────────────────────────────────────────────────

function AddGoalModal({
  open,
  onClose,
  templateId,
  templateName,
  toast,
}: {
  open: boolean
  onClose: () => void
  templateId: string
  templateName: string
  toast: ToastFn
}) {
  const qc = useQueryClient()
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<CreateIEPTemplateGoalRequest>()

  const mut = useMutation({
    mutationFn: (data: CreateIEPTemplateGoalRequest) => iepTemplatesApi.addGoal(templateId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['iep-templates'] })
      toast('Goal added', 'success')
      reset()
      onClose()
    },
    onError: (err) => toast(getApiError(err, 'Failed to add goal'), 'error'),
  })

  return (
    <Modal open={open} onClose={() => { reset(); onClose() }} title={`Add Goal — ${templateName}`}>
      <form onSubmit={handleSubmit(d => mut.mutateAsync(d))} className="space-y-4">
        <Input
          label="Goal title"
          placeholder="e.g. Phoneme Discrimination"
          error={errors.title?.message}
          {...register('title', { required: 'Title is required' })}
        />
        <Select
          label="Domain"
          placeholder="Select domain…"
          options={DOMAINS}
          error={errors.domain?.message}
          {...register('domain', { required: 'Domain is required' })}
        />
        <div>
          <label className="form-label">Goal statement</label>
          <textarea
            className="form-input w-full resize-none"
            rows={3}
            placeholder="Full SMART goal text…"
            {...register('goalStatement')}
          />
        </div>
        <Input label="Baseline" placeholder="Current performance level" {...register('baseline')} />
        <Input label="Target criteria" placeholder='e.g. "80% accuracy over 3 sessions"' {...register('targetCriteria')} />
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={() => { reset(); onClose() }}>Cancel</Button>
          <Button type="submit" loading={isSubmitting || mut.isPending}>Add Goal</Button>
        </div>
      </form>
    </Modal>
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
  onEdit: (t: IEPTemplateResponse) => void
  onDelete: (id: string) => void
  onGoalDelete: (goalId: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [addGoalOpen, setAddGoalOpen] = useState(false)

  return (
    <>
      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: `1px solid ${border.divider}`, background: surface.card }}
      >
        {/* Header row */}
        <div className="flex items-start gap-3 px-5 py-4">
          <button className="flex-1 min-w-0 text-left" onClick={() => setExpanded(v => !v)}>
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
              <p className="text-xs mt-1" style={{ color: colors.text.muted }}>{template.description}</p>
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

        {/* Expanded goals */}
        {expanded && (
          <div className="px-5 pb-4" style={{ borderTop: `1px solid ${border.divider}` }}>
            {template.goals.length === 0 ? (
              <p className="text-xs py-3" style={{ color: colors.text.dim }}>
                No goals yet.{canManage ? ' Add the first goal below.' : ''}
              </p>
            ) : (
              template.goals.map(goal => (
                <GoalItem
                  key={goal.id}
                  goal={goal}
                  canManage={canManage}
                  onDelete={onGoalDelete}
                />
              ))
            )}

            {canManage && (
              <div className="pt-3">
                <Button size="sm" variant="secondary" onClick={() => setAddGoalOpen(true)}>
                  <Plus size={13} /> Add Goal
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <AddGoalModal
        open={addGoalOpen}
        onClose={() => setAddGoalOpen(false)}
        templateId={template.id}
        templateName={template.name}
        toast={toast}
      />
    </>
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
  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } =
    useForm<{ name: string; description: string; tags: string }>({
      defaultValues: {
        name:        editing?.name ?? '',
        description: editing?.description ?? '',
        tags:        editing?.tags.join(', ') ?? '',
      },
    })

  const tagsRaw = watch('tags') ?? ''
  const tagChips = tagsRaw.split(',').map(t => t.trim()).filter(Boolean)

  const parseTags = (raw: string) => raw.split(',').map(t => t.trim()).filter(Boolean)

  const createMut = useMutation({
    mutationFn: (d: { name: string; description: string; tags: string }) =>
      iepTemplatesApi.create({ name: d.name, description: d.description || undefined, tags: parseTags(d.tags) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['iep-templates'] })
      toast('Template created', 'success')
      reset()
      onClose()
    },
    onError: (err) => toast(getApiError(err, 'Failed to create template'), 'error'),
  })

  const updateMut = useMutation({
    mutationFn: (d: { name: string; description: string; tags: string }) =>
      iepTemplatesApi.update(editing!.id, { name: d.name, description: d.description || undefined, tags: parseTags(d.tags) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['iep-templates'] })
      toast('Template updated', 'success')
      reset()
      onClose()
    },
    onError: (err) => toast(getApiError(err, 'Failed to update template'), 'error'),
  })

  const onSubmit = (d: { name: string; description: string; tags: string }) =>
    editing ? updateMut.mutateAsync(d) : createMut.mutateAsync(d)

  return (
    <Modal
      open={open}
      onClose={() => { reset(); onClose() }}
      title={editing ? 'Edit Template' : 'New IEP Template'}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Plan name"
          placeholder="e.g. Annual Speech-Language IEP"
          error={errors.name?.message}
          {...register('name', { required: 'Name is required' })}
        />
        <div>
          <label className="form-label">Description</label>
          <textarea
            className="form-input w-full resize-none"
            placeholder="Brief description of this template's purpose"
            rows={3}
            {...register('description')}
          />
        </div>
        <div>
          <Input
            label="Tags (comma-separated)"
            placeholder="e.g. speech, language, preschool"
            {...register('tags')}
          />
          {tagChips.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {tagChips.map(tag => (
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
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={() => { reset(); onClose() }}>Cancel</Button>
          <Button type="submit" loading={isSubmitting || createMut.isPending || updateMut.isPending}>
            {editing ? 'Save Changes' : 'Create Plan'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function IEPLibraryTab() {
  const { user, activeRole } = useAuth()
  const { toasts, toast, dismiss } = useToast()
  const qc = useQueryClient()

  const currentRole = activeRole ?? user?.role
  const canManage = currentRole === 'BUSINESS_OWNER' || currentRole === 'ADMIN'

  const [modalOpen,        setModalOpen]        = useState(false)
  const [editingTemplate,  setEditingTemplate]  = useState<IEPTemplateResponse | null>(null)
  const [deletingId,       setDeletingId]       = useState<string | null>(null)
  const [csvImporting,     setCsvImporting]     = useState(false)
  const csvInputRef = useRef<HTMLInputElement>(null)

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    const text = await file.text()
    const parsed = parseCsvTemplates(text)
    if (parsed.length === 0) {
      toast('No valid templates found in CSV', 'error')
      return
    }

    setCsvImporting(true)
    let created = 0
    let failed = 0
    for (const t of parsed) {
      try {
        const template = await iepTemplatesApi.create({
          name: t.name,
          description: t.description || undefined,
          tags: t.tags,
        })
        for (const g of t.goals) {
          try {
            await iepTemplatesApi.addGoal(template.id, {
              title: g.goalTitle,
              domain: g.domain,
              goalStatement: g.goalStatement || undefined,
              baseline: g.baseline || undefined,
              targetCriteria: g.targetCriteria || undefined,
            })
          } catch { /* skip individual goal failures */ }
        }
        created++
      } catch { failed++ }
    }
    setCsvImporting(false)
    qc.invalidateQueries({ queryKey: ['iep-templates'] })
    if (created > 0) toast(`${created} template${created !== 1 ? 's' : ''} imported`, 'success')
    if (failed > 0) toast(`${failed} template${failed !== 1 ? 's' : ''} failed`, 'error')
  }

  const { data: templates, isLoading } = useQuery({
    queryKey: ['iep-templates'],
    queryFn: iepTemplatesApi.list,
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
      {/* Header */}
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
          <div className="flex items-center gap-2">
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleCsvUpload}
            />
            <Button variant="secondary" loading={csvImporting} onClick={() => csvInputRef.current?.click()}>
              <Upload size={14} /> Import CSV
            </Button>
            <Button onClick={() => { setEditingTemplate(null); setModalOpen(true) }}>
              <Plus size={14} /> New Template
            </Button>
          </div>
        )}
      </div>

      {/* Template list */}
      {list.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={32} />}
          title="No templates yet"
          description={canManage
            ? 'Create reusable IEP plan templates for your organisation.'
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
              onEdit={t => { setEditingTemplate(t); setModalOpen(true) }}
              onDelete={id => setDeletingId(id)}
              onGoalDelete={goalId => deleteGoalMut.mutate(goalId)}
            />
          ))}
        </div>
      )}

      {/* Create / Edit modal */}
      <TemplateModal
        key={editingTemplate?.id ?? 'new'}
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingTemplate(null) }}
        editing={editingTemplate}
        toast={toast}
      />

      {/* Delete confirmation */}
      <Modal
        open={deletingId !== null}
        onClose={() => setDeletingId(null)}
        title="Delete Template"
        size="sm"
      >
        <p className="text-sm mb-5" style={{ color: colors.text.primary }}>
          This will permanently delete the template and all its goals.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeletingId(null)}>Cancel</Button>
          <Button
            variant="danger"
            loading={deleteMut.isPending}
            onClick={() => deletingId && deleteMut.mutate(deletingId)}
          >
            Delete
          </Button>
        </div>
      </Modal>

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
