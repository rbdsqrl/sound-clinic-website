import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import {
  Search, LayoutGrid, List, UserPlus, Briefcase,
  Mail, Phone, Users, Building2, Check, Copy,
  Link2, CalendarDays, Send, Trash2, XCircle,
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
import { statusBadge, roleBadge } from '../../components/ui/Badge'
import { useToast } from '../../hooks/useToast'
import { getApiError } from '../../lib/apiError'
import { ToastContainer } from '../../components/ui/Toast'
import {
  colors, styles, surface, border, shadow,
  accentAlpha, successAlpha, dangerAlpha,
} from '../../theme'
import type { StaffMemberResponse, Role, InviteResponse, InviteRequest } from '../../types'

// ── Constants ─────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  { bg: '#6366f1', text: '#fff' },
  { bg: '#0ea5e9', text: '#fff' },
  { bg: '#10b981', text: '#fff' },
  { bg: '#f59e0b', text: '#fff' },
  { bg: '#ec4899', text: '#fff' },
  { bg: '#8b5cf6', text: '#fff' },
  { bg: '#14b8a6', text: '#fff' },
  { bg: '#f97316', text: '#fff' },
]

function avatarColor(idx: number) { return AVATAR_COLORS[idx % AVATAR_COLORS.length] }

const ROLE_LABELS: Partial<Record<Role, string>> = {
  BUSINESS_OWNER: 'Business Owner',
  CLINIC_HEAD:    'Clinic Head',
  THERAPIST:      'Therapist',
  DOCTOR:         'Doctor',
}

const STAFF_ROLES: { value: string; label: string }[] = [
  { value: 'CLINIC_HEAD', label: 'Clinic Head' },
  { value: 'THERAPIST',   label: 'Therapist' },
  { value: 'DOCTOR',      label: 'Doctor' },
]

// Parents (and patients) are invited from the patient's own page, not here.
const INVITABLE_ROLES: { value: Role; label: string }[] = [
  { value: 'CLINIC_HEAD',    label: 'Clinic Head' },
  { value: 'DOCTOR',         label: 'Doctor' },
  { value: 'THERAPIST',      label: 'Therapist' },
  { value: 'BUSINESS_OWNER', label: 'Business Owner' },
]

type Tab = 'members' | 'invites' | 'archived'
type ViewMode = 'grid' | 'list'
type InviteStatusFilter = 'ALL' | 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED'

/** An invitation nobody took up — still resendable, still withdrawable. */
function canWithdraw(status: InviteResponse['status']): boolean {
  return status === 'PENDING' || status === 'EXPIRED'
}

// ── Copy link box ─────────────────────────────────────────────────────────────

function CopyLinkBox({ link }: { link: string }) {
  const [copied, setCopied] = useState(false)
  const fullUrl = `${window.location.origin}${link}`
  const copy = async () => {
    await navigator.clipboard.writeText(fullUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }
  return (
    <div className="rounded-xl p-4" style={{ border: border.card, background: accentAlpha(0.08) }}>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: colors.text.primary }}>
        Sign-up link — share this with the person
      </p>
      <div className="flex items-center gap-2">
        <code
          className="flex-1 rounded-lg px-3 py-2 text-xs font-mono break-all select-all"
          style={{ background: surface.filterStrip, color: colors.text.primary, border: border.card }}
        >
          {fullUrl}
        </code>
        <button
          type="button"
          onClick={copy}
          className="flex-shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium"
          style={{ background: colors.accent, color: '#fff' }}
        >
          {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
        </button>
      </div>
      <p className="mt-2 text-xs" style={{ color: colors.text.muted }}>
        Valid for 72 hours. The person sets their own name and password when they open it.
      </p>
    </div>
  )
}

// ── Member card ───────────────────────────────────────────────────────────────

