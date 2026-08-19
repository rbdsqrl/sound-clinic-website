import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Clock, Plus, Trash2, ChevronDown } from 'lucide-react'
import { useForm, Controller } from 'react-hook-form'
import { slotsApi } from '../../api/appointments'
import { clinicsApi } from '../../api/clinics'
import { usersApi } from '../../api/users'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { PageLoader } from '../../components/ui/Spinner'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { TimePicker } from '../../components/ui/TimePicker'
import { useToast } from '../../hooks/useToast'
import { getApiError } from '../../lib/apiError'
import { colors, styles, border, surface, palette, paletteStyle, rgba, borderAlpha } from '../../theme'
import type { CreateSlotRequest, DayOfWeek, SlotResponse, ClinicResponse, UserResponse } from '../../types'

const DAY_LABELS: Record<DayOfWeek, string> = {
  MONDAY: 'Monday', TUESDAY: 'Tuesday', WEDNESDAY: 'Wednesday',
  THURSDAY: 'Thursday', FRIDAY: 'Friday', SATURDAY: 'Saturday', SUNDAY: 'Sunday',
}
const DAYS: DayOfWeek[] = ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY']

// Duration badge colours keyed by slot length (minutes)
const DURATION_STYLE: Record<string, React.CSSProperties> = {
  '30': paletteStyle('teal',   0.08),
  '45': paletteStyle('green',  0.08),
  '60': paletteStyle('purple', 0.08),
  '90': paletteStyle('yellow', 0.08),
}
const durationColor = (mins: number): React.CSSProperties =>
  DURATION_STYLE[String(mins)] ?? paletteStyle('slate', 0.08)

// Shared select style for the Add Slot modal — uses CSS vars so it adapts to light/dark

