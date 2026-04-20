import { useQuery } from '@tanstack/react-query'
import { Building2, Users, Stethoscope, Mail } from 'lucide-react'
import { clinicsApi } from '../api/clinics'
import { patientsApi } from '../api/patients'
import { StatCard } from '../components/ui/Card'
import { PageLoader } from '../components/ui/Spinner'
import { useAuth } from '../contexts/AuthContext'
import { roleBadge } from '../components/ui/Badge'

export default function DashboardPage() {
  const { user } = useAuth()
  const { data: clinics, isLoading: loadingClinics } = useQuery({
    queryKey: ['clinics'],
    queryFn: clinicsApi.list,
  })
  const { data: patients, isLoading: loadingPatients } = useQuery({
    queryKey: ['patients'],
    queryFn: patientsApi.list,
  })

  const therapists = patients?.flatMap((p) => p.therapists) ?? []
  const uniqueTherapistIds = new Set(therapists.map((t) => t.id))

  if (loadingClinics || loadingPatients) return <PageLoader />

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-800">
            Welcome back, {user?.firstName}
          </h1>
          {user?.role && roleBadge(user.role)}
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Here's an overview of your organisation.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Clinics"
          value={clinics?.length ?? 0}
          icon={<Building2 size={22} />}
          color="teal"
        />
        <StatCard
          label="Patients"
          value={patients?.length ?? 0}
          icon={<Users size={22} />}
          color="blue"
        />
        <StatCard
          label="Therapists"
          value={uniqueTherapistIds.size}
          icon={<Stethoscope size={22} />}
          color="green"
        />
        <StatCard
          label="Active Clinics"
          value={clinics?.filter((c) => c.isActive).length ?? 0}
          icon={<Mail size={22} />}
          color="purple"
        />
      </div>

      {/* Recent patients */}
      {patients && patients.length > 0 && (
        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-800">Recent Patients</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3 text-left">Name</th>
                <th className="px-6 py-3 text-left">Clinic</th>
                <th className="px-6 py-3 text-left">Conditions</th>
                <th className="px-6 py-3 text-left">Therapists</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {patients.slice(0, 5).map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-6 py-3 font-medium text-slate-800">
                    {p.firstName} {p.lastName}
                  </td>
                  <td className="px-6 py-3 text-slate-500">
                    {clinics?.find((c) => c.id === p.clinicId)?.name ?? '—'}
                  </td>
                  <td className="px-6 py-3 text-slate-500">{p.conditions.length}</td>
                  <td className="px-6 py-3 text-slate-500">{p.therapists.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
