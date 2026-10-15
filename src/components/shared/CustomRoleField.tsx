import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Check } from 'lucide-react'
import { customRolesApi } from '../../api/customRoles'
import { Input } from '../ui/Input'
import { getApiError } from '../../lib/apiError'
import { colors, surface, border, accentAlpha } from '../../theme'

/**
 * Picker for a member's Custom Role: choose one from the organisation's list, or type a new name and use
 * "Add" to put it on the list (and select it) without leaving the form. Clearing the box removes the member's
 * Custom Role, so their normal role name shows again.
 */
export function CustomRoleField({ value, onChange }: {
  value: string
  onChange: (value: string) => void
}) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')

  const { data: roles = [] } = useQuery({ queryKey: ['custom-roles'], queryFn: customRolesApi.list })

  const typed = value.trim()
  const needle = typed.toLowerCase()
  const matches = roles.filter(r => r.name.toLowerCase().includes(needle))
  const exact = roles.some(r => r.name.toLowerCase() === needle)

  const addMut = useMutation({
    mutationFn: (name: string) => customRolesApi.create(name),
    onSuccess: role => {
      qc.invalidateQueries({ queryKey: ['custom-roles'] })
      onChange(role.name)
      setOpen(false)
      setError('')
    },
    onError: err => setError(getApiError(err, 'Could not add the custom role')),
  })

  const pick = (name: string) => { onChange(name); setOpen(false); setError('') }
  const showAdd = typed.length > 0 && !exact

  return (
    <div className="relative">
      <Input
        label="Custom Role"
        value={value}
        maxLength={100}
        placeholder="Pick a role, or type a new one"
        autoComplete="off"
        error={error || undefined}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
      />
      {open && (matches.length > 0 || showAdd) && (
        // onMouseDown + preventDefault keeps the input focused so the click lands before the blur closes the list.
        <div
          className="absolute z-20 left-0 right-0 mt-1 rounded-xl overflow-hidden overflow-y-auto max-h-56 shadow-lg"
          style={{ background: surface.card, border: border.card }}
          onMouseDown={e => e.preventDefault()}
        >
          {matches.map(r => (
            <button
              key={r.id}
              type="button"
              onClick={() => pick(r.name)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm"
              style={{ color: colors.text.primary, background: r.name === value ? accentAlpha(0.08) : 'transparent' }}
            >
              <span className="truncate">{r.name}</span>
              {r.name === value && <Check size={14} style={{ color: colors.accent }} />}
            </button>
          ))}
          {showAdd && (
            <button
              type="button"
              onClick={() => addMut.mutate(typed)}
              disabled={addMut.isPending}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm font-medium"
              style={{ color: colors.accent, borderTop: matches.length > 0 ? `1px solid ${border.divider}` : undefined }}
            >
              <Plus size={14} />
              <span className="truncate">Add “{typed}”</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
