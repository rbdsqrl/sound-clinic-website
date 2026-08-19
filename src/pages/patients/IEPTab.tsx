import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import {
  Plus, Upload, Download, ChevronDown, ChevronUp, Check,
  Target, Trash2, FileText, AlertCircle, CheckCircle2,
  Clock, PauseCircle, ShieldCheck, CalendarDays,
} from 'lucide-react'
import { format } from 'date-fns'
import { iepApi } from '../../api/iep'
import { iepTemplatesApi } from '../../api/iep-templates'
import { useAuth } from '../../contexts/AuthContext'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Modal } from '../../components/ui/Modal'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageLoader } from '../../components/ui/Spinner'
import { useToast } from '../../hooks/useToast'
import { getApiError } from '../../lib/apiError'
import { colors, border, surface, accentAlpha, paletteStyle, palette } from '../../theme'
import type {
  IEPGoalResponse, IEPGoalStatus, IEPGoalDomain, IEPTemplateResponse,
  CreateIEPPlanRequest, CreateIEPGoalRequest, UpdateIEPGoalRequest,
} from '../../types'

// ── Constants ─────────────────────────────────────────────────────────────────

const DOMAINS: { value: IEPGoalDomain; label: string }[] = [
  { value: 'AUDITORY',  label: 'Auditory Processing'      },
  { value: 'SPEECH',    label: 'Speech Production'        },
  { value: 'LANGUAGE',  label: 'Language'                 },
  { value: 'SENSORY',   label: 'Sensory Processing'       },
  { value: 'MOTOR',     label: 'Motor Skills'             },
  { value: 'SOCIAL',    label: 'Social Communication'     },
  { value: 'COGNITIVE', label: 'Cognitive Skills'         },
  { value: 'LITERACY',  label: 'Literacy'                 },
  { value: 'ADAPTIVE',  label: 'Adaptive / Daily Living'  },
]

const STATUS_META: Record<IEPGoalStatus, { label: string; icon: React.ElementType; dot: string }> = {
  IN_PROGRESS:      { label: 'Progress',          icon: Clock,        dot: '#3b82f6' },
  COMPLETED:        { label: 'Completed',          icon: CheckCircle2, dot: '#16a34a' },
  ON_HOLD:          { label: 'On hold',            icon: PauseCircle,  dot: '#d97706' },
  PENDING_APPROVAL: { label: 'Pending Approval',   icon: AlertCircle,  dot: '#f59e0b' },
  APPROVED:         { label: 'Approved',           icon: ShieldCheck,  dot: '#7c3aed' },
}

const GOAL_STATUSES: { value: IEPGoalStatus; label: string }[] = Object.entries(STATUS_META)
  .map(([k, v]) => ({ value: k as IEPGoalStatus, label: v.label }))

const PROGRESS_TAGS = [
  { value: 'A', short: 'A. Below expectations',       full: 'A. Below expectations — 0–25% achieved, demonstrates minimal understanding or ability to perform the skill.' },
  { value: 'B', short: 'B. Approaching expectations', full: 'B. Approaching expectations — 26–50% achieved, shows some understanding and attempts the skill, but needs significant support.' },
  { value: 'C', short: 'C. Meeting expectations',     full: 'C. Meeting expectations — 51–75% achieved, consistently performs the skill with moderate support.' },
  { value: 'D', short: 'D. Exceeding expectations',   full: 'D. Exceeding expectations — 76–90% achieved, independently performs the skill with accuracy and fluency, only needing occasional prompts.' },
  { value: 'E', short: 'E. Mastery',                  full: 'E. Mastery — 91–100% achieved, demonstrates complete mastery of the skill, consistently performing it independently and accurately.' },
]

