import { ReactNode, useEffect } from 'react'
import { X } from 'lucide-react'
import { colors, styles, border } from '../../theme'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string | ReactNode
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
}

export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (open) {
      document.addEventListener('keydown', handler)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  const widths = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0" style={styles.modalBackdrop} onClick={onClose} />

      {/* Panel */}
      <div
        className={`relative w-full ${widths[size]} rounded-t-2xl sm:rounded-2xl max-h-[92dvh] flex flex-col`}
        style={styles.modal}
      >
        {/* Mobile drag handle */}
        <div className="flex justify-center pt-2.5 pb-0 sm:hidden flex-shrink-0">
          <div className="h-1 w-10 rounded-full" style={{ background: border.drag }} />
        </div>

        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: `1px solid ${border.divider}` }}
        >
          <h2 className="text-base font-semibold" style={{ color: colors.text.primary }}>{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 transition-colors"
            style={{ color: colors.text.dim }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = colors.text.primary}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = colors.text.dim}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto px-5 py-5 flex-1">
          {children}
        </div>
      </div>
    </div>
  )
}
