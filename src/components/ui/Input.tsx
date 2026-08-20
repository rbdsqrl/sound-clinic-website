import { forwardRef, InputHTMLAttributes, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { clsx } from '../../lib/clsx'
import { colors } from '../../theme'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  /** Password fields get a reveal toggle by default. Pass false to suppress it. */
  revealToggle?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, id, type, revealToggle, ...props }, ref) => {
    const [revealed, setRevealed] = useState(false)
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    const canReveal = type === 'password' && revealToggle !== false
    const resolvedType = canReveal && revealed ? 'text' : type

    return (
      <div className="space-y-1">
        {label && <label htmlFor={inputId} className="form-label">{label}</label>}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={resolvedType}
            className={clsx(
              'form-input',
              canReveal && 'pr-10',
              error && 'border-red-500/50 focus:border-red-500',
              className,
            )}
            {...props}
          />
          {canReveal && (
            <button
              type="button"
              onClick={() => setRevealed(r => !r)}
              tabIndex={-1}
              aria-label={revealed ? 'Hide password' : 'Show password'}
              aria-pressed={revealed}
              className="absolute inset-y-0 right-0 flex items-center px-3 transition-colors"
              style={{ color: colors.text.dim }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = colors.accent)}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = colors.text.dim)}
            >
              {revealed ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          )}
        </div>
        {error && <p className="form-error">{error}</p>}
        {!error && hint && <p className="mt-1 text-xs" style={{ color: '#3E5070' }}>{hint}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'
