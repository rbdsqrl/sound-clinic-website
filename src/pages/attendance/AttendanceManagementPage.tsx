import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle, XCircle, ClipboardList, AlertTriangle, Clock,
  CalendarCheck, CalendarX, Fingerprint, Timer, ArrowLeft,
} from 'lucide-react'
import { eachDayOfInterval, differenceInCalendarDays, format as formatDate, parseISO } from 'date-fns'
import { attendanceApi } from '../../api/attendance'
import { usersApi } from '../../api/users'
import { clinicsApi } from '../../api/clinics'
import { Card, StatCard } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { PageLoader } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { ToastContainer } from '../../components/ui/Toast'
import { Avatar } from '../../components/shared/Avatar'
import AttendanceTrendChart, { type AttendanceTrendPoint } from '../../components/charts/AttendanceTrendChart'
import { useToast } from '../../hooks/useToast'
import { getApiError } from '../../lib/apiError'
import { formatTime } from '../../lib/format'
import { roleLabel } from '../../components/ui/Badge'
import { colors, styles, warningAlpha, successAlpha, dangerAlpha, palette } from '../../theme'
import type { AttendanceResponse, StaffMemberResponse } from '../../types'

function VerifyIcon({ ok }: { ok: boolean }) {
  return ok
    ? <CheckCircle size={14} style={{ color: colors.status.success }} />
    : <XCircle    size={14} style={{ color: colors.status.error }} />
}

function OverrideBadge({ approved }: { approved: boolean | null }) {
  if (approved === null) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
        style={{ background: warningAlpha(0.12), color: colors.status.warning }}
      >
        <Clock size={10} />
        Pending
      </span>
    )
  }
  return approved ? (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ background: successAlpha(0.12), color: colors.status.success }}
    >
      <CheckCircle size={10} />
      Approved
    </span>
  ) : (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ background: dangerAlpha(0.1), color: colors.status.error }}
    >
      <XCircle size={10} />
      Rejected
    </span>
  )
}

// ── Per-employee aggregation ────────────────────────────────────────────────

interface EmployeeStats {
  member: StaffMemberResponse
  records: AttendanceResponse[]
  present: number
  absent: number
  verified: number
  avgHours: number | null
}

function minutesSinceMidnight(iso: string): number {
  const d = new Date(iso)
  return d.getHours() * 60 + d.getMinutes()
}

