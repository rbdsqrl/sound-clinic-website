import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import {
  Search, LayoutGrid, List, UserPlus, Briefcase,
  Mail, Phone, Users, Building2,
  Link2, CalendarDays, Send, Trash2, XCircle, UserCheck,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import { format } from 'date-fns'
import { usersApi } from '../../api/users'
import { invitationsApi } from '../../api/invitations'
import { clinicsApi } from '../../api/clinics'
import { useAuth } from '../../contexts/AuthContext'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageLoader } from '../../components/ui/Spinner'
import { statusBadge, roleBadge, roleLabel } from '../../components/ui/Badge'
import { useToast } from '../../hooks/useToast'
import { getApiError } from '../../lib/apiError'
import { ROUTES } from '../../lib/routes'
import { Avatar } from '../../components/shared/Avatar'
import { CopyLinkBox } from '../../components/shared/CopyLinkBox'
import {
  colors, styles, surface, border, shadow,
  accentAlpha, successAlpha, dangerAlpha,
} from '../../theme'
import type { StaffMemberResponse, Role, InviteResponse, InviteRequest } from '../../types'

// ── Constants ─────────────────────────────────────────────────────────────────

const STAFF_ROLES: { value: string; label: string }[] = [
  { value: 'CLINIC_HEAD',   label: 'Clinic Head' },
  { value: 'THERAPIST',     label: 'Therapist' },
  { value: 'OFFICE_ADMIN',  label: 'Office Admin' },
]

// Parents (and patients) are invited from the patient's own page, not here.
export const INVITABLE_ROLES: { value: Role; label: string }[] = [
  { value: 'CLINIC_HEAD',    label: 'Clinic Head' },
  { value: 'THERAPIST',      label: 'Therapist' },
  { value: 'OFFICE_ADMIN',   label: 'Office Admin' },
  { value: 'BUSINESS_OWNER', label: 'Business Owner' },
]

type Tab = 'members' | 'invites' | 'archived'
type ViewMode = 'grid' | 'list'
type InviteStatusFilter = 'ALL' | 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED'

/** An invitation nobody took up — still resendable, still withdrawable. */
function canWithdraw(status: InviteResponse['status']): boolean {
  return status === 'PENDING' || status === 'EXPIRED'
}

// ── Member card ───────────────────────────────────────────────────────────────

