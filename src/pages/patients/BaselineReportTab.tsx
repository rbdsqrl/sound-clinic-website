import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Plus, ClipboardList, Pencil, History, X, Check } from 'lucide-react'
import { baselineReportApi } from '../../api/baselineReport'
import { patientsApi } from '../../api/patients'
import { enrollmentsApi } from '../../api/enrollments'
import { useAuth } from '../../contexts/AuthContext'
import Sparkline from '../../components/charts/Sparkline'
import { Card, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageLoader } from '../../components/ui/Spinner'
import { useToast } from '../../hooks/useToast'
import { getApiError } from '../../lib/apiError'
import { colors, border, surface, accentAlpha } from '../../theme'
import type { BaselineDomain, BaselineDomainResponse, BaselineReportResponse } from '../../types'

// ── Domains — fixed order, matches the paper Baseline Report form ──────────────

export const DOMAINS: { value: BaselineDomain; label: string }[] = [
  { value: 'EYE_CONTACT',               label: 'Eye Contact' },
  { value: 'ATTENTION',                 label: 'Attention' },
  { value: 'COMPLIANCE',                label: 'Compliance' },
  { value: 'GROSS_MOTOR',               label: 'Gross Motor' },
  { value: 'FINE_MOTOR',                label: 'Fine Motor' },
  { value: 'ADL_SKILLS',                label: 'Activities of Daily Living Skills' },
  { value: 'RECEPTIVE_LANGUAGE',        label: 'Receptive Language' },
  { value: 'EXPRESSIVE_LANGUAGE',       label: 'Expressive Language' },
  { value: 'NON_VERBAL_COMMUNICATION',  label: 'Non-verbal Communication' },
  { value: 'ORO_MOTOR_SKILLS',          label: 'Oro-Motor Skills' },
  { value: 'COGNITIVE_SKILLS',          label: 'Cognitive Skills' },
  { value: 'SOCIAL_SKILLS',             label: 'Social Skills' },
  { value: 'EMOTIONAL_SKILLS',          label: 'Emotional Skills' },
]

export const domainLabel = (d: BaselineDomain) => DOMAINS.find(x => x.value === d)?.label ?? d

/** A compact "72%" pill — shown next to a baseline or current value when it's been scored. */
export function ScorePill({ percent }: { percent: number }) {
  return (
    <span
      className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
      style={{ background: accentAlpha(0.10), color: colors.accent }}
    >
      {percent}%
    </span>
  )
}

/** "4y 6m" as of `asOfIso`, from a "YYYY-MM-DD" date of birth. */
function formatAge(dobIso: string, asOfIso: string): string {
  const dob = new Date(dobIso + 'T00:00:00')
  const asOf = new Date(asOfIso + 'T00:00:00')
  let years = asOf.getFullYear() - dob.getFullYear()
  let months = asOf.getMonth() - dob.getMonth()
  if (asOf.getDate() < dob.getDate()) months--
  if (months < 0) { years--; months += 12 }
  if (years < 0) return ''
  return `${years}y ${months}m`
}

