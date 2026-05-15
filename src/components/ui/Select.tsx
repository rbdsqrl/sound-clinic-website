import { forwardRef, SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { clsx } from '../../lib/clsx'
import { colors } from '../../theme'

export interface SelectOption {
  value: string
  label: string
}

export interface SelectOptionGroup {
  group: string
  options: SelectOption[]
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  placeholder?: string
  /** Either a flat array of options OR an array of grouped options */
  options: SelectOption[] | SelectOptionGroup[]
}

function isGrouped(opts: SelectOption[] | SelectOptionGroup[]): opts is SelectOptionGroup[] {
  return opts.length > 0 && 'group' in opts[0]
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, placeholder, options, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="space-y-1">
        {label && <label htmlFor={inputId} className="form-label">{label}</label>}
        <div className="relative select-icon-wrapper">
          <select
            ref={ref}
            id={inputId}
            className={clsx(
              'form-input pr-9 cursor-pointer',
              error && 'border-red-400 focus:border-red-500',
              className
            )}
            {...props}
          >
            {placeholder && <option value="">{placeholder}</option>}
            {isGrouped(options)
              ? options.map((g) => (
                  <optgroup key={g.group} label={g.group}>
                    {g.options.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </optgroup>
                ))
              : options.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))
            }
          </select>
          <ChevronDown
            size={15}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
            style={{ color: colors.text.muted }}
          />
        </div>
        {error && <p className="form-error">{error}</p>}
      </div>
    )
  }
)
Select.displayName = 'Select'
