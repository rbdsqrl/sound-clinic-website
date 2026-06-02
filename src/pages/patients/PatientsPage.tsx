import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Plus, Users, LayoutGrid, List, Search, Puzzle, Check } from 'lucide-react'
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
import { useAuth } from '../../contexts/AuthContext'
import { colors, border, styles, surface } from '../../theme'
import type { CreatePatientRequest, Gender, PatientResponse } from '../../types'
import { format, differenceInMonths } from 'date-fns'

// ── Avatar colours (cycles through 8) ────────────────────────────────────────

const AVATAR_COLORS = [
  { bg: '#4CAF50', text: '#fff' },
  { bg: '#9C27B0', text: '#fff' },
  { bg: '#3F51B5', text: '#fff' },
  { bg: '#009688', text: '#fff' },
  { bg: '#FF9800', text: '#fff' },
  { bg: '#E91E63', text: '#fff' },
  { bg: '#00BCD4', text: '#fff' },
  { bg: '#795548', text: '#fff' },
]

function avatarColor(index: number) {
  return AVATAR_COLORS[index % AVATAR_COLORS.length]
}

// ── Age helper ────────────────────────────────────────────────────────────────

function calcAge(dob: string): string {
  const totalMonths = differenceInMonths(new Date(), new Date(dob))
  const years  = Math.floor(totalMonths / 12)
  const months = totalMonths % 12
  if (years === 0) return `${months} month${months !== 1 ? 's' : ''}`
  if (months === 0) return `${years} year${years !== 1 ? 's' : ''}`
  return `${years} year${years !== 1 ? 's' : ''} ${months} month${months !== 1 ? 's' : ''}`
}

// ── Invite status ─────────────────────────────────────────────────────────────

type InviteStatus = 'ACTIVE' | 'NOT_INVITED'

function inviteStatus(p: PatientResponse): InviteStatus {
  return p.parents.length > 0 ? 'ACTIVE' : 'NOT_INVITED'
}

const INVITE_LABEL: Record<InviteStatus, string> = {
  ACTIVE:      'Active',
  NOT_INVITED: 'Not Invited',
}

const INVITE_STYLE: Record<InviteStatus, React.CSSProperties> = {
  ACTIVE:      { background: 'rgba(99,102,241,0.12)', color: '#6366f1' },
  NOT_INVITED: { background: 'rgba(99,102,241,0.10)', color: '#818cf8' },
}

// ── Filter pill types ─────────────────────────────────────────────────────────

type FilterKey = 'ACTIVE' | 'NOT_INVITED' | 'INACTIVE'

const FILTER_PILLS: { key: FilterKey; label: string }[] = [
  { key: 'ACTIVE',      label: 'Active'      },
  { key: 'NOT_INVITED', label: 'Not Invited' },
  { key: 'INACTIVE',    label: 'Inactive'    },
]

// ── Genders ───────────────────────────────────────────────────────────────────

const GENDERS: { value: Gender; label: string }[] = [
  { value: 'MALE',   label: 'Male'   },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER',  label: 'Other'  },
]

// ── Patient card ──────────────────────────────────────────────────────────────

