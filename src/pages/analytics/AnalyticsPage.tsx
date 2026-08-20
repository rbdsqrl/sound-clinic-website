import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { analyticsApi } from '../../api/analytics'
import { patientsApi } from '../../api/patients'
import { usersApi } from '../../api/users'
import MasteryTrendChart from '../../components/charts/MasteryTrendChart'
import OutcomeRibbon from '../../components/charts/OutcomeRibbon'
import Sparkline from '../../components/charts/Sparkline'
import { Select } from '../../components/ui/Select'
import { Users, UserCog } from 'lucide-react'
import { EmptyState } from '../../components/ui/EmptyState'
import { colors, border, styles, surface, radius } from '../../theme'
import type { Granularity, IEPGoalDomain } from '../../types'
import { Delta, Metric, Panel, Tile } from './components'

type TabKey = 'patient' | 'therapist' | 'overview'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'patient',   label: 'Patient Progress' },
  { key: 'therapist', label: 'Therapist Caseload' },
  { key: 'overview',  label: 'Clinic Overview' },
]

const DOMAINS: IEPGoalDomain[] = [
  'AUDITORY', 'SPEECH', 'LANGUAGE', 'SENSORY', 'MOTOR', 'SOCIAL', 'COGNITIVE', 'LITERACY', 'ADAPTIVE',
]

/** Sparklines share this band so domains can be compared against each other, not just themselves. */
const SPARK_MIN = 0
const SPARK_MAX = 100

const iso = (d: Date) => d.toISOString().slice(0, 10)

function defaultWindow(granularity: Granularity) {
  const to = new Date()
  const from = new Date()
  if (granularity === 'DAILY') from.setDate(from.getDate() - 29)
  else if (granularity === 'WEEKLY') from.setDate(from.getDate() - 83)
  else from.setMonth(from.getMonth() - 11)
  return { from: iso(from), to: iso(to) }
}

