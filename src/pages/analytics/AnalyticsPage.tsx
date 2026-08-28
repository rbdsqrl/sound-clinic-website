import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { analyticsApi } from '../../api/analytics'
import { patientsApi } from '../../api/patients'
import { enrollmentsApi } from '../../api/enrollments'
import { usersApi } from '../../api/users'
import { programsApi } from '../../api/programs'
import { baselineReportApi } from '../../api/baselineReport'
import { useAuth } from '../../contexts/AuthContext'
import MasteryTrendChart from '../../components/charts/MasteryTrendChart'
import ScoreChart from '../../components/charts/ScoreChart'
import OutcomeRibbon from '../../components/charts/OutcomeRibbon'
import Sparkline from '../../components/charts/Sparkline'
import SessionHeatmap from '../../components/charts/SessionHeatmap'
import { Select } from '../../components/ui/Select'
import { Users, UserCog, Mail, Clock, CalendarClock, Search, Download } from 'lucide-react'
import { EmptyState } from '../../components/ui/EmptyState'
import { colors, border, styles, surface, radius, accentAlpha, palette } from '../../theme'
import type { Granularity, IEPGoalDomain, EnrollmentCareStatus } from '../../types'
import { Delta, Loading, Metric, Panel, Tile } from './components'
import { StarRating } from '../patients/ReviewMeetings'
import { domainLabel as baselineDomainLabel, ScorePill } from '../patients/BaselineReportTab'
import { childStatusBadge, type ChildStatus } from '../../components/ui/Badge'
import { format, parseISO, addDays } from 'date-fns'
import { exportRowsAsCsv } from '../../lib/exportCsv'
import { ROUTES } from '../../lib/routes'

type TabKey = 'overview' | 'cases' | 'members' | 'schedule'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'cases',     label: 'Cases' },
  { key: 'members',   label: 'Members' },
  { key: 'schedule',  label: 'Schedule' },
]

const DOMAINS: IEPGoalDomain[] = [
  'AUDITORY', 'SPEECH', 'LANGUAGE', 'SENSORY', 'MOTOR', 'SOCIAL', 'COGNITIVE', 'LITERACY', 'ADAPTIVE',
]

/** Sparklines share this band so domains can be compared against each other, not just themselves. */
const SPARK_MIN = 0
const SPARK_MAX = 100

const iso = (d: Date) => d.toISOString().slice(0, 10)

/** "17–23 Aug" within a month, "28 Aug – 3 Sep" across a month boundary — a single start
 *  date reads as a day, not the week it anchors. */
function formatWeekRange(weekStartIso: string): string {
  const start = parseISO(weekStartIso + 'T00:00:00')
  const end = addDays(start, 6)
  return start.getMonth() === end.getMonth()
    ? `${format(start, 'd')}–${format(end, 'd MMM')}`
    : `${format(start, 'd MMM')} – ${format(end, 'd MMM')}`
}

function defaultWindow(granularity: Granularity) {
  const to = new Date()
  const from = new Date()
  if (granularity === 'DAILY') from.setDate(from.getDate() - 29)
  else if (granularity === 'WEEKLY') from.setDate(from.getDate() - 83)
  else from.setMonth(from.getMonth() - 11)
  return { from: iso(from), to: iso(to) }
}

