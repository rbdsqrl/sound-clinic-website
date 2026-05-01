import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, CalendarCheck, Loader2 } from 'lucide-react'
import {
  format, addWeeks, subWeeks, startOfWeek, addDays,
  isBefore, startOfDay, parseISO,
} from 'date-fns'
import { patientsApi } from '../../api/patients'
import { slotsApi, appointmentsApi } from '../../api/appointments'
import { Button } from '../../components/ui/Button'
import { PageLoader } from '../../components/ui/Spinner'
import { useToast } from '../../hooks/useToast'
import type { DayOfWeek, PatientResponse, SlotResponse } from '../../types'

const JS_DOW_TO_JAVA: Record<number, DayOfWeek> = {
  0: 'SUNDAY', 1: 'MONDAY', 2: 'TUESDAY', 3: 'WEDNESDAY',
  4: 'THURSDAY', 5: 'FRIDAY', 6: 'SATURDAY',
}

function toHHMM(time: string) { return time.slice(0, 5) }

function generateTimes(slot: SlotResponse): string[] {
  const times: string[] = []
  const [sh, sm] = slot.startTime.split(':').map(Number)
  const [eh, em] = slot.endTime.split(':').map(Number)
  let cur = sh * 60 + sm
  const end = eh * 60 + em
  while (cur + slot.slotDurationMinutes <= end) {
    const h = Math.floor(cur / 60).toString().padStart(2, '0')
    const m = (cur % 60).toString().padStart(2, '0')
    times.push(`${h}:${m}`)
    cur += slot.slotDurationMinutes
  }
  return times
}

// ── Step types ────────────────────────────────────────────────────────────────
type Step = 'patient' | 'therapist' | 'slot' | 'confirm'

