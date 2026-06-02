import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Search, LayoutGrid, List, UserPlus, Briefcase,
  Mail, Phone, Users,
} from 'lucide-react'
import { usersApi } from '../../api/users'
import { invitationsApi } from '../../api/invitations'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageLoader } from '../../components/ui/Spinner'
import { useToast } from '../../hooks/useToast'
import { ToastContainer } from '../../components/ui/Toast'
import {
  colors, styles, surface, border, shadow,
  accentAlpha, successAlpha, dangerAlpha,
} from '../../theme'
import type { StaffMemberResponse, Role, InviteResponse } from '../../types'

// ── Avatar palette ────────────────────────────────────────────────────────────
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

function avatarColor(idx: number) {
  return AVATAR_COLORS[idx % AVATAR_COLORS.length]
}

const ROLE_LABELS: Partial<Record<Role, string>> = {
  BUSINESS_OWNER: 'Business Owner',
  ADMIN:          'Admin',
  OFFICE_ADMIN:   'Office Admin',
  THERAPIST:      'Therapist',
  DOCTOR:         'Doctor',
}

const STAFF_ROLES: { value: string; label: string }[] = [
  { value: 'ADMIN',        label: 'Admin' },
  { value: 'OFFICE_ADMIN', label: 'Office Admin' },
  { value: 'THERAPIST',    label: 'Therapist' },
  { value: 'DOCTOR',       label: 'Doctor' },
]

type Tab = 'members' | 'invites' | 'archived'
type ViewMode = 'grid' | 'list'

// ── Member card ───────────────────────────────────────────────────────────────

function MemberCard({ member, idx }: { member: StaffMemberResponse; idx: number }) {
  const { bg, text } = avatarColor(idx)
  const initials = `${member.firstName[0] ?? ''}${member.lastName[0] ?? ''}`.toUpperCase()
  const isClinical = member.role === 'THERAPIST' || member.role === 'DOCTOR'

  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-3 transition-shadow hover:shadow-lg"
      style={{ background: surface.card, border: border.card, boxShadow: shadow.card }}
    >
      {/* Header */}
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
            className="inline-block text-[11px] font-medium px-2 py-0.5 rounded-full mt-0.5"
            style={{ background: accentAlpha(0.1), color: colors.accent }}
          >
            {ROLE_LABELS[member.role] ?? member.role}
          </span>
        </div>
        {!member.isActive && (
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
            style={{ background: dangerAlpha(0.1), color: colors.status.error }}
          >
            Inactive
          </span>
        )}
      </div>

      {/* Contact */}
      <div className="space-y-1">
        {member.email && (
          <div className="flex items-center gap-1.5 text-xs truncate" style={{ color: colors.text.muted }}>
            <Mail size={11} className="flex-shrink-0" />
            <span className="truncate">{member.email}</span>
          </div>
        )}
        {member.phone && (
          <div className="flex items-center gap-1.5 text-xs" style={{ color: colors.text.muted }}>
            <Phone size={11} className="flex-shrink-0" />
            <span>{member.phone}</span>
          </div>
        )}
      </div>

      {/* Case count — only for clinical staff */}
      {isClinical && (
        <div
          className="flex items-center gap-2 rounded-xl px-3 py-2"
          style={{ background: accentAlpha(0.06) }}
        >
          <Briefcase size={13} style={{ color: colors.accent }} />
          <span className="text-xs font-medium" style={{ color: colors.text.primary }}>
            {member.caseCount} active {member.caseCount === 1 ? 'case' : 'cases'}
          </span>
        </div>
      )}
    </div>
  )
}

// ── Member row (list view) ────────────────────────────────────────────────────

