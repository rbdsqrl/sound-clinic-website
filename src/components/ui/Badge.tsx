import { colors, paletteStyle, type PaletteKey } from '../../theme'

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

const ROLE_LABELS: Record<string, string> = {
  BUSINESS_OWNER: 'Business Owner',
  CLINIC_HEAD:    'Clinic Head',
  THERAPIST:      'Therapist',
  PARENT:         'Parent',
  PATIENT:        'Patient',
}

export function roleLabel(role: string): string {
  return ROLE_LABELS[role]
    ?? role.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

/** Convert any SCREAMING_SNAKE enum value to Title Case */
export function labelFromEnum(value: string): string {
  return value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

const SESSION_STATUS_LABELS: Record<string, string> = {
  SCHEDULED:              'Scheduled',
  COMPLETED:              'Completed',
  CANCELLED:              'Cancelled',
  NO_SHOW:                'No Show',
  PENDING_RESCHEDULE:     'Pending Reschedule',
  CANCELLATION_REQUESTED: 'Cancellation Requested',
}

export function sessionStatusLabel(status: string): string {
  return SESSION_STATUS_LABELS[status] ?? labelFromEnum(status)
}

export function roleBadge(role: string) {
  const roleColors = colors.role as Record<string, string>
  const color = roleColors[role] ?? '#6B8499'
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}
    >
      {roleLabel(role)}
    </span>
  )
}

const STATUS_LABELS: Record<string, string> = {
  PENDING:   'Pending',
  ACCEPTED:  'Accepted',
  EXPIRED:   'Expired',
  CANCELLED: 'Cancelled',
  ACTIVE:    'Active',
  INACTIVE:  'Inactive',
}

export function statusBadge(status: string) {
  const variantMap: Record<string, BadgeVariant> = {
    PENDING:   'yellow',
    ACCEPTED:  'green',
    ACTIVE:    'green',
    EXPIRED:   'red',
    INACTIVE:  'red',
    CANCELLED: 'slate',
  }
  const label = STATUS_LABELS[status]
    ?? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
  return <Badge variant={variantMap[status] ?? 'slate'}>{label}</Badge>
}

/**
 * A child's "current status" on the Analytics/progress views — the enrollment care-status enum,
 * plus DISCHARGE, a synthetic value the caller passes once the patient's stage is actually
 * DISCHARGED (a later, separate event from an enrollment being marked PROGRAM_COMPLETED).
 */
export type ChildStatus = 'ON_TRACK' | 'NEEDS_ATTENTION' | 'REVIEW' | 'PROGRAM_COMPLETED' | 'DISCHARGE'

const CHILD_STATUS_VARIANT: Record<ChildStatus, { label: string; variant: BadgeVariant }> = {
  ON_TRACK:          { label: 'On Track',         variant: 'green' },
  NEEDS_ATTENTION:   { label: 'Needs Attention',   variant: 'amber' },
  REVIEW:            { label: 'Review',            variant: 'amber' },
  PROGRAM_COMPLETED: { label: 'Program Completed', variant: 'teal' },
  DISCHARGE:         { label: 'Discharge',         variant: 'blue' },
}

export function childStatusBadge(status: ChildStatus) {
  const v = CHILD_STATUS_VARIANT[status]
  return <Badge variant={v.variant}>{v.label}</Badge>
}
