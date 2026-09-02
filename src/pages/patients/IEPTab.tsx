import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import {
  Plus, Upload, Download, ChevronDown, ChevronUp, Check,
  Target, Trash2, FileText, AlertCircle, CheckCircle2,
  Clock, PauseCircle, ShieldCheck, CalendarDays, Pencil,
  ArrowLeft, Layers,
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
  IEPGoalResponse, IEPGoalStatus, IEPGoalDomain, IEPTemplateResponse, TherapistSummary,
  CreateIEPPlanRequest, CreateIEPGoalRequest, UpdateIEPGoalRequest, IEPGoalProgressResponse,
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
  { value: 'A', short: 'A. Below expectations',       full: 'A. Below expectations - 0-25% achieved, demonstrates minimal understanding or ability to perform the skill.' },
  { value: 'B', short: 'B. Approaching expectations', full: 'B. Approaching expectations - 26-50% achieved, shows some understanding and attempts the skill, but needs significant support.' },
  { value: 'C', short: 'C. Meeting expectations',     full: 'C. Meeting expectations - 51-75% achieved, consistently performs the skill with moderate support, demonstrating a good grasp of the concept.' },
  { value: 'D', short: 'D. Exceeding expectations',   full: 'D. Exceeding expectations - 76-90% achieved, independently performs the skill with accuracy and fluency, only needing occasional prompts.' },
  { value: 'E', short: 'E. Mastery',                  full: 'E. Mastery - 91-100% achieved, demonstrates complete mastery of the skill, consistently performing it independently and accurately.' },
]

// ── Progress tag picker (custom dropdown — shows % ranges + descriptions) ─────

