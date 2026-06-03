import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Target, ChevronDown, ChevronUp, Users } from 'lucide-react'
import { iepApi } from '../../api/iep'
import { PageLoader } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import IEPTab from './IEPTab'
import { colors, border, accentAlpha, surface } from '../../theme'
import type { IEPPlanResponse } from '../../types'

// ── Aggregate per-patient info from the flat plan list ──────────────────────

interface PatientSummary {
  patientId: string
  patientName: string
  planCount: number
  totalGoals: number
  completedGoals: number
}

function buildPatientSummaries(plans: IEPPlanResponse[]): PatientSummary[] {
  const map = new Map<string, PatientSummary>()
  for (const plan of plans) {
    const existing = map.get(plan.patientId)
    if (existing) {
      existing.planCount++
      existing.totalGoals += plan.totalGoals
      existing.completedGoals += plan.completedGoals
    } else {
      map.set(plan.patientId, {
        patientId: plan.patientId,
        patientName: plan.patientName ?? `Patient …${plan.patientId.slice(-6)}`,
        planCount: 1,
        totalGoals: plan.totalGoals,
        completedGoals: plan.completedGoals,
      })
    }
  }
  return Array.from(map.values()).sort((a, b) => a.patientName.localeCompare(b.patientName))
}

// ── Mini ring (same SVG approach as IEPTab's CompletionRing) ────────────────

function MiniRing({ completed, total }: { completed: number; total: number }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0
  const r = 14
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ

  return (
    <div className="relative w-9 h-9 flex-shrink-0">
      <svg viewBox="0 0 36 36" className="w-full h-full rotate-[-90deg]">
        <circle cx="18" cy="18" r={r} fill="none" strokeWidth="3" stroke={border.divider} />
        <circle
          cx="18" cy="18" r={r} fill="none" strokeWidth="3"
          stroke="var(--color-accent)"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.4s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[9px] font-bold leading-none" style={{ color: colors.accent }}>
          {completed}/{total}
        </span>
      </div>
    </div>
  )
}

// ── Per-patient collapsible row ─────────────────────────────────────────────

function PatientRow({ summary }: { summary: PatientSummary }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${border.divider}`, background: surface.card }}>
      <button
        className="w-full flex items-center gap-4 px-5 py-4 text-left transition-colors"
        onClick={() => setOpen(v => !v)}
        style={{ background: open ? accentAlpha(0.03) : 'transparent' }}
      >
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate" style={{ color: colors.text.primary }}>
            {summary.patientName}
          </p>
          <p className="text-xs mt-0.5" style={{ color: colors.text.dim }}>
            {summary.planCount} plan{summary.planCount !== 1 ? 's' : ''} · {summary.totalGoals} goal{summary.totalGoals !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <MiniRing completed={summary.completedGoals} total={summary.totalGoals} />
          {open
            ? <ChevronUp size={16} style={{ color: colors.text.dim }} />
            : <ChevronDown size={16} style={{ color: colors.text.dim }} />}
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 border-t" style={{ borderColor: border.divider }}>
          <div className="mt-4">
            <IEPTab patientId={summary.patientId} />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main org IEP tab ────────────────────────────────────────────────────────

export default function IEPOrgTab() {
  const [search, setSearch] = useState('')

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['iep', 'all'],
    queryFn: iepApi.listAllPlans,
  })

  const summaries = useMemo(() => buildPatientSummaries(plans), [plans])

  const filtered = useMemo(() => {
    if (!search.trim()) return summaries
    const q = search.toLowerCase()
    return summaries.filter(s => s.patientName.toLowerCase().includes(q))
  }, [summaries, search])

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: colors.text.dim }} />
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search patients…"
          className="form-input pl-9 w-full sm:max-w-xs"
        />
      </div>

      {/* Stats bar */}
      <p className="text-xs" style={{ color: colors.text.dim }}>
        {summaries.length} patient{summaries.length !== 1 ? 's' : ''} · {plans.length} plan{plans.length !== 1 ? 's' : ''} · {plans.reduce((n, p) => n + p.totalGoals, 0)} goals
      </p>

      {/* Patient list */}
      {filtered.length === 0 ? (
        search ? (
          <p className="text-sm py-6 text-center" style={{ color: colors.text.dim }}>No patients match "{search}"</p>
        ) : (
          <EmptyState
            icon={<Users size={32} />}
            title="No IEP plans yet"
            description="Create IEP plans from a patient's profile page to see them here."
          />
        )
      ) : (
        <div className="space-y-3">
          {filtered.map(s => (
            <PatientRow key={s.patientId} summary={s} />
          ))}
        </div>
      )}
    </div>
  )
}
