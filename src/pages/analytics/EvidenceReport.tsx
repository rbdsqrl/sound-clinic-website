import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { analyticsApi } from '../../api/analytics'
import { Panel } from './components'
import { Badge } from '../../components/ui/Badge'
import { PageLoader } from '../../components/ui/Spinner'
import { reasonLabel } from '../patients/GoalEvidence'
import { exportRowsAsCsv } from '../../lib/exportCsv'
import { colors, border, surface, styles } from '../../theme'

type View = 'therapist' | 'monthly' | 'child'
const VIEWS: { key: View; label: string }[] = [
  { key: 'therapist', label: 'By therapist' },
  { key: 'monthly',   label: 'Month by month' },
  { key: 'child',     label: 'By child' },
]

const monthLabel = (m: string) => format(parseISO(`${m}-01`), 'MMM yyyy')
const TH = 'pb-2 pr-4 text-xs font-semibold uppercase tracking-wider'
const NUM = { color: colors.text.muted, fontVariantNumeric: 'tabular-nums' as const }
const NUM_STRONG = { color: colors.text.primary, fontVariantNumeric: 'tabular-nums' as const }

/**
 * Goal completion and video-evidence compliance for the selected window — by therapist, month by
 * month, or by child — including how often, and why, a therapist couldn't upload a video, so
 * tooling problems can be told apart from habits.
 */
