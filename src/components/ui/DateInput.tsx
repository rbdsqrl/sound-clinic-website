import { InputHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { clsx } from '../../lib/clsx'
import { colors } from '../../theme'

interface DateInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  label?: string
  /** ISO 'yyyy-MM-dd', same as a native date input's value. */
  value: string
  onChange: (value: string) => void
}

/** A native date input displays in whatever format the browser/OS locale dictates (e.g.
 *  MM/dd/yyyy on a US-locale Chrome), with no supported way to override that formatting
 *  directly. This layers an invisible native date input — kept for its calendar picker and
 *  ISO value — under a visible dd/MM/yyyy label, so the picker UX is unchanged but the
 *  displayed text is locale-independent. */
export function DateInput({ label, value, onChange, id, className, ...props }: DateInputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="space-y-1">
      {label && <label htmlFor={inputId} className="form-label">{label}</label>}
      <div className="relative">
        <input
          id={inputId}
          type="date"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          {...props}
        />
        <div className={clsx('form-input pr-9 pointer-events-none', className)}>
          {formatDdMmYyyy(value)}
        </div>
        <ChevronDown
          size={15}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
          style={{ color: colors.text.muted }}
        />
      </div>
    </div>
  )
}

function formatDdMmYyyy(iso: string): string {
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return ''
  return `${d}/${m}/${y}`
}
