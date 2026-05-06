import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Stethoscope, Search, Phone, Mail, Building2 } from 'lucide-react'
import { format } from 'date-fns'
import { usersApi } from '../../api/users'
import { clinicsApi } from '../../api/clinics'
import { PageLoader } from '../../components/ui/Spinner'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import {
  colors, styles, border, surface, palette,
  accentAlpha, paletteStyle, rgba,
} from '../../theme'
import type { UserResponse } from '../../types'

// ── Role display helpers ───────────────────────────────────────────────────────

const ROLE_META: Record<string, { label: string; palette: 'teal' | 'purple' }> = {
  THERAPIST: { label: 'Therapist', palette: 'teal'   },
  DOCTOR:    { label: 'Doctor',    palette: 'purple'  },
}

function roleMeta(user: UserResponse) {
  return ROLE_META[user.role] ?? { label: user.role, palette: 'teal' as const }
}

// ── Therapist card ─────────────────────────────────────────────────────────────

function TherapistCard({ therapist, clinicName }: { therapist: UserResponse; clinicName: string }) {
  const meta    = roleMeta(therapist)
  const pal     = palette[meta.palette]
  const initials = `${therapist.firstName[0]}${therapist.lastName[0]}`

  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-4 transition-all"
      style={styles.card}
    >
      {/* Avatar + name + role */}
      <div className="flex items-start gap-3">
        <div
          className="h-11 w-11 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
          style={{ background: rgba(pal.raw, 0.12), color: pal.text }}
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate" style={{ color: colors.text.heading }}>
            {therapist.firstName} {therapist.lastName}
          </p>
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium mt-0.5"
            style={paletteStyle(meta.palette, 0.10)}
          >
            {meta.label}
          </span>
        </div>
        {/* Active indicator */}
        <div
          className="h-2 w-2 rounded-full flex-shrink-0 mt-1.5"
          style={{ background: therapist.isActive ? colors.status.success : colors.status.danger }}
          title={therapist.isActive ? 'Active' : 'Inactive'}
        />
      </div>

      {/* Details */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 min-w-0">
          <Mail size={13} className="flex-shrink-0" style={{ color: colors.text.dim }} />
          <span className="text-xs truncate" style={{ color: colors.text.muted }}>
            {therapist.email}
          </span>
        </div>

        {therapist.phone && (
          <div className="flex items-center gap-2">
            <Phone size={13} className="flex-shrink-0" style={{ color: colors.text.dim }} />
            <span className="text-xs" style={{ color: colors.text.muted }}>{therapist.phone}</span>
          </div>
        )}

        <div className="flex items-center gap-2 min-w-0">
          <Building2 size={13} className="flex-shrink-0" style={{ color: colors.text.dim }} />
          <span className="text-xs truncate" style={{ color: colors.text.muted }}>
            {clinicName}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div
        className="pt-3 flex items-center justify-between"
        style={{ borderTop: `1px solid ${border.divider}` }}
      >
        <span className="text-[11px]" style={{ color: colors.text.dim }}>
          Joined {format(new Date(therapist.createdAt), 'MMM yyyy')}
        </span>
        {!therapist.isActive && (
          <Badge variant="slate">Inactive</Badge>
        )}
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function TherapistsPage() {
  const [selectedClinicId, setSelectedClinicId] = useState<string>('')
  const [search, setSearch] = useState('')

  const { data: therapists, isLoading } = useQuery({
    queryKey: ['therapists', selectedClinicId],
    queryFn: () => usersApi.listTherapists(selectedClinicId || undefined),
  })

  const { data: clinics } = useQuery({
    queryKey: ['clinics'],
    queryFn: clinicsApi.list,
  })

  const clinicMap = Object.fromEntries((clinics ?? []).map((c) => [c.id, c.name]))

  // Client-side search filter (name or email)
  const visible = (therapists ?? []).filter((t) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      t.firstName.toLowerCase().includes(q) ||
      t.lastName.toLowerCase().includes(q) ||
      t.email.toLowerCase().includes(q)
    )
  })

  const totalCount      = therapists?.length ?? 0
  const therapistCount  = therapists?.filter((t) => t.role === 'THERAPIST').length ?? 0
  const doctorCount     = therapists?.filter((t) => t.role === 'DOCTOR').length ?? 0

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: colors.text.heading }}>Therapists</h1>
          <p className="mt-1 text-sm" style={{ color: colors.text.dim }}>
            {totalCount} staff member{totalCount !== 1 ? 's' : ''}
            {therapistCount > 0 && ` · ${therapistCount} therapist${therapistCount !== 1 ? 's' : ''}`}
            {doctorCount    > 0 && ` · ${doctorCount} doctor${doctorCount !== 1 ? 's' : ''}`}
            {selectedClinicId && clinicMap[selectedClinicId] && ` at ${clinicMap[selectedClinicId]}`}
          </p>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Clinic filter tabs */}
        {clinics && clinics.length > 0 && (
          <div
            className="flex items-center gap-1 p-1 rounded-xl flex-wrap"
            style={{ background: surface.filterStrip, border: border.card }}
          >
            <button
              onClick={() => setSelectedClinicId('')}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={selectedClinicId === '' ? styles.filterTabActive : styles.filterTabInactive}
            >
              All clinics
            </button>
            {clinics.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedClinicId(c.id)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={selectedClinicId === c.id ? styles.filterTabActive : styles.filterTabInactive}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        {/* Search box */}
        <div className="relative sm:ml-auto sm:w-64">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: colors.text.dim }}
          />
          <input
            type="text"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-input pl-8 text-xs"
          />
        </div>
      </div>

      {/* ── Content ── */}
      {visible.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center py-14 text-center">
            <div className="rounded-2xl p-5 mb-4" style={styles.emptyIcon}>
              <Stethoscope size={32} />
            </div>
            <p className="text-base font-semibold" style={{ color: colors.text.primary }}>
              {search ? 'No results' : 'No therapists yet'}
            </p>
            <p className="mt-1 text-sm" style={{ color: colors.text.muted }}>
              {search
                ? 'Try a different name or email.'
                : 'Invite therapists and doctors via the Add Members page.'}
            </p>
          </div>
        </Card>
      ) : (
        <>
          {/* Card grid — always shown on mobile; shown on desktop too */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {visible.map((t) => (
              <TherapistCard
                key={t.id}
                therapist={t}
                clinicName={t.clinicId ? (clinicMap[t.clinicId] ?? '—') : '—'}
              />
            ))}
          </div>

          {/* Summary strip */}
          {visible.length > 0 && (
            <p className="text-xs text-center" style={{ color: colors.text.dim }}>
              Showing {visible.length} of {totalCount} staff member{totalCount !== 1 ? 's' : ''}
            </p>
          )}
        </>
      )}
    </div>
  )
}
