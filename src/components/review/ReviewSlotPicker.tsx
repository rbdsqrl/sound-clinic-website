import { useQuery } from '@tanstack/react-query'
import { Sun, Moon } from 'lucide-react'
import { reviewMeetingsApi } from '../../api/reviewMeetings'
import { formatTimeStr } from '../../lib/format'
import { colors, successAlpha, dangerAlpha } from '../../theme'
import type { ReviewSlotResponse } from '../../types'

/**
 * The org's fixed daily Review Session grid (default 3 morning + 3 evening times, editable in
 * Organisation settings) for the chosen Clinic Head(s) and date — booked slots are struck
 * through and disabled, so a session can never be double-booked. Used by every place a review
 * meeting is scheduled or rescheduled: the enrollment's recurring schedule, an ad-hoc meeting
 * from the Case's Therapy tab, and the Calendar's edit modal.
 */
export function ReviewSlotPicker({
  clinicHeadIds, date, value, onChange, excludeMeetingId, label = 'Time', error,
}: {
  clinicHeadIds: string[]
  date: string
  value: string
  onChange: (time: string) => void
  /** Pass the meeting's own id when rescheduling, so its current slot isn't shown busy against itself. */
  excludeMeetingId?: string
  label?: string
  error?: string
}) {
  const enabled = clinicHeadIds.length > 0 && !!date

  const { data: slots = [], isFetching } = useQuery({
    queryKey: ['review-meetings', 'slots', clinicHeadIds, date, excludeMeetingId],
    queryFn: () => reviewMeetingsApi.getSlots(clinicHeadIds, date, excludeMeetingId),
    enabled,
  })

  const renderGroup = (group: ReviewSlotResponse[], Icon: typeof Sun, groupLabel: string) => (
    <div>
      <p className="text-xs font-medium mb-1.5 uppercase tracking-wider flex items-center gap-1" style={{ color: colors.text.dim }}>
        <Icon size={11} /> {groupLabel}
      </p>
      <div className="flex flex-wrap gap-2">
        {group.map(slot => {
          const time = slot.time.slice(0, 5)
          const selected = value === time
          const disabled = !slot.available && !selected
          return (
            <button
              key={slot.time}
              type="button"
              disabled={disabled}
              onClick={() => onChange(time)}
              title={disabled ? `Busy: ${slot.busyClinicHeadNames.join(', ')}` : undefined}
              className="rounded-xl px-3 py-2 text-sm font-medium transition-all min-w-[76px] min-h-[40px]"
              style={selected
                ? { background: colors.accent, color: '#fff' }
                : disabled
                ? { background: dangerAlpha(0.06), color: colors.text.dim, cursor: 'not-allowed', textDecoration: 'line-through' }
                : { background: successAlpha(0.08), color: colors.text.primary, border: `1px solid ${successAlpha(0.3)}` }
              }
            >
              {formatTimeStr(time)}
            </button>
          )
        })}
      </div>
    </div>
  )

  return (
    <div>
      {label && <label className="form-label mb-2 block">{label}</label>}
      {!enabled ? (
        <p className="text-sm" style={{ color: colors.text.dim }}>
          Pick at least one Clinic Head and a date to see available slots.
        </p>
      ) : isFetching ? (
        <p className="text-sm" style={{ color: colors.text.muted }}>Checking availability…</p>
      ) : slots.length === 0 ? (
        <p className="text-sm" style={{ color: colors.text.dim }}>
          No Review Session slots are configured for this organisation yet.
        </p>
      ) : (
        <div className="space-y-3">
          {(() => {
            const morning = slots.filter(s => Number(s.time.slice(0, 2)) < 12)
            const evening = slots.filter(s => Number(s.time.slice(0, 2)) >= 12)
            return (
              <>
                {morning.length > 0 && renderGroup(morning, Sun, 'Morning')}
                {evening.length > 0 && renderGroup(evening, Moon, 'Evening')}
              </>
            )
          })()}
        </div>
      )}
      {error && <p className="form-error mt-1">{error}</p>}
    </div>
  )
}
