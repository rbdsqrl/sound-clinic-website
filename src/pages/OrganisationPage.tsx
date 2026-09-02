import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import {
  Building2, CalendarOff, ChevronRight, FileUp, Pencil, Plus, Trash2, X,
  ToggleLeft, ToggleRight, IndianRupee, HeartPulse, Receipt, Sparkles,
  Target, Languages as LanguagesIcon, Box, ClipboardList,
} from 'lucide-react'
import ProgramFeedbackTemplateModal from './programs/ProgramFeedbackTemplateModal'
import { format, parseISO } from 'date-fns'
import { organisationApi } from '../api/organisation'
import { publicHolidaysApi } from '../api/publicHolidays'
import { programsApi } from '../api/programs'
import { conditionsApi } from '../api/conditions'
import { taxesApi } from '../api/taxes'
import { clinicsApi } from '../api/clinics'
import { skillsApi, languagesApi, propsApi } from '../api/activityLookups'
import IEPLibraryTab from './patients/IEPLibraryTab'
import { Card, CardHeader } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Select } from '../components/ui/Select'
import { EmptyState } from '../components/ui/EmptyState'
import { PageLoader } from '../components/ui/Spinner'
import { ToastContainer } from '../components/ui/Toast'
import { useToast } from '../hooks/useToast'
import { getApiError } from '../lib/apiError'
import { useAuth } from '../contexts/AuthContext'
import { TIMEZONES } from '../lib/timezones'
import { colors, border, surface, styles, accentAlpha, dangerAlpha, successAlpha } from '../theme'
import type {
  UpdateOrganisationRequest, CreatePublicHolidayRequest, CreateClinicRequest,
  ProgramResponse, TaxResponse, UpdateProgramRequest, AiProvider, DayOfWeek,
} from '../types'

type Tab = 'information' | 'clinics' | 'manage' | 'activity-library' | 'iep-library'

const WEEK_DAYS: { value: DayOfWeek; label: string }[] = [
  { value: 'MONDAY', label: 'Mon' },
  { value: 'TUESDAY', label: 'Tue' },
  { value: 'WEDNESDAY', label: 'Wed' },
  { value: 'THURSDAY', label: 'Thu' },
  { value: 'FRIDAY', label: 'Fri' },
  { value: 'SATURDAY', label: 'Sat' },
  { value: 'SUNDAY', label: 'Sun' },
]

const TIMEZONE_GROUPS = Array.from(
  TIMEZONES.reduce((map, tz) => {
    if (!map.has(tz.region)) map.set(tz.region, [])
    map.get(tz.region)!.push({ value: tz.value, label: tz.label })
    return map
  }, new Map<string, { value: string; label: string }[]>()),
  ([group, options]) => ({ group, options })
)

// ── CSV parser ─────────────────────────────────────────────────────────────────
function parseCsv(text: string): { holidayDate: string; name: string }[] {
  const rows = text.trim().split(/\r?\n/).filter(Boolean)
  const results: { holidayDate: string; name: string }[] = []
  for (const row of rows) {
    const parts = row.split(/,|;/).map(p => p.trim().replace(/^"|"$/g, ''))
    const [col0, ...rest] = parts
    const name = rest.join(',').trim()
    if (/^date$/i.test(col0)) continue
    if (!/^\d{4}-\d{2}-\d{2}$/.test(col0)) continue
    if (!name) continue
    results.push({ holidayDate: col0, name })
  }
  return results
}

type CsvRow = { holidayDate: string; name: string }

