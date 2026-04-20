import { clsx } from '../../lib/clsx'

type BadgeVariant = 'green' | 'red' | 'yellow' | 'blue' | 'purple' | 'slate' | 'teal'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
}

const styles: Record<BadgeVariant, string> = {
  green:  'bg-green-50 text-green-700 ring-1 ring-green-200',
  red:    'bg-red-50 text-red-700 ring-1 ring-red-200',
  yellow: 'bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200',
  blue:   'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  purple: 'bg-purple-50 text-purple-700 ring-1 ring-purple-200',
  slate:  'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
  teal:   'bg-primary-50 text-primary-700 ring-1 ring-primary-200',
}

export function Badge({ children, variant = 'slate' }: BadgeProps) {
  return (
    <span className={clsx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', styles[variant])}>
      {children}
    </span>
  )
}

export function roleBadge(role: string) {
  const map: Record<string, BadgeVariant> = {
    ADMIN: 'red',
    BUSINESS_OWNER: 'purple',
    THERAPIST: 'blue',
    DOCTOR: 'teal',
    PARENT: 'green',
    PATIENT: 'yellow',
  }
  return <Badge variant={map[role] ?? 'slate'}>{role.replace('_', ' ')}</Badge>
}

export function statusBadge(status: string) {
  const map: Record<string, BadgeVariant> = {
    PENDING: 'yellow',
    ACCEPTED: 'green',
    EXPIRED: 'red',
    CANCELLED: 'slate',
  }
  return <Badge variant={map[status] ?? 'slate'}>{status}</Badge>
}
