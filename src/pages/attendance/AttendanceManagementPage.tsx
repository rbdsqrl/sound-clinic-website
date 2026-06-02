import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle, XCircle, LogIn, LogOut, ClipboardList } from 'lucide-react'
import { attendanceApi } from '../../api/attendance'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { PageLoader } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { colors, styles } from '../../theme'
import type { AttendanceResponse } from '../../types'

function formatTime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function VerifyIcon({ ok }: { ok: boolean }) {
  return ok
    ? <CheckCircle size={14} style={{ color: colors.status.success }} />
    : <XCircle    size={14} style={{ color: colors.status.error }} />
}

function StatusBadge({ status }: { status: AttendanceResponse['status'] }) {
  return (
    <Badge variant={status === 'CHECKED_OUT' ? 'green' : 'amber'}>
      {status === 'CHECKED_OUT' ? 'Checked Out' : 'Checked In'}
    </Badge>
  )
}

export default function AttendanceManagementPage({ asTab = false }: { asTab?: boolean }) {
  const today = new Date().toISOString().split('T')[0]
  const [from, setFrom] = useState(today)
  const [to, setTo]     = useState(today)

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['attendance', 'all', from, to],
    queryFn: () => attendanceApi.listAll(from, to),
  })

  const total     = records.length
  const present   = records.filter(r => r.checkInTime).length
  const verified  = records.filter(r => r.geoVerified && r.faceVerified).length

  if (isLoading) return <PageLoader />

  const DateFilters = (
    <div className="flex items-center gap-2">
      <Input label="" type="date" value={from} onChange={e => setFrom(e.target.value)} className="text-sm" />
      <span className="text-sm" style={{ color: colors.text.muted }}>to</span>
      <Input label="" type="date" value={to} onChange={e => setTo(e.target.value)} className="text-sm" />
    </div>
  )

  return (
    <div className={asTab ? 'space-y-6' : 'p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6'}>

      {/* ── Header ── */}
      {asTab ? (
        <div className="flex justify-end">{DateFilters}</div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg md:text-xl font-bold" style={{ color: colors.text.heading }}>
              Attendance Management
            </h1>
            <p className="text-sm mt-1" style={{ color: colors.text.muted }}>
              View and monitor staff attendance
            </p>
          </div>
          {DateFilters}
        </div>
      )}

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {[
          { label: 'Total Records', value: total,    color: colors.accent },
          { label: 'Present',       value: present,  color: colors.status.success },
          { label: 'Fully Verified',value: verified, color: colors.status.warning },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: colors.text.dim }}>{label}</p>
            <p className="text-2xl font-bold mt-1" style={{ color }}>{value}</p>
          </Card>
        ))}
      </div>

      {/* ── Records ── */}
      {records.length === 0 ? (
        <EmptyState icon={<ClipboardList size={32} />} title="No records found" description="No attendance records for the selected date range" />
      ) : (
        <>
          {/* Mobile card list */}
          <div className="flex flex-col gap-3 md:hidden">
            {records.map(r => (
              <div key={r.id} className="rounded-xl p-4" style={styles.card}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm" style={{ color: colors.text.primary }}>
                      {r.userFirstName} {r.userLastName}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: colors.text.muted }}>{r.clinicName}</p>
                    <p className="text-xs mt-0.5" style={{ color: colors.text.muted }}>
                      {new Date(r.attendanceDate).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
                <div className="mt-3 flex items-center gap-4 text-xs" style={{ color: colors.text.muted }}>
                  <span className="flex items-center gap-1"><LogIn size={11} /> {formatTime(r.checkInTime)}</span>
                  <span className="flex items-center gap-1"><LogOut size={11} /> {formatTime(r.checkOutTime)}</span>
                  <span className="flex items-center gap-1"><VerifyIcon ok={r.geoVerified} /> Geo</span>
                  <span className="flex items-center gap-1"><VerifyIcon ok={r.faceVerified} /> Face</span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto rounded-xl" style={styles.card}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: `1px solid ${colors.text.dim}20` }}>
                  {['Name', 'Clinic', 'Date', 'Check In', 'Check Out', 'Geo', 'Face', 'Status'].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider" style={{ color: colors.text.dim }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id} style={{ borderBottom: `1px solid ${colors.text.dim}10` }}>
                    <td className="py-3 px-4 font-medium" style={{ color: colors.text.primary }}>
                      {r.userFirstName} {r.userLastName}
                    </td>
                    <td className="py-3 px-4" style={{ color: colors.text.muted }}>{r.clinicName}</td>
                    <td className="py-3 px-4" style={{ color: colors.text.muted }}>
                      {new Date(r.attendanceDate).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                    </td>
                    <td className="py-3 px-4" style={{ color: colors.text.primary }}>{formatTime(r.checkInTime)}</td>
                    <td className="py-3 px-4" style={{ color: colors.text.primary }}>{formatTime(r.checkOutTime)}</td>
                    <td className="py-3 px-4"><VerifyIcon ok={r.geoVerified} /></td>
                    <td className="py-3 px-4"><VerifyIcon ok={r.faceVerified} /></td>
                    <td className="py-3 px-4"><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
