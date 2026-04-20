import { forwardRef, SelectHTMLAttributes } from 'react'
import { clsx } from '../../lib/clsx'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  placeholder?: string
  options: { value: string; label: string }[]
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
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {error && <p className="form-error">{error}</p>}
      </div>
    )
  }
)
Select.displayName = 'Select'