export default function EvidenceReport({ from, to }: { from: string; to: string }) {
  const [view, setView] = useState<View>('therapist')

  const therapistQ = useQuery({ queryKey: ['analytics', 'evidence', from, to], queryFn: () => analyticsApi.evidence(from, to), enabled: view === 'therapist' })
  const monthlyQ   = useQuery({ queryKey: ['analytics', 'evidence-monthly', from, to], queryFn: () => analyticsApi.evidenceMonthly(from, to), enabled: view === 'monthly' })
  const childQ     = useQuery({ queryKey: ['analytics', 'evidence-child', from, to], queryFn: () => analyticsApi.evidenceByChild(from, to), enabled: view === 'child' })

  const required = (view === 'therapist' ? therapistQ.data : view === 'monthly' ? monthlyQ.data : childQ.data)?.videosRequired
  const loading = view === 'therapist' ? therapistQ.isLoading : view === 'monthly' ? monthlyQ.isLoading : childQ.isLoading

  const exportButton = (disabled: boolean, onClick: () => void) => (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-40"
      style={{ background: surface.rowHover, color: colors.text.primary }}
    >
      <Download size={14} /> Export
    </button>
  )

  const therapistRows = therapistQ.data?.rows ?? []
  const monthly = monthlyQ.data
  const childRows = childQ.data?.rows ?? []

  const exportCurrent = () => {
    if (view === 'therapist') {
      exportRowsAsCsv(`video-evidence_${from}_to_${to}.csv`, therapistRows, [
        { header: 'Therapist', value: r => r.therapistName },
        { header: 'Goals Completed', value: r => r.goalsCompleted },
        { header: 'With Video', value: r => r.goalsWithVideo },
        { header: "Couldn't Upload (reason recorded)", value: r => r.goalsCannotUpload },
        { header: 'No Evidence', value: r => r.goalsWithoutEvidence },
        { header: 'Compliance %', value: r => r.compliancePct ?? '' },
        { header: 'Videos Uploaded', value: r => r.videosUploaded },
        { header: "Couldn't-Upload Records", value: r => r.cannotUploadRecords },
        { header: 'Reasons', value: r => r.reasons.map(x => `${reasonLabel(x.reason)} x${x.count}`).join('; ') },
      ])
    } else if (view === 'monthly' && monthly) {
      exportRowsAsCsv(`goal-completion-monthly_${from}_to_${to}.csv`, monthly.rows, [
        { header: 'Therapist', value: r => r.therapistName },
        ...monthly.months.flatMap((m, i) => [
          { header: `${monthLabel(m)} - Goals Completed`, value: (r: typeof monthly.rows[number]) => r.months[i].goalsCompleted },
          { header: `${monthLabel(m)} - With Video`, value: (r: typeof monthly.rows[number]) => r.months[i].goalsWithVideo },
          { header: `${monthLabel(m)} - Couldn't Upload`, value: (r: typeof monthly.rows[number]) => r.months[i].goalsCannotUpload },
          { header: `${monthLabel(m)} - No Evidence`, value: (r: typeof monthly.rows[number]) => r.months[i].goalsWithoutEvidence },
        ]),
      ])
    } else if (view === 'child') {
      exportRowsAsCsv(`video-evidence-by-child_${from}_to_${to}.csv`, childRows, [
        { header: 'Child', value: r => r.patientName },
        { header: 'Therapies', value: r => r.therapies.join('; ') },
        { header: 'Active Goals', value: r => r.activeGoals },
        { header: 'Goals Completed', value: r => r.goalsCompleted },
        { header: 'With Video', value: r => r.goalsWithVideo },
        { header: "Couldn't Upload", value: r => r.goalsCannotUpload },
        { header: 'No Evidence', value: r => r.goalsWithoutEvidence },
        { header: 'Videos Uploaded', value: r => r.videosUploaded },
        { header: 'Sessions Completed', value: r => r.sessionsCompleted },
      ])
    }
  }
  const exportDisabled = view === 'therapist' ? therapistRows.length === 0 : view === 'monthly' ? !monthly?.rows.length : childRows.length === 0

  return (
    <Panel
      title="Video Evidence"
      subtitle={`Goals completed in the window and whether each has video evidence${required === undefined ? '' : ` (${required === 0 ? 'optional' : `${required} per goal required`})`}. Goals completed before evidence tracking began show under No evidence.`}
      action={
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-full p-0.5" style={styles.segmentTrack}>
            {VIEWS.map(v => (
              <button
                key={v.key}
                type="button"
                onClick={() => setView(v.key)}
                className="rounded-full px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap"
                style={view === v.key ? styles.segmentActive : styles.segmentInactive}
              >
                {v.label}
              </button>
            ))}
          </div>
          {exportButton(exportDisabled, exportCurrent)}
        </div>
      }
    >
      {loading ? (
        <PageLoader />
      ) : view === 'therapist' ? (
        therapistRows.length === 0 ? (
          <p className="py-8 text-center text-sm" style={{ color: colors.text.dim }}>No therapists yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr style={{ color: colors.text.dim }}>
                  <th className={`${TH} text-left`}>Therapist</th>
                  <th className={`${TH} text-right`}>Goals Completed</th>
                  <th className={`${TH} text-right`}>With Video</th>
                  <th className={`${TH} text-right`}>Couldn't Upload</th>
                  <th className={`${TH} text-right`}>No Evidence</th>
                  <th className={`${TH} text-right`}>Compliance</th>
                  <th className={`${TH} text-right`}>Videos Uploaded</th>
                  <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wider">Reasons</th>
                </tr>
              </thead>
              <tbody>
                {therapistRows.map(r => (
                  <tr key={r.therapistId} style={{ borderTop: `1px solid ${border.divider}` }}>
                    <td className="py-2.5 pr-4 font-medium" style={{ color: colors.text.primary }}>{r.therapistName}</td>
                    <td className="py-2.5 pr-4 text-right" style={NUM_STRONG}>{r.goalsCompleted}</td>
                    <td className="py-2.5 pr-4 text-right" style={NUM}>{r.goalsWithVideo}</td>
                    <td className="py-2.5 pr-4 text-right" style={NUM}>{r.goalsCannotUpload}</td>
                    <td className="py-2.5 pr-4 text-right" style={NUM}>{r.goalsWithoutEvidence}</td>
                    <td className="py-2.5 pr-4 text-right font-medium" style={NUM_STRONG}>{r.compliancePct === null ? '—' : `${r.compliancePct}%`}</td>
                    <td className="py-2.5 pr-4 text-right" style={NUM}>{r.videosUploaded}</td>
                    <td className="py-2.5">
                      {r.reasons.length === 0 ? (
                        <span style={{ color: colors.text.dim }}>—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {r.reasons.map(x => <Badge key={x.reason} variant="amber">{reasonLabel(x.reason)} · {x.count}</Badge>)}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : view === 'monthly' ? (
        !monthly || monthly.rows.length === 0 ? (
          <p className="py-8 text-center text-sm" style={{ color: colors.text.dim }}>No therapists yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 180 + monthly.months.length * 110 }}>
              <thead>
                <tr style={{ color: colors.text.dim }}>
                  <th className={`${TH} text-left`}>Therapist</th>
                  {monthly.months.map(m => <th key={m} className={`${TH} text-right`}>{monthLabel(m)}</th>)}
                  <th className="pb-2 text-right text-xs font-semibold uppercase tracking-wider">Total</th>
                </tr>
              </thead>
              <tbody>
                {monthly.rows.map(r => {
                  const total = r.months.reduce((a, c) => a + c.goalsCompleted, 0)
                  const totalVideo = r.months.reduce((a, c) => a + c.goalsWithVideo, 0)
                  return (
                    <tr key={r.therapistId} style={{ borderTop: `1px solid ${border.divider}` }}>
                      <td className="py-2.5 pr-4 font-medium" style={{ color: colors.text.primary }}>{r.therapistName}</td>
                      {r.months.map(c => (
                        <td key={c.month} className="py-2.5 pr-4 text-right align-top" style={NUM_STRONG}>
                          {c.goalsCompleted}
                          {c.goalsCompleted > 0 && (
                            <span className="block text-[11px] font-normal" style={{ color: colors.text.dim }}>
                              {c.goalsWithVideo} with video
                            </span>
                          )}
                        </td>
                      ))}
                      <td className="py-2.5 text-right align-top font-medium" style={NUM_STRONG}>
                        {total}
                        {total > 0 && <span className="block text-[11px] font-normal" style={{ color: colors.text.dim }}>{totalVideo} with video</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      ) : childRows.length === 0 ? (
        <p className="py-8 text-center text-sm" style={{ color: colors.text.dim }}>No goals or evidence for this window.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr style={{ color: colors.text.dim }}>
                <th className={`${TH} text-left`}>Child</th>
                <th className={`${TH} text-left`}>Therapies</th>
                <th className={`${TH} text-right`}>Active Goals</th>
                <th className={`${TH} text-right`}>Completed</th>
                <th className={`${TH} text-right`}>With Video</th>
                <th className={`${TH} text-right`}>Couldn't Upload</th>
                <th className={`${TH} text-right`}>No Evidence</th>
                <th className={`${TH} text-right`}>Videos Uploaded</th>
                <th className="pb-2 text-right text-xs font-semibold uppercase tracking-wider">Sessions Completed</th>
              </tr>
            </thead>
            <tbody>
              {childRows.map(r => (
                <tr key={r.patientId} style={{ borderTop: `1px solid ${border.divider}` }}>
                  <td className="py-2.5 pr-4 font-medium" style={{ color: colors.text.primary }}>{r.patientName}</td>
                  <td className="py-2.5 pr-4">
                    {r.therapies.length === 0 ? <span style={{ color: colors.text.dim }}>—</span> : (
                      <div className="flex flex-wrap gap-1.5">{r.therapies.map(t => <Badge key={t} variant="teal">{t}</Badge>)}</div>
                    )}
                  </td>
                  <td className="py-2.5 pr-4 text-right" style={NUM}>{r.activeGoals}</td>
                  <td className="py-2.5 pr-4 text-right" style={NUM_STRONG}>{r.goalsCompleted}</td>
                  <td className="py-2.5 pr-4 text-right" style={NUM}>{r.goalsWithVideo}</td>
                  <td className="py-2.5 pr-4 text-right" style={NUM}>{r.goalsCannotUpload}</td>
                  <td className="py-2.5 pr-4 text-right" style={NUM}>{r.goalsWithoutEvidence}</td>
                  <td className="py-2.5 pr-4 text-right" style={NUM}>{r.videosUploaded}</td>
                  <td className="py-2.5 text-right" style={NUM}>{r.sessionsCompleted}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}
