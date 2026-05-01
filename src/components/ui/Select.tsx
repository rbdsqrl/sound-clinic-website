import { forwardRef, SelectHTMLAttributes } from 'react'
import { clsx } from '../../lib/clsx'

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
        <select
          ref={ref}
          id={inputId}
          className={clsx('form-input', error && 'border-red-400 focus:border-red-500 focus:ring-red-500', className)}
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
        {error && <p className="form-error">{error}</p>}
      </div>
    )
  }
)
Select.displayName = 'Select'
