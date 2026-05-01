import { ButtonHTMLAttributes, ReactNode } from 'react'
import { clsx } from '../../lib/clsx'
import { styles } from '../../theme'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  children: ReactNode
}

const BASE = 'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-200 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed'

const SIZES = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-sm',
}

const VARIANT_STYLES: Record<string, React.CSSProperties> = {
  primary:   styles.buttonPrimary,
  secondary: styles.buttonSecondary,
  danger:    styles.buttonDanger,
  ghost:     styles.buttonGhost,
}

export function Button({ variant = 'primary', size = 'md', loading, children, className, disabled, style, ...props }: ButtonProps) {
  return (
    <button
      className={clsx(BASE, SIZES[size], className)}
      style={{ ...VARIANT_STYLES[variant], ...style }}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
      )}
      {children}
    </button>
  )
}