export default function AnalyticsPage() {
  const { activeRole } = useAuth()
  const isParentUser = activeRole === 'PARENT'

  const [tab, setTab] = useState<TabKey>('overview')
  const [granularity, setGranularity] = useState<Granularity>('DAILY')
  const [domain, setDomain] = useState<IEPGoalDomain | ''>('')
  const [patientId, setPatientId] = useState('')
  const [therapistId, setTherapistId] = useState('')
  const [range, setRange] = useState(() => defaultWindow('DAILY'))

  // Parents only ever see their own children's progress — caseload and clinic-wide rollups
  // are staff views and the backend rejects them for this role.
  const visibleTabs = isParentUser ? TABS.filter(t => t.key === 'cases') : TABS

  // Overview/Members have no daily series — the API rejects it, so the control must not offer it.
  const allowedGranularities: Granularity[] =
    (tab === 'overview') ? ['WEEKLY', 'MONTHLY'] : ['DAILY', 'WEEKLY', 'MONTHLY']

  const effectiveGranularity: Granularity =
    allowedGranularities.includes(granularity) ? granularity : 'WEEKLY'

  // Once a patient's date range has been anchored to their program start, further granularity
  // changes shouldn't reset it back to a fixed lookback window.
  const anchoredPatientRef = useRef<string | null>(null)

  const changeGranularity = (g: Granularity) => {
    setGranularity(g)
    if (tab === 'cases' && patientId && anchoredPatientRef.current === patientId) return
    setRange(defaultWindow(g))
  }

  const params = {
    granularity: effectiveGranularity,
    from: range.from,
    to: range.to,
    ...(domain ? { domain } : {}),
  }

  const patients = useQuery({
    queryKey: isParentUser ? ['my-children'] : ['patients'],
    queryFn: isParentUser ? patientsApi.myChildren : patientsApi.list,
  })
  const enrollmentsQuery = useQuery({
    queryKey: ['enrollments', 'analytics', patientId],
    queryFn: () => enrollmentsApi.listForPatient(patientId),
    enabled: tab === 'cases' && !!patientId,
  })

  // Anchor the default 'from' to the child's earliest program start date rather than a fixed
  // lookback — a lookback window can start before therapy did, showing a run of empty days.
  useEffect(() => {
    if (tab !== 'cases' || !patientId) return
    if (anchoredPatientRef.current === patientId) return
    if (!enrollmentsQuery.data) return

    anchoredPatientRef.current = patientId
    const starts = enrollmentsQuery.data.map(e => e.startDate).filter(Boolean).sort()
    setRange({ from: starts[0] ?? defaultWindow(granularity).from, to: iso(new Date()) })
  }, [tab, patientId, enrollmentsQuery.data, granularity])

  // If the role is switched while this page is open, fall back to the one tab parents may view.
  useEffect(() => {
    if (isParentUser && tab !== 'cases') setTab('cases')
  }, [isParentUser, tab])

  // A parent with just the one child shouldn't have to pick them from a dropdown.
  useEffect(() => {
    if (isParentUser && !patientId && patients.data?.length === 1) {
      setPatientId(patients.data[0].id)
    }
  }, [isParentUser, patientId, patients.data])

  const patientQuery = useQuery({
    queryKey: ['analytics', 'patient', patientId, params],
    queryFn: () => analyticsApi.patientProgress(patientId, params),
    enabled: tab === 'cases' && !!patientId,
  })

  const activityProgressQuery = useQuery({
    queryKey: ['analytics', 'patient-activities', patientId, range.from, range.to],
    queryFn: () => analyticsApi.patientActivityProgress(patientId, range.from, range.to),
    enabled: tab === 'cases' && !!patientId,
  })

  const frequencyQuery = useQuery({
    queryKey: ['analytics', 'patient-frequency', patientId, range.from, range.to],
    queryFn: () => analyticsApi.patientFrequency(patientId, range.from, range.to),
    enabled: tab === 'cases' && !!patientId,
  })

  // Session log for this child in the same (program-anchored) window — reused client-side to
  // total hours per program and the average session length, rather than adding a new endpoint.
  const durationQuery = useQuery({
    queryKey: ['analytics', 'patient-duration', patientId, range.from, range.to],
    queryFn: () => analyticsApi.schedule(range.from, range.to, { patientId }),
    enabled: tab === 'cases' && !!patientId,
  })

  const baselineReportQuery = useQuery({
    queryKey: ['baseline-report', patientId],
    queryFn: () => baselineReportApi.get(patientId),
    enabled: tab === 'cases' && !!patientId,
  })

  const caseloadQuery = useQuery({
    queryKey: ['analytics', 'therapist', therapistId, params],
    queryFn: () => analyticsApi.therapistCaseload(therapistId, params),
    enabled: tab === 'members' && !!therapistId,
  })

  // The Cases list — staff only; a parent's single-child view stays on the dropdown/drill-in below.
  const [caseSearch, setCaseSearch] = useState('')
  const casesQuery = useQuery({
    queryKey: ['analytics', 'cases', range.from, range.to],
    queryFn: () => analyticsApi.cases(range.from, range.to),
    enabled: tab === 'cases' && !isParentUser,
  })
  const filteredCases = (casesQuery.data ?? []).filter(c =>
    c.patientName.toLowerCase().includes(caseSearch.trim().toLowerCase())
  )

  // The Members list. Selecting a row drills into that therapist's caseload below.
  const [memberSearch, setMemberSearch] = useState('')
  const membersQuery = useQuery({
    queryKey: ['analytics', 'members', range.from, range.to],
    queryFn: () => analyticsApi.members(range.from, range.to),
    enabled: tab === 'members',
  })
  const filteredMembers = (membersQuery.data ?? []).filter(m =>
    m.therapistName.toLowerCase().includes(memberSearch.trim().toLowerCase())
  )

  // Schedule tab — its own filters, independent of the Cases/Members drill-in patient/therapist.
  const [scheduleSearch, setScheduleSearch] = useState('')
  const [schedulePatientId, setSchedulePatientId] = useState('')
  const [scheduleTherapistId, setScheduleTherapistId] = useState('')
  const [scheduleProgramId, setScheduleProgramId] = useState('')

  const scheduleStaffQuery = useQuery({
    queryKey: ['assignable'],
    queryFn: () => usersApi.listAssignable(),
    enabled: tab === 'schedule',
  })
  const scheduleTherapistOptions = (scheduleStaffQuery.data ?? []).filter(
    u => u.role === 'THERAPIST' || u.role === 'DOCTOR'
  )
  const scheduleProgramsQuery = useQuery({
    queryKey: ['programs'],
    queryFn: () => programsApi.list(),
    enabled: tab === 'schedule',
  })

  const scheduleQuery = useQuery({
    queryKey: ['analytics', 'schedule', range.from, range.to, schedulePatientId, scheduleTherapistId, scheduleProgramId],
    queryFn: () => analyticsApi.schedule(range.from, range.to, {
      patientId: schedulePatientId || undefined,
      therapistId: scheduleTherapistId || undefined,
      programId: scheduleProgramId || undefined,
    }),
    enabled: tab === 'schedule',
  })
  const scheduleSearchTerm = scheduleSearch.trim().toLowerCase()
  const filteredScheduleSessions = (scheduleQuery.data?.sessions ?? []).filter(s =>
    !scheduleSearchTerm
    || s.patientName.toLowerCase().includes(scheduleSearchTerm)
    || s.therapistName.toLowerCase().includes(scheduleSearchTerm)
    || s.programName.toLowerCase().includes(scheduleSearchTerm)
  )

  // Therapies breakdown for the Overview tab — reuses the org snapshot's program mix.
  // Not windowed, so it's independent of the date-range control above.
  const snapshotQuery = useQuery({
    queryKey: ['analytics', 'snapshot'],
    queryFn: () => analyticsApi.orgSnapshot(),
    enabled: tab === 'overview',
  })

  // Engagement rollup — users, sessions, skills, checklist fills. Shares the same date window
  // as the goal-mastery rollup above rather than adding a second date picker.
  const engagementQuery = useQuery({
    queryKey: ['analytics', 'engagement', range.from, range.to],
    queryFn: () => analyticsApi.engagementOverview(range.from, range.to),
    enabled: tab === 'overview',
  })

  // The heatmap always shows the full calendar year, independent of the trend window above —
  // matching the reference product's own behaviour.
  const heatmapYear = new Date().getFullYear()
  const heatmapQuery = useQuery({
    queryKey: ['analytics', 'heatmap', heatmapYear],
    queryFn: () => analyticsApi.sessionHeatmap(`${heatmapYear}-01-01`, `${heatmapYear}-12-31`),
    enabled: tab === 'overview' || tab === 'schedule',
  })

  const activeSeries =
    tab === 'cases' ? patientQuery.data
    : tab === 'members' ? caseloadQuery.data?.series
    : undefined

  const loading =
    (tab === 'cases' && patientQuery.isLoading) ||
    (tab === 'members' && caseloadQuery.isLoading)

  const totals = activeSeries?.totals

  // Current status — the most attention-needing ACTIVE enrollment's care status, overridden to
  // DISCHARGE once the patient's stage actually reflects a completed discharge (a later, separate
  // event from an enrollment being marked PROGRAM_COMPLETED).
  const selectedPatient = (patients.data ?? []).find(p => p.id === patientId)
  const CARE_STATUS_SEVERITY: Record<EnrollmentCareStatus, number> =
    { NEEDS_ATTENTION: 3, REVIEW: 2, ON_TRACK: 1, PROGRAM_COMPLETED: 0 }
  const worstCareStatus = (enrollmentsQuery.data ?? [])
    .filter(e => e.status === 'ACTIVE')
    .reduce<EnrollmentCareStatus | null>((worst, e) =>
      (!worst || CARE_STATUS_SEVERITY[e.careStatus] > CARE_STATUS_SEVERITY[worst]) ? e.careStatus : worst, null)
  const currentStatus: ChildStatus | null =
    selectedPatient?.stage === 'DISCHARGED' ? 'DISCHARGE' : worstCareStatus

  // Therapy duration — completed sessions only; a scheduled-but-cancelled session isn't time spent.
  const completedDurationEntries = (durationQuery.data?.sessions ?? []).filter(s => s.status === 'COMPLETED')
  const avgSessionDurationMinutes = completedDurationEntries.length
    ? Math.round(completedDurationEntries.reduce((sum, s) => sum + s.durationMinutes, 0) / completedDurationEntries.length)
    : null
  const durationMinutesByProgram = new Map<string, number>()
  for (const s of completedDurationEntries) {
    durationMinutesByProgram.set(s.programName, (durationMinutesByProgram.get(s.programName) ?? 0) + s.durationMinutes)
  }
  const durationByProgram = Array.from(durationMinutesByProgram.entries())
    .map(([programName, minutes]) => ({ programName, hours: minutes / 60 }))
    .sort((a, b) => b.hours - a.hours)

  // Baseline Report — only domains with a baseline value or at least one logged Current entry,
  // so a report that's barely been filled in doesn't render 13 empty rows.
  const baselineDomains = (baselineReportQuery.data?.domains ?? [])
    .filter(d => d.baselineValue || d.currentEntries.length > 0)

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-6 lg:p-8">
      <div>
        <h1 className="text-lg font-bold md:text-xl" style={{ color: colors.text.heading }}>
          {isParentUser ? "Your Child's Progress" : 'Analytics'}
        </h1>
        <p className="mt-0.5 text-sm" style={{ color: colors.text.muted }}>
          {isParentUser
            ? 'Daily, weekly and monthly progress trends from session and goal records'
            : 'Engagement, caseload and clinical-outcome analytics across the organisation'}
        </p>
      </div>

      {/* Tabs */}
      {visibleTabs.length > 1 && (
        <div className="flex gap-2 overflow-x-auto border-b" style={{ borderColor: border.divider }}>
          {visibleTabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="-mb-px flex-shrink-0 whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors"
              style={tab === t.key ? styles.tabActive : styles.tabInactive}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Filters — one row above the charts */}
      {tab !== 'schedule' && (
        <div className="flex flex-wrap items-end gap-3">
          {tab === 'cases' && isParentUser && (
            <div className="min-w-[200px]">
              <Select
                label="Child"
                placeholder="Select a child"
                value={patientId}
                onChange={e => setPatientId(e.target.value)}
                options={(patients.data ?? []).map(p => ({
                  value: p.id,
                  label: `${p.firstName} ${p.lastName}`,
                }))}
              />
            </div>
          )}

          {tab !== 'overview' && (
            <div className="min-w-[150px]">
              <Select
                label="Granularity"
                value={effectiveGranularity}
                onChange={e => changeGranularity(e.target.value as Granularity)}
                options={allowedGranularities.map(g => ({
                  value: g,
                  label: g.charAt(0) + g.slice(1).toLowerCase(),
                }))}
              />
            </div>
          )}

          {tab !== 'overview' && (
            <div className="min-w-[160px]">
              <Select
                label="Domain"
                placeholder="All domains"
                value={domain}
                onChange={e => setDomain(e.target.value as IEPGoalDomain | '')}
                options={DOMAINS.map(d => ({ value: d, label: d.charAt(0) + d.slice(1).toLowerCase() }))}
              />
            </div>
          )}

          {!(tab === 'cases' && isParentUser) && (
            <>
              <div className="space-y-1">
                <label className="form-label" htmlFor="from">From</label>
                <input
                  id="from" type="date" className="form-input" value={range.from}
                  onChange={e => setRange(r => ({ ...r, from: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <label className="form-label" htmlFor="to">To</label>
                <input
                  id="to" type="date" className="form-input" value={range.to}
                  onChange={e => setRange(r => ({ ...r, to: e.target.value }))}
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* Schedule filters — its own row: single-select Case/Member/Program plus the shared date range. */}
      {tab === 'schedule' && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[180px]">
            <Select
              label="Case"
              placeholder="All cases"
              value={schedulePatientId}
              onChange={e => setSchedulePatientId(e.target.value)}
              options={(patients.data ?? []).map(p => ({ value: p.id, label: `${p.firstName} ${p.lastName}` }))}
            />
          </div>
          <div className="min-w-[180px]">
            <Select
              label="Member"
              placeholder="All members"
              value={scheduleTherapistId}
              onChange={e => setScheduleTherapistId(e.target.value)}
              options={scheduleTherapistOptions.map(t => ({ value: t.id, label: `${t.firstName} ${t.lastName}` }))}
            />
          </div>
          <div className="min-w-[180px]">
            <Select
              label="Program"
              placeholder="All programs"
              value={scheduleProgramId}
              onChange={e => setScheduleProgramId(e.target.value)}
              options={(scheduleProgramsQuery.data ?? []).map(p => ({ value: p.id, label: p.name }))}
            />
          </div>
          <div className="space-y-1">
            <label className="form-label" htmlFor="schedule-from">From</label>
            <input
              id="schedule-from" type="date" className="form-input" value={range.from}
              onChange={e => setRange(r => ({ ...r, from: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <label className="form-label" htmlFor="schedule-to">To</label>
            <input
              id="schedule-to" type="date" className="form-input" value={range.to}
              onChange={e => setRange(r => ({ ...r, to: e.target.value }))}
            />
          </div>
        </div>
      )}

      {/* Cases list — staff only. Selecting a row drills into that patient's progress below. */}
      {tab === 'cases' && !isParentUser && (
        <Panel
          title="Cases"
          subtitle="Every active patient — sessions, assignments and payment status for the selected window"
        >
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1 max-w-sm">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: colors.text.dim }} />
              <input
                type="text"
                className="form-input pl-8"
                placeholder="Search cases…"
                value={caseSearch}
                onChange={e => setCaseSearch(e.target.value)}
              />
            </div>
            <button
              type="button"
              disabled={filteredCases.length === 0}
              onClick={() => exportRowsAsCsv(`cases_${range.from}_to_${range.to}.csv`, filteredCases, [
                { header: 'Patient', value: c => c.patientName },
                { header: 'Sessions Attended', value: c => c.sessionsAttended },
                { header: 'Sessions Upcoming', value: c => c.sessionsUpcoming },
                { header: 'Sessions Cancelled', value: c => c.sessionsCancelled },
                { header: 'Members Assigned', value: c => c.membersAssigned },
                { header: 'Activities Assigned', value: c => c.activitiesAssigned },
                { header: 'Checklist Filled', value: c => c.checklistFilled },
                { header: 'LT Goals', value: c => c.ltGoals },
                { header: 'Payment Status', value: c => c.paymentStatus ?? '' },
              ])}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-40"
              style={{ background: surface.rowHover, color: colors.text.primary }}
            >
              <Download size={14} /> Export
            </button>
          </div>

          {casesQuery.isLoading ? (
            <Loading />
          ) : filteredCases.length === 0 ? (
            <p className="py-8 text-center text-sm" style={{ color: colors.text.dim }}>
              {casesQuery.data?.length ? 'No cases match your search.' : 'No active patients yet.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr style={{ color: colors.text.dim }}>
                    <th className="pb-2 pr-4 text-left text-xs font-semibold uppercase tracking-wider">Patient</th>
                    <th className="pb-2 pr-4 text-right text-xs font-semibold uppercase tracking-wider">Attended</th>
                    <th className="pb-2 pr-4 text-right text-xs font-semibold uppercase tracking-wider">Upcoming</th>
                    <th className="pb-2 pr-4 text-right text-xs font-semibold uppercase tracking-wider">Cancelled</th>
                    <th className="pb-2 pr-4 text-right text-xs font-semibold uppercase tracking-wider">Members</th>
                    <th className="pb-2 pr-4 text-right text-xs font-semibold uppercase tracking-wider">Activities</th>
                    <th className="pb-2 pr-4 text-right text-xs font-semibold uppercase tracking-wider">Checklist</th>
                    <th className="pb-2 pr-4 text-right text-xs font-semibold uppercase tracking-wider">LT Goals</th>
                    <th className="pb-2 text-right text-xs font-semibold uppercase tracking-wider">Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCases.map(c => (
                    <tr
                      key={c.patientId}
                      onClick={() => setPatientId(c.patientId)}
                      className="cursor-pointer transition-colors"
                      style={{ borderTop: `1px solid ${border.divider}`, background: patientId === c.patientId ? accentAlpha(0.06) : 'transparent' }}
                    >
                      <td className="py-2.5 pr-4 font-medium" style={{ color: colors.text.primary }}>{c.patientName}</td>
                      <td className="py-2.5 pr-4 text-right" style={{ color: colors.text.primary, fontVariantNumeric: 'tabular-nums' }}>{c.sessionsAttended}</td>
                      <td className="py-2.5 pr-4 text-right" style={{ color: colors.text.muted, fontVariantNumeric: 'tabular-nums' }}>{c.sessionsUpcoming}</td>
                      <td className="py-2.5 pr-4 text-right" style={{ color: colors.text.muted, fontVariantNumeric: 'tabular-nums' }}>{c.sessionsCancelled}</td>
                      <td className="py-2.5 pr-4 text-right" style={{ color: colors.text.muted, fontVariantNumeric: 'tabular-nums' }}>{c.membersAssigned}</td>
                      <td className="py-2.5 pr-4 text-right" style={{ color: colors.text.muted, fontVariantNumeric: 'tabular-nums' }}>{c.activitiesAssigned}</td>
                      <td className="py-2.5 pr-4 text-right" style={{ color: colors.text.muted, fontVariantNumeric: 'tabular-nums' }}>{c.checklistFilled}</td>
                      <td className="py-2.5 pr-4 text-right" style={{ color: colors.text.muted, fontVariantNumeric: 'tabular-nums' }}>{c.ltGoals}</td>
                      <td className="py-2.5 text-right">
                        {c.paymentStatus ? (
                          <span
                            className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase"
                            style={{
                              background: c.paymentStatus === 'PAID' ? `${colors.status.success}1F`
                                : c.paymentStatus === 'PARTIAL' ? `${colors.status.warning}1F` : `${colors.status.danger}1F`,
                              color: c.paymentStatus === 'PAID' ? colors.status.success
                                : c.paymentStatus === 'PARTIAL' ? colors.status.warning : colors.status.danger,
                            }}
                          >
                            {c.paymentStatus}
                          </span>
                        ) : (
                          <span style={{ color: colors.text.dim }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {/* Members list. Selecting a row drills into that therapist's caseload below. */}
      {tab === 'members' && (
        <Panel
          title="Members"
          subtitle="Every therapist/doctor — cases and activities assigned, activities created, cancellations and IEP plans for the selected window"
        >
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1 max-w-sm">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: colors.text.dim }} />
              <input
                type="text"
                className="form-input pl-8"
                placeholder="Search members…"
                value={memberSearch}
                onChange={e => setMemberSearch(e.target.value)}
              />
            </div>
            <button
              type="button"
              disabled={filteredMembers.length === 0}
              onClick={() => exportRowsAsCsv(`members_${range.from}_to_${range.to}.csv`, filteredMembers, [
                { header: 'Name', value: m => m.therapistName },
                { header: 'Role', value: m => m.role },
                { header: 'Cases Assigned', value: m => m.casesAssigned },
                { header: 'Activities Created', value: m => m.activitiesCreated },
                { header: 'Activities Assigned', value: m => m.activitiesAssigned },
                { header: 'Sessions Cancelled', value: m => m.sessionsCancelled },
                { header: 'IEP Plans', value: m => m.iepPlans },
              ])}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-40"
              style={{ background: surface.rowHover, color: colors.text.primary }}
            >
              <Download size={14} /> Export
            </button>
          </div>

          {membersQuery.isLoading ? (
            <Loading />
          ) : filteredMembers.length === 0 ? (
            <p className="py-8 text-center text-sm" style={{ color: colors.text.dim }}>
              {membersQuery.data?.length ? 'No members match your search.' : 'No therapists or doctors yet.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr style={{ color: colors.text.dim }}>
                    <th className="pb-2 pr-4 text-left text-xs font-semibold uppercase tracking-wider">Name</th>
                    <th className="pb-2 pr-4 text-left text-xs font-semibold uppercase tracking-wider">Role</th>
                    <th className="pb-2 pr-4 text-right text-xs font-semibold uppercase tracking-wider">Cases</th>
                    <th className="pb-2 pr-4 text-right text-xs font-semibold uppercase tracking-wider">Activities Created</th>
                    <th className="pb-2 pr-4 text-right text-xs font-semibold uppercase tracking-wider">Activities Assigned</th>
                    <th className="pb-2 pr-4 text-right text-xs font-semibold uppercase tracking-wider">Cancelled</th>
                    <th className="pb-2 text-right text-xs font-semibold uppercase tracking-wider">IEP Plans</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.map(m => (
                    <tr
                      key={m.therapistId}
                      onClick={() => setTherapistId(m.therapistId)}
                      className="cursor-pointer transition-colors"
                      style={{ borderTop: `1px solid ${border.divider}`, background: therapistId === m.therapistId ? accentAlpha(0.06) : 'transparent' }}
                    >
                      <td className="py-2.5 pr-4 font-medium" style={{ color: colors.text.primary }}>{m.therapistName}</td>
                      <td className="py-2.5 pr-4" style={{ color: colors.text.muted }}>{m.role.charAt(0) + m.role.slice(1).toLowerCase()}</td>
                      <td className="py-2.5 pr-4 text-right" style={{ color: colors.text.primary, fontVariantNumeric: 'tabular-nums' }}>{m.casesAssigned}</td>
                      <td className="py-2.5 pr-4 text-right" style={{ color: colors.text.muted, fontVariantNumeric: 'tabular-nums' }}>{m.activitiesCreated}</td>
                      <td className="py-2.5 pr-4 text-right" style={{ color: colors.text.muted, fontVariantNumeric: 'tabular-nums' }}>{m.activitiesAssigned}</td>
                      <td className="py-2.5 pr-4 text-right" style={{ color: colors.text.muted, fontVariantNumeric: 'tabular-nums' }}>{m.sessionsCancelled}</td>
                      <td className="py-2.5 text-right" style={{ color: colors.text.muted, fontVariantNumeric: 'tabular-nums' }}>{m.iepPlans}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {/* Empty prompts */}
      {tab === 'cases' && isParentUser && !patientId && (
        <EmptyState
          icon={<Users size={22} />}
          title="Choose a child"
          description="Progress trends are built per child."
        />
      )}

      {loading && <Loading />}

      {tab === 'overview' && (
        <div className="space-y-5">
          {/* Engagement KPI tiles */}
          {engagementQuery.isLoading ? (
            <Loading />
          ) : engagementQuery.data && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Tile
                label="Active Users"
                value={
                  <span className="flex items-center gap-4 text-base">
                    <span className="flex items-center gap-1.5"><Users size={14} style={{ color: colors.text.dim }} />{engagementQuery.data.activeUsers.members}</span>
                    <span className="flex items-center gap-1.5"><UserCog size={14} style={{ color: colors.text.dim }} />{engagementQuery.data.activeUsers.cases}</span>
                  </span>
                }
                hint="Members · Cases"
              />
              <Tile
                label="Invited Users"
                value={
                  <span className="flex items-center gap-4 text-base">
                    <span className="flex items-center gap-1.5"><Mail size={14} style={{ color: colors.text.dim }} />{engagementQuery.data.invitedUsers.members}</span>
                    <span className="flex items-center gap-1.5"><Mail size={14} style={{ color: colors.text.dim }} />{engagementQuery.data.invitedUsers.cases}</span>
                  </span>
                }
                hint="Members · Cases (pending)"
              />
              <Tile
                label="Avg. Session Time"
                value={
                  <span className="flex items-center gap-1.5">
                    <Clock size={14} style={{ color: colors.text.dim }} />
                    {engagementQuery.data.avgSessionDurationMinutes !== null ? `${engagementQuery.data.avgSessionDurationMinutes}m` : '—'}
                  </span>
                }
                hint="Across all sessions in this window"
              />
            </div>
          )}

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <Panel title="Therapies" subtitle="Distinct children on each program">
              {snapshotQuery.isLoading ? (
                <Loading />
              ) : !snapshotQuery.data || snapshotQuery.data.programBreakdown.length === 0 ? (
                <p className="py-6 text-center text-sm" style={{ color: colors.text.dim }}>No enrollments recorded yet.</p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {snapshotQuery.data.programBreakdown.slice(0, 6).map(p => (
                    <div key={p.programName} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate" style={{ color: colors.text.primary }}>{p.programName}</span>
                      <span className="flex-shrink-0 font-semibold" style={{ color: colors.text.heading }}>{p.patientCount}</span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Skills" subtitle="Most-used skills across assigned activities">
              {engagementQuery.isLoading ? (
                <Loading />
              ) : !engagementQuery.data || engagementQuery.data.skillsBreakdown.length === 0 ? (
                <p className="py-6 text-center text-sm" style={{ color: colors.text.dim }}>No activity-skill data yet.</p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {engagementQuery.data.skillsBreakdown.slice(0, 6).map(s => (
                    <div key={s.name} className="flex items-center justify-between text-sm">
                      <span style={{ color: colors.text.primary }}>{s.name}</span>
                      <span className="font-semibold" style={{ color: colors.text.heading }}>{s.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Age Group" subtitle="Active patients, by age in years">
              {engagementQuery.isLoading ? (
                <Loading />
              ) : !engagementQuery.data ? null : (
                <div className="flex items-end gap-3" style={{ height: 140 }}>
                  {(() => {
                    const max = Math.max(1, ...engagementQuery.data.ageGroups.map(a => a.count))
                    return engagementQuery.data.ageGroups.map(a => (
                      <div key={a.name} className="flex flex-1 flex-col items-center gap-1.5">
                        <span className="text-xs font-semibold" style={{ color: colors.text.heading }}>{a.count || ''}</span>
                        <div className="w-full rounded-t-md" style={{ height: `${(a.count / max) * 100}px`, background: accentAlpha(0.5), minHeight: a.count > 0 ? 4 : 0 }} />
                        <span className="text-[11px]" style={{ color: colors.text.dim }}>{a.name}</span>
                      </div>
                    ))
                  })()}
                </div>
              )}
            </Panel>
          </div>

          <Panel title="Sessions Heatmap" subtitle={`Daily session volume across ${heatmapYear}`}>
            {heatmapQuery.isLoading ? <Loading /> : heatmapQuery.data && <SessionHeatmap points={heatmapQuery.data} year={heatmapYear} />}
          </Panel>

          <Panel title="Sessions" subtitle="Session count per day in the selected window">
            {engagementQuery.isLoading ? (
              <Loading />
            ) : engagementQuery.data && (
              <>
                <ScoreChart
                  variant="bars"
                  points={engagementQuery.data.sessionsTrend.map(t => ({
                    label: format(parseISO(t.date + 'T00:00:00'), 'd MMM'),
                    value: Math.min(100, t.count * 10),
                    meta: `${t.count} session${t.count !== 1 ? 's' : ''}`,
                  }))}
                />
                <div className="mt-3 flex gap-8">
                  <Tile label="Total Sessions" value={engagementQuery.data.totalSessions} />
                  <Tile label="Avg. Duration" value={engagementQuery.data.avgSessionDurationMinutes !== null ? `${engagementQuery.data.avgSessionDurationMinutes}m` : '—'} />
                </div>
              </>
            )}
          </Panel>

          <Panel title="Checklist Filled" subtitle="Sessions where a therapist filled the Detailed Feedback Options checklist, per day">
            {engagementQuery.isLoading ? (
              <Loading />
            ) : engagementQuery.data && engagementQuery.data.checklistFilledTrend.length > 0 ? (
              <ScoreChart
                variant="line"
                points={engagementQuery.data.checklistFilledTrend.map(t => ({
                  label: format(parseISO(t.date + 'T00:00:00'), 'd MMM'),
                  value: Math.min(100, t.count * 20),
                  meta: `${t.count} filled`,
                }))}
              />
            ) : (
              <p className="py-8 text-center text-sm" style={{ color: colors.text.dim }}>No session feedback checklists filled in this window.</p>
            )}
          </Panel>

          <Panel title="Most Assigned Activities" subtitle="By number of assignments, all time">
            {engagementQuery.isLoading ? (
              <Loading />
            ) : !engagementQuery.data || engagementQuery.data.mostAssignedActivities.length === 0 ? (
              <p className="py-6 text-center text-sm" style={{ color: colors.text.dim }}>No activities assigned yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ color: colors.text.dim }}>
                    <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wider">Activity Title</th>
                    <th className="pb-2 text-right text-xs font-semibold uppercase tracking-wider">Assignments</th>
                  </tr>
                </thead>
                <tbody>
                  {engagementQuery.data.mostAssignedActivities.map(a => (
                    <tr key={a.name} style={{ borderTop: `1px solid ${border.divider}` }}>
                      <td className="py-2" style={{ color: colors.text.primary }}>{a.name}</td>
                      <td className="py-2 text-right font-semibold" style={{ color: colors.text.heading }}>{a.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>
      )}

      {tab === 'schedule' && (
        <div className="space-y-5">
          {scheduleQuery.isLoading ? (
            <Loading />
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
              <Tile label="Total Sessions" value={scheduleQuery.data?.totalSessions ?? 0} />
              <Tile label="Cancelled" value={<Metric value={scheduleQuery.data?.cancelledPct ?? null} suffix="%" empty="—" />} />
              <Tile label="Rescheduled" value={<Metric value={scheduleQuery.data?.rescheduledPct ?? null} suffix="%" empty="—" />} />
              <Tile label="Attendance" value={<Metric value={scheduleQuery.data?.attendancePct ?? null} suffix="%" empty="—" />} />
              <Tile label="Total Duration" value={`${scheduleQuery.data?.totalDurationMinutes ?? 0}m`} />
              <Tile label="Avg. Duration" value={scheduleQuery.data?.avgDurationMinutes != null ? `${scheduleQuery.data.avgDurationMinutes}m` : '—'} />
            </div>
          )}

          <Panel title="Sessions Heatmap" subtitle={`Daily session volume across ${heatmapYear}`}>
            {heatmapQuery.isLoading ? <Loading /> : heatmapQuery.data && <SessionHeatmap points={heatmapQuery.data} year={heatmapYear} />}
          </Panel>

          <Panel title="Session Log" subtitle="Every session in the selected window and filters">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <div className="relative min-w-[220px] flex-1 max-w-sm">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: colors.text.dim }} />
                <input
                  type="text"
                  className="form-input pl-8"
                  placeholder="Search sessions…"
                  value={scheduleSearch}
                  onChange={e => setScheduleSearch(e.target.value)}
                />
              </div>
              <button
                type="button"
                disabled={filteredScheduleSessions.length === 0}
                onClick={() => exportRowsAsCsv(`sessions_${range.from}_to_${range.to}.csv`, filteredScheduleSessions, [
                  { header: 'Date', value: s => s.sessionDate },
                  { header: 'Time', value: s => s.startTime.slice(0, 5) },
                  { header: 'Duration (min)', value: s => s.durationMinutes },
                  { header: 'Program', value: s => s.programName },
                  { header: 'Case', value: s => s.patientName },
                  { header: 'Member', value: s => s.therapistName },
                  { header: 'Status', value: s => s.status },
                  { header: 'Cost', value: s => s.cost ?? '' },
                ])}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-40"
                style={{ background: surface.rowHover, color: colors.text.primary }}
              >
                <Download size={14} /> Export
              </button>
            </div>

            {scheduleQuery.isLoading ? (
              <Loading />
            ) : filteredScheduleSessions.length === 0 ? (
              <p className="py-8 text-center text-sm" style={{ color: colors.text.dim }}>
                {scheduleQuery.data?.sessions.length ? 'No sessions match your search.' : 'No sessions in this window.'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-sm">
                  <thead>
                    <tr style={{ color: colors.text.dim }}>
                      <th className="pb-2 pr-4 text-left text-xs font-semibold uppercase tracking-wider">Date</th>
                      <th className="pb-2 pr-4 text-left text-xs font-semibold uppercase tracking-wider">Time</th>
                      <th className="pb-2 pr-4 text-right text-xs font-semibold uppercase tracking-wider">Duration</th>
                      <th className="pb-2 pr-4 text-left text-xs font-semibold uppercase tracking-wider">Program</th>
                      <th className="pb-2 pr-4 text-left text-xs font-semibold uppercase tracking-wider">Case</th>
                      <th className="pb-2 pr-4 text-left text-xs font-semibold uppercase tracking-wider">Member</th>
                      <th className="pb-2 pr-4 text-left text-xs font-semibold uppercase tracking-wider">Status</th>
                      <th className="pb-2 text-right text-xs font-semibold uppercase tracking-wider">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredScheduleSessions.map(s => (
                      <tr key={s.sessionId} style={{ borderTop: `1px solid ${border.divider}` }}>
                        <td className="py-2.5 pr-4" style={{ color: colors.text.primary }}>{s.sessionDate}</td>
                        <td className="py-2.5 pr-4" style={{ color: colors.text.muted }}>{s.startTime.slice(0, 5)}</td>
                        <td className="py-2.5 pr-4 text-right" style={{ color: colors.text.muted, fontVariantNumeric: 'tabular-nums' }}>{s.durationMinutes}m</td>
                        <td className="py-2.5 pr-4" style={{ color: colors.text.primary }}>{s.programName}</td>
                        <td className="py-2.5 pr-4 font-medium" style={{ color: colors.text.primary }}>{s.patientName}</td>
                        <td className="py-2.5 pr-4" style={{ color: colors.text.muted }}>{s.therapistName}</td>
                        <td className="py-2.5 pr-4">
                          <span
                            className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase"
                            style={{
                              background: s.status === 'COMPLETED' ? `${colors.status.success}1F`
                                : (s.status === 'CANCELLED' || s.status === 'NO_SHOW' || s.status === 'CANCELLATION_REQUESTED') ? `${colors.status.danger}1F`
                                : `${colors.status.warning}1F`,
                              color: s.status === 'COMPLETED' ? colors.status.success
                                : (s.status === 'CANCELLED' || s.status === 'NO_SHOW' || s.status === 'CANCELLATION_REQUESTED') ? colors.status.danger
                                : colors.status.warning,
                            }}
                          >
                            {s.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-2.5 text-right" style={{ color: colors.text.muted, fontVariantNumeric: 'tabular-nums' }}>
                          {s.cost !== null ? `₹${s.cost.toLocaleString()}` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      )}

      {activeSeries && totals && !loading && (
        <div className="space-y-5">
          {/* Current status — cases only; a therapist's caseload has no single status of its own */}
          {tab === 'cases' && currentStatus && (
            <div className="flex items-center gap-2 text-sm" style={{ color: colors.text.dim }}>
              Current status {childStatusBadge(currentStatus)}
            </div>
          )}

          {/* KPI row */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Tile
              label="Goal Achievement"
              value={<Metric value={totals.masteryPct} suffix="%" empty="—" />}
              hint={<Delta pts={totals.masteryDeltaPts} />}
            />
            <Tile
              label={tab === 'members' ? 'Sessions Delivered' : 'Sessions Planned vs. Completed'}
              value={
                <>
                  {totals.sessionsCompleted}
                  <span style={{ color: colors.text.dim, fontSize: '1.1rem' }}>/{totals.sessionsScheduled}</span>
                </>
              }
              hint={totals.sessionsScheduled > 0
                ? `${Math.round((totals.sessionsNoShow / totals.sessionsScheduled) * 100)}% no-show · ${Math.round((totals.sessionsCancelled / totals.sessionsScheduled) * 100)}% cancelled`
                : 'No sessions in this window'}
            />
            <Tile
              label="Goals Achieved"
              value={
                <>
                  {totals.goalsCompleted}
                  <span style={{ color: colors.text.dim, fontSize: '1.1rem' }}>/{totals.goalsTotal}</span>
                </>
              }
              hint={[
                totals.goalsTotal > 0 ? `${Math.round((totals.goalsCompleted / totals.goalsTotal) * 100)}% achieved` : 'No goals assigned yet',
                totals.avgParentRating !== null ? `parent rating ${totals.avgParentRating}/5` : null,
              ].filter(Boolean).join(' · ')}
            />
            <Tile
              label="Documentation Compliance"
              value={<Metric value={totals.coveragePct} suffix="%" empty="—" />}
              hint={`${totals.sessionsLogged} of ${totals.sessionsCompleted} sessions logged`}
              tone={totals.coveragePct !== null && totals.coveragePct < 60 ? 'warn' : 'neutral'}
            />
          </div>

          {/* Coverage warning — a trend on thin data is a sampling artefact, say so plainly */}
          {totals.coveragePct !== null && totals.coveragePct < 60 && totals.sessionsCompleted > 0 && (
            <div
              className="px-4 py-3 text-sm"
              style={{
                background: `${colors.status.warning}14`,
                borderLeft: `3px solid ${colors.status.warning}`,
                borderRadius: `0 ${radius.sm} ${radius.sm} 0`,
                color: colors.text.primary,
              }}
            >
              Only {totals.coveragePct}% of completed sessions carry therapist notes or a score. Read the
              trend below as indicative until coverage improves.
            </div>
          )}

          <Panel
            title="Goal mastery over time"
            subtitle="Trials passed ÷ trials attempted per period. Gaps are periods with nothing logged, not zero scores."
          >
            {activeSeries.buckets.some(b => b.masteryPct !== null) ? (
              <MasteryTrendChart buckets={activeSeries.buckets} />
            ) : (
              <p className="py-8 text-center text-sm" style={{ color: colors.text.dim }}>
                No IEP trial data recorded in this window.
              </p>
            )}
          </Panel>

          <Panel
            title="Attendance %"
            subtitle="Completed vs no-show vs cancelled, across every finalised session in this window"
          >
            {(() => {
              const finalised = totals.sessionsCompleted + totals.sessionsNoShow + totals.sessionsCancelled
              if (finalised === 0) {
                return (
                  <p className="py-8 text-center text-sm" style={{ color: colors.text.dim }}>
                    No finalised sessions in this window.
                  </p>
                )
              }
              const segments = [
                { label: 'Completed', count: totals.sessionsCompleted, color: colors.status.success },
                { label: 'No-show',   count: totals.sessionsNoShow,    color: colors.status.warning },
                { label: 'Cancelled', count: totals.sessionsCancelled, color: colors.status.danger },
              ].filter(s => s.count > 0)
              return (
                <>
                  <div className="flex h-6 w-full gap-[2px] overflow-hidden rounded-full" style={{ background: surface.rowHover }}>
                    {segments.map(s => (
                      <div
                        key={s.label}
                        className="h-full rounded-full"
                        style={{ width: `${(s.count / finalised) * 100}%`, background: s.color }}
                        title={`${s.label}: ${s.count} (${Math.round((s.count / finalised) * 100)}%)`}
                      />
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[12.65px]">
                    {segments.map(s => (
                      <span key={s.label} className="flex items-center gap-1.5" style={{ color: colors.text.primary }}>
                        <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: s.color }} />
                        {s.label}
                        <span style={{ color: colors.text.dim }}>
                          {Math.round((s.count / finalised) * 100)}% · {s.count}
                        </span>
                      </span>
                    ))}
                  </div>
                </>
              )
            })()}
          </Panel>

          {/* Therapy duration — completed session hours, by program; not windowed to a fixed lookback,
              since the Cases tab's date range is already anchored to this child's program start. */}
          {tab === 'cases' && (durationQuery.isLoading || durationQuery.data) && (
            <Panel
              title="Therapy Duration"
              subtitle="Time actually spent in session, by program — completed sessions only"
            >
              {durationQuery.isLoading ? (
                <Loading />
              ) : completedDurationEntries.length === 0 ? (
                <p className="py-6 text-center text-sm" style={{ color: colors.text.dim }}>
                  No completed sessions in this window.
                </p>
              ) : (
                <>
                  <Tile
                    label="Avg. Session Duration"
                    value={avgSessionDurationMinutes !== null ? `${avgSessionDurationMinutes}m` : '—'}
                    hint={`Across ${completedDurationEntries.length} completed session${completedDurationEntries.length !== 1 ? 's' : ''}`}
                  />
                  <div className="mt-4 flex flex-col gap-2.5">
                    {durationByProgram.map(p => (
                      <div key={p.programName} className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate" style={{ color: colors.text.primary }}>{p.programName}</span>
                        <span className="flex-shrink-0 font-semibold" style={{ color: colors.text.heading }}>
                          {p.hours.toFixed(1)} hrs
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Panel>
          )}

          {/* Baseline & Current Assessment — summarised from the patient's Baseline Report */}
          {tab === 'cases' && (baselineReportQuery.isLoading || baselineReportQuery.data !== undefined) && (
            <Panel
              title="Baseline & Current Assessment"
              subtitle={
                <>
                  From the Baseline Report — see the{' '}
                  <Link to={ROUTES.patient(patientId)} style={{ color: colors.accent }}>full report</Link>
                  {' '}for history per domain
                </>
              }
            >
              {baselineReportQuery.isLoading ? (
                <Loading />
              ) : baselineDomains.length === 0 ? (
                <p className="py-6 text-center text-sm" style={{ color: colors.text.dim }}>
                  No baseline report recorded for this child yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr style={{ color: colors.text.dim }}>
                        <th className="pb-2 pr-4 text-left text-xs font-semibold uppercase tracking-wider">Domain</th>
                        <th className="pb-2 pr-4 text-left text-xs font-semibold uppercase tracking-wider">Baseline</th>
                        <th className="pb-2 pr-4 text-left text-xs font-semibold uppercase tracking-wider">Current</th>
                        <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wider">Score Trend</th>
                      </tr>
                    </thead>
                    <tbody>
                      {baselineDomains.map(d => {
                        const latest = d.currentEntries[0]
                        // Chronological (oldest first) for the trend — currentEntries arrives newest-first.
                        const scoreTrend = [...d.currentEntries].reverse().map(e => e.scorePercent)
                        const hasScoreTrend = d.currentEntries.length >= 2 && scoreTrend.some(v => v !== null)
                        return (
                          <tr key={d.domain} style={{ borderTop: `1px solid ${border.divider}` }}>
                            <td className="py-2.5 pr-4 font-medium" style={{ color: colors.text.primary }}>
                              {baselineDomainLabel(d.domain)}
                            </td>
                            <td className="py-2.5 pr-4" style={{ color: colors.text.muted }}>
                              <div className="flex items-center gap-1.5">
                                {d.baselineValue ?? <span style={{ color: colors.text.dim }}>—</span>}
                                {d.baselineScorePercent !== null && <ScorePill percent={d.baselineScorePercent} />}
                              </div>
                            </td>
                            <td className="py-2.5 pr-4" style={{ color: colors.text.muted }}>
                              {latest ? (
                                <div className="flex items-center gap-1.5">
                                  {latest.value}
                                  {latest.scorePercent !== null && <ScorePill percent={latest.scorePercent} />}
                                  <span className="text-xs" style={{ color: colors.text.dim }}>
                                    ({format(parseISO(latest.entryDate + 'T00:00:00'), 'd MMM yyyy')})
                                  </span>
                                </div>
                              ) : (
                                <span style={{ color: colors.text.dim }}>—</span>
                              )}
                            </td>
                            <td className="py-2.5">
                              {hasScoreTrend ? (
                                <Sparkline values={scoreTrend} width={100} height={26} label={`${baselineDomainLabel(d.domain)} score trend`} />
                              ) : (
                                <span style={{ color: colors.text.dim }}>—</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          )}

          {tab === 'cases' && (activityProgressQuery.isLoading || activityProgressQuery.data) && (
            <Panel
              title="Assigned Activities"
              subtitle="Completion status and attempts logged for activities assigned to this child"
            >
              {activityProgressQuery.isLoading || !activityProgressQuery.data ? (
                <Loading />
              ) : activityProgressQuery.data.assignedCount + activityProgressQuery.data.inProgressCount
                + activityProgressQuery.data.completedCount + activityProgressQuery.data.discontinuedCount === 0 ? (
                <p className="py-8 text-center text-sm" style={{ color: colors.text.dim }}>
                  No activities assigned to this child yet.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <Tile label="Assigned" value={activityProgressQuery.data.assignedCount} />
                    <Tile label="In Progress" value={activityProgressQuery.data.inProgressCount} />
                    <Tile label="Completed" value={activityProgressQuery.data.completedCount} tone="good" />
                    <Tile
                      label="Completion Rate"
                      value={activityProgressQuery.data.completionRatePct !== null ? `${Math.round(activityProgressQuery.data.completionRatePct)}%` : '—'}
                    />
                  </div>
                  {activityProgressQuery.data.weeklyAttempts.length > 0 && (
                    <div className="mt-4">
                      <p className="mb-2 text-xs font-medium" style={{ color: colors.text.dim }}>Attempts logged per week</p>
                      <div className="overflow-x-auto">
                        <Sparkline
                          values={activityProgressQuery.data.weeklyAttempts.map((w) => w.attempts)}
                          min={0}
                          max={Math.max(1, ...activityProgressQuery.data.weeklyAttempts.map((w) => w.attempts))}
                          width={260}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </Panel>
          )}

          {tab === 'cases' && (frequencyQuery.isLoading || frequencyQuery.data) && (
            <Panel
              title="Session Frequency"
              subtitle="Sessions per week, folded across every program this child is enrolled in at once"
            >
              {frequencyQuery.isLoading || !frequencyQuery.data ? (
                <Loading />
              ) : frequencyQuery.data.weekly.length === 0 ? (
                <p className="py-8 text-center text-sm" style={{ color: colors.text.dim }}>
                  No sessions in this range.
                </p>
              ) : (
                <>
                  {frequencyQuery.data.byProgram.length > 1 && (
                    <div className="mb-4 flex flex-wrap gap-2">
                      {frequencyQuery.data.byProgram.map(p => (
                        <span
                          key={p.programName}
                          className="rounded-full px-2.5 py-1 text-[11.5px] font-medium"
                          style={{ background: accentAlpha(0.08), color: colors.text.primary }}
                        >
                          {p.programName} · {p.totalSessions}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="space-y-1.5">
                    {frequencyQuery.data.weekly.map(w => {
                      const max = Math.max(1, ...frequencyQuery.data!.weekly.map(x => x.totalSessions))
                      return (
                        <div key={w.weekStart} className="flex items-center gap-3">
                          <span className="w-28 flex-shrink-0 whitespace-nowrap text-xs" style={{ color: colors.text.dim }}>
                            {formatWeekRange(w.weekStart)}
                          </span>
                          <div className="flex h-5 flex-1 gap-[2px] overflow-hidden rounded-full" style={{ background: surface.rowHover }}>
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${(w.planSessions / max) * 100}%`, background: colors.accent }}
                              title={`${w.planSessions} plan session${w.planSessions === 1 ? '' : 's'}`}
                            />
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${(w.adHocSessions / max) * 100}%`, background: palette.purple.text }}
                              title={`${w.adHocSessions} ad-hoc session${w.adHocSessions === 1 ? '' : 's'}`}
                            />
                          </div>
                          <span className="w-6 flex-shrink-0 text-right text-xs font-semibold" style={{ color: colors.text.primary }}>
                            {w.totalSessions}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                  <div className="mt-3 flex items-center gap-4 text-[11.5px]" style={{ color: colors.text.dim }}>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: colors.accent }} /> Plan
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: palette.purple.text }} /> Ad-hoc
                    </span>
                  </div>
                </>
              )}
            </Panel>
          )}

          <Panel
            title="Score by session"
            subtitle="Every scored session in order, so a single dip stays visible rather than being averaged away."
          >
            <ScoreChart
              points={(activeSeries.sessions ?? []).map(sp => ({
                label: format(parseISO(sp.sessionDate + 'T00:00:00'), 'd MMM'),
                value: sp.performanceScore,
                meta: sp.adHoc ? 'ad-hoc' : `session ${sp.sessionNumber}`,
              }))}
              variant="line"
            />
          </Panel>

          {activeSeries.reschedules && (
            <Panel
              title="Rescheduling"
              subtitle="Counted from moves that actually happened, not from requests still waiting."
            >
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                <Tile label="Sessions moved"   value={activeSeries.reschedules.sessionsMoved} />
                <Tile label="Total moves"      value={activeSeries.reschedules.totalMoves}
                      hint="a session moved twice counts twice" />
                <Tile label="Family asked"     value={activeSeries.reschedules.parentRequested} />
                <Tile label="Clinic moved"     value={activeSeries.reschedules.clinicInitiated} />
                <Tile label="Awaiting action"  value={activeSeries.reschedules.awaitingAction}
                      tone={activeSeries.reschedules.awaitingAction > 0 ? 'warn' : 'neutral'} />
              </div>
            </Panel>
          )}

          {activeSeries.domains.length > 0 && (
            <Panel
              title="Mastery by IEP domain"
              subtitle={`Shared ${SPARK_MIN}–${SPARK_MAX}% scale, so domains are comparable with each other`}
            >
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {activeSeries.domains.map(d => (
                  <div
                    key={d.domain}
                    className="p-3"
                    style={{ border: border.card, borderRadius: radius.sm, background: surface.card }}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs font-semibold tracking-wide" style={{ color: colors.text.primary }}>
                        {d.domain}
                      </span>
                      <span className="text-sm font-semibold" style={{ color: colors.text.heading, fontVariantNumeric: 'tabular-nums' }}>
                        <Metric value={d.current} suffix="%" empty="—" />
                      </span>
                    </div>
                    <div className="mt-2">
                      <Sparkline
                        values={d.masteryPct}
                        min={SPARK_MIN}
                        max={SPARK_MAX}
                        stroke={d.plateau ? colors.status.warning : colors.accent}
                        label={`${d.domain} mastery trend`}
                      />
                    </div>
                    <p className="mt-1.5 text-xs" style={{ color: d.plateau ? colors.status.warning : colors.text.dim }}>
                      {d.plateau ? 'Plateau — flagged for review' : <Delta pts={d.deltaPts} />}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs" style={{ color: colors.text.muted }}>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: colors.accent }} />
                  On trend
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: colors.status.warning }} />
                  Plateau — flagged for review
                </span>
              </div>
            </Panel>
          )}

          <Panel
            title="Session outcomes"
            subtitle="Read alongside the trend — a flat line during a run of no-shows is an attendance problem, not a clinical one"
          >
            <OutcomeRibbon buckets={activeSeries.buckets} />
          </Panel>

          {/* Children by therapy type — this therapist's caseload composition, not windowed to the date range above */}
          {tab === 'members' && caseloadQuery.data && (
            <Panel
              title="Children by Therapy Type"
              subtitle="Distinct children on this therapist's caseload, by program — reflects their caseload right now, not the selected date range"
            >
              {caseloadQuery.data.programBreakdown.length === 0 ? (
                <p className="py-6 text-center text-sm" style={{ color: colors.text.dim }}>No enrollments on this caseload yet.</p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {caseloadQuery.data.programBreakdown.map(p => (
                    <div key={p.programName} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate" style={{ color: colors.text.primary }}>{p.programName}</span>
                      <span className="flex-shrink-0 font-semibold" style={{ color: colors.text.heading }}>{p.patientCount}</span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          )}

          {/* Consolidated parent feedback — staff-only; individual review meetings stay confidential */}
          {tab === 'members' && (
            <Panel
              title="Parent Feedback"
              subtitle="Consolidated from review meetings — visible to clinic staff only"
            >
              {totals.parentFeedbackCount > 0 ? (
                <div className="flex flex-wrap gap-8">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: colors.text.dim }}>
                      Communication
                    </p>
                    {totals.avgParentRating != null ? (
                      <div className="flex items-center gap-2">
                        <StarRating value={Math.round(totals.avgParentRating)} readOnly />
                        <span className="text-sm font-semibold" style={{ color: colors.text.primary }}>
                          {totals.avgParentRating.toFixed(1)}/5
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm" style={{ color: colors.text.dim }}>—</span>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: colors.text.dim }}>
                      Perceived progress
                    </p>
                    <span className="text-lg font-bold" style={{ color: colors.text.primary }}>
                      <Metric value={totals.avgParentProgressPct} suffix="%" empty="—" />
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: colors.text.dim }}>
                      Based on
                    </p>
                    <span className="text-sm" style={{ color: colors.text.muted }}>
                      {totals.parentFeedbackCount} review{totals.parentFeedbackCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-sm" style={{ color: colors.text.dim }}>No parent feedback in this window yet.</p>
              )}
            </Panel>
          )}

          {/* Caseload table */}
          {tab === 'members' && caseloadQuery.data && (
            <Panel
              title="Caseload"
              subtitle="Stalled patients first"
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr style={{ color: colors.text.dim }}>
                      <th className="pb-2 pr-4 text-left text-xs font-semibold uppercase tracking-wider">Patient</th>
                      <th className="pb-2 pr-4 text-left text-xs font-semibold uppercase tracking-wider">Trend</th>
                      <th className="pb-2 pr-4 text-right text-xs font-semibold uppercase tracking-wider">Mastery</th>
                      <th className="pb-2 pr-4 text-right text-xs font-semibold uppercase tracking-wider">Change</th>
                      <th className="pb-2 pr-4 text-right text-xs font-semibold uppercase tracking-wider">Sessions</th>
                      <th className="pb-2 pr-4 text-right text-xs font-semibold uppercase tracking-wider">Coverage</th>
                      <th className="pb-2 text-right text-xs font-semibold uppercase tracking-wider">Goals</th>
                    </tr>
                  </thead>
                  <tbody>
                    {caseloadQuery.data.patients.map(p => (
                      <tr key={p.patientId} style={{ borderTop: `1px solid ${border.divider}` }}>
                        <td className="py-2.5 pr-4" style={{ color: colors.text.primary }}>
                          {p.patientName}
                          {p.plateau && (
                            <span
                              className="ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase"
                              style={{ background: `${colors.status.warning}1F`, color: colors.status.warning }}
                            >
                              Plateau
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 pr-4">
                          <Sparkline
                            values={p.spark} min={SPARK_MIN} max={SPARK_MAX} width={90} height={28}
                            stroke={p.plateau ? colors.status.warning : colors.accent}
                            label={`${p.patientName} mastery trend`}
                          />
                        </td>
                        <td className="py-2.5 pr-4 text-right" style={{ color: colors.text.primary, fontVariantNumeric: 'tabular-nums' }}>
                          <Metric value={p.masteryPct} suffix="%" empty="—" />
                        </td>
                        <td className="py-2.5 pr-4 text-right text-xs" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          <Delta pts={p.deltaPts} />
                        </td>
                        <td className="py-2.5 pr-4 text-right" style={{ color: colors.text.muted, fontVariantNumeric: 'tabular-nums' }}>
                          {p.sessionsCompleted}/{p.sessionsScheduled}
                        </td>
                        <td className="py-2.5 pr-4 text-right" style={{ color: colors.text.muted, fontVariantNumeric: 'tabular-nums' }}>
                          <Metric value={p.coveragePct} suffix="%" empty="—" />
                        </td>
                        <td className="py-2.5 text-right" style={{ color: colors.text.muted, fontVariantNumeric: 'tabular-nums' }}>
                          {p.goalsCompleted}/{p.goalsTotal}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {caseloadQuery.data.patients.length === 0 && (
                <p className="py-6 text-center text-sm" style={{ color: colors.text.dim }}>
                  No patients on this therapist's caseload in the selected window.
                </p>
              )}
            </Panel>
          )}
        </div>
      )}
    </div>
  )
}