export default function BookAppointmentPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { toast } = useToast()

  const [step, setStep] = useState<Step>('patient')
  const [selectedPatient, setSelectedPatient] = useState<PatientResponse | null>(null)
  const [selectedTherapistId, setSelectedTherapistId] = useState<string>('')
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [selectedDate, setSelectedDate] = useState<string>('')   // "YYYY-MM-DD"
  const [selectedTime, setSelectedTime] = useState<string>('')   // "HH:mm"
  const [notes, setNotes] = useState('')

  // Data
  const { data: myChildren, isLoading: loadingChildren } = useQuery({
    queryKey: ['my-children'],
    queryFn: patientsApi.myChildren,
  })
  const { data: slots, isLoading: loadingSlots } = useQuery({
    queryKey: ['slots', selectedTherapistId],
    queryFn: () => slotsApi.list(selectedTherapistId || undefined),
    enabled: !!selectedTherapistId,
  })
  const { data: existingAppts, isLoading: loadingAppts } = useQuery({
    queryKey: ['appointments'],
    queryFn: appointmentsApi.list,
    enabled: !!selectedTherapistId,
  })

  const bookMut = useMutation({
    mutationFn: () => appointmentsApi.book({
      patientId: selectedPatient!.id,
      therapistId: selectedTherapistId,
      appointmentDate: selectedDate,
      startTime: selectedTime,
      notes: notes || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointments'] })
      toast('Appointment booked!', 'success')
      navigate('/appointments')
    },
    onError: () => toast('Could not book — that slot may already be taken.', 'error'),
  })

  // Compute week days
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  // Build availability: for each day in week, which times are available
  const availability = useMemo(() => {
    if (!slots) return {}
    const bookedKeys = new Set(
      (existingAppts ?? [])
        .filter(a => a.therapistId === selectedTherapistId && a.status !== 'CANCELLED')
        .map(a => `${a.appointmentDate}|${a.startTime.slice(0,5)}`)
    )

    const result: Record<string, string[]> = {}
    weekDays.forEach(day => {
      const dateStr = format(day, 'yyyy-MM-dd')
      if (isBefore(startOfDay(day), startOfDay(new Date()))) return
      const javaDow = JS_DOW_TO_JAVA[day.getDay()]
      const daySlots = slots.filter(s => s.dayOfWeek === javaDow)
      const times: string[] = []
      daySlots.forEach(s => {
        generateTimes(s).forEach(t => {
          if (!bookedKeys.has(`${dateStr}|${t}`)) times.push(t)
        })
      })
      if (times.length > 0) result[dateStr] = [...new Set(times)].sort()
    })
    return result
  }, [slots, existingAppts, weekDays, selectedTherapistId])

  const selectedTherapist = selectedPatient?.therapists.find(t => t.id === selectedTherapistId)
  const today = startOfDay(new Date())

  if (loadingChildren) return <PageLoader />

  // ── Step: choose patient ──────────────────────────────────────────────────
  if (step === 'patient') {
    return (
      <div className="space-y-6 max-w-2xl">
        <StepHeader step={1} title="Select a patient" subtitle="Which child is this appointment for?" />
        {(!myChildren || myChildren.length === 0) ? (
          <EmptyBlock message="No patients linked to your account." />
        ) : (
          <div className="grid gap-3">
            {myChildren.map(child => (
              <button
                key={child.id}
                onClick={() => { setSelectedPatient(child); setStep('therapist') }}
                className="w-full text-left rounded-2xl p-4 transition-all"
                style={{ background: 'rgba(10,22,40,0.7)', border: '1px solid rgba(255,255,255,0.06)' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,180,216,0.3)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)'}
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold"
                    style={{ background: 'rgba(168,85,247,0.1)', color: '#c084fc' }}>
                    {child.firstName[0]}{child.lastName[0]}
                  </div>
                  <div>
                    <p className="font-medium" style={{ color: '#C8D8F0' }}>{child.firstName} {child.lastName}</p>
                    <p className="text-xs" style={{ color: '#3E5070' }}>
                      {child.therapists.length} therapist{child.therapists.length !== 1 ? 's' : ''}
                      {child.conditions.length > 0 && ` · ${child.conditions.length} condition${child.conditions.length !== 1 ? 's' : ''}`}
                    </p>
                  </div>
                  <ChevronRight size={16} className="ml-auto" style={{ color: '#3E5070' }} />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── Step: choose therapist ────────────────────────────────────────────────
  if (step === 'therapist') {
    return (
      <div className="space-y-6 max-w-2xl">
        <BackButton onBack={() => setStep('patient')} />
        <StepHeader step={2} title="Select a therapist" subtitle={`Who is ${selectedPatient?.firstName} seeing?`} />
        {selectedPatient?.therapists.length === 0 ? (
          <EmptyBlock message="No therapists are assigned to this patient yet." />
        ) : (
          <div className="grid gap-3">
            {selectedPatient?.therapists.map(t => (
              <button
                key={t.id}
                onClick={() => { setSelectedTherapistId(t.id); setStep('slot') }}
                className="w-full text-left rounded-2xl p-4 transition-all"
                style={{ background: 'rgba(10,22,40,0.7)', border: '1px solid rgba(255,255,255,0.06)' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,180,216,0.3)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)'}
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold"
                    style={{ background: 'rgba(0,180,216,0.1)', color: '#00b4d8' }}>
                    {t.firstName[0]}{t.lastName[0]}
                  </div>
                  <div>
                    <p className="font-medium" style={{ color: '#C8D8F0' }}>{t.firstName} {t.lastName}</p>
                    <p className="text-xs" style={{ color: '#3E5070' }}>Therapist</p>
                  </div>
                  <ChevronRight size={16} className="ml-auto" style={{ color: '#3E5070' }} />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── Step: choose slot ─────────────────────────────────────────────────────
  if (step === 'slot') {
    const hasAnySlot = Object.keys(availability).length > 0
    return (
      <div className="space-y-6">
        <BackButton onBack={() => setStep('therapist')} />
        <StepHeader
          step={3}
          title="Choose a time"
          subtitle={`${selectedTherapist?.firstName}'s availability for the week`}
        />

        {/* Week nav */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setWeekStart(w => subWeeks(w, 1))}
            disabled={isBefore(startOfDay(subWeeks(weekStart, 1)), today)}
            className="rounded-xl p-2 transition-colors disabled:opacity-30"
            style={{ background: 'rgba(255,255,255,0.04)', color: '#6B82A8', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <ChevronLeft size={16} />
          </button>
          <p className="text-sm font-medium" style={{ color: '#C8D8F0' }}>
            {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d, yyyy')}
          </p>
          <button
            onClick={() => setWeekStart(w => addWeeks(w, 1))}
            className="rounded-xl p-2 transition-colors"
            style={{ background: 'rgba(255,255,255,0.04)', color: '#6B82A8', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {loadingSlots || loadingAppts ? (
          <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin" style={{ color: '#00b4d8' }} /></div>
        ) : !hasAnySlot ? (
          <EmptyBlock message="No availability this week. Try the next week." />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
            {weekDays.map(day => {
              const dateStr = format(day, 'yyyy-MM-dd')
              const times = availability[dateStr] ?? []
              const isPast = isBefore(startOfDay(day), today)
              return (
                <div key={dateStr} className="rounded-xl overflow-hidden"
                  style={{ background: 'rgba(10,22,40,0.7)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="px-3 py-2.5 text-center" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#3E5070' }}>
                      {format(day, 'EEE')}
                    </p>
                    <p className="text-lg font-bold mt-0.5" style={{ color: isPast ? '#3E5070' : '#C8D8F0' }}>
                      {format(day, 'd')}
                    </p>
                  </div>
                  <div className="p-2 space-y-1">
                    {isPast || times.length === 0 ? (
                      <p className="text-center text-[11px] py-3" style={{ color: '#3E5070' }}>
                        {isPast ? '—' : 'No slots'}
                      </p>
                    ) : (
                      times.map(time => {
                        const isSelected = selectedDate === dateStr && selectedTime === time
                        return (
                          <button
                            key={time}
                            onClick={() => { setSelectedDate(dateStr); setSelectedTime(time); setStep('confirm') }}
                            className="w-full rounded-lg py-1.5 text-xs font-medium transition-all"
                            style={isSelected
                              ? { background: 'rgba(0,180,216,0.15)', color: '#00b4d8', border: '1px solid rgba(0,180,216,0.3)' }
                              : { background: 'rgba(255,255,255,0.03)', color: '#8AA4C8', border: '1px solid rgba(255,255,255,0.06)' }
                            }
                            onMouseEnter={e => !isSelected && ((e.currentTarget as HTMLElement).style.background = 'rgba(0,180,216,0.06)')}
                            onMouseLeave={e => !isSelected && ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)')}
                          >
                            {time}
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ── Step: confirm ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-lg">
      <BackButton onBack={() => setStep('slot')} />
      <StepHeader step={4} title="Confirm appointment" subtitle="Review and confirm your booking" />

      <div className="rounded-2xl p-6 space-y-4"
        style={{ background: 'rgba(10,22,40,0.8)', border: '1px solid rgba(255,255,255,0.06)' }}>

        <div className="flex items-center gap-3 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="h-12 w-12 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#00b4d8,#0066cc)', boxShadow: '0 0 20px rgba(0,180,216,0.3)' }}>
            <CalendarCheck size={22} className="text-white" />
          </div>
          <div>
            <p className="font-semibold" style={{ color: '#E2EAF8' }}>Appointment Summary</p>
            <p className="text-xs" style={{ color: '#3E5070' }}>Please review before confirming</p>
          </div>
        </div>

        {[
          { label: 'Patient', value: `${selectedPatient?.firstName} ${selectedPatient?.lastName}` },
          { label: 'Therapist', value: `${selectedTherapist?.firstName} ${selectedTherapist?.lastName}` },
          { label: 'Date', value: format(parseISO(selectedDate), 'EEEE, MMMM d, yyyy') },
          { label: 'Time', value: selectedTime },
        ].map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between">
            <span className="text-sm" style={{ color: '#6B82A8' }}>{label}</span>
            <span className="text-sm font-medium" style={{ color: '#C8D8F0' }}>{value}</span>
          </div>
        ))}

        <div className="pt-2">
          <label className="form-label">Notes (optional)</label>
          <textarea
            rows={3}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Any notes for the therapist…"
            className="form-input resize-none"
          />
        </div>
      </div>

      <Button
        className="w-full"
        size="lg"
        loading={bookMut.isPending}
        onClick={() => bookMut.mutate()}
      >
        Confirm Booking
      </Button>
    </div>
  )
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function StepHeader({ step, title, subtitle }: { step: number; title: string; subtitle: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold tracking-widest uppercase mb-1" style={{ color: '#00b4d8' }}>
        Step {step} of 4
      </p>
      <h1 className="text-2xl font-bold" style={{ color: '#E2EAF8' }}>{title}</h1>
      <p className="mt-1 text-sm" style={{ color: '#3E5070' }}>{subtitle}</p>
    </div>
  )
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button
      onClick={onBack}
      className="flex items-center gap-1.5 text-sm transition-colors"
      style={{ color: '#3E5070' }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#C8D8F0'}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#3E5070'}
    >
      <ChevronLeft size={16} /> Back
    </button>
  )
}

function EmptyBlock({ message }: { message: string }) {
  return (
    <div className="rounded-2xl p-8 text-center"
      style={{ background: 'rgba(10,22,40,0.7)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <p className="text-sm" style={{ color: '#3E5070' }}>{message}</p>
    </div>
  )
}

