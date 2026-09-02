import { CheckCircle2, XCircle, Clock } from 'lucide-react'
import { paletteStyle } from '../../theme'
import type { LeaveStatus, LeaveType } from '../../types'

export const LEAVE_STATUS_META: Record<LeaveStatus, { label: string; icon: React.ElementType; style: React.CSSProperties }> = {
  PENDING:  { label: 'Pending',  icon: Clock,        style: paletteStyle('yellow', 0.10) },
  APPROVED: { label: 'Approved', icon: CheckCircle2, style: paletteStyle('teal',   0.10) },
  REJECTED: { label: 'Rejected', icon: XCircle,      style: paletteStyle('slate',  0.10) },
}

export const LEAVE_TYPE_LABEL: Record<LeaveType, string> = {
  FULL_DAY: 'Full Day',
  HALF_DAY: 'Half Day',
}

export function LeaveStatusBadge({ status }: { status: LeaveStatus }) {
  const meta = LEAVE_STATUS_META[status]
  const Icon = meta.icon
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium" style={meta.style}>
      <Icon size={11} />
      {meta.label}
    </span>
  )
}