function MemberCard({
  member, idx, clinicName, onDelete,
}: { member: StaffMemberResponse; idx: number; clinicName: string; onDelete?: () => void }) {
  const { bg, text } = avatarColor(idx)
  const initials = `${member.firstName[0] ?? ''}${member.lastName[0] ?? ''}`.toUpperCase()
  const isClinical = member.role === 'THERAPIST' || member.role === 'DOCTOR'

  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-3"
      style={{ background: surface.card, border: border.card, boxShadow: shadow.card }}
    >
      <div className="flex items-start gap-3">
        <div
          className="h-12 w-12 rounded-xl flex items-center justify-center text-base font-bold flex-shrink-0"
          style={{ background: bg, color: text }}
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold truncate" style={{ color: colors.text.primary }}>
            {member.firstName} {member.lastName}
          </p>
          <span
            className="inline-block text-[12.65px] font-medium px-2 py-0.5 rounded-full mt-0.5"
            style={{ background: accentAlpha(0.1), color: colors.accent }}
          >
            {ROLE_LABELS[member.role] ?? member.role}
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
          {onDelete && (
            <button
              onClick={onDelete}
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
  member, idx, clinicName, onDelete,
}: { member: StaffMemberResponse; idx: number; clinicName: string; onDelete?: () => void }) {
  const { bg, text } = avatarColor(idx)
  const initials = `${member.firstName[0] ?? ''}${member.lastName[0] ?? ''}`.toUpperCase()
  const isClinical = member.role === 'THERAPIST' || member.role === 'DOCTOR'

  return (
    <tr className="border-b" style={{ borderColor: border.divider }}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div
            className="h-9 w-9 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0"
            style={{ background: bg, color: text }}
          >
            {initials}
          </div>
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
          {ROLE_LABELS[member.role] ?? member.role}
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
          {onDelete && (
            <button
              onClick={onDelete}
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
  const qc = useQueryClient()
  const { toasts, toast, dismiss } = useToast()
  const { user, activeRole } = useAuth()
  const isOwner = (activeRole ?? user?.role) === 'BUSINESS_OWNER'

  const [tab, setTab]               = useState<Tab>('members')
  const [deleteTarget, setDeleteTarget] = useState<StaffMemberResponse | null>(null)
  const [viewMode, setViewMode]     = useState<ViewMode>('grid')
  const [search, setSearch]         = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [clinicFilter, setClinicFilter] = useState('')
  const [inviteStatusFilter, setInviteStatusFilter] = useState<InviteStatusFilter>('ALL')
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [linkModal, setLinkModal]   = useState<InviteResponse | null>(null)
  const [cancelTarget, setCancelTarget] = useState<InviteResponse | null>(null)

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ['members'],
    queryFn: () => usersApi.listMembers(),
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
  const { register, handleSubmit, watch, reset, formState: { errors, isSubmitting } } = useForm<InviteRequest>()
  const selectedRole = watch('role') as Role | undefined
  const needsClinic  = selectedRole === 'THERAPIST' || selectedRole === 'DOCTOR' || selectedRole === 'PARENT'

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const inviteMut = useMutation({
    mutationFn: invitationsApi.send,
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['invitations'] })
      reset()
      setShowInviteModal(false)
      setLinkModal(res)
      setTab('invites')
    },
    onError: (err) => toast(getApiError(err, 'Failed to send invite'), 'error'),
  })

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
    onError: (err) => toast(getApiError(err, 'Failed to delete member'), 'error'),
  })

  // ── Filtering ─────────────────────────────────────────────────────────────────
  const activeMembers   = members.filter(m => m.isActive)
  const archivedMembers = members.filter(m => !m.isActive)

  function filterMembers(list: StaffMemberResponse[]) {
    return list.filter(m => {
      const q = search.toLowerCase()
      const matchSearch = !q || `${m.firstName} ${m.lastName} ${m.email}`.toLowerCase().includes(q)
      const matchRole   = !roleFilter   || m.role === roleFilter
      const matchClinic = !clinicFilter || m.clinicId === clinicFilter
      return matchSearch && matchRole && matchClinic
    })
  }

  const shownMembers = filterMembers(tab === 'archived' ? archivedMembers : activeMembers)

  const filteredInvites = invites.filter(i => {
    const q = search.toLowerCase()
    const matchSearch = !q || i.email.toLowerCase().includes(q)
    const matchStatus = inviteStatusFilter === 'ALL' || i.status === inviteStatusFilter
    return matchSearch && matchStatus
  })

  const pendingCount = invites.filter(i => i.status === 'PENDING').length
  const isLoading    = tab === 'invites' ? invitesLoading : membersLoading

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: 'members',  label: 'Members',  count: activeMembers.length },
    { key: 'invites',  label: 'Invites',  count: pendingCount || undefined },
    { key: 'archived', label: 'Archived', count: archivedMembers.length || undefined },
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
      <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-5">

        {/* Page header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg md:text-xl font-bold" style={{ color: colors.text.heading }}>Members</h1>
            <p className="text-sm mt-0.5" style={{ color: colors.text.muted }}>
              {activeMembers.length} active · {pendingCount} pending invite{pendingCount !== 1 ? 's' : ''}
            </p>
          </div>
          <Button onClick={() => setShowInviteModal(true)}>
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
            {shownMembers.map((m, i) => (
              <MemberCard key={m.id} member={m} idx={i} clinicName={m.clinicId ? (clinicMap[m.clinicId] ?? '') : ''} onDelete={isOwner ? () => setDeleteTarget(m) : undefined} />
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
                {shownMembers.map((m, i) => (
                  <MemberRow key={m.id} member={m} idx={i} clinicName={m.clinicId ? (clinicMap[m.clinicId] ?? '') : ''} onDelete={isOwner ? () => setDeleteTarget(m) : undefined} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Summary strip */}
        {tab !== 'invites' && shownMembers.length > 0 && (
          <p className="text-xs text-center" style={{ color: colors.text.dim }}>
            {shownMembers.length} of {(tab === 'archived' ? archivedMembers : activeMembers).length} member{shownMembers.length !== 1 ? 's' : ''}
            {shownMembers.filter(m => m.role === 'THERAPIST').length > 0 && ` · ${shownMembers.filter(m => m.role === 'THERAPIST').length} therapist${shownMembers.filter(m => m.role === 'THERAPIST').length !== 1 ? 's' : ''}`}
            {shownMembers.filter(m => m.role === 'DOCTOR').length > 0    && ` · ${shownMembers.filter(m => m.role === 'DOCTOR').length} doctor${shownMembers.filter(m => m.role === 'DOCTOR').length !== 1 ? 's' : ''}`}
          </p>
        )}
      </div>

      {/* ── Invite modal ───────────────────────────────────────────────────── */}
      <Modal open={showInviteModal} onClose={() => { setShowInviteModal(false); reset() }} title="Invite Member">
        <div className="space-y-4">
          <Input label="Email address" type="email" placeholder="colleague@clinic.com"
            error={errors.email?.message}
            {...register('email', { required: 'Email is required' })} />
          <Select label="Role" placeholder="Select a role…" options={INVITABLE_ROLES}
            error={errors.role?.message}
            {...register('role', { required: 'Role is required' })} />
          {needsClinic && clinicOptions.length > 0 && (
            <Select label="Clinic" placeholder="Select a clinic…" options={clinicOptions}
              {...register('clinicId')} />
          )}
          <div className="flex gap-3 pt-1">
            <Button onClick={handleSubmit(d => inviteMut.mutate(d))} loading={isSubmitting || inviteMut.isPending}>
              <Send size={14} /> Send Invite
            </Button>
            <Button variant="secondary" onClick={() => { setShowInviteModal(false); reset() }}>Cancel</Button>
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
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Member">
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-sm" style={{ color: colors.text.primary }}>
              Are you sure you want to deactivate <strong>{deleteTarget.firstName} {deleteTarget.lastName}</strong>?
              They will no longer be able to log in. Their historical records (sessions, appointments, leaves) are preserved.
            </p>
            <div className="flex gap-3">
              <Button variant="danger" onClick={() => deleteMemberMut.mutate(deleteTarget.id)} loading={deleteMemberMut.isPending}>
                <Trash2 size={14} /> Deactivate member
              </Button>
              <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            </div>
          </div>
        )}
      </Modal>

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </>
  )
}
