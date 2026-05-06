import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { CalendarDays, Plus, CheckCircle2, XCircle, Clock4 } from 'lucide-react'
import { format, parseISO, isAfter, startOfDay } from 'date-fns'
import { appointmentsApi } from '../../api/appointments'
import { Button } from '../../components/ui/Button'
import { PageLoader } from '../../components/ui/Spinner'
import { useToast } from '../../hooks/useToast'
import { useAuth } from '../../contexts/AuthContext'
import { colors, styles, border, surface, paletteStyle } from '../../theme'
import type { AppointmentResponse, AppointmentStatus } from '../../types'

const STATUS_CONFIG: Record<AppointmentStatus, { label: string; style: React.CSSProperties; icon: React.ElementType }> = {
  PENDING:   { label: 'Pending',   icon: Clock4,       style: paletteStyle('yellow') },
  CONFIRMED: { label: 'Confirmed', icon: CheckCircle2, style: paletteStyle('green')  },
  CANCELLED: { label: 'Cancelled', icon: XCircle,      style: paletteStyle('slate')  },
  COMPLETED: { label: 'Completed', icon: CheckCircle2, style: paletteStyle('teal')   },
}

type FilterTab = 'upcoming' | 'past' | 'all'

export default function AppointmentsPage() {
  const { activeRole } = useAuth()
  const qc = useQueryClient()
  const { toast } = useToast()
  const [tab, setTab] = useState<FilterTab>('upcoming')

  const navigate = useNavigate()
  const isParent     = activeRole === 'PARENT'
  const isTherapist  = activeRole === 'THERAPIST' || activeRole === 'DOCTOR'
  const isOwner      = activeRole === 'BUSINESS_OWNER' || activeRole === 'ADMIN'

  const { data: appointments, isLoading } = useQuery({
    queryKey: ['appointments'],
    queryFn: appointmentsApi.list,
  })

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AppointmentStatus }) =>
      appointmentsApi.updateStatus(id, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['appointments'] }); toast('Status updated', 'success') },
    onError: () => toast('Failed to update status', 'error'),
  })

  const today = startOfDay(new Date())

  const filtered = (appointments ?? []).filter(a => {
    const apptDay = startOfDay(parseISO(a.appointmentDate))
    if (tab === 'upcoming') return isAfter(apptDay, today) || apptDay.getTime() === today.getTime()
    if (tab === 'past') return apptDay < today
    return true
  })

  const grouped = filtered.reduce<Record<string, AppointmentResponse[]>>((acc, a) => {
    const key = a.appointmentDate
    if (!acc[key]) acc[key] = []
    acc[key].push(a)
    return acc
  }, {})

  const sortedDates = Object.keys(grouped).sort()

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: colors.text.heading }}>Appointments</h1>
          <p className="mt-1 text-sm" style={{ color: colors.text.dim }}>
            {isParent     && 'Appointments booked for your children'}
            {isTherapist  && 'Your upcoming sessions'}
            {isOwner      && 'All appointments across your organisation'}
          </p>
        </div>
        {isParent && (
          <Button onClick={() => navigate('/appointments/book')}>
            <Plus size={16} /> Book Appointment
          </Button>
        )}
      </div>

      {/* Tab filter */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: surface.filterStrip, border: border.card }}>
        {(['upcoming','past','all'] as FilterTab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-all"
            style={tab === t ? styles.filterTabActive : styles.filterTabInactive}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Content */}
      {sortedDates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center" style={styles.card}>
          <div className="rounded-2xl p-5 mb-4" style={styles.emptyIcon}>
            <CalendarDays size={32} />
          </div>
          <p className="text-base font-semibold" style={{ color: colors.text.primary }}>No appointments</p>
          <p className="mt-1 text-sm" style={{ color: colors.text.dim }}>
            {isParent ? 'Book your first appointment below.' : 'Nothing here yet.'}
          </p>
          {isParent && (
            <div className="mt-4">
              <Button><Link to="/appointments/book" style={{ color: 'inherit', textDecoration: 'none' }}><Plus size={14} style={{ display:'inline', marginRight:4 }} />Book Appointment</Link></Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {sortedDates.map(date => (
            <div key={date}>
              {/* Date header */}
              <div className="flex items-center gap-3 mb-3">
                <p className="text-sm font-semibold" style={{ color: colors.text.muted }}>
                  {format(parseISO(date), 'EEEE, MMMM d, yyyy')}
                </p>
                <div className="flex-1 h-px" style={{ background: border.divider }} />
              </div>

              {/* Appointment cards */}
              <div className="space-y-2">
                {grouped[date]
                  .sort((a,b) => a.startTime.localeCompare(b.startTime))
                  .map(appt => (
                    <AppointmentCard
                      key={appt.id}
                      appt={appt}
                      isParent={isParent}
                      isTherapist={isTherapist}
                      isOwner={isOwner}
                      onUpdateStatus={(status) => statusMut.mutate({ id: appt.id, status })}
                      updating={statusMut.isPending}
                    />
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Appointment Card ──────────────────────────────────────────────────────────

function AppointmentCard({
  appt, isParent, isTherapist, isOwner, onUpdateStatus, updating
}: {
  appt: AppointmentResponse
  isParent: boolean
  isTherapist: boolean
  isOwner: boolean
  onUpdateStatus: (s: AppointmentStatus) => void
  updating: boolean
}) {
  const cfg = STATUS_CONFIG[appt.status]
  const StatusIcon = cfg.icon
  const isFuture = isAfter(startOfDay(parseISO(appt.appointmentDate)), startOfDay(new Date()))
                   || startOfDay(parseISO(appt.appointmentDate)).getTime() === startOfDay(new Date()).getTime()
  const canAct = isFuture && appt.status !== 'CANCELLED' && appt.status !== 'COMPLETED'

  return (
    <div className="rounded-2xl p-4 transition-all" style={styles.card}>
      <div className="flex items-start gap-4">
        {/* Time block */}
        <div className="flex-shrink-0 rounded-xl px-3 py-2 text-center min-w-[68px]" style={styles.timeBlock}>
          <p className="text-sm font-bold" style={{ color: colors.accent }}>{appt.startTime.slice(0,5)}</p>
          <p className="text-[10px]"       style={{ color: colors.text.dim }}>→ {appt.endTime.slice(0,5)}</p>
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <p className="font-semibold" style={{ color: colors.text.primary }}>
                {appt.patientFirstName} {appt.patientLastName}
              </p>
              <p className="text-sm" style={{ color: colors.text.muted }}>
                with {appt.therapistFirstName} {appt.therapistLastName}
                <span style={{ color: colors.text.dim }}> · {appt.clinicName}</span>
              </p>
            </div>
            <span className="flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium flex-shrink-0"
              style={cfg.style}>
              <StatusIcon size={11} />
              {cfg.label}
            </span>
          </div>

          {appt.notes && (
            <p className="mt-2 text-xs italic" style={{ color: colors.text.dim }}>{appt.notes}</p>
          )}

          {/* Action buttons */}
          {canAct && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {isTherapist && appt.status === 'PENDING' && (
                <button
                  onClick={() => onUpdateStatus('CONFIRMED')}
                  disabled={updating}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition-all"
                  style={paletteStyle('green', 0.08)}
                >
                  <CheckCircle2 size={12} /> Confirm
                </button>
              )}
              {(isTherapist || isParent || isOwner) && (
                <button
                  onClick={() => onUpdateStatus('CANCELLED')}
                  disabled={updating}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition-all"
                  style={paletteStyle('red', 0.08)}
                >
                  <XCircle size={12} /> Cancel
                </button>
              )}
              {isTherapist && appt.status === 'CONFIRMED' && (
                <button
                  onClick={() => onUpdateStatus('COMPLETED')}
                  disabled={updating}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition-all"
                  style={paletteStyle('teal', 0.08)}
                >
                  <CheckCircle2 size={12} /> Mark Complete
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