const CSV_COLUMNS = [
  { col: 'plan_title',           req: true,  desc: 'Name of the IEP plan (rows with the same name share a plan)' },
  { col: 'plan_start_date',      req: false, desc: 'Plan start date — YYYY-MM-DD' },
  { col: 'plan_end_date',        req: false, desc: 'Plan end date — YYYY-MM-DD' },
  { col: 'plan_tags',            req: false, desc: 'Comma-separated tags (quote the field if it contains commas)' },
  { col: 'goal_title',           req: true,  desc: 'Short name for this goal' },
  { col: 'goal_statement',       req: false, desc: 'Full SMART goal text' },
  { col: 'goal_domain',          req: true,  desc: 'One of: AUDITORY, SPEECH, LANGUAGE, SENSORY, MOTOR, SOCIAL, COGNITIVE, LITERACY, ADAPTIVE' },
  { col: 'goal_baseline',        req: false, desc: 'Current performance level' },
  { col: 'goal_target_criteria', req: false, desc: 'Success criterion, e.g. "80% accuracy over 3 sessions"' },
  { col: 'goal_target_date',     req: false, desc: 'Goal target date — YYYY-MM-DD' },
]

const SAMPLE_ROWS = [
  ['Annual IEP 2025', '2025-01-01', '2025-12-31', '"speech,language"', 'Phoneme Discrimination', 'Student will identify minimal pairs with 80% accuracy', 'AUDITORY', 'Currently 50% on /p/ vs /b/', '80% across 3 sessions', '2025-06-30'],
  ['Annual IEP 2025', '', '', '', 'Expressive Vocabulary', 'Student will use 50 new action words spontaneously', 'LANGUAGE', 'Uses ~20 action words consistently', '50 novel words in conversation', '2025-09-30'],
  ['Motor Skills Plan', '2025-03-01', '2025-12-31', 'motor', 'Pincer Grasp', 'Student will pick up small objects using pincer grasp independently', 'MOTOR', 'Requires hand-over-hand assistance', 'Independent in 4/5 trials', '2025-12-01'],
]

// ── Goal row ──────────────────────────────────────────────────────────────────

