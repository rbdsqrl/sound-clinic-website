import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Plus, Users, LayoutGrid, List, Search, Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { patientsApi } from '../../api/patients'
import { clinicsApi } from '../../api/clinics'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Modal } from '../../components/ui/Modal'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageLoader } from '../../components/ui/Spinner'
import { ToastContainer } from '../../components/ui/Toast'
import { useToast } from '../../hooks/useToast'
import { getApiError } from '../../lib/apiError'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import { calcAge } from '../../lib/age'
import { colors, border, styles, surface, accentAlpha, paletteStyle } from '../../theme'
import { useAvatarColor } from '../../hooks/useAvatarColor'
import { getAvatarColorStyles } from '../../lib/avatarColor'
import type { CreatePatientRequest, Gender, PatientResponse } from '../../types'
import { format } from 'date-fns'

// ── Case status — active until discharged ───────────────────────────────────────

type CaseStatus = 'ACTIVE' | 'INACTIVE'

function caseStatus(p: PatientResponse): CaseStatus {
  return p.stage === 'DISCHARGED' ? 'INACTIVE' : 'ACTIVE'
}

const STATUS_LABEL: Record<CaseStatus, string> = {
  ACTIVE:   'Active',
  INACTIVE: 'Inactive',
}

const STATUS_STYLE: Record<CaseStatus, React.CSSProperties> = {
  ACTIVE:   paletteStyle('teal',  0.10),
  INACTIVE: paletteStyle('slate', 0.10),
}

// ── Filter pill types ─────────────────────────────────────────────────────────

type FilterKey = CaseStatus

const FILTER_PILLS: { key: FilterKey; label: string }[] = [
  { key: 'ACTIVE',   label: 'Active'   },
  { key: 'INACTIVE', label: 'Inactive' },
]

// ── Genders ───────────────────────────────────────────────────────────────────

const GENDERS: { value: Gender; label: string }[] = [
  { value: 'MALE',   label: 'Male'   },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER',  label: 'Other'  },
]

// ── Patient card (grid view) ──────────────────────────────────────────────────

