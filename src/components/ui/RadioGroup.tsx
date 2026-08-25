import { colors, border, surface } from '../../theme'

export interface RadioOption {
  value: string
  label: string
}

interface RadioGroupProps {
  label?: string
  options: RadioOption[]
  value: string | null
  onChange: (value: string | null) => void
  /** Shows a "Clear" action next to the label, matching the legacy Case History form. */
  clearable?: boolean
}

/** Single-select pill group — same toggle-pill visual language as MultiSelectChips, sized for a
 *  44px touch target instead of a bare radio circle. Clicking the active pill clears it. */
export function RadioGroup({ label, options, value, onChange, clearable = false }: RadioGroupProps) {
  return (
    <div>
      {(label || clearable) && (
        <div className="flex items-center justify-between mb-1.5">
          {label && <label className="form-label !mb-0">{label}</label>}
          {clearable && value && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="text-xs font-semibold flex items-center gap-1"
              style={{ color: colors.text.dim }}
            >
              Clear
            </button>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {options.map(opt => {
          const isSelected = value === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(isSelected ? null : opt.value)}
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
    </div>
  )
}