export default function BaselineReportTab({ patientId }: { patientId: string }) {
  const { activeRole } = useAuth()
  const isEditor = activeRole !== 'PARENT'

  const [createOpen, setCreateOpen] = useState(false)
  const [editHeaderOpen, setEditHeaderOpen] = useState(false)
  const [addProgressTarget, setAddProgressTarget] = useState<BaselineDomain | null>(null)
  const [historyTarget, setHistoryTarget] = useState<BaselineDomainResponse | null>(null)

  const { data: patient } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: () => patientsApi.get(patientId),
  })

  const { data: enrollments } = useQuery({
    queryKey: ['enrollments', 'patient', patientId],
    queryFn: () => enrollmentsApi.listForPatient(patientId),
  })

  const { data: report, isLoading } = useQuery({
    queryKey: ['baseline-report', patientId],
    queryFn: () => baselineReportApi.get(patientId),
  })

  // Derived from the patient's date of birth — "admission" is their earliest enrollment's
  // start date; "on date" is simply today. Both stay editable — these are just sane defaults.
  const earliestEnrollmentDate = enrollments && enrollments.length > 0
    ? [...enrollments].sort((a, b) => a.startDate.localeCompare(b.startDate))[0].startDate
    : null
  const derivedAgeAtAdmission = patient?.dateOfBirth && earliestEnrollmentDate
    ? formatAge(patient.dateOfBirth, earliestEnrollmentDate)
    : undefined
  const derivedAgeOnDate = patient?.dateOfBirth
    ? formatAge(patient.dateOfBirth, format(new Date(), 'yyyy-MM-dd'))
    : undefined

  if (isLoading) return <PageLoader />

  if (!report) {
    return (
      <>
        <Card>
          <EmptyState
            icon={<ClipboardList size={22} />}
            title="No baseline report yet"
            description={isEditor
              ? 'Create one to record the child\'s baseline on each developmental domain, then log current values over time.'
              : 'A baseline report has not been started for this child yet.'}
          />
          {isEditor && (
            <div className="flex justify-center mt-2">
              <Button onClick={() => setCreateOpen(true)}>
                <Plus size={15} /> Create Baseline Report
              </Button>
            </div>
          )}
        </Card>
        {createOpen && (
          <CreateReportModal
            patientId={patientId}
            defaultAgeAtAdmission={derivedAgeAtAdmission}
            defaultAgeOnDate={derivedAgeOnDate}
            onClose={() => setCreateOpen(false)}
          />
        )}
      </>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader
          title="Baseline Report"
          subtitle={patient ? `${patient.firstName} ${patient.lastName}` : undefined}
          action={isEditor ? (
            <Button variant="secondary" onClick={() => setEditHeaderOpen(true)}>
              <Pencil size={14} /> Edit
            </Button>
          ) : undefined}
        />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide" style={{ color: colors.text.dim }}>Age at admission</p>
            <p className="mt-0.5" style={{ color: colors.text.primary }}>{report.ageAtAdmission || '—'}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide" style={{ color: colors.text.dim }}>Age on date</p>
            <p className="mt-0.5" style={{ color: colors.text.primary }}>{report.ageOnDate || '—'}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide" style={{ color: colors.text.dim }}>CDCT</p>
            <p className="mt-0.5" style={{ color: colors.text.primary }}>{report.cdct || '—'}</p>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Domains" subtitle="Baseline vs. current, so progress reads at a glance" />
        <div className="flex flex-col gap-3">
          {report.domains.map(d => (
            <DomainRow
              key={d.domain}
              domain={d}
              patientId={patientId}
              isEditor={isEditor}
              onAddProgress={() => setAddProgressTarget(d.domain)}
              onViewHistory={() => setHistoryTarget(d)}
            />
          ))}
        </div>
      </Card>

      {editHeaderOpen && (
        <EditHeaderModal
          patientId={patientId}
          report={report}
          defaultAgeAtAdmission={derivedAgeAtAdmission}
          defaultAgeOnDate={derivedAgeOnDate}
          onClose={() => setEditHeaderOpen(false)}
        />
      )}

      {addProgressTarget && (
        <AddProgressModal
          patientId={patientId}
          domain={addProgressTarget}
          onClose={() => setAddProgressTarget(null)}
        />
      )}

      {historyTarget && (
        <HistoryModal domain={historyTarget} onClose={() => setHistoryTarget(null)} />
      )}
    </div>
  )
}

// ── One domain's row: Baseline (editable) + Current (latest + history) ─────────