function PatientCard({ patient, index }: { patient: PatientResponse; index: number }) {
  const color  = avatarColor(index)
  const status = inviteStatus(patient)
  const initials = `${patient.firstName[0] ?? ''}${patient.lastName[0] ?? ''}`.toUpperCase()

  return (
    <Link to={`/patients/${patient.id}`} className="block group">
      <div
        className="rounded-2xl p-5 flex flex-col gap-3 transition-shadow"
        style={{ background: surface.card, border: `1px solid ${border.divider}`, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
      >
        {/* Top row: avatar + name/age + status badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="h-12 w-12 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold"
              style={{ background: color.bg, color: color.text }}
            >
              {initials}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm leading-tight truncate" style={{ color: colors.text.heading }}>
                {patient.firstName} {patient.lastName[0]}<span style={{ color: colors.text.muted }}>#{index + 1}</span>
              </p>
              <p className="text-xs mt-0.5" style={{ color: colors.text.muted }}>
                {patient.dateOfBirth ? calcAge(patient.dateOfBirth) : '—'}
              </p>
            </div>
          </div>
          <span
            className="flex-shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap"
            style={INVITE_STYLE[status]}
          >
            {INVITE_LABEL[status]}
          </span>
        </div>

        {/* Conditions/therapy tags */}
        {patient.conditions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {patient.conditions.slice(0, 3).map(c => (
              <span
                key={c.id}
                className="text-[11px] px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(99,102,241,0.08)', color: '#6366f1' }}
              >
                {c.name}
              </span>
            ))}
            {patient.conditions.length > 3 && (
              <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,0,0,0.05)', color: colors.text.muted }}>
                +{patient.conditions.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium flex-1 justify-center"
            style={{ background: 'rgba(99,102,241,0.10)', color: '#6366f1' }}
            onClick={e => e.preventDefault()}
          >
            <Puzzle size={12} />
            Activities
          </button>
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold flex-1 justify-center"
            style={{ background: '#3730a3', color: '#fff' }}
            onClick={e => e.preventDefault()}
          >
            <Users size={12} />
            Specialists ({patient.therapists.length})
          </button>
        </div>

        {/* Added on */}
        <p className="text-center text-[11px]" style={{ color: colors.text.dim }}>
          Added On {format(new Date(patient.createdAt), 'dd MMM, yyyy')}
        </p>
      </div>
    </Link>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PatientsPage() {
  const { user } = useAuth()
  const { toasts, toast, dismiss } = useToast()
  const queryClient = useQueryClient()

  const [showModal,   setShowModal]   = useState(false)
  const [viewMode,    setViewMode]    = useState<'grid' | 'list'>('grid')
  const [tab,         setTab]         = useState<'all' | 'mine'>('all')
  const [search,      setSearch]      = useState('')
  const [activeFilters, setActiveFilters] = useState<Set<FilterKey>>(new Set(['ACTIVE', 'NOT_INVITED']))

  const { data: patients, isLoading } = useQuery({ queryKey: ['patients'], queryFn: patientsApi.list })
  const { data: clinics } = useQuery({ queryKey: ['clinics'], queryFn: clinicsApi.list })

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<CreatePatientRequest>()

  const createMutation = useMutation({
    mutationFn: patientsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      toast('Patient created', 'success')
      setShowModal(false)
      reset()
    },
    onError: () => toast('Failed to create patient', 'error'),
  })

  const clinicOptions = (clinics ?? []).map(c => ({ value: c.id, label: c.name }))
  const clinicMap     = Object.fromEntries((clinics ?? []).map(c => [c.id, c.name]))

  const filtered = useMemo(() => {
    if (!patients) return []
    let list = patients

    // Tab filter
    if (tab === 'mine' && user) {
      list = list.filter(p => p.therapists.some(t => t.id === user.id))
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(p =>
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(q)
      )
    }

    // Status pill filter
    if (activeFilters.size > 0) {
      list = list.filter(p => {
        const status = inviteStatus(p)
        const isInactive = !p.isActive
        if (isInactive) return activeFilters.has('INACTIVE')
        if (status === 'ACTIVE') return activeFilters.has('ACTIVE')
        return activeFilters.has('NOT_INVITED')
      })
    }

    return list
  }, [patients, tab, search, activeFilters, user])

  function toggleFilter(key: FilterKey) {
    setActiveFilters(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  if (isLoading) return <PageLoader />

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-5">

      {/* ── Tabs + toolbar ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

        {/* Tabs */}
        <div className="flex gap-0 border-b" style={{ borderColor: border.divider }}>
          {(['all', 'mine'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap"
              style={tab === t
                ? { color: '#3730a3', borderBottom: '2px solid #3730a3', marginBottom: -1 }
                : { color: colors.text.muted }
              }
            >
              {t === 'all' ? 'All Cases' : 'My Cases'}
            </button>
          ))}
        </div>

        {/* Right side: view toggle + search + add */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Grid / List toggle */}
          <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: border.divider }}>
            <button
              onClick={() => setViewMode('grid')}
              className="p-2 transition-colors"
              style={{ background: viewMode === 'grid' ? '#3730a3' : 'transparent', color: viewMode === 'grid' ? '#fff' : colors.text.muted }}
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className="p-2 transition-colors"
              style={{ background: viewMode === 'list' ? '#3730a3' : 'transparent', color: viewMode === 'list' ? '#fff' : colors.text.muted }}
            >
              <List size={16} />
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: colors.text.dim }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search Cases..."
              className="pl-8 pr-3 py-2 text-sm rounded-xl border outline-none w-44 md:w-56"
              style={{ borderColor: border.divider, background: surface.card, color: colors.text.primary }}
            />
          </div>

          {/* Add button */}
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold min-h-[36px]"
            style={{ background: '#3730a3', color: '#fff' }}
          >
            <Plus size={14} /> Add
          </button>
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
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all"
              style={active
                ? { borderColor: '#3730a3', color: '#3730a3', background: 'transparent' }
                : { borderColor: border.divider, color: colors.text.muted, background: 'transparent' }
              }
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
        <div className="rounded-2xl flex flex-col items-center justify-center py-16 gap-3" style={{ border: `1px solid ${border.divider}` }}>
          <Users size={32} style={{ color: colors.text.dim }} />
          <p className="text-sm font-medium" style={{ color: colors.text.muted }}>No patients match your filters</p>
          <button
            onClick={() => setShowModal(true)}
            className="text-xs px-4 py-2 rounded-lg font-medium"
            style={{ background: '#3730a3', color: '#fff' }}
          >
            Add Patient
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p, i) => (
            <PatientCard key={p.id} patient={p} index={i} />
          ))}
        </div>
      ) : (
        /* List view */
        <div className="rounded-2xl overflow-hidden border" style={{ borderColor: border.divider }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'rgba(0,0,0,0.02)', borderBottom: `1px solid ${border.divider}` }}>
                {['#', 'Patient', 'Age', 'Clinic', 'Conditions', 'Specialists', 'Status', 'Added'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: colors.text.muted }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => {
                const color  = avatarColor(i)
                const status = inviteStatus(p)
                const initials = `${p.firstName[0] ?? ''}${p.lastName[0] ?? ''}`.toUpperCase()
                return (
                  <tr
                    key={p.id}
                    style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${border.divider}` : undefined, cursor: 'pointer' }}
                    onClick={() => window.location.assign(`/patients/${p.id}`)}
                  >
                    <td className="px-4 py-3 text-xs" style={{ color: colors.text.dim }}>#{i + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold" style={{ background: color.bg, color: color.text }}>{initials}</div>
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
                            <span key={c.id} className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(99,102,241,0.08)', color: '#6366f1' }}>{c.name}</span>
                          ))}
                        {p.conditions.length > 2 && <span className="text-[11px]" style={{ color: colors.text.dim }}>+{p.conditions.length - 2}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3" style={{ color: colors.text.muted }}>{p.therapists.length}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full px-2.5 py-0.5 text-[11px] font-medium" style={INVITE_STYLE[status]}>{INVITE_LABEL[status]}</span>
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: colors.text.muted }}>{format(new Date(p.createdAt), 'dd MMM yyyy')}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Add patient modal ── */}
      <Modal open={showModal} onClose={() => { setShowModal(false); reset() }} title="Add Patient">
        <form onSubmit={handleSubmit(d => createMutation.mutate(d))} className="space-y-4">
          <Select label="Clinic" placeholder="Select clinic…" options={clinicOptions} error={errors.clinicId?.message}
            {...register('clinicId', { required: 'Clinic is required' })} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="First name" placeholder="Alex" error={errors.firstName?.message}
              {...register('firstName', { required: 'Required' })} />
            <Input label="Last name" placeholder="Johnson" error={errors.lastName?.message}
              {...register('lastName', { required: 'Required' })} />
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