function minutesToLabel(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = Math.round(mins % 60)
  const period = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${period}`
}

function hoursWorked(r: AttendanceResponse): number | null {
  if (!r.checkInTime || !r.checkOutTime) return null
  return (new Date(r.checkOutTime).getTime() - new Date(r.checkInTime).getTime()) / 3_600_000
}

// ── Employee detail panel ────────────────────────────────────────────────────
// Rendered in place of the employee list (not a modal/drawer) — same pattern as
// Analytics > Cases: select one row, the list gets out of the way, an "All
// employees" link brings it back. Keeps the loaded detail directly where you were
// looking instead of appended below a list that can run long.

function EmployeeDetailPanel({ stats, from, to, clinicName, onBack }: {
  stats: EmployeeStats; from: string; to: string; clinicName: string; onBack: () => void
}) {
  const { member, records, present, absent, verified, avgHours } = stats

  const dayRange = useMemo(
    () => eachDayOfInterval({ start: parseISO(from), end: parseISO(to) }),
    [from, to]
  )
  const recordsByDate = useMemo(
    () => new Map(records.map(r => [r.attendanceDate, r])),
    [records]
  )

  const hoursPoints: AttendanceTrendPoint[] = dayRange.map(d => {
    const key = formatDate(d, 'yyyy-MM-dd')
    const r = recordsByDate.get(key)
    return { date: key, label: formatDate(d, 'd MMM'), value: r ? hoursWorked(r) : null }
  })

  const checkInPoints: AttendanceTrendPoint[] = dayRange.map(d => {
    const key = formatDate(d, 'yyyy-MM-dd')
    const r = recordsByDate.get(key)
    return {
      date: key, label: formatDate(d, 'd MMM'),
      value: r?.checkInTime ? minutesSinceMidnight(r.checkInTime) : null,
    }
  })

  return (
    <Card>
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-sm font-medium mb-4 transition-colors"
        style={{ color: colors.text.muted }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = colors.accent}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = colors.text.muted}
      >
        <ArrowLeft size={14} /> All employees
      </button>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Avatar
            initials={`${member.firstName[0] ?? ''}${member.lastName[0] ?? ''}`}
            name={`${member.firstName} ${member.lastName}`}
            size="xl" bold
          />
          <div className="min-w-0">
            <p className="font-semibold truncate" style={{ color: colors.text.heading }}>
              {member.firstName} {member.lastName}
            </p>
            <p className="text-sm truncate" style={{ color: colors.text.muted }}>
              {roleLabel(member.role)}{clinicName && ` · ${clinicName}`}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Present"            value={present}  icon={<CalendarCheck size={18} />} color="green" />
          <StatCard label="Absent"              value={absent}   icon={<CalendarX size={18} />}     color="purple" />
          <StatCard label="Biometric Verified"  value={verified} icon={<Fingerprint size={18} />}    color="blue" />
          <StatCard
            label="Avg Hours / Day"
            value={avgHours === null ? '—' : avgHours.toFixed(1)}
            icon={<Timer size={18} />}
            color="teal"
          />
        </div>

        {/* Charts */}
        <div>
          <h3 className="text-sm font-semibold mb-2" style={{ color: colors.text.heading }}>Hours worked per day</h3>
          <AttendanceTrendChart
            points={hoursPoints}
            valueLabel="Hours"
            formatValue={v => `${v.toFixed(1)}h`}
            accentColor={palette.teal.text}
          />
        </div>
        <div>
          <h3 className="text-sm font-semibold mb-2" style={{ color: colors.text.heading }}>Check-in time per day</h3>
          <AttendanceTrendChart
            points={checkInPoints}
            valueLabel="Check-in"
            formatValue={minutesToLabel}
            accentColor={palette.purple.text}
            padLeft={70}
          />
        </div>

        {/* Daily records */}
        <div>
          <h3 className="text-sm font-semibold mb-2" style={{ color: colors.text.heading }}>Daily records</h3>
          {records.length === 0 ? (
            <p className="text-sm" style={{ color: colors.text.dim }}>No attendance records in this period.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {[...records].reverse().map(r => (
                <div key={r.id} className="rounded-xl p-3" style={styles.card}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium" style={{ color: colors.text.primary }}>
                      {new Date(r.attendanceDate + 'T00:00:00').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                    </p>
                    {r.faceOverride && <OverrideBadge approved={r.overrideApproved} />}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-4 text-xs" style={{ color: colors.text.muted }}>
                    <span>In {formatTime(r.checkInTime)}</span>
                    <span>Out {formatTime(r.checkOutTime)}</span>
                    <span className="flex items-center gap-1"><VerifyIcon ok={r.geoVerified} /> Geo</span>
                    <span className="flex items-center gap-1"><VerifyIcon ok={r.faceVerified} /> Face</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AttendanceManagementPage({ asTab = false }: { asTab?: boolean }) {
  const today = new Date().toISOString().split('T')[0]
  // Default to the last seven days inclusive of today — a single-day window
  // opened on an empty table before anyone had checked in.
  const sevenDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0]
  // The native date input fires onChange for every intermediate field it commits (year, then
  // month, then day) while its own popup is still open — driving the query straight off that
  // reloads the page mid-selection. `from`/`to` (what the query keys off) only catch up to the
  // draft values a moment after typing/clicking stops, so the picker stays put until you're done.
  const [fromDraft, setFromDraft] = useState(sevenDaysAgo)
  const [toDraft, setToDraft]     = useState(today)
  const [from, setFrom] = useState(sevenDaysAgo)
  const [to, setTo]     = useState(today)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setFrom(fromDraft), 600)
    return () => clearTimeout(t)
  }, [fromDraft])

  useEffect(() => {
    const t = setTimeout(() => setTo(toDraft), 600)
    return () => clearTimeout(t)
  }, [toDraft])

  const { toasts, toast, dismiss } = useToast()
  const qc = useQueryClient()

  const { data: records = [], isLoading: recordsLoading } = useQuery({
    queryKey: ['attendance', 'all', from, to],
    queryFn: () => attendanceApi.listAll(from, to),
    // Keep the outgoing range's records on screen while a new range loads, instead of
    // blanking the whole page (and the date filters with it) on every date change.
    placeholderData: (previousData) => previousData,
  })

  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ['members'],
    queryFn: () => usersApi.listMembers(),
  })

  const { data: clinics = [] } = useQuery({ queryKey: ['clinics'], queryFn: clinicsApi.list })
  const clinicMap = useMemo(() => Object.fromEntries(clinics.map(c => [c.id, c.name])), [clinics])

  const reviewMut = useMutation({
    mutationFn: ({ id, approved }: { id: string; approved: boolean }) =>
      attendanceApi.reviewOverride(id, approved),
    onSuccess: (updated) => {
      qc.setQueryData(['attendance', 'all', from, to], (prev: AttendanceResponse[] | undefined) =>
        (prev ?? []).map(r => r.id === updated.id ? updated : r)
      )
      toast(updated.overrideApproved ? 'Check-in approved' : 'Check-in rejected', 'success')
    },
    onError: (err) => toast(getApiError(err, 'Review failed'), 'error'),
  })

  const daysInRange = Math.max(1, differenceInCalendarDays(parseISO(to), parseISO(from)) + 1)

  const employeeStats = useMemo<EmployeeStats[]>(() => {
    const byUser = new Map<string, AttendanceResponse[]>()
    for (const r of records) {
      const list = byUser.get(r.userId) ?? []
      list.push(r)
      byUser.set(r.userId, list)
    }
    return members
      .filter(m => m.isActive)
      .map(member => {
        const recs = (byUser.get(member.id) ?? []).slice().sort((a, b) => a.attendanceDate.localeCompare(b.attendanceDate))
        const present = recs.filter(r => r.checkInTime).length
        const verified = recs.filter(r => r.geoVerified && r.faceVerified).length
        const hours = recs.map(hoursWorked).filter((h): h is number => h !== null)
        return {
          member, records: recs, present,
          absent: Math.max(0, daysInRange - present),
          verified,
          avgHours: hours.length ? hours.reduce((a, b) => a + b, 0) / hours.length : null,
        }
      })
      .sort((a, b) => `${a.member.firstName} ${a.member.lastName}`.localeCompare(`${b.member.firstName} ${b.member.lastName}`))
  }, [records, members, daysInRange])

  const selectedStats = employeeStats.find(e => e.member.id === selectedId) ?? null

  const pendingOverrides = records.filter(r => r.faceOverride && r.overrideApproved === null)

  // Only the roster gates the full-page loader — records use placeholderData above, so a date
  // change refetches quietly in the background instead of unmounting the filters mid-use.
  const isLoading = membersLoading

  if (isLoading) return <PageLoader />

  const DateFilters = (
    <div className="flex items-center gap-2">
      <Input label="" type="date" value={fromDraft} onChange={e => setFromDraft(e.target.value)} className="text-sm" />
      <span className="text-sm" style={{ color: colors.text.muted }}>to</span>
      <Input label="" type="date" value={toDraft} onChange={e => setToDraft(e.target.value)} className="text-sm" />
    </div>
  )

  return (
    <div className={asTab ? 'space-y-6' : 'p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6'}>

      {/* ── Header ── */}
      {asTab ? (
        <div className="flex justify-end">{DateFilters}</div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg md:text-xl font-bold" style={{ color: colors.text.heading }}>
              Attendance Management
            </h1>
            <p className="text-sm mt-1" style={{ color: colors.text.muted }}>
              View and monitor staff attendance
            </p>
          </div>
          {DateFilters}
        </div>
      )}

      {/* ── Pending override reviews ── */}
      {pendingOverrides.length > 0 && (
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={16} style={{ color: colors.status.warning }} />
            <h2 className="text-base font-semibold" style={{ color: colors.text.heading }}>
              Pending Review
            </h2>
            <span
              className="inline-flex items-center justify-center rounded-full text-xs font-bold w-5 h-5"
              style={{ background: warningAlpha(0.15), color: colors.status.warning }}
            >
              {pendingOverrides.length}
            </span>
          </div>
          <p className="text-sm mb-4" style={{ color: colors.text.muted }}>
            These staff members checked in but their face was not recognised. Review each check-in and mark it as valid or invalid.
          </p>
          <div className="flex flex-col gap-3">
            {pendingOverrides.map(r => (
              <div
                key={r.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl px-4 py-3"
                style={{ background: warningAlpha(0.06), border: `1px solid ${warningAlpha(0.2)}` }}
              >
                <div>
                  <p className="font-semibold text-sm" style={{ color: colors.text.primary }}>
                    {r.userFirstName} {r.userLastName}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: colors.text.muted }}>
                    {r.clinicName} · {new Date(r.attendanceDate).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} · {formatTime(r.checkInTime)}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    variant="secondary"
                    onClick={() => reviewMut.mutate({ id: r.id, approved: true })}
                    loading={reviewMut.isPending && reviewMut.variables?.id === r.id && reviewMut.variables?.approved === true}
                    disabled={reviewMut.isPending}
                  >
                    <CheckCircle size={14} />
                    Approve
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => reviewMut.mutate({ id: r.id, approved: false })}
                    loading={reviewMut.isPending && reviewMut.variables?.id === r.id && reviewMut.variables?.approved === false}
                    disabled={reviewMut.isPending}
                  >
                    <XCircle size={14} />
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Employees ──
          Selecting one replaces the list with its detail panel — like Analytics > Cases,
          but collapsing the list instead of appending the detail below it, so a long
          roster never buries the thing you just clicked on. */}
      {selectedStats ? (
        <EmployeeDetailPanel
          stats={selectedStats}
          from={from}
          to={to}
          clinicName={selectedStats.member.clinicId ? (clinicMap[selectedStats.member.clinicId] ?? '') : ''}
          onBack={() => setSelectedId(null)}
        />
      ) : employeeStats.length === 0 ? (
        <EmptyState icon={<ClipboardList size={32} />} title="No active staff" description="No active staff members to show attendance for" />
      ) : (
        <>
          {/* Mobile card list */}
          <div className="flex flex-col gap-3 md:hidden">
            {employeeStats.map(stats => (
              <button
                key={stats.member.id}
                onClick={() => setSelectedId(stats.member.id)}
                className="text-left rounded-xl p-4 w-full"
                style={styles.card}
              >
                <div className="flex items-center gap-3">
                  <Avatar
                    initials={`${stats.member.firstName[0] ?? ''}${stats.member.lastName[0] ?? ''}`}
                    name={`${stats.member.firstName} ${stats.member.lastName}`}
                    bold
                  />
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate" style={{ color: colors.text.primary }}>
                      {stats.member.firstName} {stats.member.lastName}
                    </p>
                    <p className="text-xs truncate" style={{ color: colors.text.muted }}>
                      {roleLabel(stats.member.role)}{stats.member.clinicId && ` · ${clinicMap[stats.member.clinicId] ?? ''}`}
                    </p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                  <div>
                    <p className="text-sm font-bold" style={{ color: colors.status.success }}>{stats.present}</p>
                    <p className="text-[11px]" style={{ color: colors.text.dim }}>Present</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold" style={{ color: colors.status.error }}>{stats.absent}</p>
                    <p className="text-[11px]" style={{ color: colors.text.dim }}>Absent</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold" style={{ color: colors.accent }}>{stats.verified}</p>
                    <p className="text-[11px]" style={{ color: colors.text.dim }}>Verified</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold" style={{ color: colors.text.primary }}>
                      {stats.avgHours === null ? '—' : stats.avgHours.toFixed(1)}
                    </p>
                    <p className="text-[11px]" style={{ color: colors.text.dim }}>Avg hrs</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto rounded-xl" style={styles.card}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: `1px solid ${colors.text.dim}20` }}>
                  {['Employee', 'Clinic', 'Present', 'Absent', 'Biometric Verified', 'Avg Hours'].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider" style={{ color: colors.text.dim }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employeeStats.map(stats => (
                  <tr
                    key={stats.member.id}
                    onClick={() => setSelectedId(stats.member.id)}
                    className="cursor-pointer transition-colors"
                    style={{ borderBottom: `1px solid ${colors.text.dim}10` }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = warningAlpha(0.03)}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <Avatar
                          initials={`${stats.member.firstName[0] ?? ''}${stats.member.lastName[0] ?? ''}`}
                          name={`${stats.member.firstName} ${stats.member.lastName}`}
                          size="sm" bold
                        />
                        <div className="min-w-0">
                          <p className="font-medium truncate" style={{ color: colors.text.primary }}>
                            {stats.member.firstName} {stats.member.lastName}
                          </p>
                          <p className="text-xs truncate" style={{ color: colors.text.dim }}>{roleLabel(stats.member.role)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4" style={{ color: colors.text.muted }}>
                      {stats.member.clinicId ? (clinicMap[stats.member.clinicId] ?? '—') : '—'}
                    </td>
                    <td className="py-3 px-4 font-medium" style={{ color: colors.status.success }}>{stats.present}</td>
                    <td className="py-3 px-4 font-medium" style={{ color: colors.status.error }}>{stats.absent}</td>
                    <td className="py-3 px-4 font-medium" style={{ color: colors.accent }}>{stats.verified}</td>
                    <td className="py-3 px-4" style={{ color: colors.text.primary }}>
                      {stats.avgHours === null ? '—' : `${stats.avgHours.toFixed(1)}h`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
