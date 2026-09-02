import { clsx } from '../../lib/clsx'
import { styles } from '../../theme'

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const SIZE_CLASSES: Record<AvatarSize, string> = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-7 w-7 text-xs',
  md: 'h-8 w-8 text-xs',
  lg: 'h-9 w-9 text-sm',
  xl: 'h-12 w-12 text-base',
}

interface AvatarProps {
  /** Pre-computed initials — callers vary in how many letters they show (e.g. one for a free-text name, two for first+last), so this stays their call. */
  initials: string
  size?: AvatarSize
  shape?: 'circle' | 'square'
  /** font-bold instead of the default font-semibold */
  bold?: boolean
  /** Defaults to the standard accent avatar tint (`styles.avatar`) */
  color?: React.CSSProperties
  title?: string
  className?: string
}

/** Initials circle used for people (staff, therapists, parents) across the app. */
export function Avatar({ initials, size = 'md', shape = 'circle', bold = false, color, title, className }: AvatarProps) {
  return (
    <div
      title={title}
      className={clsx(
        SIZE_CLASSES[size],
        shape === 'circle' ? 'rounded-full' : 'rounded-xl',
        'flex items-center justify-center flex-shrink-0',
        bold ? 'font-bold' : 'font-semibold',
        className,
      )}
      style={color ?? styles.avatar}
    >
      {initials}
    </div>
  )
}
