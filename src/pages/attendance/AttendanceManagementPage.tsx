import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, XCircle, LogIn, LogOut, ClipboardList, AlertTriangle, Clock } from 'lucide-react'
import { attendanceApi } from '../../api/attendance'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { PageLoader } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { ToastContainer } from '../../components/ui/Toast'
import { useToast } from '../../hooks/useToast'
import { getApiError } from '../../lib/apiError'
import { colors, styles, warningAlpha, successAlpha, dangerAlpha } from '../../theme'
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

function OverrideBadge({ approved }: { approved: boolean | null }) {
  if (approved === null) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
        style={{ background: warningAlpha(0.12), color: colors.status.warning }}
      >
        <Clock size={10} />
        Pending
      </span>
    )
  }
  return approved ? (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ background: successAlpha(0.12), color: colors.status.success }}
    >
      <CheckCircle size={10} />
      Approved
    </span>
  ) : (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ background: dangerAlpha(0.1), color: colors.status.error }}
    >
      <XCircle size={10} />
      Rejected
    </span>
  )
}

export default function AttendanceManagementPage({ asTab = false }: { asTab?: boolean }) {
  const today = new Date().toISOString().split('T')[0]
  const [from, setFrom] = useState(today)
  const [to, setTo]     = useState(today)

  const { toasts, toast, dismiss } = useToast()
  const qc = useQueryClient()

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['attendance', 'all', from, to],
    queryFn: () => attendanceApi.listAll(from, to),
  })

  const reviewMut = useMutation({
    mutationFn: ({ id, approved }: { id: string; approved: boolean }) =>
      attendanceApi.reviewOverride(id, approved),
    onSuccess: (updated) => {
      qc.setQueryData(['attendance', 'all', from, to], (prev: AttendanceResponse[] | undefined) =>
        (prev ?? []).map(r => r.id === updated.id ? updated : r)
      )
      toast(updated.overrideApproved ? 'Check-in approved' : 'Check-in rejected', 'success')
    },
    onError: (err) => toast(getApiError(err, 'Review failed'), 'error'),
  })

  const total    = records.length
  const present  = records.filter(r => r.checkInTime).length
  const verified = records.filter(r => r.geoVerified && r.faceVerified).length

  const pendingOverrides = records.filter(r => r.faceOverride && r.overrideApproved === null)

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

      {/* ── Pending override reviews ── */}
      {pendingOverrides.length > 0 && (
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={16} style={{ color: colors.status.warning }} />
            <h2 className="text-base font-semibold" style={{ color: colors.text.heading }}>
              Pending Review
            </h2>
            <span
              className="inline-flex items-center justify-center rounded-full text-xs font-bold w-5 h-5"
              style={{ background: warningAlpha(0.15), color: colors.status.warning }}
            >
              {pendingOverrides.length}
            </span>
          </div>
          <p className="text-sm mb-4" style={{ color: colors.text.muted }}>
            These staff members checked in but their face was not recognised. Review each check-in and mark it as valid or invalid.
          </p>
          <div className="flex flex-col gap-3">
            {pendingOverrides.map(r => (
              <div
                key={r.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl px-4 py-3"
                style={{ background: warningAlpha(0.06), border: `1px solid ${warningAlpha(0.2)}` }}
              >
                <div>
                  <p className="font-semibold text-sm" style={{ color: colors.text.primary }}>
                    {r.userFirstName} {r.userLastName}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: colors.text.muted }}>
                    {r.clinicName} · {new Date(r.attendanceDate).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} · {formatTime(r.checkInTime)}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    variant="secondary"
                    onClick={() => reviewMut.mutate({ id: r.id, approved: true })}
                    loading={reviewMut.isPending && reviewMut.variables?.id === r.id && reviewMut.variables?.approved === true}
                    disabled={reviewMut.isPending}
                  >
                    <CheckCircle size={14} />
                    Approve
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => reviewMut.mutate({ id: r.id, approved: false })}
                    loading={reviewMut.isPending && reviewMut.variables?.id === r.id && reviewMut.variables?.approved === false}
                    disabled={reviewMut.isPending}
                  >
                    <XCircle size={14} />
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
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
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm" style={{ color: colors.text.primary }}>
                        {r.userFirstName} {r.userLastName}
                      </p>
                      {r.faceOverride && <OverrideBadge approved={r.overrideApproved} />}
                    </div>
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
                {r.faceOverride && r.overrideReviewedByName && (
                  <p className="text-xs mt-2" style={{ color: colors.text.muted }}>
                    Reviewed by {r.overrideReviewedByName}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto rounded-xl" style={styles.card}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: `1px solid ${colors.text.dim}20` }}>
                  {['Name', 'Clinic', 'Date', 'Check In', 'Check Out', 'Geo', 'Face', 'Override', 'Status'].map(h => (
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
                    <td className="py-3 px-4">
                      {r.faceOverride ? <OverrideBadge approved={r.overrideApproved} /> : <span style={{ color: colors.text.dim }}>—</span>}
                    </td>
                    <td className="py-3 px-4"><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
