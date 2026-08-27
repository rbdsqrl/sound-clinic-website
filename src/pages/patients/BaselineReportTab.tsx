import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Plus, ClipboardList, Pencil, History, X, Check } from 'lucide-react'
import { baselineReportApi } from '../../api/baselineReport'
import { patientsApi } from '../../api/patients'
import { useAuth } from '../../contexts/AuthContext'
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

const DOMAINS: { value: BaselineDomain; label: string }[] = [
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

const domainLabel = (d: BaselineDomain) => DOMAINS.find(x => x.value === d)?.label ?? d

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

  const { data: report, isLoading } = useQuery({
    queryKey: ['baseline-report', patientId],
    queryFn: () => baselineReportApi.get(patientId),
  })

  if (isLoading) return <PageLoader />

  if (!report) {
    return (
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
        {createOpen && (
          <CreateReportModal patientId={patientId} onClose={() => setCreateOpen(false)} />
        )}
      </Card>
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
        <EditHeaderModal patientId={patientId} report={report} onClose={() => setEditHeaderOpen(false)} />
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

  const saveMut = useMutation({
    mutationFn: () => baselineReportApi.update(patientId, { domainValues: { [domain.domain]: draft } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['baseline-report', patientId] })
      toast('Baseline updated', 'success')
      setEditing(false)
    },
    onError: (err) => toast(getApiError(err, 'Failed to save baseline value'), 'error'),
  })

  const latest = domain.currentEntries[0]

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
                onClick={() => { setEditing(false); setDraft(domain.baselineValue ?? '') }}
                className="p-1.5 rounded-lg flex-shrink-0"
                style={{ color: colors.text.dim }}
                title="Cancel"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm" style={{ color: domain.baselineValue ? colors.text.primary : colors.text.dim }}>
                {domain.baselineValue || 'Not set yet'}
              </p>
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
              <div>
                <p className="text-sm" style={{ color: colors.text.primary }}>{latest.value}</p>
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
    </div>
  )
}

// ── Create Baseline Report modal ────────────────────────────────────────────────

function CreateReportModal({ patientId, onClose }: { patientId: string; onClose: () => void }) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [ageAtAdmission, setAgeAtAdmission] = useState('')
  const [ageOnDate, setAgeOnDate] = useState('')
  const [cdct, setCdct] = useState('')
  const [values, setValues] = useState<Partial<Record<BaselineDomain, string>>>({})

  const saveMut = useMutation({
    mutationFn: () => baselineReportApi.create(patientId, {
      ageAtAdmission: ageAtAdmission || undefined,
      ageOnDate: ageOnDate || undefined,
      cdct: cdct || undefined,
      domainValues: values,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['baseline-report', patientId] })
      toast('Baseline report created', 'success')
      onClose()
    },
    onError: (err) => toast(getApiError(err, 'Failed to create baseline report'), 'error'),
  })

  return (
    <Modal
      open
      title="Create Baseline Report"
      onClose={onClose}
      size="lg"
      footer={
        <>
          {saveMut.isError && (
            <div className="flex-1 text-xs" style={{ color: colors.status.danger }}>
              {getApiError(saveMut.error, 'Failed to save. Please try again.')}
            </div>
          )}
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={saveMut.isPending} onClick={() => saveMut.mutate()}>Create</Button>
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
            <textarea
              className="form-input resize-none"
              rows={2}
              value={values[d.value] ?? ''}
              onChange={e => setValues(prev => ({ ...prev, [d.value]: e.target.value }))}
            />
          </div>
        ))}
      </div>
    </Modal>
  )
}

// ── Edit header fields modal ────────────────────────────────────────────────────

function EditHeaderModal({ patientId, report, onClose }: {
  patientId: string
  report: BaselineReportResponse
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [ageAtAdmission, setAgeAtAdmission] = useState(report.ageAtAdmission ?? '')
  const [ageOnDate, setAgeOnDate] = useState(report.ageOnDate ?? '')
  const [cdct, setCdct] = useState(report.cdct ?? '')

  const saveMut = useMutation({
    mutationFn: () => baselineReportApi.update(patientId, { ageAtAdmission, ageOnDate, cdct }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['baseline-report', patientId] })
      toast('Baseline report updated', 'success')
      onClose()
    },
    onError: (err) => toast(getApiError(err, 'Failed to save'), 'error'),
  })

  return (
    <Modal
      open
      title="Edit Baseline Report"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={saveMut.isPending} onClick={() => saveMut.mutate()}>Save</Button>
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

  const saveMut = useMutation({
    mutationFn: () => baselineReportApi.addProgress(patientId, domain, { entryDate, value }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['baseline-report', patientId] })
      toast('Current value logged', 'success')
      onClose()
    },
    onError: (err) => toast(getApiError(err, 'Failed to log current value'), 'error'),
  })

  return (
    <Modal
      open
      title={`Log Current — ${domainLabel(domain)}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={saveMut.isPending} disabled={!value.trim()} onClick={() => saveMut.mutate()}>Save</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Input label="Date" type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} />
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
              <p className="text-sm font-medium" style={{ color: colors.text.primary }}>
                {format(new Date(entry.entryDate + 'T00:00:00'), 'd MMM yyyy')}
              </p>
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