function MemberRow({ member, idx }: { member: StaffMemberResponse; idx: number }) {
  const { bg, text } = avatarColor(idx)
  const initials = `${member.firstName[0] ?? ''}${member.lastName[0] ?? ''}`.toUpperCase()
  const isClinical = member.role === 'THERAPIST' || member.role === 'DOCTOR'

  return (
    <tr className="border-b transition-colors" style={{ borderColor: border.card }}>
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
        <span
          className="inline-block text-[11px] font-medium px-2 py-0.5 rounded-full"
          style={{ background: accentAlpha(0.1), color: colors.accent }}
        >
          {ROLE_LABELS[member.role] ?? member.role}
        </span>
      </td>
      <td className="px-4 py-3 hidden md:table-cell text-sm" style={{ color: colors.text.muted }}>
        {member.phone ?? '—'}
      </td>
      <td className="px-4 py-3 hidden lg:table-cell text-sm text-center" style={{ color: colors.text.primary }}>
        {isClinical ? member.caseCount : '—'}
      </td>
      <td className="px-4 py-3">
        <span
          className="inline-block text-[11px] font-medium px-2 py-0.5 rounded-full"
          style={member.isActive
            ? { background: successAlpha(0.1), color: colors.status.success }
            : { background: dangerAlpha(0.1),  color: colors.status.error }}
        >
          {member.isActive ? 'Active' : 'Inactive'}
        </span>
      </td>
    </tr>
  )
}

// ── Invite row ────────────────────────────────────────────────────────────────

