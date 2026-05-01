import { paletteStyle, type PaletteKey } from '../../theme'

type BadgeVariant = PaletteKey

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
}

export function Badge({ children, variant = 'slate' }: BadgeProps) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={paletteStyle(variant)}
    >
      {children}
    </span>
  )
}

export function roleBadge(role: string) {
  const map: Record<string, BadgeVariant> = {
    ADMIN:          'red',
    BUSINESS_OWNER: 'purple',
    THERAPIST:      'blue',
    DOCTOR:         'teal',
    PARENT:         'green',
    PATIENT:        'yellow',
  }
  return <Badge variant={map[role] ?? 'slate'}>{role.replace('_', ' ')}</Badge>
}

export function statusBadge(status: string) {
  const map: Record<string, BadgeVariant> = {
    PENDING:  'yellow',
    ACCEPTED: 'green',
    EXPIRED:  'red',
    CANCELLED: 'slate',
  }
  return <Badge variant={map[status] ?? 'slate'}>{status}</Badge>
}
