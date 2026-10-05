import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { leavePolicyApi } from '../../api/leavePolicy'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Badge, roleLabel } from '../../components/ui/Badge'
import { PageLoader } from '../../components/ui/Spinner'
import { useToast } from '../../hooks/useToast'
import { getApiError } from '../../lib/apiError'
import { formatDateStr } from '../../lib/format'
import { exportRowsAsCsv } from '../../lib/exportCsv'
import { colors, border, surface, palette } from '../../theme'
import type { LeaveBalance, PersonLeaveBalances } from '../../types'

/**
 * Everyone's leave position for a leave year, therapist by therapist: each category's used / allocated
 * (with what's pending), and how many requests are pending, approved or rejected. Click a figure to give
 * that person their own allocation for the year instead of the category default.
 */
export default function LeaveBalancesView() {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [year, setYear] = useState<number | undefined>(undefined)
  const [editing, setEditing] = useState<{ person: PersonLeaveBalances; balance: LeaveBalance } | null>(null)
  const [days, setDays] = useState('')
  const [error, setError] = useState<string | null>(null)

  const { data, isLoading } = useQuery({ queryKey: ['leave-policy', 'balances', year], queryFn: () => leavePolicyApi.balances(year) })

  const saveMut = useMutation({
    mutationFn: (value: number | undefined) => leavePolicyApi.setAllocation({
      userId: editing!.person.userId, categoryId: editing!.balance.categoryId, year: data!.year, days: value,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leave-policy'] }); setEditing(null); toast('Allocation updated', 'success') },
    onError: (err) => setError(getApiError(err, 'Could not update the allocation')),
  })

  if (isLoading || !data) return <PageLoader />

  const categories = data.people[0]?.balances ?? []
  const yearLabel = `${formatDateStr(data.yearStart)} – ${formatDateStr(data.yearEnd)}`
  const openEdit = (person: PersonLeaveBalances, balance: LeaveBalance) => {
    setEditing({ person, balance }); setDays(balance.allocated === null ? '' : String(balance.allocated)); setError(null)
  }
  const daysValid = days.trim() === '' || (Number.isInteger(Number(days)) && Number(days) >= 0 && Number(days) <= 366)

  const exportCsv = () => exportRowsAsCsv(`leave-balances_${data.year}.csv`, data.people, [
    { header: 'Name', value: p => p.name },
    { header: 'Role', value: p => roleLabel(p.role as never) },
    ...categories.flatMap((c, i) => [
      { header: `${c.categoryName} - Allocated`, value: (p: PersonLeaveBalances) => p.balances[i]?.allocated ?? 'No limit' },
      { header: `${c.categoryName} - Used`, value: (p: PersonLeaveBalances) => p.balances[i]?.used ?? 0 },
      { header: `${c.categoryName} - Pending`, value: (p: PersonLeaveBalances) => p.balances[i]?.pending ?? 0 },
      { header: `${c.categoryName} - Remaining`, value: (p: PersonLeaveBalances) => p.balances[i]?.remaining ?? 'No limit' },
    ]),
    { header: 'Requests Pending', value: p => p.pendingRequests },
    { header: 'Requests Approved', value: p => p.approvedRequests },
    { header: 'Requests Rejected', value: p => p.rejectedRequests },
  ])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" aria-label="Previous leave year" onClick={() => setYear(data.year - 1)}><ChevronLeft size={14} /></Button>
          <div>
            <p className="text-sm font-semibold" style={{ color: colors.text.primary }}>Leave year {data.year}</p>
            <p className="text-xs" style={{ color: colors.text.dim }}>{yearLabel}</p>
          </div>
          <Button size="sm" variant="secondary" aria-label="Next leave year" onClick={() => setYear(data.year + 1)}><ChevronRight size={14} /></Button>
        </div>
        <button
          type="button"
          disabled={data.people.length === 0}
          onClick={exportCsv}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-40"
          style={{ background: surface.rowHover, color: colors.text.primary }}
        >
          <Download size={14} /> Export
        </button>
      </div>

      {data.people.length === 0 ? (
        <Card><p className="py-8 text-center text-sm" style={{ color: colors.text.dim }}>No staff yet.</p></Card>
      ) : (
        <Card padding={false}>
          {categories.length === 0 && (
            <p className="px-5 py-3 text-xs" style={{ color: colors.text.dim, borderBottom: `1px solid ${border.divider}` }}>
              No leave types are set up, so there are no balances to track. Add them under Organisation → Settings → Leave Policy.
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 360 + categories.length * 130 }}>
              <thead>
                <tr style={{ color: colors.text.dim }}>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider">Name</th>
                  {categories.map(c => (
                    <th key={c.categoryId} className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider">{c.categoryName}</th>
                  ))}
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider">Requests</th>
                </tr>
              </thead>
              <tbody>
                {data.people.map(p => (
                  <tr key={p.userId} style={{ borderTop: `1px solid ${border.divider}` }}>
                    <td className="px-5 py-3 align-top">
                      <p className="font-medium" style={{ color: colors.text.primary }}>{p.name}</p>
                      <p className="text-xs" style={{ color: colors.text.dim }}>{roleLabel(p.role as never)}</p>
                    </td>
                    {p.balances.map(b => {
                      const low = b.remaining !== null && b.remaining <= 0
                      return (
                        <td key={b.categoryId} className="px-3 py-3 text-right align-top">
                          <button
                            type="button"
                            onClick={() => openEdit(p, b)}
                            title="Set this person's allocation"
                            className="rounded-lg px-2 py-1 text-right hover:opacity-80"
                            style={{ fontVariantNumeric: 'tabular-nums' }}
                          >
                            <span className="font-semibold" style={{ color: low ? colors.status.warning : colors.text.primary }}>
                              {b.used}
                            </span>
                            <span style={{ color: colors.text.dim }}> / {b.allocated === null ? '∞' : b.allocated}</span>
                            {b.custom && <span className="ml-1 text-[10px]" style={{ color: colors.accent }}>custom</span>}
                            {b.pending > 0 && <span className="block text-[11px]" style={{ color: palette.yellow.text }}>{b.pending} pending</span>}
                          </button>
                        </td>
                      )
                    })}
                    <td className="px-5 py-3 text-right align-top">
                      <div className="flex justify-end gap-1.5 flex-wrap">
                        <Badge variant="yellow">{p.pendingRequests} pending</Badge>
                        <Badge variant="teal">{p.approvedRequests} approved</Badge>
                        <Badge variant="slate">{p.rejectedRequests} rejected</Badge>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      <p className="text-xs" style={{ color: colors.text.dim }}>
        Figures are working days used / allocated for the leave year. Weekly off days and public holidays aren't counted.
      </p>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Leave allocation"
        size="sm"
        error={error}
        footer={
          <div className="flex justify-between gap-2">
            <Button variant="ghost" disabled={!editing?.balance.custom} loading={saveMut.isPending}
              onClick={() => { setError(null); saveMut.mutate(undefined) }}>
              Reset to default
            </Button>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
              <Button disabled={days.trim() === '' || !daysValid} loading={saveMut.isPending}
                onClick={() => { setError(null); saveMut.mutate(Number(days)) }}>Save</Button>
            </div>
          </div>
        }
      >
        {editing && (
          <div className="space-y-3">
            <p className="text-sm" style={{ color: colors.text.primary }}>
              <strong>{editing.person.name}</strong> · {editing.balance.categoryName} · leave year {data.year}
            </p>
            <Input label="Working days for this person" type="number" min={0} max={366} value={days} onChange={e => setDays(e.target.value)} />
            <p className="text-xs" style={{ color: colors.text.dim }}>
              {editing.balance.used} used{editing.balance.pending > 0 ? `, ${editing.balance.pending} pending` : ''} so far.
              Resetting returns them to the leave type's default.
            </p>
          </div>
        )}
      </Modal>
    </div>
  )
}
