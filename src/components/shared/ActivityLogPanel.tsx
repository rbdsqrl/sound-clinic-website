import { useQuery } from '@tanstack/react-query'
import { auditLogApi, type AuditSubjectType } from '../../api/auditLog'
import { formatDateTimeStr } from '../../lib/format'
import { colors, border, styles } from '../../theme'

/** Accent colour of an entry's marker, by what kind of thing happened. */
function tone(type: string): string {
  if (type.includes('DEACTIVATED') || type.endsWith('_REMOVED') || type.endsWith('_UNLINKED')
    || type.endsWith('_UNASSIGNED') || type.endsWith('_CANCELLED')) return colors.status.danger
  if (type.includes('REACTIVATED') || type === 'JOINED' || type === 'CASE_CREATED') return colors.status.success
  if (type === 'INVITED' || type === 'PARENT_INVITED') return colors.status.info
  if (type.includes('REASSIGN') || type === 'THERAPIST_CHANGED') return colors.status.warning
  return colors.accent
}

/**
 * Who changed what on a member, parent or case. Only mounted once its tab is opened, so the
 * request is made on demand rather than with the page. Shown to the Business Owner only — the
 * API enforces the same.
 */
export function ActivityLogPanel({ subjectType, subjectId }: { subjectType: AuditSubjectType; subjectId: string }) {
  const { data: entries = [], isLoading, isError } = useQuery({
    queryKey: ['audit-log', subjectType, subjectId],
    queryFn: () => auditLogApi.list(subjectType, subjectId),
    staleTime: 0,
  })

  return (
    <div className="rounded-2xl p-4 sm:p-5" style={styles.card}>
      <div className="mb-3">
        <h2 className="text-base font-semibold" style={{ color: colors.text.primary }}>Activity Log</h2>
        <p className="text-xs" style={{ color: colors.text.muted }}>
          Changes made to this {subjectType === 'CASE' ? 'case' : 'profile'}, and who made them
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <div className="h-5 w-5 animate-spin rounded-full border-2" style={{ borderColor: `${colors.accent}30`, borderTopColor: colors.accent }} />
        </div>
      ) : isError ? (
        <p className="text-sm text-center py-10" style={{ color: colors.text.dim }}>
          Could not load the activity log. Please try again.
        </p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-center py-10" style={{ color: colors.text.dim }}>
          No activity recorded yet — edits, invitations and assignments will show up here from now on.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {entries.map(e => (
            <div key={e.id} className="rounded-xl p-3 flex gap-3" style={{ border: border.card }}>
              <span className="mt-1.5 h-2 w-2 rounded-full flex-shrink-0" style={{ background: tone(e.type) }} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium" style={{ color: colors.text.primary }}>{e.summary}</p>
                  <p className="text-xs flex-shrink-0" style={{ color: colors.text.dim }}>{formatDateTimeStr(e.createdAt)}</p>
                </div>
                <p className="text-xs mt-0.5" style={{ color: colors.text.dim }}>by {e.actorName}</p>
                {e.changes.length > 0 && (
                  <div className="mt-2 flex flex-col gap-1.5">
                    {e.changes.map((c, i) => (
                      <div key={`${c.field}-${i}`} className="text-xs break-words whitespace-pre-wrap">
                        <span className="font-medium" style={{ color: colors.text.muted }}>{c.field}: </span>
                        <span style={{ color: colors.text.dim }}>{c.from ?? '—'}</span>
                        <span style={{ color: colors.text.dim }}> → </span>
                        <span style={{ color: colors.text.primary }}>{c.to ?? '—'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
