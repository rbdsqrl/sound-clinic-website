import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, X } from 'lucide-react'
import { customRolesApi } from '../../api/customRoles'
import { Card, CardHeader } from '../ui/Card'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { useToast } from '../../hooks/useToast'
import { getApiError } from '../../lib/apiError'
import { colors, surface } from '../../theme'

/**
 * The organisation's Custom Roles (e.g. "Speech Language Pathologist"). A member given one shows it
 * instead of their role name everywhere; admins pick from this list on a member's Edit Profile.
 * Removing a name only takes it off the picker — members who already have it keep it.
 */
export function CustomRolesCard({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const { data: roles = [] } = useQuery({ queryKey: ['custom-roles'], queryFn: customRolesApi.list })

  const addMut = useMutation({
    mutationFn: () => customRolesApi.create(name.trim()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['custom-roles'] }); setName(''); setError(null); toast('Custom role added', 'success') },
    onError: err => setError(getApiError(err, 'Could not add the custom role')),
  })

  const removeMut = useMutation({
    mutationFn: (id: string) => customRolesApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['custom-roles'] }); toast('Custom role removed', 'success') },
    onError: err => toast(getApiError(err, 'Could not remove the custom role'), 'error'),
  })

  return (
    <Card>
      <CardHeader
        title="Custom Roles"
        subtitle="Names you can give a member on their Edit Profile — shown in place of their role everywhere"
      />
      {roles.length === 0 ? (
        <p className="text-sm" style={{ color: colors.text.dim }}>No custom roles yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {roles.map(r => (
            <span key={r.id} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm"
              style={{ background: surface.filterStrip, color: colors.text.primary }}>
              {r.name}
              {canEdit && (
                <button type="button" title={`Remove ${r.name}`} onClick={() => removeMut.mutate(r.id)}
                  disabled={removeMut.isPending} className="flex items-center" style={{ color: colors.text.dim }}>
                  <X size={13} />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      {canEdit && (
        <form
          className="flex items-end gap-2 mt-4"
          onSubmit={e => { e.preventDefault(); if (name.trim()) { setError(null); addMut.mutate() } }}
        >
          <div className="flex-1">
            <Input label="New custom role" value={name} maxLength={100} placeholder="e.g. Speech Language Pathologist"
              error={error ?? undefined} onChange={e => setName(e.target.value)} />
          </div>
          <Button type="submit" disabled={!name.trim()} loading={addMut.isPending}>
            <Plus size={14} /> Add
          </Button>
        </form>
      )}
    </Card>
  )
}
