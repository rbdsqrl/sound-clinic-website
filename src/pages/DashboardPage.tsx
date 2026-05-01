import { useQuery } from '@tanstack/react-query'
import { Building2, Users, Stethoscope, Mail, Baby } from 'lucide-react'
import { Link } from 'react-router-dom'
import { clinicsApi } from '../api/clinics'
import { patientsApi } from '../api/patients'
import { StatCard } from '../components/ui/Card'
import { PageLoader } from '../components/ui/Spinner'
import { useAuth } from '../contexts/AuthContext'
import { roleBadge } from '../components/ui/Badge'
import { colors, styles, border, palette, rgba } from '../theme'
import { format } from 'date-fns'

const ROW_HOVER_IN  = (e: React.MouseEvent) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)' }
const ROW_HOVER_OUT = (e: React.MouseEvent) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }

export default function DashboardPage() {
  const { user, activeRole } = useAuth()
  const isParentView       = activeRole === 'PARENT'
  const isOwnerOrTherapist = activeRole === 'BUSINESS_OWNER' || activeRole === 'THERAPIST' || activeRole === 'DOCTOR' || activeRole === 'ADMIN'

  const { data: clinics,    isLoading: loadingClinics }   = useQuery({ queryKey: ['clinics'],      queryFn: clinicsApi.list,       enabled: isOwnerOrTherapist })
  const { data: patients,   isLoading: loadingPatients }   = useQuery({ queryKey: ['patients'],     queryFn: patientsApi.list,      enabled: isOwnerOrTherapist })
  const { data: myChildren, isLoading: loadingChildren }   = useQuery({ queryKey: ['my-children'],  queryFn: patientsApi.myChildren, enabled: isParentView })

  const uniqueTherapistIds = new Set(patients?.flatMap(p => p.therapists).map(t => t.id) ?? [])

  if (loadingClinics || loadingPatients || loadingChildren) return <PageLoader />

  const sectionCard: React.CSSProperties = { ...styles.card, overflow: 'hidden', padding: 0 }
  const sectionHeader: React.CSSProperties = {
    borderBottom: `1px solid ${border.dividerDark}`,
  }

  // ── Parent dashboard ──────────────────────────────────────────────────────
  if (isParentView) {
    return (
      <div className="space-y-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold" style={{ color: colors.text.heading }}>
              Welcome back, {user?.firstName}
            </h1>
            {activeRole && roleBadge(activeRole)}
          </div>
          <p className="mt-1 text-sm" style={{ color: colors.text.dim }}>Here's a summary for your children.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Children"           value={myChildren?.length ?? 0}                                                        icon={<Baby size={22} />}        color="purple" />
          <StatCard label="Conditions"          value={myChildren?.reduce((s, c) => s + c.conditions.length, 0) ?? 0}                  icon={<Users size={22} />}       color="blue" />
          <StatCard label="Assigned Therapists" value={new Set(myChildren?.flatMap(c => c.therapists.map(t => t.id)) ?? []).size}      icon={<Stethoscope size={22} />} color="green" />
        </div>

        {myChildren && myChildren.length > 0 && (
          <div style={sectionCard}>
            <div className="px-6 py-4 flex items-center justify-between" style={sectionHeader}>
              <h2 className="text-base font-semibold" style={{ color: colors.text.primary }}>My Children</h2>
              <Link to="/my-children" className="text-xs transition-colors" style={{ color: colors.accent }}>View all →</Link>
            </div>
            <div>
              {myChildren.map((child, i) => (
                <Link
                  key={child.id}
                  to={`/patients/${child.id}`}
                  className="flex items-center gap-4 px-6 py-3 transition-colors"
                  style={i < myChildren.length - 1 ? { borderBottom: `1px solid ${border.dividerDark}` } : {}}
                  onMouseEnter={ROW_HOVER_IN}
                  onMouseLeave={ROW_HOVER_OUT}
                >
                  <div
                    className="h-9 w-9 rounded-full text-sm font-semibold flex items-center justify-center flex-shrink-0"
                    style={{ background: rgba(palette.purple.raw, 0.10), color: palette.purple.text }}
                  >
                    {child.firstName[0]}{child.lastName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium" style={{ color: colors.text.primary }}>{child.firstName} {child.lastName}</p>
                    <p className="text-xs"     style={{ color: colors.text.dim }}>
                      {child.dateOfBirth ? format(new Date(child.dateOfBirth), 'MMM d, yyyy') : 'No DOB'}
                      {child.conditions.length > 0 && ` · ${child.conditions.length} condition${child.conditions.length !== 1 ? 's' : ''}`}
                    </p>
                  </div>
                  <p className="text-xs" style={{ color: colors.text.dim }}>
                    {child.therapists.length} therapist{child.therapists.length !== 1 ? 's' : ''}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Owner / Therapist / Admin dashboard ───────────────────────────────────
  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold" style={{ color: colors.text.heading }}>
            Welcome back, {user?.firstName}
          </h1>
          {activeRole && roleBadge(activeRole)}
        </div>
        <p className="mt-1 text-sm" style={{ color: colors.text.dim }}>Here's an overview of your organisation.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Clinics"        value={clinics?.length ?? 0}                            icon={<Building2 size={22} />}   color="teal" />
        <StatCard label="Patients"       value={patients?.length ?? 0}                           icon={<Users size={22} />}       color="blue" />
        <StatCard label="Therapists"     value={uniqueTherapistIds.size}                         icon={<Stethoscope size={22} />} color="green" />
        <StatCard label="Active Clinics" value={clinics?.filter(c => c.isActive).length ?? 0}   icon={<Mail size={22} />}        color="purple" />
      </div>

      {patients && patients.length > 0 && (
        <div style={sectionCard}>
          <div className="px-4 sm:px-6 py-4 flex items-center justify-between" style={sectionHeader}>
            <h2 className="text-base font-semibold" style={{ color: colors.text.primary }}>Recent Patients</h2>
            <Link to="/patients" className="text-xs transition-colors" style={{ color: colors.accent }}>View all →</Link>
          </div>

          {/* Mobile card list */}
          <div className="sm:hidden">
            {patients.slice(0, 5).map((p, i) => (
              <Link
                key={p.id}
                to={`/patients/${p.id}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors"
                style={i < Math.min(patients.length, 5) - 1 ? { borderBottom: `1px solid ${border.dividerDark}` } : {}}
                onMouseEnter={ROW_HOVER_IN}
                onMouseLeave={ROW_HOVER_OUT}
              >
                <div
                  className="h-9 w-9 rounded-full text-sm font-semibold flex items-center justify-center flex-shrink-0"
                  style={{ background: rgba(palette.teal.raw, 0.10), color: palette.teal.text }}
                >
                  {p.firstName[0]}{p.lastName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate" style={{ color: colors.text.primary }}>{p.firstName} {p.lastName}</p>
                  <p className="text-xs truncate"     style={{ color: colors.text.dim }}>
                    {clinics?.find(c => c.id === p.clinicId)?.name ?? '—'}
                    {p.conditions.length > 0 && ` · ${p.conditions.length} condition${p.conditions.length !== 1 ? 's' : ''}`}
                  </p>
                </div>
                <span className="text-xs flex-shrink-0" style={{ color: colors.text.dim }}>
                  {p.therapists.length} therapist{p.therapists.length !== 1 ? 's' : ''}
                </span>
              </Link>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: `1px solid ${border.dividerDark}` }}>
                  {['Name', 'Clinic', 'Conditions', 'Therapists'].map(h => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: colors.text.dim }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {patients.slice(0, 5).map((p, i) => (
                  <tr
                    key={p.id}
                    style={i < Math.min(patients.length, 5) - 1 ? { borderBottom: `1px solid ${border.dividerDark}` } : {}}
                    onMouseEnter={ROW_HOVER_IN}
                    onMouseLeave={ROW_HOVER_OUT}
                    className="transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-3 font-medium" style={{ color: colors.text.primary }}>{p.firstName} {p.lastName}</td>
                    <td className="px-6 py-3"              style={{ color: colors.text.muted }}>{clinics?.find(c => c.id === p.clinicId)?.name ?? '—'}</td>
                    <td className="px-6 py-3"              style={{ color: colors.text.muted }}>{p.conditions.length}</td>
                    <td className="px-6 py-3"              style={{ color: colors.text.muted }}>{p.therapists.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