function InviteRow({ invite }: { invite: InviteResponse }) {
  const statusColor =
    invite.status === 'ACCEPTED'  ? { bg: successAlpha(0.1), text: colors.status.success } :
    invite.status === 'EXPIRED'   ? { bg: dangerAlpha(0.1),  text: colors.status.error }   :
    invite.status === 'CANCELLED' ? { bg: dangerAlpha(0.1),  text: colors.status.error }   :
                                    { bg: accentAlpha(0.1),   text: colors.accent }

  return (
    <tr className="border-b" style={{ borderColor: border.card }}>
      <td className="px-4 py-3 text-sm font-medium" style={{ color: colors.text.primary }}>
        {invite.email}
      </td>
      <td className="px-4 py-3 hidden sm:table-cell">
        <span
          className="text-[11px] font-medium px-2 py-0.5 rounded-full"
          style={{ background: accentAlpha(0.1), color: colors.accent }}
        >
          {ROLE_LABELS[invite.role as Role] ?? invite.role}
        </span>
      </td>
      <td className="px-4 py-3">
        <span
          className="text-[11px] font-medium px-2 py-0.5 rounded-full"
          style={{ background: statusColor.bg, color: statusColor.text }}
        >
          {invite.status}
        </span>
      </td>
      <td className="px-4 py-3 text-xs hidden md:table-cell" style={{ color: colors.text.muted }}>
        {new Date(invite.createdAt).toLocaleDateString()}
      </td>
    </tr>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MembersPage() {
  const qc = useQueryClient()
  const { toasts, toast, dismiss } = useToast()

  const [tab, setTab]         = useState<Tab>('members')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [search, setSearch]   = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('')
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole]   = useState<string>('THERAPIST')

  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ['members'],
    queryFn: () => usersApi.listMembers(),
  })

  const { data: invites = [], isLoading: invitesLoading } = useQuery({
    queryKey: ['invitations'],
    queryFn: () => invitationsApi.list(),
    enabled: tab === 'invites',
  })

  const inviteMut = useMutation({
    mutationFn: () => invitationsApi.send({ email: inviteEmail.trim(), role: inviteRole as Role }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invitations'] })
      toast('Invitation sent', 'success')
      setShowInviteModal(false)
      setInviteEmail('')
      setInviteRole('THERAPIST')
    },
    onError: (err: any) => toast(err?.response?.data?.message ?? 'Failed to send invite', 'error'),
  })

  // ── Filtering ──────────────────────────────────────────────────────────────

  const activeMembers = members.filter(m => m.isActive)
  const archivedMembers = members.filter(m => !m.isActive)

  function filterMembers(list: StaffMemberResponse[]) {
    return list.filter(m => {
      const q = search.toLowerCase()
      const matchesSearch = !q ||
        m.firstName.toLowerCase().includes(q) ||
        m.lastName.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q)
      const matchesRole = !roleFilter || m.role === roleFilter
      return matchesSearch && matchesRole
    })
  }

  const shownMembers   = filterMembers(tab === 'archived' ? archivedMembers : activeMembers)
  const shownInvites   = invites.filter(i => {
    const q = search.toLowerCase()
    return !q || i.email.toLowerCase().includes(q)
  })

  const isLoading = tab === 'invites' ? invitesLoading : membersLoading

  // ── Render ─────────────────────────────────────────────────────────────────

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: 'members',  label: 'Members',  count: activeMembers.length },
    { key: 'invites',  label: 'Invites',  count: invites.filter(i => i.status === 'PENDING').length },
    { key: 'archived', label: 'Archived', count: archivedMembers.length },
  ]

  return (
    <>
      <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-5">

        {/* Page header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg md:text-xl font-bold" style={{ color: colors.text.heading }}>
              Members
            </h1>
            <p className="text-sm mt-0.5" style={{ color: colors.text.muted }}>
              {activeMembers.length} active staff member{activeMembers.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Button onClick={() => setShowInviteModal(true)}>
            <UserPlus size={15} /> Invite Member
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="flex-shrink-0 whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5"
              style={tab === t.key
                ? { background: colors.accent, color: '#fff' }
                : { background: accentAlpha(0.07), color: colors.text.muted }}
            >
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full min-w-[18px] text-center"
                  style={tab === t.key
                    ? { background: 'rgba(255,255,255,0.25)', color: '#fff' }
                    : { background: accentAlpha(0.12), color: colors.accent }}
                >
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Controls row */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* Search */}
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: colors.text.muted }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={tab === 'invites' ? 'Search by email…' : 'Search members…'}
              className="form-input pl-8 w-full"
            />
          </div>

          {/* Role filter (members & archived only) */}
          {tab !== 'invites' && (
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              className="form-input min-w-[140px]"
            >
              <option value="">All Roles</option>
              {STAFF_ROLES.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          )}

          {/* View toggle (members & archived only) */}
          {tab !== 'invites' && (
            <div
              className="flex rounded-xl overflow-hidden flex-shrink-0"
              style={{ border: border.card }}
            >
              <button
                onClick={() => setViewMode('grid')}
                className="px-3 py-2 transition-colors"
                style={viewMode === 'grid'
                  ? { background: colors.accent, color: '#fff' }
                  : { background: 'transparent', color: colors.text.muted }}
              >
                <LayoutGrid size={15} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className="px-3 py-2 transition-colors"
                style={viewMode === 'list'
                  ? { background: colors.accent, color: '#fff' }
                  : { background: 'transparent', color: colors.text.muted }}
              >
                <List size={15} />
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        {isLoading ? (
          <PageLoader />
        ) : tab === 'invites' ? (
          shownInvites.length === 0 ? (
            <EmptyState icon={<Mail size={40} />} title="No invitations sent yet" />
          ) : (
            <div className="overflow-x-auto rounded-2xl" style={styles.card}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: border.card }}>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: colors.text.muted }}>Email</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide hidden sm:table-cell" style={{ color: colors.text.muted }}>Role</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: colors.text.muted }}>Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide hidden md:table-cell" style={{ color: colors.text.muted }}>Invited</th>
                  </tr>
                </thead>
                <tbody>
                  {shownInvites.map(invite => (
                    <InviteRow key={invite.id} invite={invite} />
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : shownMembers.length === 0 ? (
          <EmptyState icon={<Users size={40} />} title={search ? 'No members match your search' : 'No members found'} />
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {shownMembers.map((m, i) => (
              <MemberCard key={m.id} member={m} idx={i} />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl" style={styles.card}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: border.card }}>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: colors.text.muted }}>Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide hidden sm:table-cell" style={{ color: colors.text.muted }}>Role</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide hidden md:table-cell" style={{ color: colors.text.muted }}>Phone</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide hidden lg:table-cell" style={{ color: colors.text.muted }}>Cases</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: colors.text.muted }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {shownMembers.map((m, i) => (
                  <MemberRow key={m.id} member={m} idx={i} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invite modal */}
      <Modal open={showInviteModal} onClose={() => setShowInviteModal(false)} title="Invite Member">
        <div className="space-y-4">
          <Input
            label="Email address"
            type="email"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            placeholder="staff@example.com"
          />
          <Select
            label="Role"
            value={inviteRole}
            onChange={e => setInviteRole(e.target.value)}
            options={STAFF_ROLES}
          />
          <div className="flex gap-3 pt-1">
            <Button
              onClick={() => inviteMut.mutate()}
              loading={inviteMut.isPending}
              disabled={!inviteEmail.trim()}
            >
              <Mail size={14} /> Send Invite
            </Button>
            <Button variant="secondary" onClick={() => setShowInviteModal(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </>
  )
}
