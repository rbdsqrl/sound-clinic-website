import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { LogIn, LogOut, CheckCircle2, Clock } from 'lucide-react'
import { attendanceApi } from '../../api/attendance'
import { colors, accentAlpha, successAlpha, dangerAlpha } from '../../theme'
import { ROUTES } from '../../lib/routes'
import { formatTime } from '../../lib/format'

export default function AttendanceWidget() {
  const navigate = useNavigate()

  const { data: today, isLoading } = useQuery({
    queryKey: ['attendance', 'today'],
    queryFn: () => attendanceApi.today(),
  })

  if (isLoading) return null

  const checkedIn  = today?.status === 'CHECKED_IN'
  const checkedOut = today?.status === 'CHECKED_OUT'

  return (
    <>
      <div
        className="flex items-center justify-between gap-3 rounded-xl px-4 py-3"
        style={{
          background: checkedOut ? successAlpha(0.08) : checkedIn ? accentAlpha(0.08) : dangerAlpha(0.06),
          border: `1px solid ${checkedOut ? successAlpha(0.2) : checkedIn ? accentAlpha(0.15) : dangerAlpha(0.15)}`,
        }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {checkedOut ? (
            <CheckCircle2 size={16} style={{ color: colors.status.success, flexShrink: 0 }} />
          ) : checkedIn ? (
            <Clock size={16} style={{ color: colors.accent, flexShrink: 0 }} />
          ) : (
            <LogIn size={16} style={{ color: colors.status.error, flexShrink: 0 }} />
          )}

          <div className="min-w-0">
            {checkedOut && (
              <p className="text-sm font-medium truncate" style={{ color: colors.status.success }}>
                Done for today · {today.clinicName}
              </p>
            )}
            {checkedIn && (
              <p className="text-sm font-medium truncate" style={{ color: colors.accent }}>
                Checked in at {formatTime(today.checkInTime)} · {today.clinicName}
              </p>
            )}
            {!today && (
              <p className="text-sm font-medium" style={{ color: colors.status.error }}>
                Not checked in yet
              </p>
            )}
          </div>

          {(checkedIn || checkedOut) && (
            <div className="hidden sm:flex items-center gap-2 flex-shrink-0 ml-1">
              <span
                className="text-[11.5px] font-medium px-2 py-0.5 rounded-full"
                style={{
                  background: today!.geoVerified ? successAlpha(0.15) : dangerAlpha(0.1),
                  color: today!.geoVerified ? colors.status.success : colors.status.error,
                }}
              >
                {today!.geoVerified ? '✓' : '✗'} Geo
              </span>
              <span
                className="text-[11.5px] font-medium px-2 py-0.5 rounded-full"
                style={{
                  background: today!.faceVerified ? successAlpha(0.15) : dangerAlpha(0.1),
                  color: today!.faceVerified ? colors.status.success : colors.status.error,
                }}
              >
                {today!.faceVerified ? '✓' : '✗'} Face
              </span>
            </div>
          )}
        </div>

        {!checkedOut && (
          <button
            onClick={() => navigate(ROUTES.workforce)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg flex-shrink-0 transition-opacity hover:opacity-75 min-h-[32px]"
            style={checkedIn
              ? { background: accentAlpha(0.12), color: colors.accent }
              : { background: dangerAlpha(0.1), color: colors.status.error }
            }
          >
            {checkedIn ? <><LogOut size={12} /> Check Out</> : <><LogIn size={12} /> Check In</>}
          </button>
        )}
      </div>

    </>
  )
}
