import { useState } from 'react'
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
}

/** Toggleable pill multi-select — the pattern PatientDetailPage's "Add Condition" modal
 *  hand-rolled once; pulled out here because Activities needs it for Skills, Languages,
 *  and Props Required. */
export function MultiSelectChips({
  label, options, selected, onChange, searchable = true, emptyMessage = 'No options available.',
}: MultiSelectChipsProps) {
  const [query, setQuery] = useState('')

  const filtered = searchable && query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options

  const toggle = (value: string) => {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value])
  }

  return (
    <div>
      {label && <label className="form-label">{label}</label>}
      {searchable && options.length > 6 && (
        <input
          type="text"
          className="form-input mb-2"
          placeholder="Start typing…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}
      {options.length === 0 ? (
        <p className="text-sm" style={{ color: colors.text.dim }}>{emptyMessage}</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm" style={{ color: colors.text.dim }}>No matches.</p>
      ) : (
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
        </div>
      )}
      {selected.length > 0 && (
        <p className="text-xs mt-1.5" style={{ color: colors.text.dim }}>{selected.length} selected</p>
      )}
    </div>
  )
}
