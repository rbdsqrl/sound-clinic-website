import { ReactNode } from 'react'
import { clsx } from '../../lib/clsx'
import { colors, styles, palette, rgba, shadow } from '../../theme'

interface CardProps {
  children: ReactNode
  className?: string
  padding?: boolean
}

export function Card({ children, className, padding = true }: CardProps) {
  return (
    <div className={clsx(padding && 'p-4 md:p-6', className)} style={styles.card}>
      {children}
    </div>
  )
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h2 className="text-lg font-semibold" style={{ color: colors.text.primary }}>{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm" style={{ color: colors.text.dim }}>{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0 ml-4">{action}</div>}
    </div>
  )
}

const STAT_COLORS: Record<string, { key: keyof typeof palette }> = {
  teal:   { key: 'teal'   },
  blue:   { key: 'blue'   },
  green:  { key: 'green'  },
  purple: { key: 'purple' },
}

export function StatCard({ label, value, icon, color = 'teal' }: {
  label: string; value: string | number; icon: ReactNode; color?: string
}) {
  const entry = STAT_COLORS[color] ?? STAT_COLORS.teal
  const p = palette[entry.key]
  return (
    <Card>
      <div className="flex items-center gap-4">
        <div
          className="rounded-xl p-3 flex-shrink-0"
          style={{
            background: rgba(p.raw, 0.08),
            color:      p.text,
            boxShadow:  shadow.cardStat(rgba(p.raw, 0.20)),
          }}
        >
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold" style={{ color: colors.text.heading }}>{value}</p>
          <p className="text-sm"            style={{ color: colors.text.muted }}>{label}</p>
        </div>
      </div>
    </Card>
  )
}
