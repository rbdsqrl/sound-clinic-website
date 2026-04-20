import { ReactNode } from 'react'
import { clsx } from '../../lib/clsx'

interface CardProps {
  children: ReactNode
  className?: string
  padding?: boolean
}

export function Card({ children, className, padding = true }: CardProps) {
  return (
    <div className={clsx('rounded-2xl bg-white shadow-sm ring-1 ring-slate-100', padding && 'p-6', className)}>
      {children}
    </div>
  )
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0 ml-4">{action}</div>}
    </div>
  )
}

export function StatCard({ label, value, icon, color = 'teal' }: {
  label: string; value: string | number; icon: ReactNode; color?: string
}) {
  const colors: Record<string, string> = {
    teal:   'bg-primary-50 text-primary-600',
    blue:   'bg-blue-50 text-blue-600',
    green:  'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
  }
  return (
    <Card>
      <div className="flex items-center gap-4">
        <div className={clsx('rounded-xl p-3', colors[color] ?? colors.teal)}>{icon}</div>
        <div>
          <p className="text-2xl font-bold text-slate-800">{value}</p>
          <p className="text-sm text-slate-500">{label}</p>
        </div>
      </div>
    </Card>
  )
}