// ── Reusable item row (name + delete button) ──────────────────────────────────
function ItemRow({ name, onDelete, canDelete = true }: { name: string; onDelete?: () => void; canDelete?: boolean }) {
  return (
    <div
      className="flex items-center justify-between py-3 px-1 border-b last:border-b-0"
      style={{ borderColor: border.divider }}
    >
      <span className="text-sm" style={{ color: colors.text.primary }}>{name}</span>
      {canDelete && onDelete && (
        <button
          onClick={onDelete}
          className="p-1.5 rounded-lg transition-colors hover:opacity-75"
          style={{ color: colors.text.dim }}
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  )
}

// ── Add row inline input ───────────────────────────────────────────────────────
function AddRow({
  placeholder, onAdd, loading, extraInput,
}: {
  placeholder: string
  onAdd: (value: string, extra?: string) => void
  loading: boolean
  extraInput?: { placeholder: string; label: string }
}) {
  const [val, setVal] = useState('')
  const [extra, setExtra] = useState('')

  const submit = () => {
    if (!val.trim()) return
    onAdd(val.trim(), extra.trim() || undefined)
    setVal('')
    setExtra('')
  }

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2 mt-3">
      <div className="flex-1">
        <input
          className="form-input w-full text-sm"
          placeholder={placeholder}
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
        />
      </div>
      {extraInput && (
        <div className="w-full sm:w-28">
          <input
            className="form-input w-full text-sm"
            placeholder={extraInput.placeholder}
            value={extra}
            onChange={e => setExtra(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
          />
        </div>
      )}
      <Button size="sm" onClick={submit} loading={loading} disabled={!val.trim()}>
        <Plus size={13} /> Add
      </Button>
    </div>
  )
}

// ── Program row ───────────────────────────────────────────────────────────────
function ProgramRow({
  program, canManage, taxes, onToggle, onDelete, onEdit,
}: {
  program: ProgramResponse
  canManage: boolean
  taxes: TaxResponse[]
  onToggle: () => void
  onDelete: () => void
  onEdit: (name: string, cost: number, description: string | undefined, taxId: string, priceIncludesTax: boolean) => void
}) {
  const [editing, setEditing] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [name, setName]       = useState(program.name)
  const [cost, setCost]       = useState(String(program.perSessionCost))
  const [desc, setDesc]       = useState(program.description ?? '')
  const [taxId, setTaxId]     = useState(program.taxId ?? '')
  const [priceIncludesTax, setPriceIncludesTax] = useState(program.priceIncludesTax)

  const resetFields = () => {
    setName(program.name); setCost(String(program.perSessionCost)); setDesc(program.description ?? '')
    setTaxId(program.taxId ?? ''); setPriceIncludesTax(program.priceIncludesTax)
  }

  const save = () => {
    const c = parseFloat(cost)
    if (!name.trim() || isNaN(c)) return
    onEdit(name.trim(), c, desc.trim() || undefined, taxId, priceIncludesTax)
    setEditing(false)
  }

  const selectedTax = taxes.find(t => t.id === taxId)
  const costNum = parseFloat(cost)
  const hasPreview = !!selectedTax && !isNaN(costNum)
  const taxAmount = hasPreview
    ? priceIncludesTax
      ? costNum - costNum / (1 + selectedTax!.rate / 100)
      : costNum * (selectedTax!.rate / 100)
    : 0
  const totalCost = priceIncludesTax ? costNum : costNum + taxAmount

  if (editing) {
    return (
      <div className="py-3 px-1 border-b last:border-b-0 space-y-2" style={{ borderColor: border.divider }}>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            className="form-input flex-1 text-sm"
            placeholder="Program name"
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <input
            className="form-input w-full sm:w-28 text-sm"
            placeholder="₹ price"
            type="number"
            min="0"
            value={cost}
            onChange={e => setCost(e.target.value)}
          />
        </div>
        <input
          className="form-input w-full text-sm"
          placeholder="Description (optional)"
          value={desc}
          onChange={e => setDesc(e.target.value)}
        />

        {taxes.length > 0 && (
          <Select
            className="text-sm"
            placeholder="No tax"
            value={taxId}
            onChange={e => setTaxId(e.target.value)}
            options={taxes.map(t => ({ value: t.id, label: `${t.name} (${t.rate}%)` }))}
          />
        )}

        {selectedTax && (
          <>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-full px-3 py-1.5 text-xs font-medium transition-all"
                style={priceIncludesTax ? styles.filterTabActive : styles.filterTabInactive}
                onClick={() => setPriceIncludesTax(true)}
              >
                Price includes tax
              </button>
              <button
                type="button"
                className="rounded-full px-3 py-1.5 text-xs font-medium transition-all"
                style={!priceIncludesTax ? styles.filterTabActive : styles.filterTabInactive}
                onClick={() => setPriceIncludesTax(false)}
              >
                Tax will be added
              </button>
            </div>
            {hasPreview && (
              <p className="text-xs" style={{ color: colors.text.muted }}>
                {priceIncludesTax
                  ? `₹${costNum.toLocaleString('en-IN')} includes ${selectedTax.name} of ₹${taxAmount.toFixed(2)} (base ₹${(costNum - taxAmount).toFixed(2)})`
                  : `+ ${selectedTax.name} (₹${taxAmount.toFixed(2)}) = ₹${totalCost.toFixed(2)} total`}
              </p>
            )}
          </>
        )}

        <div className="flex gap-2">
          <Button size="sm" onClick={save} disabled={!name.trim() || !cost}>Save</Button>
          <Button size="sm" variant="secondary" onClick={() => { setEditing(false); resetFields() }}>Cancel</Button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="py-3 px-1 border-b last:border-b-0"
      style={{ borderColor: border.divider }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium" style={{ color: colors.text.primary }}>
              {program.name}
            </span>
            <span
              className="text-xs font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-0.5"
              style={{ background: accentAlpha(0.08), color: colors.accent }}
            >
              <IndianRupee size={10} />
              {Number(program.perSessionCost).toLocaleString('en-IN')}
            </span>
            {program.taxName && (
              <span className="text-xs" style={{ color: colors.text.muted }}>
                {program.priceIncludesTax
                  ? `incl. ${program.taxName}`
                  : `+ ${program.taxName} = ₹${Number(program.totalCost).toLocaleString('en-IN')}`}
              </span>
            )}
          </div>
          {program.description && (
            <p className="text-xs mt-0.5" style={{ color: colors.text.muted }}>{program.description}</p>
          )}
        </div>
        {canManage && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => setFeedbackOpen(true)}
              className="p-1.5 rounded-lg hover:opacity-75"
              style={{ color: colors.text.dim }}
              title="Session feedback template"
            >
              <ClipboardList size={13} />
            </button>
            <button
              onClick={() => setEditing(true)}
              className="p-1.5 rounded-lg hover:opacity-75"
              style={{ color: colors.text.dim }}
              title="Edit"
            >
              <Pencil size={13} />
            </button>
            <button onClick={onToggle} title={program.isActive ? 'Disable' : 'Enable'}>
              {program.isActive
                ? <ToggleRight size={20} style={{ color: colors.accent }} />
                : <ToggleLeft size={20} style={{ color: colors.text.dim }} />}
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 rounded-lg hover:opacity-75"
              style={{ color: colors.text.dim }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>
      {feedbackOpen && (
        <ProgramFeedbackTemplateModal
          programId={program.id}
          programName={program.name}
          onClose={() => setFeedbackOpen(false)}
        />
      )}
    </div>
  )
}

// ── Add program inline ─────────────────────────────────────────────────────────
function AddProgramRow({ onAdd, loading, taxes }: {
  onAdd: (name: string, cost: string, desc: string, taxId: string, priceIncludesTax: boolean) => void
  loading: boolean
  taxes: TaxResponse[]
}) {
  const [name, setName] = useState('')
  const [cost, setCost] = useState('')
  const [desc, setDesc] = useState('')
  const [taxId, setTaxId] = useState('')
  const [priceIncludesTax, setPriceIncludesTax] = useState(true)
  const [open, setOpen] = useState(false)

  const selectedTax = taxes.find(t => t.id === taxId)
  const costNum = parseFloat(cost)
  const hasPreview = !!selectedTax && !isNaN(costNum)
  const taxAmount = hasPreview
    ? priceIncludesTax
      ? costNum - costNum / (1 + selectedTax!.rate / 100)
      : costNum * (selectedTax!.rate / 100)
    : 0
  const totalCost = priceIncludesTax ? costNum : costNum + taxAmount

  const reset = () => {
    setName(''); setCost(''); setDesc(''); setTaxId(''); setPriceIncludesTax(true); setOpen(false)
  }

  const submit = () => {
    if (!name.trim() || !cost) return
    onAdd(name.trim(), cost, desc.trim(), taxId, priceIncludesTax)
    reset()
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-3 flex items-center gap-1.5 text-sm font-medium"
        style={{ color: colors.accent }}
      >
        <Plus size={14} /> Add Program
      </button>
    )
  }

  return (
    <div
      className="mt-3 p-3 rounded-xl space-y-2"
      style={{ background: accentAlpha(0.04), border: `1px solid ${border.divider}` }}
    >
      <div className="flex flex-col sm:flex-row gap-2">
        <input className="form-input flex-1 text-sm" placeholder="Program name" value={name} onChange={e => setName(e.target.value)} />
        <input className="form-input w-full sm:w-28 text-sm" placeholder="₹ price" type="number" min="0" value={cost} onChange={e => setCost(e.target.value)} />
      </div>
      <input className="form-input w-full text-sm" placeholder="Description (optional)" value={desc} onChange={e => setDesc(e.target.value)} />

      {taxes.length > 0 && (
        <Select
          className="text-sm"
          placeholder="No tax"
          value={taxId}
          onChange={e => setTaxId(e.target.value)}
          options={taxes.map(t => ({ value: t.id, label: `${t.name} (${t.rate}%)` }))}
        />
      )}

      {selectedTax && (
        <>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-full px-3 py-1.5 text-xs font-medium transition-all"
              style={priceIncludesTax ? styles.filterTabActive : styles.filterTabInactive}
              onClick={() => setPriceIncludesTax(true)}
            >
              Price includes tax
            </button>
            <button
              type="button"
              className="rounded-full px-3 py-1.5 text-xs font-medium transition-all"
              style={!priceIncludesTax ? styles.filterTabActive : styles.filterTabInactive}
              onClick={() => setPriceIncludesTax(false)}
            >
              Tax will be added
            </button>
          </div>
          {hasPreview && (
            <p className="text-xs" style={{ color: colors.text.muted }}>
              {priceIncludesTax
                ? `₹${costNum.toLocaleString('en-IN')} includes ${selectedTax.name} of ₹${taxAmount.toFixed(2)} (base ₹${(costNum - taxAmount).toFixed(2)})`
                : `+ ${selectedTax.name} (₹${taxAmount.toFixed(2)}) = ₹${totalCost.toFixed(2)} total`}
            </p>
          )}
        </>
      )}

      <div className="flex gap-2">
        <Button size="sm" onClick={submit} loading={loading} disabled={!name.trim() || !cost}>
          <Plus size={13} /> Add
        </Button>
        <Button size="sm" variant="secondary" onClick={reset}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

// ── Manage section card ────────────────────────────────────────────────────────
function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-4 md:p-5" style={{ background: surface.card, border: border.card }}>
      <div className="flex items-center gap-2 mb-4">
        <span style={{ color: colors.accent }}>{icon}</span>
        <h2 className="text-base font-semibold" style={{ color: colors.text.heading }}>{title}</h2>
      </div>
      {children}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function OrganisationPage() {
  const [tab, setTab]               = useState<Tab>('information')
  const [editing, setEditing]       = useState(false)
  const [addingHoliday, setAddingHoliday] = useState(false)
  const [holidayDate, setHolidayDate] = useState('')
  const [holidayName, setHolidayName] = useState('')
  const [csvRows, setCsvRows]         = useState<CsvRow[] | null>(null)
  const [csvUploading, setCsvUploading] = useState(false)
  const [showClinicModal, setShowClinicModal] = useState(false)
  const [aiEditing, setAiEditing]   = useState(false)
  const [aiProvider, setAiProvider] = useState<AiProvider | ''>('')
  const [aiApiKey, setAiApiKey]     = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { toasts, toast, dismiss } = useToast()
  const qc = useQueryClient()
  const { user } = useAuth()
  const canManage = user?.role === 'BUSINESS_OWNER' || user?.role === 'CLINIC_HEAD'

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: org, isLoading } = useQuery({ queryKey: ['organisation'], queryFn: organisationApi.get })

  const { data: holidays = [] } = useQuery({
    queryKey: ['public-holidays'],
    queryFn: publicHolidaysApi.list,
    enabled: tab === 'information',
  })

  const { data: programs = [] } = useQuery({
    queryKey: ['programs'],
    queryFn: () => programsApi.list(),
    enabled: tab === 'manage',
  })

  const { data: conditions = [] } = useQuery({
    queryKey: ['conditions'],
    queryFn: conditionsApi.list,
    enabled: tab === 'manage',
  })

  const { data: taxes = [] } = useQuery({
    queryKey: ['taxes'],
    queryFn: taxesApi.list,
    enabled: tab === 'manage',
  })

  const { data: skills = [] } = useQuery({
    queryKey: ['skills'],
    queryFn: skillsApi.list,
    enabled: tab === 'activity-library',
  })

  const { data: languages = [] } = useQuery({
    queryKey: ['languages'],
    queryFn: languagesApi.list,
    enabled: tab === 'activity-library',
  })

  const { data: propsList = [] } = useQuery({
    queryKey: ['activity-props'],
    queryFn: propsApi.list,
    enabled: tab === 'activity-library',
  })

  const { data: clinics = [] } = useQuery({
    queryKey: ['clinics'],
    queryFn: clinicsApi.list,
    enabled: tab === 'clinics',
  })

  // ── Org form ─────────────────────────────────────────────────────────────────
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<UpdateOrganisationRequest>()

  // ── Clinic form ───────────────────────────────────────────────────────────────
  const {
    register: registerClinic,
    handleSubmit: handleClinicSubmit,
    reset: resetClinic,
    formState: { errors: clinicErrors, isSubmitting: isClinicSubmitting },
  } = useForm<CreateClinicRequest>({
    defaultValues: { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
  })

  const orgMut = useMutation({
    mutationFn: organisationApi.update,
    onSuccess: (updated) => {
      qc.setQueryData(['organisation'], updated)
      toast('Organisation updated', 'success')
      setEditing(false)
    },
    onError: (err) => toast(getApiError(err, 'Failed to update organisation'), 'error'),
  })

  const startEdit = () => {
    if (org) reset({ name: org.name, contactEmail: org.contactEmail ?? '', contactPhone: org.contactPhone ?? '', address: org.address ?? '', logoUrl: org.logoUrl ?? '', timezone: org.timezone })
    setEditing(true)
  }

  const aiMut = useMutation({
    mutationFn: organisationApi.update,
    onSuccess: (updated) => {
      qc.setQueryData(['organisation'], updated)
      toast('AI assistant settings saved', 'success')
      setAiEditing(false)
      setAiApiKey('')
    },
    onError: (err) => toast(getApiError(err, 'Failed to save AI assistant settings'), 'error'),
  })

  const startAiEdit = () => {
    setAiProvider(org?.aiProvider ?? '')
    setAiApiKey('')
    setAiEditing(true)
  }

  const saveAi = () => {
    if (!aiProvider) { toast('Choose a provider first', 'error'); return }
    aiMut.mutate({ aiProvider, ...(aiApiKey ? { aiApiKey } : {}) })
  }

  const clearAi = () => {
    if (!window.confirm('Turn off the AI assistant for this organisation? Magic Fill will no longer be available in Activities.')) return
    aiMut.mutate({ aiApiKey: '' })
  }

  // ── Weekly off days ──────────────────────────────────────────────────────────
  const weeklyOffMut = useMutation({
    mutationFn: organisationApi.update,
    onSuccess: (updated) => {
      qc.setQueryData(['organisation'], updated)
      toast('Weekly off days updated', 'success')
    },
    onError: (err) => toast(getApiError(err, 'Failed to update weekly off days'), 'error'),
  })

  const toggleWeeklyOffDay = (day: DayOfWeek) => {
    if (!org) return
    const current = org.weeklyOffDays ?? []
    const next = current.includes(day) ? current.filter(d => d !== day) : [...current, day]
    weeklyOffMut.mutate({ weeklyOffDays: next })
  }

  // ── Holiday mutations ────────────────────────────────────────────────────────
  const createHolidayMut = useMutation({
    mutationFn: (data: CreatePublicHolidayRequest) => publicHolidaysApi.create(data),
    onSuccess: (h) => {
      qc.invalidateQueries({ queryKey: ['public-holidays'] })
      const msg = h.sessionsAffected > 0
        ? `Holiday added — ${h.sessionsAffected} session${h.sessionsAffected !== 1 ? 's' : ''} flagged`
        : 'Holiday added'
      toast(msg, 'success')
      setAddingHoliday(false); setHolidayDate(''); setHolidayName('')
    },
    onError: (err) => toast(getApiError(err, 'Failed to add holiday'), 'error'),
  })

  const deleteHolidayMut = useMutation({
    mutationFn: publicHolidaysApi.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['public-holidays'] }); toast('Holiday removed', 'success') },
    onError: (err) => toast(getApiError(err, 'Failed to remove holiday'), 'error'),
  })

  // ── Programs mutations ───────────────────────────────────────────────────────
  const createProgramMut = useMutation({
    mutationFn: (p: { name: string; description?: string; perSessionCost: number; taxId?: string; priceIncludesTax?: boolean }) => programsApi.create(p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['programs'] }); toast('Program added', 'success') },
    onError: (err) => toast(getApiError(err, 'Failed to add program'), 'error'),
  })

  const toggleProgramMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => programsApi.update(id, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['programs'] }),
    onError: (err) => toast(getApiError(err, 'Failed to update program'), 'error'),
  })

  const updateProgramMut = useMutation({
    mutationFn: ({ id, ...data }: { id: string } & UpdateProgramRequest) =>
      programsApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['programs'] }); toast('Program updated', 'success') },
    onError: (err) => toast(getApiError(err, 'Failed to update program'), 'error'),
  })

  const deleteProgramMut = useMutation({
    mutationFn: programsApi.deactivate,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['programs'] }); toast('Program removed', 'success') },
    onError: (err) => toast(getApiError(err, 'Failed to remove program'), 'error'),
  })

  // ── Conditions mutations ─────────────────────────────────────────────────────
  const createConditionMut = useMutation({
    mutationFn: conditionsApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['conditions'] }); toast('Condition added', 'success') },
    onError: (err) => toast(getApiError(err, 'Failed to add condition'), 'error'),
  })

  const deleteConditionMut = useMutation({
    mutationFn: conditionsApi.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['conditions'] }); toast('Condition removed', 'success') },
    onError: (err) => toast(getApiError(err, 'Failed to remove condition'), 'error'),
  })

  // ── Activity library mutations (Skills / Languages / Props) ──────────────────
  const createSkillMut = useMutation({
    mutationFn: skillsApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['skills'] }); toast('Skill added', 'success') },
    onError: (err) => toast(getApiError(err, 'Failed to add skill'), 'error'),
  })
  const deleteSkillMut = useMutation({
    mutationFn: skillsApi.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['skills'] }); toast('Skill removed', 'success') },
    onError: (err) => toast(getApiError(err, 'Failed to remove skill'), 'error'),
  })

  const createLanguageMut = useMutation({
    mutationFn: languagesApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['languages'] }); toast('Language added', 'success') },
    onError: (err) => toast(getApiError(err, 'Failed to add language'), 'error'),
  })
  const deleteLanguageMut = useMutation({
    mutationFn: languagesApi.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['languages'] }); toast('Language removed', 'success') },
    onError: (err) => toast(getApiError(err, 'Failed to remove language'), 'error'),
  })

  const createPropMut = useMutation({
    mutationFn: propsApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['activity-props'] }); toast('Prop added', 'success') },
    onError: (err) => toast(getApiError(err, 'Failed to add prop'), 'error'),
  })
  const deletePropMut = useMutation({
    mutationFn: propsApi.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['activity-props'] }); toast('Prop removed', 'success') },
    onError: (err) => toast(getApiError(err, 'Failed to remove prop'), 'error'),
  })

  // ── Taxes mutations ──────────────────────────────────────────────────────────
  const createTaxMut = useMutation({
    mutationFn: ({ name, rate }: { name: string; rate: number }) => taxesApi.create(name, rate),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['taxes'] }); toast('Tax rate added', 'success') },
    onError: (err) => toast(getApiError(err, 'Failed to add tax'), 'error'),
  })

  const deleteTaxMut = useMutation({
    mutationFn: taxesApi.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['taxes'] }); toast('Tax rate removed', 'success') },
    onError: (err) => toast(getApiError(err, 'Failed to remove tax'), 'error'),
  })

  // ── Clinic mutations ──────────────────────────────────────────────────────────
  const createClinicMut = useMutation({
    mutationFn: clinicsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clinics'] })
      toast('Clinic created', 'success')
      setShowClinicModal(false)
      resetClinic()
    },
    onError: (err) => toast(getApiError(err, 'Failed to create clinic'), 'error'),
  })

  // ── CSV handlers ─────────────────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const parsed = parseCsv(ev.target?.result as string)
      if (parsed.length === 0) { toast('No valid rows found. Expected: date (YYYY-MM-DD), name', 'error'); return }
      setCsvRows(parsed)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleCsvImport = async () => {
    if (!csvRows) return
    setCsvUploading(true)
    let added = 0, skipped = 0, totalAffected = 0
    for (const row of csvRows) {
      try { const r = await publicHolidaysApi.create({ holidayDate: row.holidayDate, name: row.name }); added++; totalAffected += r.sessionsAffected }
      catch { skipped++ }
    }
    qc.invalidateQueries({ queryKey: ['public-holidays'] })
    const parts = [`${added} holiday${added !== 1 ? 's' : ''} added`]
    if (totalAffected > 0) parts.push(`${totalAffected} session${totalAffected !== 1 ? 's' : ''} flagged`)
    if (skipped > 0) parts.push(`${skipped} skipped`)
    toast(parts.join(' · '), added > 0 ? 'success' : 'error')
    setCsvRows(null); setCsvUploading(false)
  }

  if (isLoading) return <PageLoader />

  const TABS: { key: Tab; label: string }[] = [
    { key: 'information', label: 'Information' },
    { key: 'clinics',     label: 'Clinics' },
    { key: 'manage',           label: 'Manage' },
    { key: 'activity-library', label: 'Activity Library' },
    { key: 'iep-library',      label: 'IEP Library' },
  ]

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-lg md:text-xl font-bold" style={{ color: colors.text.heading }}>Organisation</h1>
        <p className="text-sm mt-0.5" style={{ color: colors.text.muted }}>Profile and service configuration</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 border-b overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0" style={{ borderColor: border.divider }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="px-4 py-2.5 text-sm font-medium -mb-px transition-colors flex-shrink-0 whitespace-nowrap"
            style={tab === t.key ? styles.tabActive : styles.tabInactive}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Information tab ─────────────────────────────────────────────────── */}
      {tab === 'information' && (
        <>
          <Card>
            <CardHeader
              title="Profile"
              subtitle="Manage your organisation's details"
              action={!editing ? (
                <Button variant="secondary" size="sm" onClick={startEdit}><Pencil size={14} /> Edit</Button>
              ) : undefined}
            />
            {!editing ? (
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {[['Name', org?.name], ['Email', org?.contactEmail],
                  ['Phone', org?.contactPhone], ['Timezone', org?.timezone], ['Address', org?.address]
                ].map(([label, value]) => (
                  <div key={label as string}>
                    <dt className="text-xs font-medium uppercase tracking-wider" style={{ color: colors.text.dim }}>{label}</dt>
                    <dd className="mt-1 text-sm" style={{ color: colors.text.primary }}>{value || <span style={{ color: colors.text.dim }}>—</span>}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <form onSubmit={handleSubmit((d) => orgMut.mutate(d))} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input label="Name" error={errors.name?.message} {...register('name')} />
                  <Input label="Contact Email" type="email" {...register('contactEmail')} />
                  <Input label="Contact Phone" {...register('contactPhone')} />
                  <Input label="Timezone" {...register('timezone')} />
                </div>
                <Input label="Address" {...register('address')} />
                <Input label="Logo URL" type="url" {...register('logoUrl')} />
                <div className="flex gap-3">
                  <Button type="submit" loading={isSubmitting || orgMut.isPending}>Save changes</Button>
                  <Button type="button" variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
                </div>
              </form>
            )}
          </Card>

          {user?.role === 'BUSINESS_OWNER' && (
            <Card>
              <CardHeader
                title="AI Assistant (Magic Fill)"
                subtitle="Lets staff auto-draft Activity instructions and checklists. Off until a provider and key are set here."
                action={!aiEditing ? (
                  <Button variant="secondary" size="sm" onClick={startAiEdit}><Pencil size={14} /> {org?.aiKeyConfigured ? 'Change' : 'Set up'}</Button>
                ) : undefined}
              />
              {!aiEditing ? (
                <div className="flex items-center gap-2">
                  <Sparkles size={16} style={{ color: org?.aiKeyConfigured ? colors.text.primary : colors.text.dim }} />
                  {org?.aiKeyConfigured ? (
                    <p className="text-sm" style={{ color: colors.text.primary }}>
                      Enabled — using <span className="font-medium">{org?.aiProvider}</span>. The API key is hidden once saved.
                    </p>
                  ) : (
                    <p className="text-sm" style={{ color: colors.text.dim }}>Not configured — Magic Fill is hidden in Activities.</p>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Select
                      label="Provider"
                      placeholder="Select a provider…"
                      value={aiProvider}
                      onChange={(e) => setAiProvider(e.target.value as AiProvider)}
                      options={[
                        { value: 'ANTHROPIC', label: 'Anthropic (Claude)' },
                        { value: 'OPENAI', label: 'OpenAI (ChatGPT)' },
                        { value: 'GEMINI', label: 'Google (Gemini)' },
                      ]}
                    />
                    <Input
                      label="API Key"
                      type="password"
                      autoComplete="off"
                      placeholder={org?.aiKeyConfigured ? 'Leave blank to keep the current key' : 'Paste the provider API key'}
                      value={aiApiKey}
                      onChange={(e) => setAiApiKey(e.target.value)}
                    />
                  </div>
                  <p className="text-xs" style={{ color: colors.text.dim }}>
                    The key is stored server-side only — it is never shown again after saving.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Button onClick={saveAi} loading={aiMut.isPending}>Save</Button>
                    <Button variant="secondary" onClick={() => setAiEditing(false)}>Cancel</Button>
                    {org?.aiKeyConfigured && (
                      <Button variant="danger" onClick={clearAi} loading={aiMut.isPending}>Turn off</Button>
                    )}
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Public Holidays */}
          <Card>
            <CardHeader
              title="Public Holidays"
              subtitle="Sessions scheduled on these dates are flagged for rescheduling"
              action={canManage ? (
                <div className="flex items-center gap-2">
                  <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileChange} />
                  <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
                    <FileUp size={14} /><span className="hidden sm:inline"> Upload CSV</span>
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setAddingHoliday(v => !v)}>
                    <Plus size={14} /><span className="hidden sm:inline"> Add</span>
                  </Button>
                </div>
              ) : undefined}
            />
            {canManage && <p className="text-xs mb-4" style={{ color: colors.text.dim }}>CSV format: <code className="font-mono">date,name</code> — date as <code className="font-mono">YYYY-MM-DD</code>.</p>}
            {csvRows && (
              <div className="mb-4 rounded-xl overflow-hidden" style={{ border: `1px solid ${border.divider}` }}>
                <div className="flex items-center justify-between px-4 py-2.5" style={{ background: accentAlpha(0.06), borderBottom: `1px solid ${border.divider}` }}>
                  <p className="text-sm font-medium" style={{ color: colors.text.primary }}>{csvRows.length} holiday{csvRows.length !== 1 ? 's' : ''} ready to import</p>
                  <button onClick={() => setCsvRows(null)} style={{ color: colors.text.dim }}><X size={16} /></button>
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {csvRows.map((row, i) => (
                    <div key={i} className="flex items-center gap-4 px-4 py-2.5 text-sm" style={{ borderBottom: i < csvRows.length - 1 ? `1px solid ${border.divider}` : undefined }}>
                      <span className="font-mono text-xs w-28 flex-shrink-0" style={{ color: colors.text.muted }}>{format(parseISO(row.holidayDate), 'd MMM yyyy')}</span>
                      <span style={{ color: colors.text.primary }}>{row.name}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end gap-2 px-4 py-3" style={{ borderTop: `1px solid ${border.divider}` }}>
                  <Button variant="secondary" size="sm" onClick={() => setCsvRows(null)}>Cancel</Button>
                  <Button size="sm" loading={csvUploading} onClick={handleCsvImport}>Import {csvRows.length} holiday{csvRows.length !== 1 ? 's' : ''}</Button>
                </div>
              </div>
            )}
            {addingHoliday && (
              <div className="mb-4 p-4 rounded-xl flex flex-col sm:flex-row gap-3 items-end" style={{ background: accentAlpha(0.04), border: `1px solid ${border.divider}` }}>
                <Input label="Date" type="date" value={holidayDate} onChange={e => setHolidayDate(e.target.value)} />
                <div className="flex-1"><Input label="Holiday name" placeholder="e.g. Republic Day" value={holidayName} onChange={e => setHolidayName(e.target.value)} /></div>
                <div className="flex gap-2">
                  <Button size="sm" disabled={!holidayDate || !holidayName.trim()} loading={createHolidayMut.isPending} onClick={() => createHolidayMut.mutate({ holidayDate, name: holidayName.trim() })}>Add</Button>
                  <Button size="sm" variant="secondary" onClick={() => { setAddingHoliday(false); setHolidayDate(''); setHolidayName('') }}>Cancel</Button>
                </div>
              </div>
            )}
            {holidays.length === 0 ? (
              <div className="flex items-center gap-3 py-6 justify-center">
                <CalendarOff size={20} style={{ color: colors.text.dim }} />
                <p className="text-sm" style={{ color: colors.text.muted }}>No public holidays defined yet</p>
              </div>
            ) : (
              <div className="divide-subtle">
                {holidays.map(h => (
                  <div key={h.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium" style={{ color: colors.text.primary }}>{h.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: colors.text.muted }}>{format(parseISO(h.holidayDate), 'EEEE, d MMMM yyyy')}</p>
                    </div>
                    {canManage && (
                      <button onClick={() => deleteHolidayMut.mutate(h.id)} className="p-2 rounded-lg" style={{ color: colors.text.dim }}>
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Weekly Off Days */}
          <Card>
            <CardHeader
              title="Weekly Off Days"
              subtitle="Autoscheduling skips these days every week — ad-hoc sessions can still be booked on them"
            />
            <div className="flex flex-wrap gap-2">
              {WEEK_DAYS.map(d => {
                const active = (org?.weeklyOffDays ?? []).includes(d.value)
                return (
                  <button
                    key={d.value}
                    type="button"
                    disabled={!canManage || weeklyOffMut.isPending}
                    onClick={() => toggleWeeklyOffDay(d.value)}
                    className="rounded-full px-3 py-1.5 text-xs font-medium transition-all"
                    style={active ? styles.filterTabActive : styles.filterTabInactive}
                  >
                    {d.label}
                  </button>
                )
              })}
            </div>
          </Card>
        </>
      )}

      {/* ── Clinics tab ─────────────────────────────────────────────────────── */}
      {tab === 'clinics' && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm" style={{ color: colors.text.muted }}>
              {clinics.length} clinic{clinics.length !== 1 ? 's' : ''} in your organisation
            </p>
            {canManage && (
              <Button onClick={() => setShowClinicModal(true)}>
                <Plus size={16} /> New Clinic
              </Button>
            )}
          </div>

          {clinics.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Building2 size={32} />}
                title="No clinics yet"
                description="Create your first clinic to start managing cases and therapists."
                action={canManage ? { label: 'Create clinic', onClick: () => setShowClinicModal(true) } : undefined}
              />
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {clinics.map(clinic => (
                <Link key={clinic.id} to={`/clinics/${clinic.id}`}>
                  <div
                    className="rounded-2xl p-5 cursor-pointer transition-all"
                    style={styles.card}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = `0 0 0 1px var(--color-accent), 0 4px 16px ${accentAlpha(0.12)}`}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = (styles.card as React.CSSProperties).boxShadow as string ?? ''}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="rounded-xl p-2.5" style={{ background: accentAlpha(0.10), color: colors.accent }}>
                          <Building2 size={20} />
                        </div>
                        <div>
                          <p className="font-semibold" style={{ color: colors.text.primary }}>{clinic.name}</p>
                          <p className="text-xs mt-0.5" style={{ color: colors.text.muted }}>{clinic.email ?? 'No email'}</p>
                        </div>
                      </div>
                      <ChevronRight size={16} style={{ color: colors.text.dim }} />
                    </div>
                    {clinic.address && (
                      <p className="mt-3 text-xs truncate" style={{ color: colors.text.muted }}>{clinic.address}</p>
                    )}
                    <div className="mt-3 flex items-center gap-2">
                      <span
                        className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                        style={clinic.isActive
                          ? { background: successAlpha(0.10), color: colors.status.success }
                          : { background: dangerAlpha(0.10),  color: colors.status.danger }}
                      >
                        {clinic.isActive ? 'Active' : 'Inactive'}
                      </span>
                      <span className="text-xs" style={{ color: colors.text.dim }}>{clinic.timezone}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          <Modal open={showClinicModal} onClose={() => { setShowClinicModal(false); resetClinic() }} title="Create new clinic">
            <form onSubmit={handleClinicSubmit(d => createClinicMut.mutate(d))} className="space-y-4">
              <Input label="Clinic name" placeholder="Downtown Branch" error={clinicErrors.name?.message}
                {...registerClinic('name', { required: 'Clinic name is required' })} />
              <Input label="Email" type="email" placeholder="clinic@example.com" {...registerClinic('email')} />
              <Input label="Phone" placeholder="+1 555 0123" {...registerClinic('phone')} />
              <Input label="Address" placeholder="123 Main St, City" {...registerClinic('address')} />
              <Select label="Timezone" placeholder="Select timezone…" options={TIMEZONE_GROUPS} {...registerClinic('timezone')} />
              <div className="flex justify-end gap-3">
                <Button type="button" variant="secondary" onClick={() => { setShowClinicModal(false); resetClinic() }}>Cancel</Button>
                <Button type="submit" loading={isClinicSubmitting || createClinicMut.isPending}>Create</Button>
              </div>
            </form>
          </Modal>
        </>
      )}

      {/* ── Manage tab ──────────────────────────────────────────────────────── */}
      {tab === 'manage' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Programs */}
          <SectionCard title="Programs" icon={<IndianRupee size={18} />}>
            {programs.length === 0 && (
              <p className="text-sm py-2" style={{ color: colors.text.dim }}>No programs yet.</p>
            )}
            {programs.map(p => (
              <ProgramRow
                key={p.id}
                program={p}
                canManage={canManage}
                taxes={taxes}
                onToggle={() => canManage && toggleProgramMut.mutate({ id: p.id, isActive: !p.isActive })}
                onDelete={() => canManage && deleteProgramMut.mutate(p.id)}
                onEdit={(name, cost, desc, taxId, priceIncludesTax) => canManage && updateProgramMut.mutate({
                  id: p.id,
                  name,
                  perSessionCost: cost,
                  description: desc,
                  ...(taxId
                    ? { taxId, priceIncludesTax }
                    : (p.taxId ? { removeTax: true } : {})),
                })}
              />
            ))}
            {canManage && (
              <AddProgramRow
                loading={createProgramMut.isPending}
                taxes={taxes}
                onAdd={(name, cost, desc, taxId, priceIncludesTax) => createProgramMut.mutate({
                  name,
                  description: desc || undefined,
                  perSessionCost: parseFloat(cost),
                  taxId: taxId || undefined,
                  priceIncludesTax: taxId ? priceIncludesTax : undefined,
                })}
              />
            )}
          </SectionCard>

          {/* Conditions */}
          <SectionCard title="Conditions" icon={<HeartPulse size={18} />}>
            {conditions.length === 0 && (
              <p className="text-sm py-2" style={{ color: colors.text.dim }}>No conditions yet.</p>
            )}
            {conditions.map(c => (
              <ItemRow
                key={c.id}
                name={c.name}
                onDelete={() => deleteConditionMut.mutate(c.id)}
                canDelete={canManage && !!(c as any).orgId}
              />
            ))}
            {canManage && (
              <AddRow
                placeholder="e.g. Autism, ADHD…"
                loading={createConditionMut.isPending}
                onAdd={(name) => createConditionMut.mutate(name)}
              />
            )}
          </SectionCard>

          {/* Taxes */}
          <SectionCard title="Taxes" icon={<Receipt size={18} />}>
            {taxes.length === 0 && (
              <p className="text-sm py-2" style={{ color: colors.text.dim }}>No tax rates defined.</p>
            )}
            {taxes.map(t => (
              <ItemRow
                key={t.id}
                name={`${t.name} — ${t.rate}%`}
                onDelete={() => deleteTaxMut.mutate(t.id)}
                canDelete={canManage}
              />
            ))}
            {canManage && (
              <AddRow
                placeholder="e.g. GST"
                loading={createTaxMut.isPending}
                extraInput={{ placeholder: 'Rate %', label: 'Rate' }}
                onAdd={(name, rate) => createTaxMut.mutate({ name, rate: parseFloat(rate ?? '0') })}
              />
            )}
          </SectionCard>

        </div>
      )}

      {/* ── Activity Library tab ────────────────────────────────────────────── */}
      {tab === 'activity-library' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Activity Skills */}
          <SectionCard title="Activity Skills" icon={<Target size={18} />}>
            {skills.length === 0 && (
              <p className="text-sm py-2" style={{ color: colors.text.dim }}>No skills yet.</p>
            )}
            {skills.map(s => (
              <ItemRow key={s.id} name={s.name} onDelete={() => deleteSkillMut.mutate(s.id)} canDelete={canManage} />
            ))}
            {canManage && (
              <AddRow
                placeholder="e.g. Fine Motor, Attention…"
                loading={createSkillMut.isPending}
                onAdd={(name) => createSkillMut.mutate(name)}
              />
            )}
          </SectionCard>

          {/* Activity Languages */}
          <SectionCard title="Activity Languages" icon={<LanguagesIcon size={18} />}>
            {languages.length === 0 && (
              <p className="text-sm py-2" style={{ color: colors.text.dim }}>No languages yet.</p>
            )}
            {languages.map(l => (
              <ItemRow key={l.id} name={l.name} onDelete={() => deleteLanguageMut.mutate(l.id)} canDelete={canManage} />
            ))}
            {canManage && (
              <AddRow
                placeholder="e.g. English, Hindi…"
                loading={createLanguageMut.isPending}
                onAdd={(name) => createLanguageMut.mutate(name)}
              />
            )}
          </SectionCard>

          {/* Activity Props */}
          <SectionCard title="Activity Props Required" icon={<Box size={18} />}>
            {propsList.length === 0 && (
              <p className="text-sm py-2" style={{ color: colors.text.dim }}>No props yet.</p>
            )}
            {propsList.map(p => (
              <ItemRow key={p.id} name={p.name} onDelete={() => deletePropMut.mutate(p.id)} canDelete={canManage} />
            ))}
            {canManage && (
              <AddRow
                placeholder="e.g. Building Blocks, Flashcards…"
                loading={createPropMut.isPending}
                onAdd={(name) => createPropMut.mutate(name)}
              />
            )}
          </SectionCard>
        </div>
      )}

      {/* ── IEP Library tab ──────────────────────────────────────────────── */}
      {tab === 'iep-library' && <IEPLibraryTab />}

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