export default function AnalyticsPage() {
  const [tab, setTab] = useState<TabKey>('patient')
  const [granularity, setGranularity] = useState<Granularity>('WEEKLY')
  const [domain, setDomain] = useState<IEPGoalDomain | ''>('')
  const [patientId, setPatientId] = useState('')
  const [therapistId, setTherapistId] = useState('')
  const [range, setRange] = useState(() => defaultWindow('WEEKLY'))

  // Overview has no daily series — the API rejects it, so the control must not offer it.
  const allowedGranularities: Granularity[] =
    tab === 'overview' ? ['WEEKLY', 'MONTHLY'] : ['DAILY', 'WEEKLY', 'MONTHLY']

  const effectiveGranularity: Granularity =
    allowedGranularities.includes(granularity) ? granularity : 'WEEKLY'

  const changeGranularity = (g: Granularity) => {
    setGranularity(g)
    setRange(defaultWindow(g))
  }

  const params = {
    granularity: effectiveGranularity,
    from: range.from,
    to: range.to,
    ...(domain ? { domain } : {}),
  }

  const patients = useQuery({ queryKey: ['patients'], queryFn: patientsApi.list })
  const staff = useQuery({ queryKey: ['assignable'], queryFn: usersApi.listAssignable })

  const therapists = useMemo(
    () => (staff.data ?? []).filter(u => u.role === 'THERAPIST' || u.role === 'DOCTOR'),
    [staff.data]
  )

  const patientQuery = useQuery({
    queryKey: ['analytics', 'patient', patientId, params],
    queryFn: () => analyticsApi.patientProgress(patientId, params),
    enabled: tab === 'patient' && !!patientId,
  })

  const caseloadQuery = useQuery({
    queryKey: ['analytics', 'therapist', therapistId, params],
    queryFn: () => analyticsApi.therapistCaseload(therapistId, params),
    enabled: tab === 'therapist' && !!therapistId,
  })

  const overviewQuery = useQuery({
    queryKey: ['analytics', 'overview', params],
    queryFn: () => analyticsApi.overview(params),
    enabled: tab === 'overview',
  })

  const activeSeries =
    tab === 'patient' ? patientQuery.data
    : tab === 'therapist' ? caseloadQuery.data?.series
    : overviewQuery.data

  const loading =
    (tab === 'patient' && patientQuery.isLoading) ||
    (tab === 'therapist' && caseloadQuery.isLoading) ||
    (tab === 'overview' && overviewQuery.isLoading)

  const totals = activeSeries?.totals

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-6 lg:p-8">
      <div>
        <h1 className="text-lg font-bold md:text-xl" style={{ color: colors.text.heading }}>Progress Analytics</h1>
        <p className="mt-0.5 text-sm" style={{ color: colors.text.muted }}>
          Daily, weekly and monthly trends from therapist session and IEP goal records
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto border-b" style={{ borderColor: border.divider }}>
        {TABS.map(t => (
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

      {/* Filters — one row above the charts */}
      <div className="flex flex-wrap items-end gap-3">
        {tab === 'patient' && (
          <div className="min-w-[200px]">
            <Select
              label="Patient"
              placeholder="Select a patient"
              value={patientId}
              onChange={e => setPatientId(e.target.value)}
              options={(patients.data ?? []).map(p => ({
                value: p.id,
                label: `${p.firstName} ${p.lastName}`,
              }))}
            />
          </div>
        )}

        {tab === 'therapist' && (
          <div className="min-w-[200px]">
            <Select
              label="Therapist"
              placeholder="Select a therapist"
              value={therapistId}
              onChange={e => setTherapistId(e.target.value)}
              options={therapists.map(t => ({
                value: t.id,
                label: `${t.firstName} ${t.lastName}`,
              }))}
            />
          </div>
        )}

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

        <div className="min-w-[160px]">
          <Select
            label="Domain"
            placeholder="All domains"
            value={domain}
            onChange={e => setDomain(e.target.value as IEPGoalDomain | '')}
            options={DOMAINS.map(d => ({ value: d, label: d.charAt(0) + d.slice(1).toLowerCase() }))}
          />
        </div>

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
      </div>

      {/* Empty prompts */}
      {tab === 'patient' && !patientId && (
        <EmptyState icon={<Users size={22} />} title="Choose a patient" description="Progress trends are built per child." />
      )}
      {tab === 'therapist' && !therapistId && (
        <EmptyState icon={<UserCog size={22} />} title="Choose a therapist" description="Caseload trends are built per therapist." />
      )}

      {loading && (
        <p className="py-8 text-center text-sm" style={{ color: colors.text.muted }}>Loading…</p>
      )}

      {activeSeries && totals && !loading && (
        <div className="space-y-5">
          {/* KPI row */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Tile
              label="Goal mastery"
              value={<Metric value={totals.masteryPct} suffix="%" empty="—" />}
              hint={<Delta pts={totals.masteryDeltaPts} />}
            />
            <Tile
              label="Sessions held"
              value={
                <>
                  {totals.sessionsCompleted}
                  <span style={{ color: colors.text.dim, fontSize: '1.1rem' }}>/{totals.sessionsScheduled}</span>
                </>
              }
              hint={`${totals.sessionsNoShow} no-show · ${totals.sessionsCancelled} cancelled`}
            />
            <Tile
              label="Goals closed"
              value={
                <>
                  {totals.goalsCompleted}
                  <span style={{ color: colors.text.dim, fontSize: '1.1rem' }}>/{totals.goalsTotal}</span>
                </>
              }
              hint={totals.avgParentRating !== null ? `Parent rating ${totals.avgParentRating}/5` : 'No parent ratings yet'}
            />
            <Tile
              label="Data coverage"
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
                    style={{ border: `1px solid ${border.card}`, borderRadius: radius.sm, background: surface.card }}
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

          {/* Caseload table */}
          {tab === 'therapist' && caseloadQuery.data && (
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