function DomainRow({ domain, patientId, isEditor, onAddProgress, onViewHistory }: {
  domain: BaselineDomainResponse
  patientId: string
  isEditor: boolean
  onAddProgress: () => void
  onViewHistory: () => void
}) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(domain.baselineValue ?? '')
  const [scoreDraft, setScoreDraft] = useState(domain.baselineScorePercent?.toString() ?? '')

  const saveMut = useMutation({
    mutationFn: () => baselineReportApi.update(patientId, {
      domainValues: { [domain.domain]: draft },
      domainScores: { [domain.domain]: scoreDraft === '' ? null : Number(scoreDraft) },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['baseline-report', patientId] })
      toast('Baseline updated', 'success')
      setEditing(false)
    },
    onError: (err) => toast(getApiError(err, 'Failed to save baseline value'), 'error'),
  })

  const latest = domain.currentEntries[0]

  // Chronological (oldest first) for the sparkline — currentEntries arrives newest-first.
  // Nulls preserved so the line breaks at an unscored entry rather than joining across it.
  const scoreTrend = [...domain.currentEntries].reverse().map(e => e.scorePercent)
  const hasScoreTrend = domain.currentEntries.length >= 2 && scoreTrend.some(v => v !== null)

  return (
    <div className="rounded-xl p-3.5" style={{ border: border.card, background: surface.card }}>
      <p className="text-sm font-semibold mb-2" style={{ color: colors.text.heading }}>{domainLabel(domain.domain)}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: colors.text.dim }}>Baseline</p>
          {editing ? (
            <div className="flex items-start gap-1.5">
              <textarea
                autoFocus
                className="form-input resize-none flex-1"
                rows={2}
                value={draft}
                onChange={e => setDraft(e.target.value)}
              />
              <input
                type="number" min={0} max={100} placeholder="%"
                className="form-input w-16 flex-shrink-0"
                value={scoreDraft}
                onChange={e => setScoreDraft(e.target.value)}
                title="Score (0-100, optional)"
              />
              <button
                onClick={() => saveMut.mutate()}
                disabled={saveMut.isPending}
                className="p-1.5 rounded-lg flex-shrink-0"
                style={{ background: accentAlpha(0.10), color: colors.accent }}
                title="Save"
              >
                <Check size={14} />
              </button>
              <button
                onClick={() => { setEditing(false); setDraft(domain.baselineValue ?? ''); setScoreDraft(domain.baselineScorePercent?.toString() ?? '') }}
                className="p-1.5 rounded-lg flex-shrink-0"
                style={{ color: colors.text.dim }}
                title="Cancel"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-1.5 min-w-0">
                <p className="text-sm" style={{ color: domain.baselineValue ? colors.text.primary : colors.text.dim }}>
                  {domain.baselineValue || 'Not set yet'}
                </p>
                {domain.baselineScorePercent !== null && <ScorePill percent={domain.baselineScorePercent} />}
              </div>
              {isEditor && (
                <button onClick={() => setEditing(true)} className="flex-shrink-0 hover:opacity-70" style={{ color: colors.text.dim }} title="Edit baseline">
                  <Pencil size={13} />
                </button>
              )}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-medium uppercase tracking-wide" style={{ color: colors.text.dim }}>Current</p>
            {isEditor && (
              <button
                onClick={onAddProgress}
                className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                style={{ background: accentAlpha(0.08), color: colors.accent }}
              >
                <Plus size={11} /> Add
              </button>
            )}
          </div>
          {latest ? (
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-start gap-1.5">
                  <p className="text-sm" style={{ color: colors.text.primary }}>{latest.value}</p>
                  {latest.scorePercent !== null && <ScorePill percent={latest.scorePercent} />}
                </div>
                <p className="text-[11px] mt-0.5" style={{ color: colors.text.dim }}>
                  {format(new Date(latest.entryDate + 'T00:00:00'), 'd MMM yyyy')}
                </p>
              </div>
              {domain.currentEntries.length > 0 && (
                <button
                  onClick={onViewHistory}
                  className="inline-flex items-center gap-1 text-xs flex-shrink-0 hover:opacity-70"
                  style={{ color: colors.text.dim }}
                  title="View history"
                >
                  <History size={12} /> {domain.currentEntries.length}
                </button>
              )}
            </div>
          ) : (
            <p className="text-sm" style={{ color: colors.text.dim }}>No entries yet</p>
          )}
        </div>
      </div>

      {hasScoreTrend && (
        <div className="mt-3 pt-3 flex items-center gap-2" style={{ borderTop: `1px solid ${border.divider}` }}>
          <p className="text-[11px] flex-shrink-0" style={{ color: colors.text.dim }}>Score trend</p>
          <Sparkline values={scoreTrend} width={120} height={28} label={`${domainLabel(domain.domain)} score trend`} />
        </div>
      )}
    </div>
  )
}

