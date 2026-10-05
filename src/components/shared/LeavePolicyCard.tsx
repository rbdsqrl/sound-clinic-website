import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil } from 'lucide-react'
import { leavePolicyApi } from '../../api/leavePolicy'
import { Card, CardHeader } from '../ui/Card'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { Badge } from '../ui/Badge'
import { useToast } from '../../hooks/useToast'
import { getApiError } from '../../lib/apiError'
import { colors, border } from '../../theme'
import type { LeaveCategory } from '../../types'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/**
 * Leave policy: the kinds of leave (Casual, Sick…), how many working days of each a person gets per
 * leave year, and when that year starts. With no categories set up, leave works as it always has —
 * requested and approved with no quota. Individual allocations are adjusted from the Leave Requests
 * page, so a person can have more or fewer days than the default.
 */
export function LeavePolicyCard({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const { data: categories = [] } = useQuery({ queryKey: ['leave-policy', 'categories', 'all'], queryFn: () => leavePolicyApi.categories(true) })
  const { data: settings } = useQuery({ queryKey: ['leave-policy', 'settings'], queryFn: leavePolicyApi.getSettings })

  const [name, setName] = useState('')
  const [days, setDays] = useState('')
  const [editing, setEditing] = useState<LeaveCategory | null>(null)
  const [editName, setEditName] = useState('')
  const [editDays, setEditDays] = useState('')
  const [error, setError] = useState<string | null>(null)

  const refresh = () => qc.invalidateQueries({ queryKey: ['leave-policy'] })
  const fail = (err: unknown) => setError(getApiError(err, 'Could not save the change'))

  const addMut = useMutation({
    mutationFn: () => leavePolicyApi.createCategory({ name: name.trim(), annualDays: days.trim() === '' ? undefined : Number(days) }),
    onSuccess: () => { refresh(); setName(''); setDays(''); setError(null); toast('Leave type added', 'success') },
    onError: fail,
  })
  const saveMut = useMutation({
    mutationFn: () => leavePolicyApi.updateCategory(editing!.id, editDays.trim() === ''
      ? { name: editName.trim(), clearAnnualDays: true }
      : { name: editName.trim(), annualDays: Number(editDays) }),
    onSuccess: () => { refresh(); setEditing(null); toast('Leave type updated', 'success') },
    onError: fail,
  })
  const activeMut = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => leavePolicyApi.updateCategory(id, { active }),
    onSuccess: refresh,
    onError: fail,
  })
  const monthMut = useMutation({
    mutationFn: (m: number) => leavePolicyApi.updateSettings(m),
    onSuccess: () => { refresh(); toast('Leave year updated', 'success') },
    onError: fail,
  })

  const daysValid = (v: string) => v.trim() === '' || (Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 366)
  const openEdit = (c: LeaveCategory) => { setEditing(c); setEditName(c.name); setEditDays(c.annualDays === null ? '' : String(c.annualDays)); setError(null) }

  return (
    <Card>
      <CardHeader
        title="Leave Policy"
        subtitle="The kinds of leave, the working days each person gets per year, and when the leave year starts"
      />

      <div className="max-w-xs mb-5">
        <Select
          label="Leave year starts in"
          value={String(settings?.yearStartMonth ?? 1)}
          disabled={!canEdit}
          onChange={e => monthMut.mutate(Number(e.target.value))}
          options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))}
        />
      </div>

      {categories.length === 0 ? (
        <p className="text-sm mb-4" style={{ color: colors.text.dim }}>
          No leave types yet. Until you add one, leave is requested and approved with no quota, as before.
        </p>
      ) : (
        <div className="mb-4">
          {categories.map(c => (
            <div key={c.id} className="flex items-center justify-between gap-3 py-2.5" style={{ borderTop: `1px solid ${border.divider}` }}>
              <div className="min-w-0">
                <p className="text-sm font-medium flex items-center gap-2 flex-wrap" style={{ color: c.active ? colors.text.primary : colors.text.dim }}>
                  {c.name} {!c.active && <Badge variant="slate">Inactive</Badge>}
                </p>
                <p className="text-xs" style={{ color: colors.text.dim }}>
                  {c.annualDays === null ? 'No yearly limit' : `${c.annualDays} working day${c.annualDays === 1 ? '' : 's'} per year`}
                </p>
              </div>
              {canEdit && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button size="sm" variant="ghost" aria-label={`Edit ${c.name}`} onClick={() => openEdit(c)}><Pencil size={13} /></Button>
                  <Button size="sm" variant="secondary" loading={activeMut.isPending && activeMut.variables?.id === c.id}
                    onClick={() => activeMut.mutate({ id: c.id, active: !c.active })}>
                    {c.active ? 'Deactivate' : 'Activate'}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {canEdit && (
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px_auto] gap-3 items-end pt-4" style={{ borderTop: `1px solid ${border.divider}` }}>
          <Input label="New leave type" placeholder="e.g. Casual Leave" value={name} onChange={e => setName(e.target.value)} />
          <Input label="Days per year" type="number" min={0} max={366} placeholder="No limit" value={days} onChange={e => setDays(e.target.value)} />
          <Button onClick={() => { setError(null); addMut.mutate() }} disabled={!name.trim() || !daysValid(days)} loading={addMut.isPending}>
            <Plus size={14} /> Add
          </Button>
        </div>
      )}
      {error && !editing && <p className="text-sm mt-3" style={{ color: colors.status.danger }}>{error}</p>}

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Edit leave type"
        size="sm"
        error={error}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={() => { setError(null); saveMut.mutate() }} disabled={!editName.trim() || !daysValid(editDays)} loading={saveMut.isPending}>Save</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input label="Name" value={editName} onChange={e => setEditName(e.target.value)} />
          <Input label="Days per year" type="number" min={0} max={366} placeholder="No limit" value={editDays} onChange={e => setEditDays(e.target.value)} />
          <p className="text-xs" style={{ color: colors.text.dim }}>
            Changing the default applies to everyone without their own allocation. Leave already taken keeps its label.
          </p>
        </div>
      </Modal>
    </Card>
  )
}