function MemberCard({
  member, clinicName, onDelete, onActivate, onReinvite, onSelect,
}: {
  member: StaffMemberResponse
  clinicName: string
  onDelete?: () => void
  onActivate?: () => void
  onReinvite?: () => void
  onSelect: () => void
}) {
  const initials = `${member.firstName[0] ?? ''}${member.lastName[0] ?? ''}`.toUpperCase()
  const isClinical = member.role === 'THERAPIST'

  return (
    <div
      onClick={onSelect}
      className="rounded-2xl p-4 flex flex-col gap-3 cursor-pointer transition-colors"
      style={{ background: surface.card, border: border.card, boxShadow: shadow.card }}
    >
      <div className="flex items-start gap-3">
        <Avatar initials={initials} name={`${member.firstName} ${member.lastName}`} size="xl" shape="square" bold />
        <div className="min-w-0 flex-1">
          <p className="font-semibold truncate" style={{ color: colors.text.primary }}>
            {member.firstName} {member.lastName}
          </p>
          <span
            className="inline-block text-[12.65px] font-medium px-2 py-0.5 rounded-full mt-0.5"
            style={{ background: accentAlpha(0.1), color: colors.accent }}
          >
            {roleLabel(member.role)}
          </span>
        </div>
        <div
          className="h-2 w-2 rounded-full flex-shrink-0 mt-1.5"
          style={{ background: member.isActive ? colors.status.success : colors.status.error }}
          title={member.isActive ? 'Active' : 'Inactive'}
        />
      </div>

      <div className="space-y-1">
        {member.email && (
          <div className="flex items-center gap-1.5 text-xs truncate" style={{ color: colors.text.muted }}>
            <Mail size={11} className="flex-shrink-0" /><span className="truncate">{member.email}</span>
          </div>
        )}
        {member.phone && (
          <div className="flex items-center gap-1.5 text-xs" style={{ color: colors.text.muted }}>
            <Phone size={11} className="flex-shrink-0" /><span>{member.phone}</span>
          </div>
        )}
        {clinicName && (
          <div className="flex items-center gap-1.5 text-xs truncate" style={{ color: colors.text.muted }}>
            <Building2 size={11} className="flex-shrink-0" /><span className="truncate">{clinicName}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-2" style={{ borderTop: `1px solid ${border.divider}` }}>
        <span className="text-[12.65px]" style={{ color: colors.text.dim }}>
          Joined {format(new Date(member.createdAt), 'MMM yyyy')}
        </span>
        <div className="flex items-center gap-2">
          {isClinical && (
            <span
              className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ background: accentAlpha(0.06), color: colors.accent }}
            >
              <Briefcase size={10} />{member.caseCount} {member.caseCount === 1 ? 'case' : 'cases'}
            </span>
          )}
          {onReinvite && (
            <button
              onClick={e => { e.stopPropagation(); onReinvite() }}
              className="flex items-center justify-center rounded-lg p-1.5 transition-colors"
              style={{ color: colors.text.dim }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = colors.accent; (e.currentTarget as HTMLElement).style.background = accentAlpha(0.08) }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = colors.text.dim; (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              title="Re-invite with a new role"
            >
              <Send size={13} />
            </button>
          )}
          {onActivate && (
            <button
              onClick={e => { e.stopPropagation(); onActivate() }}
              className="flex items-center justify-center rounded-lg p-1.5 transition-colors"
              style={{ color: colors.text.dim }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = colors.status.success; (e.currentTarget as HTMLElement).style.background = successAlpha(0.08) }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = colors.text.dim; (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              title="Activate member"
            >
              <UserCheck size={13} />
            </button>
          )}
          {onDelete && (
            <button
              onClick={e => { e.stopPropagation(); onDelete() }}
              className="flex items-center justify-center rounded-lg p-1.5 transition-colors"
              style={{ color: colors.text.dim }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = colors.status.error; (e.currentTarget as HTMLElement).style.background = dangerAlpha(0.08) }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = colors.text.dim; (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              title="Delete member"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Member row (list view) ────────────────────────────────────────────────────

function MemberRow({
  member, clinicName, onDelete, onActivate, onReinvite, onSelect,
}: {
  member: StaffMemberResponse
  clinicName: string
  onDelete?: () => void
  onActivate?: () => void
  onReinvite?: () => void
  onSelect: () => void
}) {
  const initials = `${member.firstName[0] ?? ''}${member.lastName[0] ?? ''}`.toUpperCase()
  const isClinical = member.role === 'THERAPIST'

  return (
    <tr onClick={onSelect} className="border-b cursor-pointer transition-colors" style={{ borderColor: border.divider }}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar initials={initials} name={`${member.firstName} ${member.lastName}`} size="lg" shape="square" bold />
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: colors.text.primary }}>
              {member.firstName} {member.lastName}
            </p>
            <p className="text-xs truncate" style={{ color: colors.text.muted }}>{member.email}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 hidden sm:table-cell">
        <span className="text-[12.65px] font-medium px-2 py-0.5 rounded-full"
          style={{ background: accentAlpha(0.1), color: colors.accent }}>
          {roleLabel(member.role)}
        </span>
      </td>
      <td className="px-4 py-3 hidden md:table-cell text-xs truncate" style={{ color: colors.text.muted }}>
        {clinicName || '—'}
      </td>
      <td className="px-4 py-3 hidden lg:table-cell text-sm text-center" style={{ color: colors.text.primary }}>
        {isClinical ? member.caseCount : '—'}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className="text-[12.65px] font-medium px-2 py-0.5 rounded-full"
            style={member.isActive
              ? { background: successAlpha(0.1), color: colors.status.success }
              : { background: dangerAlpha(0.1),  color: colors.status.error }}
          >
            {member.isActive ? 'Active' : 'Inactive'}
          </span>
          {onReinvite && (
            <button
              onClick={e => { e.stopPropagation(); onReinvite() }}
              className="flex items-center justify-center rounded-lg p-1.5 transition-colors"
              style={{ color: colors.text.dim }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = colors.accent; (e.currentTarget as HTMLElement).style.background = accentAlpha(0.08) }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = colors.text.dim; (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              title="Re-invite with a new role"
            >
              <Send size={13} />
            </button>
          )}
          {onActivate && (
            <button
              onClick={e => { e.stopPropagation(); onActivate() }}
              className="flex items-center justify-center rounded-lg p-1.5 transition-colors"
              style={{ color: colors.text.dim }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = colors.status.success; (e.currentTarget as HTMLElement).style.background = successAlpha(0.08) }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = colors.text.dim; (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              title="Activate member"
            >
              <UserCheck size={13} />
            </button>
          )}
          {onDelete && (
            <button
              onClick={e => { e.stopPropagation(); onDelete() }}
              className="flex items-center justify-center rounded-lg p-1.5 transition-colors"
              style={{ color: colors.text.dim }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = colors.status.error; (e.currentTarget as HTMLElement).style.background = dangerAlpha(0.08) }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = colors.text.dim; (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              title="Delete member"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MembersPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { toast } = useToast()
  const { user, activeRole } = useAuth()
  const isOwner = (activeRole ?? user?.role) === 'BUSINESS_OWNER'
  const isOfficeAdmin = (activeRole ?? user?.role) === 'OFFICE_ADMIN'
  // Office Admin can invite front-line staff, but not org leadership.
  const invitableRoles = isOfficeAdmin
    ? INVITABLE_ROLES.filter(r => r.value !== 'BUSINESS_OWNER' && r.value !== 'CLINIC_HEAD')
    : INVITABLE_ROLES

  const [tab, setTab]               = useState<Tab>('members')
  const [deleteTarget, setDeleteTarget] = useState<StaffMemberResponse | null>(null)
  const [viewMode, setViewMode]     = useState<ViewMode>('grid')
  const [search, setSearch]         = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [clinicFilter, setClinicFilter] = useState('')
  const [inviteStatusFilter, setInviteStatusFilter] = useState<InviteStatusFilter>('ALL')
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [reinviteTarget, setReinviteTarget] = useState<StaffMemberResponse | null>(null)
  const [linkModal, setLinkModal]   = useState<InviteResponse | null>(null)
  const [cancelTarget, setCancelTarget] = useState<InviteResponse | null>(null)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [page, setPage]             = useState(0)
  const PAGE_SIZE = 20

  // Debounce search so every keystroke doesn't fire a request.
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  // Any filter change should land back on page 1.
  useEffect(() => { setPage(0) }, [tab, debouncedSearch, roleFilter, clinicFilter])

  useEffect(() => { if (showInviteModal) setInviteError(null) }, [showInviteModal])
  useEffect(() => { if (deleteTarget) setDeleteError(null) }, [deleteTarget])

  // ── Queries ──────────────────────────────────────────────────────────────────
  // Tab badges show unfiltered totals for Members/Archived, so these are fetched
  // independently of the search/role/clinic filters below (size:1 — only the count matters).
  const { data: activeCountPage } = useQuery({
    queryKey: ['members', 'count', 'active'],
    queryFn: () => usersApi.searchMembers({ active: true, page: 0, size: 1 }),
  })
  const { data: archivedCountPage } = useQuery({
    queryKey: ['members', 'count', 'archived'],
    queryFn: () => usersApi.searchMembers({ active: false, page: 0, size: 1 }),
  })

  const { data: membersPage, isLoading: membersLoading, isFetching: membersFetching } = useQuery({
    queryKey: ['members', 'search', { page, tab, debouncedSearch, roleFilter, clinicFilter }],
    queryFn: () => usersApi.searchMembers({
      page,
      size: PAGE_SIZE,
      search: debouncedSearch || undefined,
      role: (roleFilter || undefined) as Role | undefined,
      clinicId: clinicFilter || undefined,
      active: tab !== 'archived',
    }),
    enabled: tab !== 'invites',
    placeholderData: (prev) => prev,
  })

  const { data: invites = [], isLoading: invitesLoading } = useQuery({
    queryKey: ['invitations'],
    queryFn: () => invitationsApi.list(),
    enabled: tab === 'invites',
  })

  const { data: clinics = [] } = useQuery({
    queryKey: ['clinics'],
    queryFn: clinicsApi.list,
  })

  const clinicMap = Object.fromEntries(clinics.map(c => [c.id, c.name]))
  const clinicOptions = clinics.map(c => ({ value: c.id, label: c.name }))

  // ── Invite form ───────────────────────────────────────────────────────────────
  const { register, handleSubmit, watch, reset, setValue, formState: { errors, isSubmitting } } = useForm<InviteRequest>()
  const selectedRole = watch('role') as Role | undefined
  const needsClinic  = selectedRole === 'THERAPIST' || selectedRole === 'PARENT'

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const inviteMut = useMutation({
    mutationFn: invitationsApi.send,
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['invitations'] })
      reset()
      setShowInviteModal(false)
      setReinviteTarget(null)
      setLinkModal(res)
      setTab('invites')
    },
    onError: (err) => setInviteError(getApiError(err, 'Failed to send invite')),
  })

  const activateMemberMut = useMutation({
    mutationFn: (id: string) => usersApi.activateMember(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members'] })
      toast('Member activated', 'success')
    },
    onError: (err) => toast(getApiError(err, 'Failed to activate member'), 'error'),
  })

  const openReinvite = (member: StaffMemberResponse) => {
    reset()
    setValue('email', member.email)
    if (member.clinicId) setValue('clinicId', member.clinicId)
    setReinviteTarget(member)
    setShowInviteModal(true)
  }

  const resendMut = useMutation({
    mutationFn: (id: string) => invitationsApi.resend(id),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['invitations'] })
      toast('Invitation resent', 'success')
      setLinkModal(res)
    },
    onError: (err) => toast(getApiError(err, 'Failed to resend invite'), 'error'),
  })

  const cancelMut = useMutation({
    mutationFn: (id: string) => invitationsApi.cancel(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invitations'] })
      toast('Invitation cancelled', 'success')
    },
    onError: (err) => toast(getApiError(err, 'Could not cancel the invitation'), 'error'),
  })

  const deleteMemberMut = useMutation({
    mutationFn: (id: string) => usersApi.deleteMember(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members'] })
      toast('Member deleted', 'success')
      setDeleteTarget(null)
    },
    onError: (err) => setDeleteError(getApiError(err, 'Failed to delete member')),
  })

  // ── Filtering ─────────────────────────────────────────────────────────────────
  const activeMembersCount   = activeCountPage?.totalElements ?? 0
  const archivedMembersCount = archivedCountPage?.totalElements ?? 0
  const shownMembers = membersPage?.content ?? []

  const filteredInvites = invites.filter(i => {
    const q = search.toLowerCase()
    const matchSearch = !q || i.email.toLowerCase().includes(q)
    const matchStatus = inviteStatusFilter === 'ALL' || i.status === inviteStatusFilter
    return matchSearch && matchStatus
  })

  const pendingCount = invites.filter(i => i.status === 'PENDING').length
  const isLoading    = tab === 'invites' ? invitesLoading : membersLoading

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: 'members',  label: 'Members',  count: activeMembersCount },
    { key: 'invites',  label: 'Invites',  count: pendingCount || undefined },
    { key: 'archived', label: 'Archived', count: archivedMembersCount || undefined },
  ]

  const INVITE_STATUS_FILTERS: { value: InviteStatusFilter; label: string }[] = [
    { value: 'ALL',       label: 'All' },
    { value: 'PENDING',   label: 'Pending' },
    { value: 'ACCEPTED',  label: 'Accepted' },
    { value: 'EXPIRED',   label: 'Expired' },
    { value: 'CANCELLED', label: 'Cancelled' },
  ]

  return (
    <>
      <div className="max-w-7xl mx-auto space-y-5">

        {/* Page header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg md:text-xl font-bold" style={{ color: colors.text.heading }}>Members</h1>
            <p className="text-sm mt-0.5" style={{ color: colors.text.muted }}>
              {activeMembersCount} active · {pendingCount} pending invite{pendingCount !== 1 ? 's' : ''}
            </p>
          </div>
          <Button onClick={() => { reset(); setReinviteTarget(null); setShowInviteModal(true) }}>
            <UserPlus size={15} /> Invite Member
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0" style={{ borderColor: border.divider }}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setSearch(''); setRoleFilter(''); setClinicFilter('') }}
              className="flex-shrink-0 whitespace-nowrap px-4 py-2.5 text-sm font-medium -mb-px transition-colors flex items-center gap-1.5"
              style={tab === t.key ? styles.tabActive : styles.tabInactive}
            >
              {t.label}
              {t.count !== undefined && (
                <span
                  className="text-[11.5px] font-semibold px-1.5 py-0.5 rounded-full min-w-[18px] text-center"
                  style={{ background: accentAlpha(0.12), color: colors.accent }}
                >
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Members / Archived controls ─────────────────────────────────── */}
        {tab !== 'invites' && (
          <div className="flex flex-col gap-3">
            {/* Clinic filter tabs */}
            {clinics.length > 1 && (
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                <button
                  onClick={() => setClinicFilter('')}
                  className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap"
                  style={clinicFilter === '' ? styles.filterTabActive : styles.filterTabInactive}
                >
                  All clinics
                </button>
                {clinics.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setClinicFilter(c.id)}
                    className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap"
                    style={clinicFilter === c.id ? styles.filterTabActive : styles.filterTabInactive}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: colors.text.muted }} />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search members…" className="form-input pl-8 w-full" />
              </div>
              <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
                className="form-input min-w-[140px]">
                <option value="">All Roles</option>
                {STAFF_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <div className="flex rounded-xl overflow-hidden flex-shrink-0" style={{ border: border.card }}>
                <button onClick={() => setViewMode('grid')} className="px-3 py-2 transition-colors"
                  style={viewMode === 'grid'
                    ? { background: colors.accent, color: '#fff' }
                    : { background: 'transparent', color: colors.text.muted }}>
                  <LayoutGrid size={15} />
                </button>
                <button onClick={() => setViewMode('list')} className="px-3 py-2 transition-colors"
                  style={viewMode === 'list'
                    ? { background: colors.accent, color: '#fff' }
                    : { background: 'transparent', color: colors.text.muted }}>
                  <List size={15} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Invites controls ─────────────────────────────────────────────── */}
        {tab === 'invites' && (
          <div className="flex flex-col gap-3">
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {INVITE_STATUS_FILTERS.map(f => {
                const count = f.value === 'ALL'
                  ? invites.length
                  : invites.filter(i => i.status === f.value).length
                return (
                  <button
                    key={f.value}
                    onClick={() => setInviteStatusFilter(f.value)}
                    className="flex-shrink-0 px-3 py-1.5 rounded-full text-sm whitespace-nowrap flex items-center gap-1"
                    style={inviteStatusFilter === f.value ? styles.filterTabActive : styles.filterTabInactive}
                  >
                    {f.label}
                    {count > 0 && <span className="opacity-60 text-xs">{count}</span>}
                  </button>
                )
              })}
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: colors.text.muted }} />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by email…" className="form-input pl-8 w-full" />
            </div>
          </div>
        )}

        {/* ── Content ──────────────────────────────────────────────────────── */}
        {isLoading ? <PageLoader /> : tab === 'invites' ? (

          filteredInvites.length === 0 ? (
            <EmptyState icon={<Mail size={40} />} title={search ? 'No matching invitations' : 'No invitations sent yet'} />
          ) : (<>
            {/* Mobile card list */}
            <div className="flex flex-col gap-3 md:hidden">
              {filteredInvites.map(inv => (
                <div key={inv.id} className="rounded-2xl p-4" style={styles.card}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate" style={{ color: colors.text.primary }}>{inv.email}</p>
                      {inv.clinicName && <p className="text-xs mt-0.5 truncate" style={{ color: colors.text.muted }}>{inv.clinicName}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      {statusBadge(inv.status)}
                      {roleBadge(inv.role)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: `1px solid ${border.divider}` }}>
                    <p className="flex items-center gap-1 text-xs" style={{ color: colors.text.muted }}>
                      <CalendarDays size={11} /> Expires {format(new Date(inv.expiresAt), 'MMM d, yyyy')}
                    </p>
                    <div className="flex items-center gap-2">
                      {inv.acceptLink && (
                        <button onClick={() => setLinkModal(inv)}
                          className="flex items-center gap-1 text-xs font-medium min-h-[36px] px-2"
                          style={{ color: colors.accent }}>
                          <Link2 size={12} /> View link
                        </button>
                      )}
                      {canWithdraw(inv.status) && (
                        <>
                          <button
                            onClick={() => resendMut.mutate(inv.id)}
                            disabled={resendMut.isPending && resendMut.variables === inv.id}
                            className="flex items-center gap-1 text-xs font-medium min-h-[36px] px-2 disabled:opacity-50"
                            style={{ color: colors.accent }}>
                            <Send size={12} /> Resend
                          </button>
                          <button
                            onClick={() => setCancelTarget(inv)}
                            disabled={cancelMut.isPending && cancelMut.variables === inv.id}
                            className="flex items-center gap-1 text-xs font-medium min-h-[36px] px-2 disabled:opacity-50"
                            style={{ color: colors.status.error }}>
                            <XCircle size={12} /> Cancel
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto rounded-2xl" style={styles.card}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: border.card }}>
                    {['Email', 'Role', 'Clinic', 'Status', 'Expires', 'Link'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                        style={{ color: colors.text.muted }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredInvites.map(inv => (
                    <tr key={inv.id} className="border-b" style={{ borderColor: border.divider }}>
                      <td className="px-4 py-3 max-w-[200px] truncate" style={{ color: colors.text.primary }}>{inv.email}</td>
                      <td className="px-4 py-3">{roleBadge(inv.role)}</td>
                      <td className="px-4 py-3 text-sm" style={{ color: colors.text.muted }}>{inv.clinicName ?? '—'}</td>
                      <td className="px-4 py-3">{statusBadge(inv.status)}</td>
                      <td className="px-4 py-3 text-sm" style={{ color: colors.text.muted }}>
                        {format(new Date(inv.expiresAt), 'MMM d, yyyy')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {inv.acceptLink && (
                            <button onClick={() => setLinkModal(inv)}
                              className="flex items-center gap-1 text-xs hover:underline"
                              style={{ color: colors.accent }}>
                              <Link2 size={13} /> View link
                            </button>
                          )}
                          {canWithdraw(inv.status) ? (
                            <>
                              <button
                                onClick={() => resendMut.mutate(inv.id)}
                                disabled={resendMut.isPending && resendMut.variables === inv.id}
                                className="flex items-center gap-1 text-xs hover:underline disabled:opacity-50"
                                style={{ color: colors.accent }}>
                                <Send size={13} /> Resend
                              </button>
                              <button
                                onClick={() => setCancelTarget(inv)}
                                disabled={cancelMut.isPending && cancelMut.variables === inv.id}
                                className="flex items-center gap-1 text-xs hover:underline disabled:opacity-50"
                                style={{ color: colors.status.error }}>
                                <XCircle size={13} /> Cancel
                              </button>
                            </>
                          ) : !inv.acceptLink && (
                            <span className="text-xs" style={{ color: colors.text.dim }}>—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>)

        ) : shownMembers.length === 0 ? (
          <EmptyState icon={<Users size={40} />} title={search ? 'No members match your search' : 'No members found'} />
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {shownMembers.map((m) => (
              <MemberCard key={m.id} member={m} clinicName={m.clinicId ? (clinicMap[m.clinicId] ?? '') : ''}
                onDelete={isOwner && m.isActive ? () => setDeleteTarget(m) : undefined}
                onActivate={isOwner && !m.isActive ? () => activateMemberMut.mutate(m.id) : undefined}
                onReinvite={isOwner && !m.isActive ? () => openReinvite(m) : undefined}
                onSelect={() => navigate(ROUTES.member(m.id))} />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl" style={styles.card}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: border.card }}>
                  {['Name', 'Role', 'Clinic', 'Cases', 'Status'].map((h, i) => (
                    <th key={h} className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide ${i === 1 ? 'hidden sm:table-cell' : i === 2 ? 'hidden md:table-cell' : i === 3 ? 'hidden lg:table-cell' : ''}`}
                      style={{ color: colors.text.muted }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shownMembers.map((m) => (
                  <MemberRow key={m.id} member={m} clinicName={m.clinicId ? (clinicMap[m.clinicId] ?? '') : ''}
                    onDelete={isOwner && m.isActive ? () => setDeleteTarget(m) : undefined}
                    onActivate={isOwner && !m.isActive ? () => activateMemberMut.mutate(m.id) : undefined}
                    onReinvite={isOwner && !m.isActive ? () => openReinvite(m) : undefined}
                    onSelect={() => navigate(ROUTES.member(m.id))} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Pagination ── */}
        {tab !== 'invites' && membersPage && membersPage.totalPages > 1 && (
          <div className="flex items-center justify-between pt-1">
            <p className="text-xs" style={{ color: colors.text.dim }}>
              Page {membersPage.page + 1} of {membersPage.totalPages} · {membersPage.totalElements} member{membersPage.totalElements !== 1 ? 's' : ''}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0 || membersFetching}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
                style={{ border: border.card, color: colors.text.primary }}
              >
                <ChevronLeft size={14} /> Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(membersPage.totalPages - 1, p + 1))}
                disabled={page + 1 >= membersPage.totalPages || membersFetching}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
                style={{ border: border.card, color: colors.text.primary }}
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Summary strip */}
        {tab !== 'invites' && shownMembers.length > 0 && (
          <p className="text-xs text-center" style={{ color: colors.text.dim }}>
            {shownMembers.length} of {membersPage?.totalElements ?? 0} member{shownMembers.length !== 1 ? 's' : ''}
            {shownMembers.filter(m => m.role === 'THERAPIST').length > 0 && ` · ${shownMembers.filter(m => m.role === 'THERAPIST').length} therapist${shownMembers.filter(m => m.role === 'THERAPIST').length !== 1 ? 's' : ''}`}
          </p>
        )}
      </div>

      {/* ── Invite modal ───────────────────────────────────────────────────── */}
      <Modal
        open={showInviteModal}
        onClose={() => { setShowInviteModal(false); setReinviteTarget(null); reset() }}
        title={reinviteTarget ? `Re-invite ${reinviteTarget.firstName} ${reinviteTarget.lastName}` : 'Invite Member'}
        error={inviteError}
      >
        <div className="space-y-4">
          {reinviteTarget && (
            <p className="text-sm" style={{ color: colors.text.muted }}>
              This restores their access once accepted. Pick whichever role they should have now —
              it doesn't need to match their previous one.
            </p>
          )}
          <Input label="Email address" type="email" placeholder="colleague@clinic.com"
            error={errors.email?.message}
            disabled={!!reinviteTarget}
            {...register('email', { required: 'Email is required' })} />
          <Select label="Role" placeholder="Select a role…" options={invitableRoles}
            error={errors.role?.message}
            {...register('role', { required: 'Role is required' })} />
          {needsClinic && clinicOptions.length > 0 && (
            <Select label="Clinic" placeholder="Select a clinic…" options={clinicOptions}
              {...register('clinicId')} />
          )}
          <div className="flex gap-3 pt-1">
            <Button onClick={handleSubmit(d => { setInviteError(null); inviteMut.mutate(d) })} loading={isSubmitting || inviteMut.isPending}>
              <Send size={14} /> Send Invite
            </Button>
            <Button variant="secondary" onClick={() => { setShowInviteModal(false); setReinviteTarget(null); reset() }}>Cancel</Button>
          </div>
        </div>
      </Modal>

      {/* ── Link modal ─────────────────────────────────────────────────────── */}
      <Modal open={!!linkModal} onClose={() => setLinkModal(null)}
        title={`Sign-up link for ${linkModal?.email ?? ''}`}>
        {linkModal && (
          <div className="space-y-4">
            <p className="text-sm" style={{ color: colors.text.muted }}>
              Share this link with <strong>{linkModal.email}</strong> so they can set up their account.
              Expires <strong>{format(new Date(linkModal.expiresAt), "MMM d, yyyy 'at' h:mm a")}</strong>.
            </p>
            <CopyLinkBox link={linkModal.acceptLink ?? ''} />
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setLinkModal(null)}>Done</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Cancel invitation confirmation */}
      <Modal open={!!cancelTarget} onClose={() => setCancelTarget(null)} title="Cancel Invitation">
        {cancelTarget && (
          <div className="space-y-4">
            <p className="text-sm" style={{ color: colors.text.primary }}>
              Cancel the invitation sent to <strong>{cancelTarget.email}</strong>? The link in their
              inbox stops working immediately. You can invite them again later.
            </p>
            <div className="flex gap-3">
              <Button
                variant="danger"
                loading={cancelMut.isPending}
                onClick={() => {
                  cancelMut.mutate(cancelTarget.id)
                  setCancelTarget(null)
                }}
              >
                <XCircle size={14} /> Cancel invitation
              </Button>
              <Button variant="secondary" onClick={() => setCancelTarget(null)}>Keep it</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete member confirmation */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Member" error={deleteError}>
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-sm" style={{ color: colors.text.primary }}>
              Are you sure you want to deactivate <strong>{deleteTarget.firstName} {deleteTarget.lastName}</strong>?
              They will no longer be able to log in. Their historical records (sessions, appointments, leaves) are preserved.
            </p>
            <div className="flex gap-3">
              <Button variant="danger" onClick={() => { setDeleteError(null); deleteMemberMut.mutate(deleteTarget.id) }} loading={deleteMemberMut.isPending}>
                <Trash2 size={14} /> Deactivate member
              </Button>
              <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