// ── Create Baseline Report modal ────────────────────────────────────────────────

function CreateReportModal({ patientId, defaultAgeAtAdmission, defaultAgeOnDate, onClose }: {
  patientId: string
  defaultAgeAtAdmission?: string
  defaultAgeOnDate?: string
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [ageAtAdmission, setAgeAtAdmission] = useState(defaultAgeAtAdmission ?? '')
  const [ageOnDate, setAgeOnDate] = useState(defaultAgeOnDate ?? '')
  const [cdct, setCdct] = useState('')
  const [values, setValues] = useState<Partial<Record<BaselineDomain, string>>>({})
  const [scores, setScores] = useState<Partial<Record<BaselineDomain, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)

  // Fills in once the patient's DOB (and, for admission, their earliest enrollment) has
  // loaded — never overwrites something the user already typed.
  useEffect(() => {
    if (!ageAtAdmission && defaultAgeAtAdmission) setAgeAtAdmission(defaultAgeAtAdmission)
  }, [defaultAgeAtAdmission]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!ageOnDate && defaultAgeOnDate) setAgeOnDate(defaultAgeOnDate)
  }, [defaultAgeOnDate]) // eslint-disable-line react-hooks/exhaustive-deps

  const saveMut = useMutation({
    mutationFn: () => baselineReportApi.create(patientId, {
      ageAtAdmission: ageAtAdmission || undefined,
      ageOnDate: ageOnDate || undefined,
      cdct: cdct || undefined,
      domainValues: values,
      domainScores: Object.fromEntries(
        Object.entries(scores).filter(([, v]) => v !== '').map(([k, v]) => [k, Number(v)])
      ) as Partial<Record<BaselineDomain, number>>,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['baseline-report', patientId] })
      toast('Baseline report created', 'success')
      onClose()
    },
    onError: (err) => setFormError(getApiError(err, 'Failed to create baseline report')),
  })

  return (
    <Modal
      open
      title="Create Baseline Report"
      onClose={onClose}
      size="lg"
      error={formError}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={saveMut.isPending} onClick={() => { setFormError(null); saveMut.mutate() }}>Create</Button>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <Input label="Age at admission" placeholder="e.g. 4y 6m" value={ageAtAdmission} onChange={e => setAgeAtAdmission(e.target.value)} />
        <Input label="Age on date" placeholder="e.g. 5y 2m" value={ageOnDate} onChange={e => setAgeOnDate(e.target.value)} />
        <Input label="CDCT" value={cdct} onChange={e => setCdct(e.target.value)} />
      </div>

      <p className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: colors.text.dim }}>
        Baseline — fill what you know now, complete the rest later
      </p>
      <div className="flex flex-col gap-3">
        {DOMAINS.map(d => (
          <div key={d.value}>
            <label className="form-label">{d.label}</label>
            <div className="flex items-start gap-1.5">
              <textarea
                className="form-input resize-none flex-1"
                rows={2}
                value={values[d.value] ?? ''}
                onChange={e => setValues(prev => ({ ...prev, [d.value]: e.target.value }))}
              />
              <input
                type="number" min={0} max={100} placeholder="%"
                className="form-input w-16 flex-shrink-0"
                value={scores[d.value] ?? ''}
                onChange={e => setScores(prev => ({ ...prev, [d.value]: e.target.value }))}
                title="Score (0-100, optional)"
              />
            </div>
          </div>
        ))}
      </div>
    </Modal>
  )
}

// ── Edit header fields modal ────────────────────────────────────────────────────