function PatientCard({ patient, clinicName }: {
  patient: PatientResponse
  clinicName?: string
}) {
  const av      = useAvatarColor(`${patient.firstName} ${patient.lastName}`)
  const status  = caseStatus(patient)
  const initials = `${patient.firstName[0] ?? ''}${patient.lastName[0] ?? ''}`.toUpperCase()
  const therapies = patient.therapies ?? []

  return (
    <Link to={`/patients/${patient.id}`} className="block">
      <div
        className="rounded-2xl p-5 flex flex-col gap-3 transition-all"
        style={styles.card}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = `0 0 0 1px var(--color-accent), 0 4px 16px ${accentAlpha(0.12)}`}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = (styles.card as React.CSSProperties).boxShadow as string ?? ''}
      >
        {/* Avatar + name + status */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="h-10 w-10 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold"
              style={av}
            >
              {initials}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm leading-tight truncate" style={{ color: colors.text.primary }}>
                {patient.firstName} {patient.lastName}
              </p>
              <p className="text-xs mt-0.5" style={{ color: colors.text.muted }}>
                {patient.dateOfBirth ? calcAge(patient.dateOfBirth) : '—'}
                {clinicName && <> · {clinicName}</>}
              </p>
            </div>
          </div>
          <span
            className="flex-shrink-0 rounded-full px-2.5 py-0.5 text-[12.65px] font-medium whitespace-nowrap"
            style={STATUS_STYLE[status]}
          >
            {STATUS_LABEL[status]}
          </span>
        </div>

        {/* Therapies — fixed height for ~2 rows so every card lines up */}
        <div className="flex flex-wrap content-start gap-1.5 overflow-hidden" style={{ minHeight: 58, maxHeight: 58 }}>
          {therapies.length > 0 ? (
            <>
              {therapies.slice(0, 4).map(t => (
                <span key={t.id} className="text-[12.65px] px-2 py-0.5 rounded-full" style={paletteStyle('purple', 0.08, 0.15)}>
                  {t.name}
                </span>
              ))}
              {therapies.length > 4 && (
                <span className="text-[12.65px] px-2 py-0.5 rounded-full" style={{ background: accentAlpha(0.06), color: colors.text.muted }}>
                  +{therapies.length - 4}
                </span>
              )}
            </>
          ) : (
            <span className="text-[12.65px]" style={{ color: colors.text.dim }}>No therapy assigned</span>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: border.divider }}>
          <span className="text-[12.65px] flex items-center gap-1" style={{ color: colors.text.muted }}>
            <Users size={11} />
            {patient.therapists.length} specialist{patient.therapists.length !== 1 ? 's' : ''}
          </span>
          <span className="text-[12.65px]" style={{ color: colors.text.dim }}>
            {format(new Date(patient.createdAt), 'dd MMM yyyy')}
          </span>
        </div>
      </div>
    </Link>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PatientsPage() {
  const { theme } = useTheme()
  const { user, activeRole } = useAuth()
  const currentRole = activeRole ?? user?.role
  const isOfficeAdmin = currentRole === 'OFFICE_ADMIN'
  const canAddCase = currentRole !== 'THERAPIST'
  const { toasts, toast, dismiss } = useToast()
  const queryClient = useQueryClient()

  const [showModal,     setShowModal]     = useState(false)
  const [viewMode,      setViewMode]      = useState<'grid' | 'list'>('grid')
  const [tab,           setTab]           = useState<'all' | 'mine'>('all')
  const [search,        setSearch]        = useState('')
  const [activeFilters, setActiveFilters] = useState<Set<FilterKey>>(new Set(['ACTIVE']))
  const [page,          setPage]          = useState(0)
  const PAGE_SIZE = 18

  // Debounce search so every keystroke doesn't fire a request.
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  // Any filter change should land back on page 1.
  useEffect(() => { setPage(0) }, [tab, debouncedSearch, activeFilters])

  const statusParam = activeFilters.size === 0 ? '' : Array.from(activeFilters).join(',')

  const { data: patientsPage, isLoading, isFetching } = useQuery({
    queryKey: ['patients', 'search', { page, tab, debouncedSearch, statusParam }],
    queryFn: () => patientsApi.search({
      page,
      size: PAGE_SIZE,
      search: debouncedSearch || undefined,
      mine: tab === 'mine',
      status: statusParam,
      // Only parents.length / therapists.length are ever read on this page (invite-status pill,
      // specialist count) — never names, so skip resolving them to full User records server-side.
      compact: true,
    }),
    placeholderData: (prev) => prev,
  })
  const { data: clinics } = useQuery({ queryKey: ['clinics'], queryFn: clinicsApi.list })

  const filtered = patientsPage?.content ?? []

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<CreatePatientRequest>()

  const createMutation = useMutation({
    mutationFn: patientsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      toast('Case created', 'success')
      setShowModal(false)
      reset()
    },
    onError: (err) => toast(getApiError(err, 'Failed to create case'), 'error'),
  })

  const clinicOptions = (clinics ?? []).map(c => ({ value: c.id, label: c.name }))
  const clinicMap     = Object.fromEntries((clinics ?? []).map(c => [c.id, c.name]))

  function toggleFilter(key: FilterKey) {
    setActiveFilters(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

        {/* Tabs — Office Admin is never assigned a case, so "My Cases" doesn't apply */}
        {!isOfficeAdmin && (
          <div className="flex gap-0 border-b" style={{ borderColor: border.divider }}>
            {(['all', 'mine'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="px-4 py-2.5 text-sm font-medium -mb-px transition-colors whitespace-nowrap"
                style={tab === t ? styles.tabActive : styles.tabInactive}
              >
                {t === 'all' ? 'All Cases' : 'My Cases'}
              </button>
            ))}
          </div>
        )}

        {/* Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Grid / List toggle */}
          <div className="flex rounded-xl overflow-hidden" style={{ border: border.card }}>
            {(['grid', 'list'] as const).map((mode, idx) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className="p-2 transition-colors"
                style={viewMode === mode
                  ? { background: accentAlpha(0.10), color: colors.accent }
                  : { background: surface.card, color: colors.text.dim }}
              >
                {idx === 0 ? <LayoutGrid size={15} /> : <List size={15} />}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: colors.text.dim }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search cases…"
              className="pl-8 pr-3 py-2 text-sm rounded-xl outline-none w-44 md:w-52 transition-colors"
              style={{ border: border.card, background: surface.card, color: colors.text.primary }}
            />
          </div>

          {canAddCase && (
            <Button onClick={() => setShowModal(true)}>
              <Plus size={15} /> Add Case
            </Button>
          )}
        </div>
      </div>

      {/* ── Filter pills ── */}
      <div className="flex gap-2 flex-wrap">
        {FILTER_PILLS.map(({ key, label }) => {
          const active = activeFilters.has(key)
          return (
            <button
              key={key}
              onClick={() => toggleFilter(key)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all"
              style={active ? styles.filterTabActive : styles.filterTabInactive}
            >
              {active
                ? <Check size={11} strokeWidth={3} />
                : <span className="h-1.5 w-1.5 rounded-full inline-block" style={{ background: colors.text.dim }} />
              }
              {label}
            </button>
          )
        })}
      </div>

      {/* ── Patient list ── */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Users size={32} />}
          title="No cases match your filters"
          description="Try adjusting the filters above or add a new case."
          action={canAddCase ? { label: 'Add Case', onClick: () => setShowModal(true) } : undefined}
        />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <PatientCard key={p.id} patient={p} clinicName={clinicMap[p.clinicId]} />
          ))}
        </div>
      ) : (
        /* List view */
        <>
          {/* Mobile cards */}
          <div className="flex flex-col gap-3 md:hidden">
            {filtered.map((p) => {
              const av      = getAvatarColorStyles(`${p.firstName} ${p.lastName}`, theme === 'dark')
              const status  = caseStatus(p)
              const initials = `${p.firstName[0] ?? ''}${p.lastName[0] ?? ''}`.toUpperCase()
              return (
                <Link key={p.id} to={`/patients/${p.id}`}>
                  <div className="rounded-xl p-4" style={styles.card}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="h-9 w-9 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold" style={av}>{initials}</div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate" style={{ color: colors.text.primary }}>{p.firstName} {p.lastName}</p>
                          <p className="text-xs mt-0.5" style={{ color: colors.text.muted }}>{p.dateOfBirth ? calcAge(p.dateOfBirth) : '—'}</p>
                        </div>
                      </div>
                      <span className="flex-shrink-0 rounded-full px-2.5 py-0.5 text-[12.65px] font-medium" style={STATUS_STYLE[status]}>{STATUS_LABEL[status]}</span>
                    </div>
                    {p.conditions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {p.conditions.slice(0, 2).map(c => (
                          <span key={c.id} className="text-[12.65px] px-2 py-0.5 rounded-full" style={paletteStyle('purple', 0.08, 0.15)}>{c.name}</span>
                        ))}
                        {p.conditions.length > 2 && <span className="text-[12.65px]" style={{ color: colors.text.dim }}>+{p.conditions.length - 2}</span>}
                      </div>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block rounded-2xl overflow-hidden" style={styles.card}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: `1px solid ${border.divider}` }}>
                  {['Case', 'Age', 'Clinic', 'Conditions', 'Specialists', 'Status', 'Added'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: colors.text.dim }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const av      = getAvatarColorStyles(`${p.firstName} ${p.lastName}`, theme === 'dark')
                  const status  = caseStatus(p)
                  const initials = `${p.firstName[0] ?? ''}${p.lastName[0] ?? ''}`.toUpperCase()
                  return (
                    <tr
                      key={p.id}
                      className="cursor-pointer transition-colors"
                      style={{ borderBottom: `1px solid ${border.divider}` }}
                      onClick={() => window.location.assign(`/patients/${p.id}`)}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = accentAlpha(0.03)}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold" style={av}>{initials}</div>
                          <span className="font-medium" style={{ color: colors.text.primary }}>{p.firstName} {p.lastName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3" style={{ color: colors.text.muted }}>{p.dateOfBirth ? calcAge(p.dateOfBirth) : '—'}</td>
                      <td className="px-4 py-3" style={{ color: colors.text.muted }}>{clinicMap[p.clinicId] ?? '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {p.conditions.length === 0
                            ? <span style={{ color: colors.text.dim }}>—</span>
                            : p.conditions.slice(0, 2).map(c => (
                              <span key={c.id} className="text-[12.65px] px-2 py-0.5 rounded-full" style={paletteStyle('purple', 0.08, 0.15)}>{c.name}</span>
                            ))}
                          {p.conditions.length > 2 && <span className="text-[12.65px]" style={{ color: colors.text.dim }}>+{p.conditions.length - 2}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3" style={{ color: colors.text.muted }}>{p.therapists.length}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full px-2.5 py-0.5 text-[12.65px] font-medium" style={STATUS_STYLE[status]}>{STATUS_LABEL[status]}</span>
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: colors.text.muted }}>{format(new Date(p.createdAt), 'dd MMM yyyy')}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Pagination ── */}
      {patientsPage && patientsPage.totalPages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <p className="text-xs" style={{ color: colors.text.dim }}>
            Page {patientsPage.page + 1} of {patientsPage.totalPages} · {patientsPage.totalElements} case{patientsPage.totalElements !== 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0 || isFetching}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
              style={{ border: border.card, color: colors.text.primary }}
            >
              <ChevronLeft size={14} /> Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(patientsPage.totalPages - 1, p + 1))}
              disabled={page + 1 >= patientsPage.totalPages || isFetching}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
              style={{ border: border.card, color: colors.text.primary }}
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── Add patient modal ── */}
      <Modal open={showModal} onClose={() => { setShowModal(false); reset() }} title="Add Case">
        <form onSubmit={handleSubmit(d => createMutation.mutate(d))} className="space-y-4">
          <Select label="Clinic" placeholder="Select clinic…" options={clinicOptions} error={errors.clinicId?.message}
            {...register('clinicId', { required: 'Clinic is required' })} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="First name" placeholder="Alex" error={errors.firstName?.message}
              {...register('firstName', { required: 'Required' })} />
            <Input label="Last name" placeholder="Johnson" error={errors.lastName?.message}
              {...register('lastName')} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Date of birth" type="date" {...register('dateOfBirth')} />
            <Select label="Gender" placeholder="Select…" options={GENDERS} {...register('gender')} />
          </div>
          <div>
            <label className="form-label">Notes</label>
            <textarea className="form-input min-h-[80px] resize-none" {...register('notes')} />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => { setShowModal(false); reset() }}>Cancel</Button>
            <Button type="submit" loading={isSubmitting || createMutation.isPending}>Create</Button>
          </div>
        </form>
      </Modal>

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
