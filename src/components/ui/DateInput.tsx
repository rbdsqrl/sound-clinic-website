import { InputHTMLAttributes } from 'react'
import { clsx } from '../../lib/clsx'

interface DateInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  label?: string
  /** ISO 'yyyy-MM-dd', same as a native date input's value. */
  value: string
  onChange: (value: string) => void
}

/** A plain native date input — same proven pattern used for every other date field in the app
 *  (EnrollmentSessions, CalendarPage, AdHocSessionModal, …). An earlier version of this
 *  component layered an invisible native input under a locale-independent dd/MM/yyyy label to
 *  work around the browser/OS-locale display, but that stacking hack made the field unreliable
 *  to click and select from — not worth it for a cosmetic format difference. */
export function DateInput({ label, value, onChange, id, className, ...props }: DateInputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="space-y-1">
      {label && <label htmlFor={inputId} className="form-label">{label}</label>}
      <input
        id={inputId}
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        className={clsx('form-input w-full', className)}
        {...props}
      />
    </div>
  )
}