function ProgressTagPicker({ value, onChange }: { value: string | null; onChange: (tag: string) => void }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ left: number; openUpward: boolean; top: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const selected = PROGRESS_TAGS.find(t => t.value === value)
  const panelHeight = 360

  useEffect(() => {
    if (!open) return
    const handle = (e: MouseEvent) => {
      const target = e.target as Node
      if (buttonRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  useEffect(() => {
    if (!open || !buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    const openUpward = spaceBelow < panelHeight && spaceAbove > spaceBelow
    setPos({
      left: rect.left + window.scrollX,
      top: (openUpward ? rect.top - 6 : rect.bottom + 6) + window.scrollY,
      openUpward,
    })
  }, [open])

  const select = (tag: string) => {
    onChange(tag)
    setOpen(false)
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1 text-xs rounded-full pl-3 pr-2 py-1 border outline-none cursor-pointer max-w-[140px]"
        style={{
          borderColor: value ? accentAlpha(0.30) : border.divider,
          background: value ? accentAlpha(0.06) : surface.card,
          color: value ? colors.accent : colors.text.dim,
        }}
      >
        <span className="truncate">{selected ? selected.short : 'No Progress Tag'}</span>
        <ChevronDown size={10} style={{ color: value ? colors.accent : colors.text.dim, flexShrink: 0 }} />
      </button>

      {open && pos && createPortal(
        <div
          ref={panelRef}
          className="fixed z-50 rounded-2xl overflow-hidden"
          style={{
            left: pos.left,
            ...(pos.openUpward ? { transform: 'translateY(-100%)' } : {}),
            top: pos.top,
            background: surface.card,
            border: `1px solid ${border.medium}`,
            boxShadow: '0 12px 40px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)',
            width: '340px',
            maxWidth: '86vw',
          }}
        >
          <div className="py-1.5 overflow-y-auto" style={{ maxHeight: 'min(60vh, 360px)' }}>
            <button
              type="button"
              onClick={() => select('')}
              className="w-full text-left px-3 py-2 text-sm transition-colors"
              style={{ color: colors.text.muted, background: !value ? accentAlpha(0.08) : 'transparent' }}
              onMouseEnter={e => { if (value) (e.currentTarget as HTMLElement).style.background = accentAlpha(0.05) }}
              onMouseLeave={e => { if (value) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              No Progress Tag
            </button>

            <div style={{ borderTop: `1px solid ${border.divider}` }} className="mt-1 pt-1">
              {PROGRESS_TAGS.map(t => {
                const isSelected = t.value === value
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => select(t.value)}
                    className="w-full text-left px-3 py-2 text-sm leading-snug flex items-start justify-between gap-2 transition-colors"
                    style={{
                      color: isSelected ? colors.accent : colors.text.primary,
                      background: isSelected ? accentAlpha(0.08) : 'transparent',
                    }}
                    onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = accentAlpha(0.05) }}
                    onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                  >
                    <span>{t.full}</span>
                    {isSelected && <Check size={14} className="flex-shrink-0 mt-0.5" />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

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

function GoalRow({ goal, isEditor, onStatusChange, onProgressTagChange, onDelete, onLogProgress, onViewProgress, onEdit }: {
  goal: IEPGoalResponse
  isEditor: boolean
  onStatusChange: (id: string, status: IEPGoalStatus) => void
  onProgressTagChange: (id: string, tag: string) => void
  onDelete: (id: string) => void
  onLogProgress: (goal: IEPGoalResponse) => void
  onViewProgress: (goal: IEPGoalResponse) => void
  onEdit: (goal: IEPGoalResponse) => void
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

          {/* Progress entries logged — click to view history */}
          <button
            onClick={() => onViewProgress(goal)}
            disabled={goal.progressCount === 0}
            className="inline-flex items-center gap-1 text-xs rounded-full px-1.5 py-0.5 transition-opacity hover:opacity-70 disabled:cursor-default disabled:opacity-100"
            style={{ color: colors.text.dim }}
            title={goal.progressCount > 0 ? 'View progress history' : 'No progress logged yet'}
          >
            <FileText size={11} />
            {goal.progressCount}
          </button>

          {/* Latest logged mastery percentage */}
          {goal.latestMasteryPct !== null && (
            <button
              onClick={() => onViewProgress(goal)}
              className="inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5 font-medium transition-opacity hover:opacity-70"
              style={{ background: accentAlpha(0.08), color: colors.accent }}
              title="Trials passed ÷ trials attempted on the most recent progress entry"
            >
              {goal.latestMasteryPct}%
            </button>
          )}

          {/* Grade / Progress tag */}
          {isEditor ? (
            <ProgressTagPicker
              value={goal.progressTag}
              onChange={tag => onProgressTagChange(goal.id, tag)}
            />
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
                onClick={() => onEdit(goal)}
                className="p-1 rounded-lg transition-opacity hover:opacity-60"
                style={{ color: colors.text.dim }}
                title="Edit goal"
              >
                <Pencil size={13} />
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
          <span className="text-[12.65px] font-bold leading-none" style={{ color: colors.accent }}>
            {completed}/{total}
          </span>
        </div>
      </div>
      <p className="text-[11.5px]" style={{ color: colors.text.dim }}>Completed</p>
    </div>
  )
}

// ── Plan therapist badge (view / assign / reassign) ─────────────────────────────

function PlanTherapistBadge({ therapistName, therapists, canAssign, onAssign }: {
  therapistName: string | null
  therapists: TherapistSummary[]
  canAssign: boolean
  onAssign: (therapistId: string) => void
}) {
  const [editing, setEditing] = useState(false)

  if (editing) {
    return (
      <select
        autoFocus
        defaultValue=""
        onClick={e => e.stopPropagation()}
        onBlur={() => setEditing(false)}
        onChange={e => {
          e.stopPropagation()
          if (e.target.value) onAssign(e.target.value)
          setEditing(false)
        }}
        className="text-xs rounded-full px-2 py-0.5 border outline-none cursor-pointer"
        style={{ borderColor: accentAlpha(0.30), background: accentAlpha(0.06), color: colors.accent }}
      >
        <option value="" disabled>Select therapist…</option>
        {therapists.map(t => (
          <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>
        ))}
      </select>
    )
  }

  return (
    <span className="inline-flex items-center gap-1">
      {therapistName ?? 'No therapist assigned'}
      {canAssign && therapists.length > 0 && (
        <button
          onClick={e => { e.stopPropagation(); setEditing(true) }}
          className="hover:opacity-70 transition-opacity"
          style={{ color: colors.text.dim }}
          title={therapistName ? 'Change therapist' : 'Assign therapist'}
        >
          <Pencil size={10} />
        </button>
      )}
    </span>
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

function AddPlanModal({ open, onClose, patientId, therapists, currentUserId }: {
  open: boolean
  onClose: () => void
  patientId: string
  therapists: TherapistSummary[]
  currentUserId?: string
}) {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [mode, setMode] = useState<'choice' | 'template' | 'custom'>('choice')
  const [selectedTemplate, setSelectedTemplate] = useState<IEPTemplateResponse | null>(null)
  const [goalDrafts,   setGoalDrafts]   = useState<CreateIEPGoalRequest[]>([])
  const [showGoalForm, setShowGoalForm] = useState(false)
  const [saveAsTemplate, setSaveAsTemplate] = useState(false)

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<{
    title: string; startDate: string; endDate: string; tags: string; therapistId: string
  }>()

  // Field names deliberately don't collide with the plan-level form's fields above
  // (e.g. "goalTitle" not "title") — two inputs sharing a `name` on the same page
  // confuses the browser's autofill/value-sync heuristics even outside a <form>.
  const {
    register: registerGoal, handleSubmit: handleGoalSubmit, reset: resetGoalForm,
    formState: { errors: goalErrors },
  } = useForm<{
    goalTitle: string; domain: IEPGoalDomain; goalStatement?: string
    baseline?: string; targetCriteria?: string; targetDate?: string
  }>()

  const addGoalDraft = (data: {
    goalTitle: string; domain: IEPGoalDomain; goalStatement?: string
    baseline?: string; targetCriteria?: string; targetDate?: string
  }) => {
    setGoalDrafts(prev => [...prev, {
      title: data.goalTitle, domain: data.domain, goalStatement: data.goalStatement,
      baseline: data.baseline, targetCriteria: data.targetCriteria, targetDate: data.targetDate,
    }])
    resetGoalForm()
    setShowGoalForm(false)
  }

  // Default the therapist: self if the creator is one of the patient's assigned therapists,
  // else the sole assigned therapist, else leave it for the dropdown when there are several.
  useEffect(() => {
    if (!open) return
    const self = therapists.find(t => t.id === currentUserId)
    setValue('therapistId', self ? self.id : (therapists.length === 1 ? therapists[0].id : ''))
  }, [open, therapists, currentUserId, setValue])

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

  const handleClose = () => {
    reset(); setMode('choice'); setSelectedTemplate(null); setGoalDrafts([]); setShowGoalForm(false); setSaveAsTemplate(false)
    resetGoalForm(); onClose()
  }

  const backToChoice = () => {
    setMode('choice'); setSelectedTemplate(null); setValue('title', ''); setValue('tags', '')
  }

  const mut = useMutation({
    mutationFn: async (data: CreateIEPPlanRequest) => {
      const plan = await iepApi.createPlan(patientId, data)

      const templateGoals: CreateIEPGoalRequest[] = selectedTemplate
        ? selectedTemplate.goals
            .filter((g): g is typeof g & { domain: IEPGoalDomain } => !!g.domain)
            .map(g => ({
              title: g.title, domain: g.domain, goalStatement: g.goalStatement,
              baseline: g.baseline, targetCriteria: g.targetCriteria,
            }))
        : []
      const allGoals = [...templateGoals, ...goalDrafts]

      for (const g of allGoals) {
        await iepApi.addGoal(plan.id, g)
      }

      // Bank this plan's goals as a reusable template for future cases too.
      if (saveAsTemplate) {
        const template = await iepTemplatesApi.create({ name: data.title, tags: data.tags })
        for (const g of allGoals) {
          await iepTemplatesApi.addGoal(template.id, {
            title: g.title, goalStatement: g.goalStatement, domain: g.domain,
            baseline: g.baseline, targetCriteria: g.targetCriteria,
          })
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['iep'] })
      if (saveAsTemplate) qc.invalidateQueries({ queryKey: ['iep-templates'] })
      toast('IEP plan created', 'success')
      handleClose()
    },
    onError: (err) => toast(getApiError(err, 'Failed to create plan'), 'error'),
  })

  const onSubmit = (data: { title: string; startDate: string; endDate: string; tags: string; therapistId: string }) => {
    const tags = data.tags ? data.tags.split(',').map(t => t.trim()).filter(Boolean) : []
    return mut.mutateAsync({
      title: data.title, startDate: data.startDate || undefined, endDate: data.endDate || undefined, tags,
      therapistId: data.therapistId || undefined,
    })
  }

  return (
    <Modal open={open} onClose={handleClose} title="New IEP Plan" size="lg">
      {mode === 'choice' ? (
        <div className="space-y-3">
          <p className="text-sm mb-1" style={{ color: colors.text.muted }}>How would you like to start this plan?</p>
          <button
            type="button"
            disabled={templates.length === 0}
            onClick={() => setMode('template')}
            className="w-full flex items-start gap-3 text-left rounded-xl px-4 py-3.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ border: `1px solid ${border.divider}`, background: surface.card }}
          >
            <div className="rounded-lg p-2 flex-shrink-0" style={{ background: accentAlpha(0.1), color: colors.accent }}>
              <Layers size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: colors.text.primary }}>Add from Template</p>
              <p className="text-xs mt-0.5" style={{ color: colors.text.dim }}>
                {templates.length > 0
                  ? `Start from a saved template and its goals (${templates.length} available)`
                  : 'No templates saved yet'}
              </p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setMode('custom')}
            className="w-full flex items-start gap-3 text-left rounded-xl px-4 py-3.5 transition-all"
            style={{ border: `1px solid ${border.divider}`, background: surface.card }}
          >
            <div className="rounded-lg p-2 flex-shrink-0" style={{ background: accentAlpha(0.1), color: colors.accent }}>
              <Pencil size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: colors.text.primary }}>Add custom plan</p>
              <p className="text-xs mt-0.5" style={{ color: colors.text.dim }}>
                Build the plan and its goals from scratch
              </p>
            </div>
          </button>
        </div>
      ) : (
      <>
      <button type="button" onClick={backToChoice}
        className="flex items-center gap-1 text-xs font-medium mb-4" style={{ color: colors.text.muted }}>
        <ArrowLeft size={13} /> Back
      </button>
      {mode === 'template' && (
        <div className="mb-5 pb-5 border-b" style={{ borderColor: border.divider }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2.5" style={{ color: colors.text.dim }}>
            Choose a template
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
      {/* Not a <form> — the inline goal-draft fields below share field names (title, domain, …)
          with this plan form, and two same-named inputs inside one native <form> is a real
          footgun (autofill/reset confusion). Submission is wired up manually instead, same as
          the "Add" goal button already does. */}
      <div className="space-y-4">
        <Input label="Plan title" placeholder="e.g. Annual IEP 2025" error={errors.title?.message}
          {...register('title', { required: 'Title is required' })} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Start date" type="date" {...register('startDate')} />
          <Input label="End date"   type="date" {...register('endDate')} />
        </div>
        <Input label="Tags" placeholder="speech, language, motor (comma-separated)" {...register('tags')} />
        {therapists.length > 0 ? (
          <Select
            label="Therapist"
            placeholder="Select a therapist…"
            options={therapists.map(t => ({ value: t.id, label: `${t.firstName} ${t.lastName}` }))}
            error={errors.therapistId?.message}
            {...register('therapistId', { required: 'Select a therapist' })}
          />
        ) : (
          <p className="text-xs" style={{ color: colors.text.dim }}>
            No therapist assigned to this case yet — a Business Owner or Clinic Head can assign one to this plan later.
          </p>
        )}

        {/* Goals — added inline so a plan doesn't have to start empty */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="form-label !mb-0">
              Goals <span className="font-normal normal-case" style={{ color: colors.text.dim }}>(optional)</span>
            </span>
            {!showGoalForm && (
              <button type="button" onClick={() => setShowGoalForm(true)}
                className="flex items-center gap-1 text-xs font-medium" style={{ color: colors.accent }}>
                <Plus size={13} /> Add Goal
              </button>
            )}
          </div>

          {(selectedTemplate ? selectedTemplate.goalCount : 0) > 0 && (
            <p className="text-xs mb-2" style={{ color: colors.text.dim }}>
              + {selectedTemplate!.goalCount} goal{selectedTemplate!.goalCount !== 1 ? 's' : ''} from the selected template
            </p>
          )}

          {goalDrafts.length > 0 && (
            <div className="space-y-2 mb-3">
              {goalDrafts.map((g, i) => (
                <div key={i} className="flex items-center justify-between gap-2 rounded-xl px-3 py-2"
                  style={{ border: `1px solid ${border.divider}`, background: surface.card }}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: colors.text.primary }}>{g.title}</p>
                    <p className="text-xs" style={{ color: colors.text.dim }}>
                      {DOMAINS.find(d => d.value === g.domain)?.label}
                    </p>
                  </div>
                  <button type="button" onClick={() => setGoalDrafts(prev => prev.filter((_, idx) => idx !== i))}
                    style={{ color: colors.text.dim }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {showGoalForm && (
            <div className="rounded-xl p-3 space-y-3" style={{ border: `1px solid ${border.divider}`, background: surface.card }}>
              <Input label="Goal title" placeholder="e.g. Phoneme Discrimination" error={goalErrors.goalTitle?.message}
                {...registerGoal('goalTitle', { required: 'Required' })} />
              <Select label="Domain" placeholder="Select domain…" options={DOMAINS} error={goalErrors.domain?.message}
                {...registerGoal('domain', { required: 'Required' })} />
              <div>
                <label className="form-label">Goal statement</label>
                <textarea className="form-input resize-none" rows={2}
                  placeholder="Full SMART goal text…" {...registerGoal('goalStatement')} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Baseline" placeholder="Current level" {...registerGoal('baseline')} />
                <Input label="Target criteria" placeholder='e.g. "80% over 3 sessions"' {...registerGoal('targetCriteria')} />
              </div>
              <Input label="Target date" type="date" {...registerGoal('targetDate')} />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" size="sm"
                  onClick={() => { resetGoalForm(); setShowGoalForm(false) }}>Cancel</Button>
                <Button type="button" size="sm" onClick={handleGoalSubmit(addGoalDraft)}>Add</Button>
              </div>
            </div>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: colors.text.primary }}>
          <input type="checkbox" checked={saveAsTemplate} onChange={e => setSaveAsTemplate(e.target.checked)} />
          Also save as a reusable template in the library
        </label>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={handleClose}>Cancel</Button>
          <Button type="button" loading={isSubmitting || mut.isPending} onClick={handleSubmit(onSubmit)}>
            Create Plan
          </Button>
        </div>
      </div>
      </>
      )}
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

// ── Edit Goal modal ─────────────────────────────────────────────────────────
// Case-level only — edits this goal's own row, never the template it may have been
// added from (templates and case goals are independent copies once a plan is created).

function EditGoalModal({ open, onClose, goal }: {
  open: boolean
  onClose: () => void
  goal: IEPGoalResponse | null
}) {
  const { toast } = useToast()
  const qc = useQueryClient()
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<CreateIEPGoalRequest>()

  useEffect(() => {
    if (goal) {
      reset({
        title: goal.title,
        domain: goal.domain,
        goalStatement: goal.goalStatement ?? '',
        baseline: goal.baseline ?? '',
        targetCriteria: goal.targetCriteria ?? '',
        targetDate: goal.targetDate ?? '',
      })
    }
  }, [goal, reset])

  const mut = useMutation({
    mutationFn: (data: CreateIEPGoalRequest) => iepApi.updateGoal(goal!.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['iep'] })
      toast('Goal updated', 'success')
      onClose()
    },
    onError: (err) => toast(getApiError(err, 'Failed to update goal'), 'error'),
  })

  if (!goal) return null

  return (
    <Modal open={open} onClose={onClose} title={`Edit Goal — ${goal.title}`}>
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
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting || mut.isPending}>Save Changes</Button>
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
      qc.invalidateQueries({ queryKey: ['iep-progress', goal!.id] })
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

// ── Progress History modal ──────────────────────────────────────────────────────

function ProgressHistoryModal({ open, onClose, goal }: {
  open: boolean
  onClose: () => void
  goal: IEPGoalResponse | null
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['iep-progress', goal?.id],
    queryFn: () => iepApi.listProgress(goal!.id),
    enabled: open && !!goal,
  })

  if (!goal) return null

  return (
    <Modal open={open} onClose={onClose} title={`Progress History — ${goal.title}`}>
      {isLoading ? (
        <PageLoader />
      ) : !data || data.length === 0 ? (
        <p className="py-6 text-center text-sm" style={{ color: colors.text.dim }}>No progress logged yet.</p>
      ) : (
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {data.map((p: IEPGoalProgressResponse) => (
            <div key={p.id} className="p-3 rounded-lg" style={{ border: border.card, background: surface.card }}>
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: colors.text.primary }}>
                  <CalendarDays size={13} style={{ color: colors.text.dim }} />
                  {format(new Date(p.sessionDate), 'dd MMM yyyy')}
                </span>
                {p.masteryPct !== null && (
                  <span
                    className="text-xs font-semibold rounded-full px-2 py-0.5"
                    style={{ background: accentAlpha(0.08), color: colors.accent }}
                  >
                    {p.masteryPct}%
                  </span>
                )}
              </div>
              {p.trialsPassed !== null && p.trialsTotal !== null && (
                <p className="text-xs mt-1" style={{ color: colors.text.muted }}>
                  {p.trialsPassed}/{p.trialsTotal} trials passed
                </p>
              )}
              {p.note && (
                <p className="text-xs mt-1.5 leading-relaxed" style={{ color: colors.text.dim }}>{p.note}</p>
              )}
              {p.therapistName && (
                <p className="text-[11px] mt-1.5" style={{ color: colors.text.dim }}>Logged by {p.therapistName}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}

// ── Main IEP Tab ──────────────────────────────────────────────────────────────

export default function IEPTab({ patientId, therapists = [] }: { patientId: string; therapists?: TherapistSummary[] }) {
  const { toast } = useToast()
  const qc = useQueryClient()
  const { user, activeRole } = useAuth()
  const isEditor = activeRole !== 'PARENT'
  const isAdmin = activeRole === 'BUSINESS_OWNER' || activeRole === 'CLINIC_HEAD'

  const [showPlanModal,  setShowPlanModal]  = useState(false)
  const [showCsvModal,   setShowCsvModal]   = useState(false)
  const [addGoalTarget,  setAddGoalTarget]  = useState<{ id: string; title: string } | null>(null)
  const [editGoalTarget, setEditGoalTarget] = useState<IEPGoalResponse | null>(null)
  const [progressTarget, setProgressTarget] = useState<IEPGoalResponse | null>(null)
  const [historyTarget,  setHistoryTarget]  = useState<IEPGoalResponse | null>(null)
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

  const assignTherapistMut = useMutation({
    mutationFn: ({ planId, therapistId }: { planId: string; therapistId: string }) =>
      iepApi.updatePlan(planId, { therapistId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['iep'] }); toast('Therapist assigned', 'success') },
    onError: (err) => toast(getApiError(err, 'Failed to assign therapist'), 'error'),
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
                <div
                  className="w-full flex items-center gap-4 px-5 py-4 text-left transition-colors cursor-pointer"
                  onClick={() => togglePlan(plan.id)}
                  style={{ background: isOpen ? accentAlpha(0.03) : 'transparent' }}
                >
                  {/* Plan info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-semibold text-sm" style={{ color: colors.text.primary }}>{plan.title}</p>
                      {plan.tags.map(tag => (
                        <span key={tag} className="text-[12.65px] px-2 py-0.5 rounded-full" style={paletteStyle('purple', 0.07, 0.12)}>{tag}</span>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 text-xs flex-wrap" style={{ color: colors.text.dim }}>
                      <PlanTherapistBadge
                        therapistName={plan.therapistName}
                        therapists={therapists}
                        canAssign={isAdmin}
                        onAssign={therapistId => assignTherapistMut.mutate({ planId: plan.id, therapistId })}
                      />
                      {plan.startDate && plan.endDate && (
                        <span>{format(new Date(plan.startDate), 'dd MMM yyyy')} – {format(new Date(plan.endDate), 'dd MMM yyyy')}</span>
                      )}
                    </div>
                  </div>

                  {/* Completion ring, or a highlighted nudge when the plan has no goals yet + chevron */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {plan.totalGoals === 0 ? (
                      isEditor ? (
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); setAddGoalTarget({ id: plan.id, title: plan.title }) }}
                          className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-full transition-opacity hover:opacity-80"
                          style={paletteStyle('yellow', 0.14, 0)}
                        >
                          <AlertCircle size={12} /> No goals — Add Goal
                        </button>
                      ) : (
                        <span className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-full"
                          style={paletteStyle('yellow', 0.14, 0)}>
                          <AlertCircle size={12} /> No goals added
                        </span>
                      )
                    ) : (
                      <CompletionRing completed={plan.completedGoals} total={plan.totalGoals} />
                    )}
                    {isOpen
                      ? <ChevronUp size={16} style={{ color: colors.text.dim }} />
                      : <ChevronDown size={16} style={{ color: colors.text.dim }} />}
                  </div>
                </div>

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
                            onViewProgress={g => setHistoryTarget(g)}
                            onEdit={g => setEditGoalTarget(g)}
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
                          <Plus size={13} /> Add Goal
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
            therapists={therapists}
            currentUserId={user?.id}
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

          <EditGoalModal
            open={!!editGoalTarget}
            onClose={() => setEditGoalTarget(null)}
            goal={editGoalTarget}
          />

          <LogProgressModal
            open={!!progressTarget}
            onClose={() => setProgressTarget(null)}
            goal={progressTarget}
            patientId={patientId}
          />

          <ProgressHistoryModal
            open={!!historyTarget}
            onClose={() => setHistoryTarget(null)}
            goal={historyTarget}
          />
        </>
      )}
    </div>
  )
}