function GoalRow({ goal, isEditor, onStatusChange, onProgressTagChange, onDelete, onLogProgress }: {
  goal: IEPGoalResponse
  isEditor: boolean
  onStatusChange: (id: string, status: IEPGoalStatus) => void
  onProgressTagChange: (id: string, tag: string) => void
  onDelete: (id: string) => void
  onLogProgress: (goal: IEPGoalResponse) => void
}) {
  const statusMeta = STATUS_META[goal.status]

  return (
    <div className="relative flex gap-3 mb-5 last:mb-0">
      {/* Filled square bullet */}
      <div className="flex-shrink-0 flex flex-col items-center" style={{ width: 16, marginTop: 3 }}>
        <div className="w-3 h-3 rounded-sm" style={{ background: colors.accent }} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Goal text — full statement as primary display */}
        <p className="text-sm leading-relaxed mb-2.5" style={{ color: colors.text.primary }}>
          {goal.goalStatement || goal.title}
        </p>

        {/* Controls row */}
        <div className="flex items-center gap-2 flex-wrap">

          {/* Progress status */}
          {isEditor ? (
            <div className="relative">
              <select
                value={goal.status}
                onChange={e => onStatusChange(goal.id, e.target.value as IEPGoalStatus)}
                className="appearance-none text-xs rounded-full pl-5 pr-6 py-1 border outline-none cursor-pointer"
                style={{ borderColor: border.divider, background: surface.card, color: colors.text.primary }}
              >
                {GOAL_STATUSES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              {/* Colored dot overlay */}
              <span
                className="absolute left-1.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full pointer-events-none"
                style={{ background: statusMeta.dot }}
              />
              <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: colors.text.dim }} />
            </div>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs rounded-full px-3 py-1 border" style={{ borderColor: border.divider, background: surface.card, color: colors.text.primary }}>
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: statusMeta.dot }} />
              {statusMeta.label}
            </span>
          )}

          {/* Progress session count */}
          <span className="inline-flex items-center gap-1 text-xs" style={{ color: colors.text.dim }}>
            <FileText size={11} />
            {goal.progressCount}
          </span>

          {/* Progress date / sessions */}
          <span className="inline-flex items-center gap-1 text-xs" style={{ color: colors.text.dim }}>
            <CalendarDays size={11} />
            {goal.progressCount}
          </span>

          {/* Grade / Progress tag */}
          {isEditor ? (
            <div className="relative">
              <select
                value={goal.progressTag ?? ''}
                onChange={e => onProgressTagChange(goal.id, e.target.value)}
                className="appearance-none text-xs rounded-full pl-3 pr-6 py-1 border outline-none cursor-pointer max-w-[140px] truncate"
                style={{
                  borderColor: goal.progressTag ? accentAlpha(0.30) : border.divider,
                  background: goal.progressTag ? accentAlpha(0.06) : surface.card,
                  color: goal.progressTag ? colors.accent : colors.text.dim,
                }}
              >
                <option value="">No Progress Tag</option>
                {PROGRESS_TAGS.map(t => (
                  <option key={t.value} value={t.value}>{t.short}</option>
                ))}
              </select>
              <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: colors.text.dim }} />
            </div>
          ) : (
            goal.progressTag && (
              <span
                className="inline-flex items-center text-xs rounded-full px-3 py-1"
                style={{ background: accentAlpha(0.08), color: colors.accent, border: `1px solid ${accentAlpha(0.20)}` }}
              >
                {PROGRESS_TAGS.find(t => t.value === goal.progressTag)?.short ?? goal.progressTag}
              </span>
            )
          )}

          {/* Editor-only actions */}
          {isEditor && (
            <>
              <button
                onClick={() => onLogProgress(goal)}
                className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full transition-colors"
                style={{ background: accentAlpha(0.08), color: colors.accent, border: `1px solid ${accentAlpha(0.18)}` }}
                title="Log progress"
              >
                <Plus size={11} /> Progress
              </button>
              <button
                onClick={() => onDelete(goal.id)}
                className="p-1 rounded-lg transition-opacity hover:opacity-60"
                style={{ color: colors.text.dim }}
                title="Delete goal"
              >
                <Trash2 size={13} />
              </button>
            </>
          )}
        </div>

        {/* Expanded details (baseline / target / due) */}
        {(goal.baseline || goal.targetCriteria || goal.targetDate || goal.therapistName) && (
          <div className="mt-2 space-y-1 text-xs" style={{ color: colors.text.dim }}>
            {goal.baseline && (
              <p><span className="font-medium" style={{ color: colors.text.muted }}>Baseline:</span> {goal.baseline}</p>
            )}
            {goal.targetCriteria && (
              <p><span className="font-medium" style={{ color: colors.text.muted }}>Target:</span> {goal.targetCriteria}</p>
            )}
            {goal.targetDate && (
              <p><span className="font-medium" style={{ color: colors.text.muted }}>Due:</span> {format(new Date(goal.targetDate), 'dd MMM yyyy')}</p>
            )}
            {goal.therapistName && (
              <p><span className="font-medium" style={{ color: colors.text.muted }}>Assigned:</span> {goal.therapistName}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Completion ring ───────────────────────────────────────────────────────────

function CompletionRing({ completed, total }: { completed: number; total: number }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0
  const r = 18
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ

  return (
    <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
      <div className="relative w-14 h-14">
        <svg viewBox="0 0 44 44" className="w-full h-full rotate-[-90deg]">
          <circle cx="22" cy="22" r={r} fill="none" strokeWidth="3.5" stroke={border.divider} />
          <circle
            cx="22" cy="22" r={r} fill="none" strokeWidth="3.5"
            stroke="var(--color-accent)"
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.4s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[13.2px] font-bold leading-none" style={{ color: colors.accent }}>
            {completed}/{total}
          </span>
        </div>
      </div>
      <p className="text-[12px]" style={{ color: colors.text.dim }}>Completed</p>
    </div>
  )
}

// ── CSV Guide modal ───────────────────────────────────────────────────────────

function CsvGuideModal({ open, onClose, onFileSelect }: {
  open: boolean
  onClose: () => void
  onFileSelect: (file: File) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [previewRows, setPreviewRows] = useState<string[][]>([])
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSelectedFile(file)
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      const lines = text.trim().split(/\r?\n/).slice(0, 6)
      setPreviewRows(lines.map(parseCsvRowPreview))
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const downloadSample = () => {
    const csvContent = [
      CSV_COLUMNS.map(c => c.col).join(','),
      ...SAMPLE_ROWS.map(r => r.join(',')),
    ].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'iep-import-sample.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const close = () => { setSelectedFile(null); setPreviewRows([]); onClose() }

  return (
    <Modal open={open} onClose={close} title="Import IEP Plans via CSV">
      <div className="space-y-5">
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium" style={{ color: colors.text.primary }}>CSV Format</p>
            <button
              onClick={downloadSample}
              className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg"
              style={{ background: accentAlpha(0.08), color: colors.accent, border: `1px solid ${accentAlpha(0.18)}` }}
            >
              <Download size={12} /> Download Sample
            </button>
          </div>
          <div className="rounded-xl overflow-hidden border text-xs" style={{ borderColor: border.divider }}>
            <table className="w-full">
              <thead>
                <tr style={{ background: accentAlpha(0.05), borderBottom: `1px solid ${border.divider}` }}>
                  <th className="text-left px-3 py-2 font-semibold" style={{ color: colors.text.dim }}>Column</th>
                  <th className="text-left px-3 py-2 font-semibold" style={{ color: colors.text.dim }}>Req</th>
                  <th className="text-left px-3 py-2 font-semibold" style={{ color: colors.text.dim }}>Description</th>
                </tr>
              </thead>
              <tbody>
                {CSV_COLUMNS.map((col, i) => (
                  <tr key={col.col} style={{ borderBottom: i < CSV_COLUMNS.length - 1 ? `1px solid ${border.divider}` : undefined }}>
                    <td className="px-3 py-2 font-mono whitespace-nowrap" style={{ color: colors.accent }}>{col.col}</td>
                    <td className="px-3 py-2">
                      {col.req
                        ? <span style={{ color: palette.teal.text }}>Yes</span>
                        : <span style={{ color: colors.text.dim }}>No</span>}
                    </td>
                    <td className="px-3 py-2" style={{ color: colors.text.muted }}>{col.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs" style={{ color: colors.text.dim }}>
            Rows sharing the same <code className="font-mono px-1 rounded" style={{ background: accentAlpha(0.08) }}>plan_title</code> are grouped into one plan.
          </p>
        </div>

        <div
          className="border-2 border-dashed rounded-xl p-6 flex flex-col items-center gap-3 cursor-pointer"
          style={{ borderColor: selectedFile ? accentAlpha(0.40) : border.divider, background: selectedFile ? accentAlpha(0.03) : 'transparent' }}
          onClick={() => fileRef.current?.click()}
        >
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
          {selectedFile ? (
            <>
              <Check size={24} style={{ color: colors.accent }} />
              <p className="text-sm font-medium" style={{ color: colors.accent }}>{selectedFile.name}</p>
              <p className="text-xs" style={{ color: colors.text.dim }}>Click to choose a different file</p>
            </>
          ) : (
            <>
              <Upload size={24} style={{ color: colors.text.dim }} />
              <p className="text-sm font-medium" style={{ color: colors.text.primary }}>Click to select your CSV file</p>
              <p className="text-xs" style={{ color: colors.text.dim }}>or drag and drop</p>
            </>
          )}
        </div>

        {previewRows.length > 0 && (
          <div>
            <p className="text-xs font-medium mb-2" style={{ color: colors.text.muted }}>
              Preview ({previewRows.length - 1} row{previewRows.length - 1 !== 1 ? 's' : ''})
            </p>
            <div className="overflow-x-auto rounded-xl border text-xs" style={{ borderColor: border.divider }}>
              <table className="w-full">
                <thead>
                  <tr style={{ background: accentAlpha(0.05), borderBottom: `1px solid ${border.divider}` }}>
                    {previewRows[0]?.map((h, i) => (
                      <th key={i} className="px-3 py-2 text-left font-semibold whitespace-nowrap" style={{ color: colors.text.dim }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.slice(1).map((row, ri) => (
                    <tr key={ri} style={{ borderBottom: ri < previewRows.length - 2 ? `1px solid ${border.divider}` : undefined }}>
                      {row.map((cell, ci) => (
                        <td key={ci} className="px-3 py-2 max-w-[160px] truncate" style={{ color: colors.text.primary }} title={cell}>{cell || '—'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={close}>Cancel</Button>
          <Button onClick={() => { if (selectedFile) { onFileSelect(selectedFile); close() } }} disabled={!selectedFile}>
            <Upload size={14} /> Import
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function parseCsvRowPreview(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQuotes) {
      if (c === '"' && i + 1 < line.length && line[i + 1] === '"') { current += '"'; i++ }
      else if (c === '"') inQuotes = false
      else current += c
    } else {
      if (c === '"') inQuotes = true
      else if (c === ',') { fields.push(current); current = '' }
      else current += c
    }
  }
  fields.push(current)
  return fields
}

// ── Add Plan modal ────────────────────────────────────────────────────────────

function AddPlanModal({ open, onClose, patientId }: {
  open: boolean
  onClose: () => void
  patientId: string
}) {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [selectedTemplate, setSelectedTemplate] = useState<IEPTemplateResponse | null>(null)

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<{
    title: string; startDate: string; endDate: string; tags: string
  }>()

  const { data: templates = [] } = useQuery({
    queryKey: ['iep-templates'],
    queryFn: iepTemplatesApi.list,
    enabled: open,
  })

  const pickTemplate = (t: IEPTemplateResponse) => {
    if (selectedTemplate?.id === t.id) {
      setSelectedTemplate(null)
      setValue('title', '')
      setValue('tags', '')
    } else {
      setSelectedTemplate(t)
      setValue('title', t.name)
      if (t.tags.length > 0) setValue('tags', t.tags.join(', '))
    }
  }

  const handleClose = () => { reset(); setSelectedTemplate(null); onClose() }

  const mut = useMutation({
    mutationFn: async (data: CreateIEPPlanRequest) => {
      const plan = await iepApi.createPlan(patientId, data)
      if (selectedTemplate) {
        for (const g of selectedTemplate.goals) {
          if (!g.domain) continue
          await iepApi.addGoal(plan.id, {
            title: g.title,
            domain: g.domain,
            goalStatement: g.goalStatement,
            baseline: g.baseline,
            targetCriteria: g.targetCriteria,
          })
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['iep'] })
      toast('IEP plan created', 'success')
      handleClose()
    },
    onError: (err) => toast(getApiError(err, 'Failed to create plan'), 'error'),
  })

  const onSubmit = (data: { title: string; startDate: string; endDate: string; tags: string }) => {
    const tags = data.tags ? data.tags.split(',').map(t => t.trim()).filter(Boolean) : []
    return mut.mutateAsync({ title: data.title, startDate: data.startDate || undefined, endDate: data.endDate || undefined, tags })
  }

  return (
    <Modal open={open} onClose={handleClose} title="New IEP Plan" size="lg">
      {templates.length > 0 && (
        <div className="mb-5 pb-5 border-b" style={{ borderColor: border.divider }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2.5" style={{ color: colors.text.dim }}>
            Start from template <span className="normal-case font-normal tracking-normal" style={{ color: colors.text.muted }}>(optional)</span>
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
            {templates.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => pickTemplate(t)}
                className="text-left rounded-xl px-3 py-2.5 transition-all"
                style={selectedTemplate?.id === t.id
                  ? { border: `1.5px solid ${colors.accent}`, background: accentAlpha(0.06) }
                  : { border: `1px solid ${border.divider}`, background: surface.card }
                }
              >
                <p className="text-sm font-medium truncate" style={{ color: selectedTemplate?.id === t.id ? colors.accent : colors.text.primary }}>
                  {t.name}
                </p>
                <p className="text-xs mt-0.5" style={{ color: colors.text.dim }}>
                  {t.goalCount} goal{t.goalCount !== 1 ? 's' : ''}
                  {t.tags.length > 0 && ` · ${t.tags.slice(0, 2).join(', ')}`}
                </p>
              </button>
            ))}
          </div>
          {selectedTemplate && (
            <p className="text-xs mt-2.5" style={{ color: colors.accent }}>
              {selectedTemplate.goalCount} goal{selectedTemplate.goalCount !== 1 ? 's' : ''} will be added automatically
              {' · '}
              <button type="button" onClick={() => { setSelectedTemplate(null); setValue('title', ''); setValue('tags', '') }} className="underline">
                Clear
              </button>
            </p>
          )}
        </div>
      )}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input label="Plan title" placeholder="e.g. Annual IEP 2025" error={errors.title?.message}
          {...register('title', { required: 'Title is required' })} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Start date" type="date" {...register('startDate')} />
          <Input label="End date"   type="date" {...register('endDate')} />
        </div>
        <Input label="Tags" placeholder="speech, language, motor (comma-separated)" {...register('tags')} />
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={handleClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting || mut.isPending}>Create Plan</Button>
        </div>
      </form>
    </Modal>
  )
}

// ── Add Goal modal ────────────────────────────────────────────────────────────

function AddGoalModal({ open, onClose, planId, planTitle }: {
  open: boolean
  onClose: () => void
  planId: string
  planTitle: string
}) {
  const { toast } = useToast()
  const qc = useQueryClient()
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<CreateIEPGoalRequest>()

  const mut = useMutation({
    mutationFn: (data: CreateIEPGoalRequest) => iepApi.addGoal(planId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['iep'] })
      toast('Goal added', 'success')
      reset()
      onClose()
    },
    onError: (err) => toast(getApiError(err, 'Failed to add goal'), 'error'),
  })

  return (
    <Modal open={open} onClose={() => { reset(); onClose() }} title={`Add Goal — ${planTitle}`}>
      <form onSubmit={handleSubmit(d => mut.mutateAsync(d))} className="space-y-4">
        <Input label="Goal title" placeholder="e.g. Phoneme Discrimination" error={errors.title?.message}
          {...register('title', { required: 'Required' })} />
        <Select label="Domain" placeholder="Select domain…" options={DOMAINS} error={errors.domain?.message}
          {...register('domain', { required: 'Required' })} />
        <div>
          <label className="form-label">Goal statement</label>
          <textarea className="form-input resize-none" rows={3}
            placeholder="Full SMART goal text…" {...register('goalStatement')} />
        </div>
        <Input label="Baseline" placeholder="Current performance level" {...register('baseline')} />
        <Input label="Target criteria" placeholder='e.g. "80% accuracy over 3 sessions"' {...register('targetCriteria')} />
        <Input label="Target date" type="date" {...register('targetDate')} />
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={() => { reset(); onClose() }}>Cancel</Button>
          <Button type="submit" loading={isSubmitting || mut.isPending}>Add Goal</Button>
        </div>
      </form>
    </Modal>
  )
}

// ── Log Progress modal ────────────────────────────────────────────────────────

function LogProgressModal({ open, onClose, goal, patientId }: {
  open: boolean
  onClose: () => void
  goal: IEPGoalResponse | null
  patientId: string
}) {
  const { toast } = useToast()
  const qc = useQueryClient()
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<{
    sessionDate: string; note: string; trialsPassed: string; trialsTotal: string
  }>({ defaultValues: { sessionDate: new Date().toISOString().split('T')[0] } })

  const mut = useMutation({
    mutationFn: (data: { sessionDate: string; note: string; trialsPassed: string; trialsTotal: string }) =>
      iepApi.addProgress(goal!.id, {
        sessionDate: data.sessionDate,
        note: data.note || undefined,
        trialsPassed: data.trialsPassed ? parseInt(data.trialsPassed) : undefined,
        trialsTotal: data.trialsTotal ? parseInt(data.trialsTotal) : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['iep'] })
      toast('Progress logged', 'success')
      reset({ sessionDate: new Date().toISOString().split('T')[0] })
      onClose()
    },
    onError: (err) => toast(getApiError(err, 'Failed to log progress'), 'error'),
  })

  if (!goal) return null

  return (
    <Modal open={open} onClose={() => { reset(); onClose() }} title={`Log Progress — ${goal.title}`}>
      <form onSubmit={handleSubmit(d => mut.mutateAsync(d))} className="space-y-4">
        <Input label="Session date" type="date" {...register('sessionDate', { required: 'Required' })} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Trials passed" type="number" placeholder="e.g. 4" {...register('trialsPassed')} />
          <Input label="Trials total"  type="number" placeholder="e.g. 5" {...register('trialsTotal')} />
        </div>
        <div>
          <label className="form-label">Note</label>
          <textarea className="form-input resize-none" rows={3} placeholder="Describe the session…" {...register('note')} />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={() => { reset(); onClose() }}>Cancel</Button>
          <Button type="submit" loading={isSubmitting || mut.isPending}>Save</Button>
        </div>
      </form>
    </Modal>
  )
}

// ── Main IEP Tab ──────────────────────────────────────────────────────────────

export default function IEPTab({ patientId }: { patientId: string }) {
  const { toast } = useToast()
  const qc = useQueryClient()
  const { activeRole } = useAuth()
  const isEditor = activeRole !== 'PARENT'

  const [showPlanModal,  setShowPlanModal]  = useState(false)
  const [showCsvModal,   setShowCsvModal]   = useState(false)
  const [addGoalTarget,  setAddGoalTarget]  = useState<{ id: string; title: string } | null>(null)
  const [progressTarget, setProgressTarget] = useState<IEPGoalResponse | null>(null)
  const [expandedPlans,  setExpandedPlans]  = useState<Set<string>>(new Set())

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['iep', patientId],
    queryFn: () => iepApi.listPlans(patientId),
  })

  const importMut = useMutation({
    mutationFn: (file: File) => iepApi.importCsv(patientId, file),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['iep'] })
      const msg = `${result.plansCreated} plan${result.plansCreated !== 1 ? 's' : ''} · ${result.goalsCreated} goal${result.goalsCreated !== 1 ? 's' : ''} imported`
      toast(result.errors.length > 0 ? `${msg} (${result.errors.length} errors)` : msg, result.errors.length > 0 ? 'error' : 'success')
    },
    onError: (err) => toast(getApiError(err, 'Import failed'), 'error'),
  })

  const updateGoalMut = useMutation({
    mutationFn: ({ goalId, data }: { goalId: string; data: UpdateIEPGoalRequest }) =>
      iepApi.updateGoal(goalId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['iep'] }),
    onError: (err) => toast(getApiError(err, 'Failed to update goal'), 'error'),
  })

  const deletePlanMut = useMutation({
    mutationFn: iepApi.deletePlan,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['iep'] }); toast('Plan deleted', 'success') },
    onError: (err) => toast(getApiError(err, 'Failed to delete plan'), 'error'),
  })

  const deleteGoalMut = useMutation({
    mutationFn: iepApi.deleteGoal,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['iep'] }); toast('Goal deleted', 'success') },
    onError: (err) => toast(getApiError(err, 'Failed to delete goal'), 'error'),
  })

  const togglePlan = (id: string) =>
    setExpandedPlans(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })

  const totalGoals = plans.flatMap(p => p.goals).length
  const totalCompleted = plans.reduce((acc, p) => acc + p.completedGoals, 0)

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-semibold" style={{ color: colors.text.heading }}>
            IEP Goals
            <span className="ml-1.5 text-sm font-normal" style={{ color: colors.text.dim }}>({totalGoals})</span>
          </h2>
          <p className="text-xs mt-0.5" style={{ color: colors.text.muted }}>
            {plans.length} plan{plans.length !== 1 ? 's' : ''} · {totalCompleted} of {totalGoals} completed
          </p>
        </div>
        {isEditor && (
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setShowCsvModal(true)} loading={importMut.isPending}>
              <Upload size={14} /> Import CSV
            </Button>
            <Button onClick={() => setShowPlanModal(true)}>
              <Plus size={14} /> New Plan
            </Button>
          </div>
        )}
      </div>

      {/* ── Plan list ── */}
      {plans.length === 0 ? (
        <EmptyState
          icon={<Target size={32} />}
          title="No IEP plans yet"
          description={isEditor ? 'Create a plan manually or import from a CSV file.' : 'No IEP plans have been created for this child yet.'}
          action={isEditor ? { label: 'New Plan', onClick: () => setShowPlanModal(true) } : undefined}
        />
      ) : (
        <div className="space-y-3">
          {plans.map(plan => {
            const isOpen = expandedPlans.has(plan.id)

            return (
              <div key={plan.id} className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${border.divider}`, background: 'var(--surface-card)' }}>
                {/* Plan header */}
                <button
                  className="w-full flex items-center gap-4 px-5 py-4 text-left transition-colors"
                  onClick={() => togglePlan(plan.id)}
                  style={{ background: isOpen ? accentAlpha(0.03) : 'transparent' }}
                >
                  {/* Plan info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-semibold text-sm" style={{ color: colors.text.primary }}>{plan.title}</p>
                      {plan.tags.map(tag => (
                        <span key={tag} className="text-[13.2px] px-2 py-0.5 rounded-full" style={paletteStyle('purple', 0.07, 0.12)}>{tag}</span>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 text-xs flex-wrap" style={{ color: colors.text.dim }}>
                      {plan.therapistName && <span>{plan.therapistName}</span>}
                      {plan.startDate && plan.endDate && (
                        <span>{format(new Date(plan.startDate), 'dd MMM yyyy')} – {format(new Date(plan.endDate), 'dd MMM yyyy')}</span>
                      )}
                    </div>
                  </div>

                  {/* Completion ring + chevron */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <CompletionRing completed={plan.completedGoals} total={plan.totalGoals} />
                    {isOpen
                      ? <ChevronUp size={16} style={{ color: colors.text.dim }} />
                      : <ChevronDown size={16} style={{ color: colors.text.dim }} />}
                  </div>
                </button>

                {/* Goal timeline */}
                {isOpen && (
                  <div className="px-5 pb-5 border-t" style={{ borderColor: border.divider }}>
                    {plan.goals.length === 0 ? (
                      <p className="text-xs py-4 text-center" style={{ color: colors.text.dim }}>
                        No goals yet{isEditor ? ' — add one below' : ''}.
                      </p>
                    ) : (
                      <div className="relative mt-4 ml-2 pl-5 border-l-2" style={{ borderColor: accentAlpha(0.25) }}>
                        {plan.goals.map(goal => (
                          <GoalRow
                            key={goal.id}
                            goal={goal}
                            isEditor={isEditor}
                            onStatusChange={(id, status) => updateGoalMut.mutate({ goalId: id, data: { status } })}
                            onProgressTagChange={(id, tag) => updateGoalMut.mutate({ goalId: id, data: { progressTag: tag } })}
                            onDelete={id => deleteGoalMut.mutate(id)}
                            onLogProgress={g => setProgressTarget(g)}
                          />
                        ))}
                      </div>
                    )}

                    {isEditor && (
                      <div className="flex items-center justify-between mt-4 pt-3 border-t" style={{ borderColor: border.divider }}>
                        <button
                          onClick={() => setAddGoalTarget({ id: plan.id, title: plan.title })}
                          className="flex items-center gap-1.5 text-xs font-medium"
                          style={{ color: colors.accent }}
                        >
                          <Plus size={13} /> Add ST Goal
                        </button>
                        <button
                          onClick={() => deletePlanMut.mutate(plan.id)}
                          disabled={deletePlanMut.isPending}
                          className="flex items-center gap-1 text-xs hover:opacity-70 transition-opacity"
                          style={{ color: colors.text.dim }}
                        >
                          <Trash2 size={12} /> Delete Plan
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modals ── */}
      {isEditor && (
        <>
          <AddPlanModal
            open={showPlanModal}
            onClose={() => setShowPlanModal(false)}
            patientId={patientId}
          />

          <CsvGuideModal
            open={showCsvModal}
            onClose={() => setShowCsvModal(false)}
            onFileSelect={file => importMut.mutate(file)}
          />

          {addGoalTarget && (
            <AddGoalModal
              open={!!addGoalTarget}
              onClose={() => setAddGoalTarget(null)}
              planId={addGoalTarget.id}
              planTitle={addGoalTarget.title}
            />
          )}

          <LogProgressModal
            open={!!progressTarget}
            onClose={() => setProgressTarget(null)}
            goal={progressTarget}
            patientId={patientId}
          />
        </>
      )}
    </div>
  )
}
