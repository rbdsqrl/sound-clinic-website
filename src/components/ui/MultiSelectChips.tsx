import { useState } from 'react'
import { Plus } from 'lucide-react'
import { colors, border, surface } from '../../theme'

export interface ChipOption {
  value: string
  label: string
}

interface MultiSelectChipsProps {
  label?: string
  options: ChipOption[]
  selected: string[]
  onChange: (selected: string[]) => void
  searchable?: boolean
  emptyMessage?: string
  /** When provided, typing a name with no match shows a "+ Create" option that calls this and
   *  auto-selects the result. Lets a lower-privileged role (e.g. a therapist adding a prop) add
   *  to the list inline instead of needing an admin to pre-populate it. */
  onCreate?: (name: string) => Promise<{ value: string; label: string }>
}

/** Toggleable pill multi-select — the pattern PatientDetailPage's "Add Condition" modal
 *  hand-rolled once; pulled out here because Activities needs it for Skills, Languages,
 *  and Props Required. */
export function MultiSelectChips({
  label, options, selected, onChange, searchable = true, emptyMessage = 'No options available.', onCreate,
}: MultiSelectChipsProps) {
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)

  const showSearch = searchable && (options.length > 6 || !!onCreate)
  const trimmedQuery = query.trim()
  const filtered = showSearch && trimmedQuery
    ? options.filter((o) => o.label.toLowerCase().includes(trimmedQuery.toLowerCase()))
    : options

  const exactMatch = trimmedQuery
    ? options.some((o) => o.label.toLowerCase() === trimmedQuery.toLowerCase())
    : true

  const toggle = (value: string) => {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value])
  }

  const handleCreate = async () => {
    if (!onCreate || !trimmedQuery || creating) return
    setCreating(true)
    try {
      const created = await onCreate(trimmedQuery)
      onChange(selected.includes(created.value) ? selected : [...selected, created.value])
      setQuery('')
    } catch {
      // The caller is responsible for surfacing its own error (e.g. a toast).
    } finally {
      setCreating(false)
    }
  }

  return (
    <div>
      {label && <label className="form-label">{label}</label>}
      {showSearch && (
        <input
          type="text"
          className="form-input mb-2"
          placeholder="Start typing…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}
      {options.length === 0 && !onCreate && (
        <p className="text-sm" style={{ color: colors.text.dim }}>{emptyMessage}</p>
      )}
      {(options.length > 0 || onCreate) && (
        <div className="flex flex-wrap gap-2">
          {filtered.map((opt) => {
            const isSelected = selected.includes(opt.value)
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggle(opt.value)}
                className="px-3 py-1.5 rounded-full text-sm font-medium transition-all min-h-[36px]"
                style={isSelected
                  ? { background: 'var(--color-accent)', color: '#fff' }
                  : { background: surface.card, color: colors.text.primary, border: `1px solid ${border.divider}` }
                }
              >
                {opt.label}
              </button>
            )
          })}
          {onCreate && trimmedQuery && !exactMatch && (
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium transition-all min-h-[36px] disabled:opacity-60"
              style={{ background: 'transparent', color: colors.accent, border: `1px dashed ${colors.accent}` }}
            >
              <Plus size={13} /> {creating ? 'Adding…' : `Add "${trimmedQuery}"`}
            </button>
          )}
          {options.length === 0 && !trimmedQuery && (
            <p className="text-sm" style={{ color: colors.text.dim }}>{emptyMessage}</p>
          )}
        </div>
      )}
      {selected.length > 0 && (
        <p className="text-xs mt-1.5" style={{ color: colors.text.dim }}>{selected.length} selected</p>
      )}
    </div>
  )
}
