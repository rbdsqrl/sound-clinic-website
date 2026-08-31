import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ChevronRight, Pencil, Plus, X, Mail, Phone, Download } from 'lucide-react'
import { usersApi } from '../../api/users'
import { clinicsApi } from '../../api/clinics'
import { languagesApi } from '../../api/activityLookups'
import { patientsApi } from '../../api/patients'
import { analyticsApi } from '../../api/analytics'
import { useAuth } from '../../contexts/AuthContext'
import { calcAge } from '../../lib/age'
import { ROUTES } from '../../lib/routes'
import { Card } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { PageLoader } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { useToast } from '../../hooks/useToast'
import { ToastContainer } from '../../components/ui/Toast'
import { getApiError } from '../../lib/apiError'
import { roleBadge, statusBadge } from '../../components/ui/Badge'
import { MultiSelectChips } from '../../components/ui/MultiSelectChips'
import { Tile, Panel } from '../analytics/components'
import { INVITABLE_ROLES } from './MembersPage'
import { exportRowsAsCsv } from '../../lib/exportCsv'
import { colors, border, surface, accentAlpha, paletteStyle } from '../../theme'
import type { Role } from '../../types'

const iso = (d: Date) => d.toISOString().slice(0, 10)

function defaultRange() {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 29)
  return { from: iso(from), to: iso(to) }
}