export default function AvailabilityPage() {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [modalOpen, setModalOpen] = useState(false)
  const [filterTherapistId, setFilterTherapistId] = useState<string>('')

  const { data: slots, isLoading } = useQuery({
    queryKey: ['slots', filterTherapistId],
    queryFn: () => slotsApi.list(filterTherapistId || undefined),
  })
  const { data: clinics }    = useQuery({ queryKey: ['clinics'],      queryFn: clinicsApi.list })
  const { data: therapists } = useQuery({ queryKey: ['therapists'],   queryFn: () => usersApi.listTherapists() })

  const deleteMut = useMutation({
    mutationFn: (id: string) => slotsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['slots'] }); toast('Slot removed', 'success') },
    onError: (err) => toast(getApiError(err, 'Failed to remove slot'), 'error'),
  })

  // Group slots by therapist → by day
  const grouped = (slots ?? []).reduce<Record<string, SlotResponse[]>>((acc, s) => {
    const key = s.therapistId
    if (!acc[key]) acc[key] = []
    acc[key].push(s)
    return acc
  }, {})

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: colors.text.heading }}>Availability</h1>
          <p className="mt-1 text-sm" style={{ color: colors.text.dim }}>
            Define recurring weekly slots for each therapist
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus size={16} /> Add Slot
        </Button>
      </div>

      {/* Therapist filter */}
      {therapists && therapists.length > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-sm" style={{ color: colors.text.muted }}>Filter by therapist:</span>
          <div className="relative">
            <select
              value={filterTherapistId}
              onChange={e => setFilterTherapistId(e.target.value)}
              className="form-input pr-8 appearance-none"
              style={{ minWidth: 200 }}
            >
              <option value="">All therapists</option>
              {therapists.map(t => (
                <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: colors.text.muted }} />
          </div>
        </div>
      )}

      {/* Slots grouped by therapist */}
      {Object.keys(grouped).length === 0 ? (
        <Card>
          <div className="flex flex-col items-center py-12 text-center">
            <div className="rounded-2xl p-5 mb-4" style={styles.emptyIcon}><Clock size={32} /></div>
            <p className="text-base font-semibold" style={{ color: colors.text.primary }}>No slots defined yet</p>
            <p className="mt-1 text-sm"            style={{ color: colors.text.muted }}>
              Add recurring weekly availability for your therapists.
            </p>
            <div className="mt-4">
              <Button onClick={() => setModalOpen(true)}><Plus size={14} /> Add Slot</Button>
            </div>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([therapistId, therapistSlots]) => {
            const first = therapistSlots[0]
            const byDay = DAYS.reduce<Record<DayOfWeek, SlotResponse[]>>((acc, d) => {
              acc[d] = therapistSlots.filter(s => s.dayOfWeek === d)
                                     .sort((a,b) => a.startTime.localeCompare(b.startTime))
              return acc
            }, {} as Record<DayOfWeek, SlotResponse[]>)
            const activeDays = DAYS.filter(d => byDay[d].length > 0)

            return (
              <Card key={therapistId} padding={false}>
                {/* Therapist header */}
                <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: `1px solid ${border.divider}` }}>
                  <div
                    className="h-9 w-9 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0"
                    style={{ background: rgba(palette.teal.raw, 0.10), color: palette.teal.text }}
                  >
                    {first.therapistFirstName[0]}{first.therapistLastName[0]}
                  </div>
                  <div>
                    <p className="font-semibold" style={{ color: colors.text.primary }}>
                      {first.therapistFirstName} {first.therapistLastName}
                    </p>
                    <p className="text-xs" style={{ color: colors.text.dim }}>{first.clinicName}</p>
                  </div>
                  <div className="ml-auto">
                    <span className="text-xs rounded-full px-2.5 py-0.5" style={styles.slotBadge}>
                      {therapistSlots.length} slot{therapistSlots.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {/* Days grid */}
                <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {activeDays.map(day => (
                    <div key={day} className="rounded-xl p-3" style={{ background: surface.sidebarFooter, border: border.card }}>
                      <p className="text-xs font-semibold mb-2" style={{ color: colors.text.muted }}>{DAY_LABELS[day]}</p>
                      <div className="space-y-1.5">
                        {byDay[day].map(slot => (
                          <div key={slot.id} className="flex items-center justify-between gap-2">
                            <div>
                              <p className="text-xs font-medium" style={{ color: colors.text.primary }}>
                                {slot.startTime.slice(0,5)} – {slot.endTime.slice(0,5)}
                              </p>
                              <span className="text-[12px] rounded-full px-1.5 py-0.5 mt-0.5 inline-block" style={durationColor(slot.slotDurationMinutes)}>
                                {slot.slotDurationMinutes} min
                              </span>
                            </div>
                            <button
                              onClick={() => deleteMut.mutate(slot.id)}
                              disabled={deleteMut.isPending}
                              className="rounded-lg p-1 transition-colors flex-shrink-0"
                              style={{ color: colors.text.dim }}
                              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = colors.status.danger}
                              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = colors.text.dim}
                              title="Remove slot"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <AddSlotModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        clinics={clinics ?? []}
        therapists={therapists ?? []}
        onCreated={() => { qc.invalidateQueries({ queryKey: ['slots'] }); setModalOpen(false) }}
      />
    </div>
  )
}

// ── Add Slot Modal ─────────────────────────────────────────────────────────────

function AddSlotModal({ open, onClose, clinics, therapists, onCreated }: {
  open: boolean; onClose: () => void
  clinics: ClinicResponse[]; therapists: UserResponse[]; onCreated: () => void
}) {
  const { toast } = useToast()
  type FormValues = Omit<CreateSlotRequest, 'slotDurationMinutes'> & { slotDurationMinutes: string }
  const { register, handleSubmit, reset, control, formState: { errors, isSubmitting } } = useForm<FormValues>()

  const createMut = useMutation({
    mutationFn: (data: CreateSlotRequest) => slotsApi.create(data),
    onSuccess: () => { toast('Slot added', 'success'); reset(); onCreated() },
    onError: (err) => toast(getApiError(err, 'Failed to add slot'), 'error'),
  })

  const onSubmit = handleSubmit(async (raw: FormValues) => {
    await createMut.mutateAsync({
      therapistId:         raw.therapistId,
      clinicId:            raw.clinicId,
      dayOfWeek:           raw.dayOfWeek,
      startTime:           raw.startTime,
      endTime:             raw.endTime,
      slotDurationMinutes: Number(raw.slotDurationMinutes),
    })
  })

  return (
    <Modal open={open} onClose={onClose} title="Add Availability Slot">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1">
          <label className="form-label">Therapist</label>
          <select className="form-input w-full" {...register('therapistId', { required: 'Required' })}>
            <option value="">Select therapist…</option>
            {therapists.map(t => (
              <option key={t.id} value={t.id}>
                {t.firstName} {t.lastName}{t.role === 'DOCTOR' ? ' (Doctor)' : ''}
              </option>
            ))}
          </select>
          {errors.therapistId && <p className="form-error">{errors.therapistId.message}</p>}
        </div>

        <div className="space-y-1">
          <label className="form-label">Clinic</label>
          <select className="form-input w-full" {...register('clinicId', { required: 'Required' })}>
            <option value="">Select clinic…</option>
            {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {errors.clinicId && <p className="form-error">{errors.clinicId.message}</p>}
        </div>

        <div className="space-y-1">
          <label className="form-label">Day of Week</label>
          <select className="form-input w-full" {...register('dayOfWeek', { required: 'Required' })}>
            <option value="">Select day…</option>
            {DAYS.map(d => <option key={d} value={d}>{DAY_LABELS[d]}</option>)}
          </select>
          {errors.dayOfWeek && <p className="form-error">{errors.dayOfWeek.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Controller control={control} name="startTime" rules={{ required: 'Required' }}
            render={({ field }) => (
              <TimePicker label="Start time" value={field.value ?? ''} onChange={field.onChange} error={errors.startTime?.message} />
            )} />
          <Controller control={control} name="endTime" rules={{ required: 'Required' }}
            render={({ field }) => (
              <TimePicker label="End time" value={field.value ?? ''} onChange={field.onChange} error={errors.endTime?.message} />
            )} />
        </div>

        <div className="space-y-1">
          <label className="form-label">Session duration (minutes)</label>
          <select className="form-input w-full" {...register('slotDurationMinutes', { required: 'Required' })}>
            <option value="30">30 minutes</option>
            <option value="45">45 minutes</option>
            <option value="60">60 minutes</option>
            <option value="90">90 minutes</option>
          </select>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting || createMut.isPending}>Save Slot</Button>
        </div>
      </form>
    </Modal>
  )
}
