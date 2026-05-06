import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { BookOpen, Plus, Pencil, PowerOff, X, IndianRupee } from 'lucide-react'
import { programsApi } from '../../api/programs'
import { useToast } from '../../hooks/useToast'
import { Input } from '../../components/ui/Input'
import type { ProgramResponse } from '../../types'
import { colors, styles, surface, border, accentAlpha, paletteStyle } from '../../theme'

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatCost(cost: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(cost)
}

// ── ProgramModal ───────────────────────────────────────────────────────────────

interface ProgramModalProps {
  program?: ProgramResponse          // undefined = create mode
  onClose: () => void
  onSave: (name: string, cost: number) => void
  isSaving: boolean
}

function ProgramModal({ program, onClose, onSave, isSaving }: ProgramModalProps) {
  const [name, setName] = useState(program?.name ?? '')
  const [cost, setCost] = useState(program ? String(program.perSessionCost) : '')
  const [errors, setErrors] = useState<{ name?: string; cost?: string }>({})

  const validate = () => {
    const e: typeof errors = {}
    if (!name.trim()) e.name = 'Program name is required'
    const c = parseFloat(cost)
    if (!cost || isNaN(c) || c <= 0) e.cost = 'Enter a valid cost (> 0)'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!validate()) return
    onSave(name.trim(), parseFloat(cost))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={styles.modalBackdrop}>
      <div className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 md:p-6" style={styles.modal}>
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold" style={{ color: colors.text.heading }}>
            {program ? 'Edit Program' : 'New Program'}
          </h2>
          <button onClick={onClose} className="p-2.5 rounded-lg transition-colors"
            style={{ color: colors.text.muted }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = accentAlpha(0.08)}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Name */}
          <Input
            label="Program Name"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Auditory Verbal Therapy"
            error={errors.name}
          />

          {/* Cost */}
          <div className="space-y-1">
            <label className="form-label">Cost per Session (₹)</label>
            <div className="relative">
              <IndianRupee size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: colors.text.muted }} />
              <input
                type="number"
                min="1"
                step="0.01"
                value={cost}
                onChange={e => setCost(e.target.value)}
                placeholder="800"
                className="form-input pl-8"
              />
            </div>
            {errors.cost && <p className="form-error">{errors.cost}</p>}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium"
              style={styles.buttonSecondary}>
              Cancel
            </button>
            <button type="submit" disabled={isSaving} className="flex-1 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
              style={styles.buttonPrimary}>
              {isSaving ? 'Saving…' : program ? 'Save Changes' : 'Create Program'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── ConfirmDeactivateModal ─────────────────────────────────────────────────────

function ConfirmDeactivateModal({
  program,
  onClose,
  onConfirm,
  isLoading,
}: {
  program: ProgramResponse
  onClose: () => void
  onConfirm: () => void
  isLoading: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={styles.modalBackdrop}>
      <div className="relative w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-5 md:p-6" style={styles.modal}>
        <h2 className="text-base font-semibold mb-2" style={{ color: colors.text.heading }}>Deactivate Program</h2>
        <p className="text-sm mb-5" style={{ color: colors.text.muted }}>
          Deactivating <strong style={{ color: colors.text.primary }}>{program.name}</strong> will hide it from new subscriptions. Existing subscriptions are unaffected.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium"
            style={styles.buttonSecondary}>
            Cancel
          </button>
          <button onClick={onConfirm} disabled={isLoading} className="flex-1 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
            style={styles.buttonDanger}>
            {isLoading ? 'Deactivating…' : 'Deactivate'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── ProgramCard ────────────────────────────────────────────────────────────────

function ProgramCard({
  program,
  onEdit,
  onDeactivate,
}: {
  program: ProgramResponse
  onEdit: (p: ProgramResponse) => void
  onDeactivate: (p: ProgramResponse) => void
}) {
  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-4 transition-all"
      style={{
        ...styles.card,
        opacity: program.isActive ? 1 : 0.6,
      }}
    >
      {/* Top row: name + status badge */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: accentAlpha(0.12) }}>
            <BookOpen size={16} style={{ color: colors.accent }} />
          </div>
          <p className="font-semibold text-sm truncate" style={{ color: colors.text.heading }}>
            {program.name}
          </p>
        </div>
        <span className="flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full"
          style={program.isActive
            ? paletteStyle('teal', 0.12, 0)
            : paletteStyle('slate', 0.12, 0)}>
          {program.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* Cost */}
      <div>
        <p className="text-[10px] uppercase tracking-widest mb-0.5" style={{ color: colors.text.muted }}>
          Per Session
        </p>
        <p className="text-xl font-bold" style={{ color: colors.accent }}>
          {formatCost(program.perSessionCost)}
        </p>
      </div>

      {/* Actions */}
      {program.isActive && (
        <div className="flex gap-2 pt-1 border-t" style={{ borderColor: border.divider }}>
          <button
            onClick={() => onEdit(program)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-colors"
            style={{ color: colors.text.muted, background: surface.rowHover }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = colors.accent}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = colors.text.muted}
          >
            <Pencil size={12} />
            Edit
          </button>
          <button
            onClick={() => onDeactivate(program)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-colors"
            style={{ color: colors.text.muted, background: surface.rowHover }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = colors.status.error}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = colors.text.muted}
          >
            <PowerOff size={12} />
            Deactivate
          </button>
        </div>
      )}
    </div>
  )
}

// ── ProgramsPage ───────────────────────────────────────────────────────────────

export default function ProgramsPage() {
  const qc = useQueryClient()
  const { toast } = useToast()

  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState<ProgramResponse | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<ProgramResponse | null>(null)

  const { data: programs = [], isLoading } = useQuery({
    queryKey: ['programs'],
    queryFn: () => programsApi.list(),
    staleTime: 2 * 60 * 1000,
  })

  const createMut = useMutation({
    mutationFn: (data: { name: string; cost: number }) =>
      programsApi.create({ name: data.name, perSessionCost: data.cost }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['programs'] })
      toast('Program created', 'success')
      setShowCreate(false)
    },
    onError: () => toast('Failed to create program', 'error'),
  })

  const updateMut = useMutation({
    mutationFn: (data: { id: string; name: string; cost: number }) =>
      programsApi.update(data.id, { name: data.name, perSessionCost: data.cost }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['programs'] })
      toast('Program updated', 'success')
      setEditTarget(null)
    },
    onError: () => toast('Failed to update program', 'error'),
  })

  const deactivateMut = useMutation({
    mutationFn: (id: string) => programsApi.deactivate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['programs'] })
      toast('Program deactivated', 'success')
      setDeactivateTarget(null)
    },
    onError: () => toast('Failed to deactivate program', 'error'),
  })

  const active   = programs.filter(p => p.isActive)
  const inactive = programs.filter(p => !p.isActive)

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-5xl mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-lg md:text-xl lg:text-2xl font-bold" style={{ color: colors.text.heading }}>
            Programs
          </h1>
          <p className="text-sm mt-0.5" style={{ color: colors.text.muted }}>
            Therapy programs offered by your clinic
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium min-h-[44px]"
          style={styles.buttonPrimary}
        >
          <Plus size={16} />
          Add Program
        </button>
      </div>

      {/* ── Loading ── */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4" style={{ borderColor: `${colors.accent}30`, borderTopColor: colors.accent }} />
        </div>
      )}

      {/* ── Empty ── */}
      {!isLoading && programs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-14 w-14 rounded-2xl flex items-center justify-center mb-4" style={styles.emptyIcon}>
            <BookOpen size={24} style={{ color: colors.accent }} />
          </div>
          <p className="font-semibold mb-1" style={{ color: colors.text.heading }}>No programs yet</p>
          <p className="text-sm mb-5" style={{ color: colors.text.muted }}>
            Add your first therapy program to get started
          </p>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
            style={styles.buttonPrimary}>
            <Plus size={15} />
            Add Program
          </button>
        </div>
      )}

      {/* ── Active programs ── */}
      {!isLoading && active.length > 0 && (
        <section className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: colors.text.muted }}>
            Active · {active.length}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {active.map(p => (
              <ProgramCard
                key={p.id}
                program={p}
                onEdit={setEditTarget}
                onDeactivate={setDeactivateTarget}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Inactive programs ── */}
      {!isLoading && inactive.length > 0 && (
        <section>
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: colors.text.dim }}>
            Inactive · {inactive.length}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {inactive.map(p => (
              <ProgramCard
                key={p.id}
                program={p}
                onEdit={setEditTarget}
                onDeactivate={setDeactivateTarget}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Create modal ── */}
      {showCreate && (
        <ProgramModal
          onClose={() => setShowCreate(false)}
          onSave={(name, cost) => createMut.mutate({ name, cost })}
          isSaving={createMut.isPending}
        />
      )}

      {/* ── Edit modal ── */}
      {editTarget && (
        <ProgramModal
          program={editTarget}
          onClose={() => setEditTarget(null)}
          onSave={(name, cost) => updateMut.mutate({ id: editTarget.id, name, cost })}
          isSaving={updateMut.isPending}
        />
      )}

      {/* ── Deactivate confirm ── */}
      {deactivateTarget && (
        <ConfirmDeactivateModal
          program={deactivateTarget}
          onClose={() => setDeactivateTarget(null)}
          onConfirm={() => deactivateMut.mutate(deactivateTarget.id)}
          isLoading={deactivateMut.isPending}
        />
      )}
    </div>
  )
}