export default function MemberProfilePage() {
  const { id } = useParams<{ id: string }>()
  const { user, activeRole } = useAuth()
  const canEdit = activeRole === 'BUSINESS_OWNER' || activeRole === 'CLINIC_HEAD'
  // Role changes are Business-Owner-only, and never on one's own account.
  const canChangeRole = activeRole === 'BUSINESS_OWNER' && user?.id !== id
  const qc = useQueryClient()
  const { toasts, toast, dismiss } = useToast()

  const [range, setRange] = useState(defaultRange)
  const [editOpen, setEditOpen] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)

  const { data: profile, isLoading } = useQuery({
    queryKey: ['member-profile', id],
    queryFn: () => usersApi.getProfile(id!),
    enabled: !!id,
  })

  // Caseload — every active patient assigned to this member, and the complement for the Assign picker.
  const { data: patients = [] } = useQuery({
    queryKey: ['patients'],
    queryFn: () => patientsApi.list(),
  })
  const cases = patients.filter(p => p.therapists.some(t => t.id === id))
  const unassigned = patients.filter(p => !p.therapists.some(t => t.id === id))

  // Insights — assembled from three existing analytics endpoints rather than a new one.
  const { data: members = [] } = useQuery({
    queryKey: ['analytics', 'members', range.from, range.to],
    queryFn: () => analyticsApi.members(range.from, range.to),
  })
  const memberStats = members.find(m => m.therapistId === id)

  const { data: caseload } = useQuery({
    queryKey: ['analytics', 'member-profile-caseload', id, range.from, range.to],
    queryFn: () => analyticsApi.therapistCaseload(id!, { granularity: 'MONTHLY', from: range.from, to: range.to }),
    enabled: !!id,
  })

  const { data: scheduleData } = useQuery({
    queryKey: ['analytics', 'member-profile-duration', id, range.from, range.to],
    queryFn: () => analyticsApi.schedule(range.from, range.to, { therapistId: id }),
    enabled: !!id,
  })
  const completedSessions = (scheduleData?.sessions ?? []).filter(s => s.status === 'COMPLETED')
  const totalDurationMinutes = completedSessions.reduce((sum, s) => sum + s.durationMinutes, 0)
  const avgSessionDurationMinutes = completedSessions.length
    ? Math.round(totalDurationMinutes / completedSessions.length) : null
  const weeksInRange = Math.max(1, Math.round(
    (new Date(range.to).getTime() - new Date(range.from).getTime()) / (7 * 24 * 60 * 60 * 1000)))
  const weeklyAvgMinutes = Math.round(totalDurationMinutes / weeksInRange)

  // Assign / unassign — the existing patient-side endpoint is symmetric, so no new backend was needed.
  const assignMut = useMutation({
    mutationFn: (patientId: string) => patientsApi.assignTherapist(patientId, { therapistId: id! }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patients'] })
      qc.invalidateQueries({ queryKey: ['member-profile', id] })
      toast('Case assigned', 'success')
      setAssignOpen(false)
    },
    onError: (err: unknown) => toast(getApiError(err, 'Could not assign case'), 'error'),
  })
  const unassignMut = useMutation({
    mutationFn: (patientId: string) => patientsApi.unassignTherapist(patientId, id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patients'] })
      qc.invalidateQueries({ queryKey: ['member-profile', id] })
      toast('Case unassigned', 'success')
    },
    onError: (err: unknown) => toast(getApiError(err, 'Could not unassign case'), 'error'),
  })

  if (isLoading || !profile) return <PageLoader />

  const specializationTags = (profile.specialization ?? '').split(',').map(s => s.trim()).filter(Boolean)

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex items-center gap-1.5 text-sm" style={{ color: colors.text.dim }}>
        <Link to={ROUTES.members} className="hover:underline flex-shrink-0">Members</Link>
        <ChevronRight size={14} />
        <span>{profile.firstName} {profile.lastName}</span>
      </div>

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-14 w-14 rounded-full font-bold text-lg flex items-center justify-center flex-shrink-0"
              style={{ background: accentAlpha(0.10), color: colors.accent }}>
              {profile.firstName[0]}{profile.lastName[0]}
            </div>
            <div className="min-w-0">
              <p className="text-base sm:text-lg font-semibold truncate" style={{ color: colors.text.heading }}>
                {profile.firstName} {profile.lastName}
              </p>
              <p className="text-sm truncate" style={{ color: colors.text.muted }}>{profile.email}</p>
              <p className="text-xs mt-0.5" style={{ color: colors.text.dim }}>
                Joined {format(new Date(profile.createdAt), 'MMM d, yyyy')}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 sm:flex-col sm:items-end sm:flex-shrink-0">
            <div className="flex items-center gap-2 flex-wrap">
              {roleBadge(profile.role)}
              {statusBadge(profile.isActive ? 'ACTIVE' : 'INACTIVE')}
            </div>
            {canEdit && (
              <button
                onClick={() => setEditOpen(true)}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
                style={{ color: colors.text.muted, border: `1px solid ${border.divider}` }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = colors.accent; (e.currentTarget as HTMLElement).style.borderColor = colors.accent }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = colors.text.muted; (e.currentTarget as HTMLElement).style.borderColor = border.divider }}
              >
                <Pencil size={13} /> Edit
              </button>
            )}
          </div>
        </div>
        {profile.clinicName && (
          <p className="text-xs mt-3" style={{ color: colors.text.dim }}>{profile.clinicName}</p>
        )}

        {specializationTags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {specializationTags.map(tag => (
              <span key={tag} className="text-[12.65px] px-2.5 py-1 rounded-full"
                style={paletteStyle('purple', 0.08, 0.15)}>
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl p-3" style={{ background: surface.rowHover }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: colors.text.dim }}>Contact</p>
            <p className="text-sm flex items-center gap-1.5" style={{ color: colors.text.primary }}><Mail size={12} />{profile.email}</p>
            {profile.phone && (
              <p className="text-sm flex items-center gap-1.5 mt-1" style={{ color: colors.text.primary }}><Phone size={12} />{profile.phone}</p>
            )}
          </div>
          <div className="rounded-xl p-3" style={{ background: surface.rowHover }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: colors.text.dim }}>Qualification</p>
            <p className="text-sm" style={{ color: colors.text.primary }}>
              {profile.qualification || <span style={{ color: colors.text.dim }}>—</span>}
            </p>
          </div>
          <div className="rounded-xl p-3" style={{ background: surface.rowHover }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: colors.text.dim }}>Languages</p>
            {profile.languages.length === 0 ? (
              <p className="text-sm" style={{ color: colors.text.dim }}>—</p>
            ) : (
              <ul className="text-sm" style={{ color: colors.text.primary }}>
                {profile.languages.map(l => <li key={l.id}>{l.name}</li>)}
              </ul>
            )}
          </div>
        </div>
      </Card>

      <Panel
        title="Insights"
        subtitle="Sessions, activities and duration for the selected window"
        action={
          <div className="flex items-end gap-2">
            <div>
              <label className="form-label" htmlFor="member-from">From</label>
              <input id="member-from" type="date" className="form-input" value={range.from}
                onChange={e => setRange(r => ({ ...r, from: e.target.value }))} />
            </div>
            <div>
              <label className="form-label" htmlFor="member-to">To</label>
              <input id="member-to" type="date" className="form-input" value={range.to}
                onChange={e => setRange(r => ({ ...r, to: e.target.value }))} />
            </div>
            <button
              type="button"
              disabled={!scheduleData?.sessions.length}
              onClick={() => exportRowsAsCsv(
                `${profile.firstName}-${profile.lastName}-sessions_${range.from}_to_${range.to}.csv`,
                scheduleData?.sessions ?? [],
                [
                  { header: 'Date', value: s => s.sessionDate },
                  { header: 'Time', value: s => s.startTime.slice(0, 5) },
                  { header: 'Duration (min)', value: s => s.durationMinutes },
                  { header: 'Program', value: s => s.programName },
                  { header: 'Case', value: s => s.patientName },
                  { header: 'Status', value: s => s.status },
                ],
              )}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-40"
              style={{ background: surface.rowHover, color: colors.text.primary }}
            >
              <Download size={14} /> Export
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Tile label="Sessions"
            value={<>{caseload?.series.totals.sessionsCompleted ?? 0}<span style={{ color: colors.text.dim, fontSize: '1.1rem' }}>/{caseload?.series.totals.sessionsScheduled ?? 0}</span></>} />
          <Tile label="Activities" value={memberStats?.activitiesAssigned ?? 0}
            hint={`${memberStats?.activitiesCreated ?? 0} created`} />
          <Tile label="IEP Goals" value={memberStats?.iepPlans ?? 0} />
          <Tile label="Notes" value={caseload?.series.totals.sessionsLogged ?? 0} />
        </div>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
          <Tile label="Daily Avg. Duration" value={avgSessionDurationMinutes !== null ? `${avgSessionDurationMinutes}m` : '—'} />
          <Tile label="Weekly Avg. Duration" value={completedSessions.length ? `${weeklyAvgMinutes}m` : '—'} />
          <Tile label="Total Duration" value={completedSessions.length ? `${Math.round(totalDurationMinutes / 60)}h` : '—'} />
        </div>
      </Panel>

      <Panel
        title={`Cases (${cases.length})`}
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={cases.length === 0}
              onClick={() => exportRowsAsCsv(
                `${profile.firstName}-${profile.lastName}-cases.csv`,
                cases,
                [
                  { header: 'Name', value: p => `${p.firstName} ${p.lastName}` },
                  { header: 'Age', value: p => p.dateOfBirth ? calcAge(p.dateOfBirth) : '' },
                  { header: 'Conditions', value: p => p.conditions.map(c => c.name).join('; ') },
                ],
              )}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-40"
              style={{ background: surface.rowHover, color: colors.text.primary }}
            >
              <Download size={14} /> Export
            </button>
            {canEdit && (
              <Button size="sm" onClick={() => setAssignOpen(true)}><Plus size={14} /> Assign</Button>
            )}
          </div>
        }
      >
        {cases.length === 0 ? (
          <EmptyState icon={<Mail size={22} />} title="No cases yet" description="Assign a case to this member to see them here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: colors.text.dim }}>
                  <th className="pb-2 pr-4 text-left text-xs font-semibold uppercase tracking-wider">Name</th>
                  <th className="pb-2 pr-4 text-left text-xs font-semibold uppercase tracking-wider">Age</th>
                  <th className="pb-2 pr-4 text-left text-xs font-semibold uppercase tracking-wider">Conditions</th>
                  {canEdit && <th className="pb-2 text-right text-xs font-semibold uppercase tracking-wider"></th>}
                </tr>
              </thead>
              <tbody>
                {cases.map(p => (
                  <tr key={p.id} style={{ borderTop: `1px solid ${border.divider}` }}>
                    <td className="py-2.5 pr-4">
                      <Link to={ROUTES.patient(p.id)} className="font-medium hover:underline" style={{ color: colors.text.primary }}>
                        {p.firstName} {p.lastName}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-4" style={{ color: colors.text.muted }}>
                      {p.dateOfBirth ? calcAge(p.dateOfBirth) : '—'}
                    </td>
                    <td className="py-2.5 pr-4">
                      {p.conditions.length === 0 ? (
                        <span style={{ color: colors.text.dim }}>—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {p.conditions.slice(0, 2).map(c => (
                            <span key={c.id} className="text-[12.65px] px-2 py-0.5 rounded-full" style={paletteStyle('purple', 0.08, 0.15)}>
                              {c.name}
                            </span>
                          ))}
                          {p.conditions.length > 2 && (
                            <span className="text-[12.65px]" style={{ color: colors.text.dim }}>+{p.conditions.length - 2}</span>
                          )}
                        </div>
                      )}
                    </td>
                    {canEdit && (
                      <td className="py-2.5 text-right">
                        <button
                          onClick={() => unassignMut.mutate(p.id)}
                          disabled={unassignMut.isPending}
                          className="p-1.5 rounded-lg transition-colors disabled:opacity-50"
                          style={{ color: colors.text.dim }}
                          title="Unassign"
                        >
                          <X size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Assign a case */}
      <AssignCaseModal
        open={assignOpen}
        patients={unassigned}
        pending={assignMut.isPending}
        onClose={() => setAssignOpen(false)}
        onAssign={patientId => assignMut.mutate(patientId)}
      />

      {/* Edit profile */}
      {editOpen && (
        <EditProfileModal
          memberId={id!}
          profile={profile}
          canChangeRole={canChangeRole}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['member-profile', id] })
            toast('Profile updated', 'success')
            setEditOpen(false)
          }}
        />
      )}

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}

// ── Assign a case ────────────────────────────────────────────────────────────

function AssignCaseModal({
  open, patients, pending, onClose, onAssign,
}: {
  open: boolean
  patients: { id: string; firstName: string; lastName: string }[]
  pending: boolean
  onClose: () => void
  onAssign: (patientId: string) => void
}) {
  const [patientId, setPatientId] = useState('')

  return (
    <Modal open={open} onClose={onClose} title="Assign a case">
      <div className="flex flex-col gap-4">
        <Select
          label="Case"
          placeholder="Choose a case"
          value={patientId}
          onChange={e => setPatientId(e.target.value)}
          options={patients.map(p => ({ value: p.id, label: `${p.firstName} ${p.lastName}` }))}
        />
        {patients.length === 0 && (
          <p className="text-sm" style={{ color: colors.text.dim }}>Every case is already assigned to this member.</p>
        )}
      </div>
      <div className="flex gap-2 justify-end mt-6 pt-4" style={{ borderTop: `1px solid ${border.divider}` }}>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={!patientId} loading={pending} onClick={() => onAssign(patientId)}>
          Assign
        </Button>
      </div>
    </Modal>
  )
}

// ── Edit profile ──────────────────────────────────────────────────────────────

function EditProfileModal({
  memberId, profile, canChangeRole, onClose, onSaved,
}: {
  memberId: string
  profile: { role: Role; phone: string | null; clinicId: string | null; qualification: string | null; specialization: string | null; languages: { id: string; name: string }[] }
  /** Only a Business Owner may change a member's role, and never their own. */
  canChangeRole: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [phone, setPhone] = useState(profile.phone ?? '')
  const [clinicId, setClinicId] = useState(profile.clinicId ?? '')
  const [qualification, setQualification] = useState(profile.qualification ?? '')
  const [specialization, setSpecialization] = useState(profile.specialization ?? '')
  const [languageIds, setLanguageIds] = useState<string[]>(profile.languages.map(l => l.id))
  const [role, setRole] = useState<Role>(profile.role)
  const [error, setError] = useState('')

  const { data: clinics = [] } = useQuery({ queryKey: ['clinics'], queryFn: () => clinicsApi.list() })
  const { data: languages = [] } = useQuery({ queryKey: ['languages'], queryFn: () => languagesApi.list() })

  const mut = useMutation({
    mutationFn: () => usersApi.updateProfile(memberId, {
      phone: phone.trim() || undefined,
      clinicId: clinicId || undefined,
      qualification: qualification.trim() || undefined,
      specialization: specialization.trim() || undefined,
      languageIds,
      role: canChangeRole && role !== profile.role ? role : undefined,
    }),
    onSuccess: onSaved,
    onError: (err: unknown) => setError(getApiError(err, 'Could not save profile')),
  })

  return (
    <Modal open title="Edit Profile" onClose={onClose}>
      <div className="flex flex-col gap-4">
        {canChangeRole && (
          <Select
            label="Role"
            value={role}
            onChange={e => setRole(e.target.value as Role)}
            options={INVITABLE_ROLES}
          />
        )}
        <Input label="Phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone number" />
        <Select
          label="Clinic"
          placeholder="No clinic"
          value={clinicId}
          onChange={e => setClinicId(e.target.value)}
          options={clinics.map(c => ({ value: c.id, label: c.name }))}
        />
        <Input label="Qualification" value={qualification} onChange={e => setQualification(e.target.value)}
          placeholder="e.g. Diploma in Hearing, Language and Speech" />
        <Input label="Specialization" value={specialization} onChange={e => setSpecialization(e.target.value)}
          placeholder="Comma-separated, e.g. Speech Language Pathologist, ABA Therapist" />
        <MultiSelectChips
          label="Languages"
          options={languages.map(l => ({ value: l.id, label: l.name }))}
          selected={languageIds}
          onChange={setLanguageIds}
          emptyMessage="No languages configured yet."
        />
        {error && <p className="form-error">{error}</p>}
      </div>
      <div className="flex gap-2 justify-end mt-6 pt-4" style={{ borderTop: `1px solid ${border.divider}` }}>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" loading={mut.isPending} onClick={() => { setError(''); mut.mutate() }}>
          Save
        </Button>
      </div>
    </Modal>
  )
}
