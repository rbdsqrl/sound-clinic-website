import { useQuery } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { analyticsApi } from '../../api/analytics'
import { Panel } from './components'
import { Badge } from '../../components/ui/Badge'
import { PageLoader } from '../../components/ui/Spinner'
import { reasonLabel } from '../patients/GoalEvidence'
import { exportRowsAsCsv } from '../../lib/exportCsv'
import { colors, border, surface } from '../../theme'

/**
 * Goal completion and video-evidence compliance per therapist for the selected window — including
 * how often, and why, a therapist couldn't upload a video, so tooling problems can be told apart
 * from habits.
 */
export default function EvidenceReport({ from, to }: { from: string; to: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics', 'evidence', from, to],
    queryFn: () => analyticsApi.evidence(from, to),
  })
  const rows = data?.rows ?? []

  const th = 'pb-2 pr-4 text-xs font-semibold uppercase tracking-wider'
  const num = { color: colors.text.muted, fontVariantNumeric: 'tabular-nums' as const }

  return (
    <Panel
      title="Video Evidence"
      subtitle={data
        ? `Goals completed in the window and whether each has video evidence (${data.videosRequired === 0 ? 'optional' : `${data.videosRequired} per goal required`}). Goals completed before evidence tracking began show under No evidence.`
        : 'Goal completion and video evidence by therapist'}
      action={
        <button
          type="button"
          disabled={rows.length === 0}
          onClick={() => exportRowsAsCsv(`video-evidence_${from}_to_${to}.csv`, rows, [
            { header: 'Therapist', value: r => r.therapistName },
            { header: 'Goals Completed', value: r => r.goalsCompleted },
            { header: 'With Video', value: r => r.goalsWithVideo },
            { header: "Couldn't Upload (reason recorded)", value: r => r.goalsCannotUpload },
            { header: 'No Evidence', value: r => r.goalsWithoutEvidence },
            { header: 'Compliance %', value: r => r.compliancePct ?? '' },
            { header: 'Videos Uploaded', value: r => r.videosUploaded },
            { header: "Couldn't-Upload Records", value: r => r.cannotUploadRecords },
            { header: 'Reasons', value: r => r.reasons.map(x => `${reasonLabel(x.reason)} x${x.count}`).join('; ') },
          ])}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-40"
          style={{ background: surface.rowHover, color: colors.text.primary }}
        >
          <Download size={14} /> Export
        </button>
      }
    >
      {isLoading ? (
        <PageLoader />
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm" style={{ color: colors.text.dim }}>No therapists yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr style={{ color: colors.text.dim }}>
                <th className={`${th} text-left`}>Therapist</th>
                <th className={`${th} text-right`}>Goals Completed</th>
                <th className={`${th} text-right`}>With Video</th>
                <th className={`${th} text-right`}>Couldn't Upload</th>
                <th className={`${th} text-right`}>No Evidence</th>
                <th className={`${th} text-right`}>Compliance</th>
                <th className={`${th} text-right`}>Videos Uploaded</th>
                <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wider">Reasons</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.therapistId} style={{ borderTop: `1px solid ${border.divider}` }}>
                  <td className="py-2.5 pr-4 font-medium" style={{ color: colors.text.primary }}>{r.therapistName}</td>
                  <td className="py-2.5 pr-4 text-right" style={{ color: colors.text.primary, fontVariantNumeric: 'tabular-nums' }}>{r.goalsCompleted}</td>
                  <td className="py-2.5 pr-4 text-right" style={num}>{r.goalsWithVideo}</td>
                  <td className="py-2.5 pr-4 text-right" style={num}>{r.goalsCannotUpload}</td>
                  <td className="py-2.5 pr-4 text-right" style={num}>{r.goalsWithoutEvidence}</td>
                  <td className="py-2.5 pr-4 text-right font-medium" style={{ color: colors.text.primary, fontVariantNumeric: 'tabular-nums' }}>
                    {r.compliancePct === null ? '—' : `${r.compliancePct}%`}
                  </td>
                  <td className="py-2.5 pr-4 text-right" style={num}>{r.videosUploaded}</td>
                  <td className="py-2.5">
                    {r.reasons.length === 0 ? (
                      <span style={{ color: colors.text.dim }}>—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {r.reasons.map(x => (
                          <Badge key={x.reason} variant="amber">{reasonLabel(x.reason)} · {x.count}</Badge>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}