function EditHeaderModal({ patientId, report, defaultAgeAtAdmission, defaultAgeOnDate, onClose }: {
  patientId: string
  report: BaselineReportResponse
  defaultAgeAtAdmission?: string
  defaultAgeOnDate?: string
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [ageAtAdmission, setAgeAtAdmission] = useState(report.ageAtAdmission || defaultAgeAtAdmission || '')
  const [ageOnDate, setAgeOnDate] = useState(report.ageOnDate || defaultAgeOnDate || '')
  const [cdct, setCdct] = useState(report.cdct ?? '')
  const [formError, setFormError] = useState<string | null>(null)

  const saveMut = useMutation({
    mutationFn: () => baselineReportApi.update(patientId, { ageAtAdmission, ageOnDate, cdct }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['baseline-report', patientId] })
      toast('Baseline report updated', 'success')
      onClose()
    },
    onError: (err) => setFormError(getApiError(err, 'Failed to save')),
  })

  return (
    <Modal
      open
      title="Edit Baseline Report"
      onClose={onClose}
      error={formError}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={saveMut.isPending} onClick={() => { setFormError(null); saveMut.mutate() }}>Save</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Input label="Age at admission" value={ageAtAdmission} onChange={e => setAgeAtAdmission(e.target.value)} />
        <Input label="Age on date" value={ageOnDate} onChange={e => setAgeOnDate(e.target.value)} />
        <Input label="CDCT" value={cdct} onChange={e => setCdct(e.target.value)} />
      </div>
    </Modal>
  )
}

// ── Add a dated Current entry for one domain ────────────────────────────────────

function AddProgressModal({ patientId, domain, onClose }: {
  patientId: string
  domain: BaselineDomain
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [entryDate, setEntryDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [value, setValue] = useState('')
  const [score, setScore] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const saveMut = useMutation({
    mutationFn: () => baselineReportApi.addProgress(patientId, domain, {
      entryDate,
      value,
      scorePercent: score === '' ? undefined : Number(score),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['baseline-report', patientId] })
      toast('Current value logged', 'success')
      onClose()
    },
    onError: (err) => setFormError(getApiError(err, 'Failed to log current value')),
  })

  return (
    <Modal
      open
      title={`Log Current — ${domainLabel(domain)}`}
      onClose={onClose}
      error={formError}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={saveMut.isPending} disabled={!value.trim()} onClick={() => { setFormError(null); saveMut.mutate() }}>Save</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Date" type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} />
          <Input label="Score (optional)" type="number" min={0} max={100} placeholder="0-100"
            value={score} onChange={e => setScore(e.target.value)} />
        </div>
        <div>
          <label className="form-label">Current value</label>
          <textarea
            autoFocus
            className="form-input resize-none"
            rows={3}
            placeholder="Describe where the child stands now on this domain…"
            value={value}
            onChange={e => setValue(e.target.value)}
          />
        </div>
      </div>
    </Modal>
  )
}

// ── History modal — every dated Current entry for one domain ───────────────────

function HistoryModal({ domain, onClose }: { domain: BaselineDomainResponse; onClose: () => void }) {
  return (
    <Modal open title={`Current History — ${domainLabel(domain.domain)}`} onClose={onClose}>
      {domain.currentEntries.length === 0 ? (
        <p className="py-6 text-center text-sm" style={{ color: colors.text.dim }}>No entries logged yet.</p>
      ) : (
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {domain.currentEntries.map(entry => (
            <div key={entry.id} className="p-3 rounded-lg" style={{ border: border.card, background: surface.card }}>
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium" style={{ color: colors.text.primary }}>
                  {format(new Date(entry.entryDate + 'T00:00:00'), 'd MMM yyyy')}
                </p>
                {entry.scorePercent !== null && <ScorePill percent={entry.scorePercent} />}
              </div>
              <p className="text-sm mt-1 leading-relaxed" style={{ color: colors.text.primary }}>{entry.value}</p>
              {entry.loggedByName && (
                <p className="text-[11px] mt-1.5" style={{ color: colors.text.dim }}>Logged by {entry.loggedByName}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
