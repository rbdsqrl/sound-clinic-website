import { ReactNode } from 'react'
import { Button } from './Button'
import { colors, styles } from '../../theme'

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 rounded-2xl p-5" style={styles.emptyIcon}>
        {icon}
      </div>
      <h3 className="text-base font-semibold" style={{ color: colors.text.primary }}>{title}</h3>
      {description && (
        <p className="mt-1 text-sm max-w-sm" style={{ color: colors.text.dim }}>{description}</p>
      )}
      {action && (
        <div className="mt-4">
          <Button onClick={action.onClick}>{action.label}</Button>
        </div>
      )}
    </div>
  )
}
