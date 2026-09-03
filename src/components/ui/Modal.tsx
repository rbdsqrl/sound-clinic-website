import { ReactNode, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { colors, styles, border, surface } from '../../theme'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string | ReactNode
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'full'
  /** 'side' anchors the panel to the right edge, full height (e.g. Review Meeting feedback) — everything else about it (header, scrollable content, footer) is identical to the default centered dialog. */
  variant?: 'center' | 'side'
  /** Rendered pinned to the bottom of the panel, below the scrollable content (e.g. Save actions). */
  footer?: ReactNode
  /** Rendered in the header, to the left of the close button (e.g. a Reschedule shortcut). */
  headerActions?: ReactNode
}

export function Modal({ open, onClose, title, children, size = 'md', variant = 'center', footer, headerActions }: ModalProps) {
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

  const widths = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', full: 'sm:max-w-4xl' }
  // Wider than the centered-dialog scale above — a side panel reads cramped at the
  // same breakpoints that work for a dialog pinned in the middle of the screen.
  const sideWidths = { sm: 'sm:max-w-md', md: 'sm:max-w-2xl', lg: 'sm:max-w-3xl', full: 'sm:max-w-5xl' }
  const isFull = size === 'full'

  if (variant === 'side') {
    return createPortal(
      <>
        {/* Backdrop — dims and blurs the page behind the panel on every breakpoint. */}
        <div className="fixed inset-0 z-40" onClick={onClose} style={styles.modalBackdrop} />

        {/* Panel */}
        <div
          className={`fixed right-0 top-0 h-full z-50 w-full ${sideWidths[size]} flex flex-col shadow-2xl`}
          style={{ background: surface.card, borderLeft: `1px solid ${border.card}` }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-5 py-4 flex-shrink-0"
            style={{ borderBottom: `1px solid ${border.divider}` }}
          >
            <h2 className="text-base font-semibold" style={{ color: colors.text.primary }}>{title}</h2>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {headerActions}
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
          </div>

          {/* Content */}
          <div className="overflow-y-auto px-5 py-5 flex-1">
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div
              className="flex items-center justify-end gap-2.5 px-5 py-4 flex-shrink-0"
              style={{ borderTop: `1px solid ${border.divider}` }}
            >
              {footer}
            </div>
          )}
        </div>
      </>,
      document.body
    )
  }

  // Portalled to <body> so a modal rendered from deep inside the tree (e.g. nested inside a
  // Card, which sets backdrop-filter) never has its `fixed` positioning contained by an
  // ancestor — backdrop-filter/transform/perspective on any ancestor otherwise turns `fixed`
  // into "fixed relative to that ancestor" per the CSS spec, breaking full-screen coverage.
  return createPortal(
    <div className={`fixed inset-0 z-50 flex justify-center ${isFull ? 'items-center p-0 sm:p-4' : 'items-end sm:items-center'}`}>
      {/* Backdrop */}
      <div className="absolute inset-0" style={styles.modalBackdrop} onClick={onClose} />

      {/* Panel */}
      <div
        className={`relative w-full ${widths[size]} ${isFull ? 'h-full sm:h-[92dvh] rounded-none sm:rounded-2xl' : 'rounded-t-2xl sm:rounded-2xl max-h-[92dvh]'} flex flex-col`}
        style={styles.modal}
      >
        {/* Mobile drag handle */}
        {!isFull && (
          <div className="flex justify-center pt-2.5 pb-0 sm:hidden flex-shrink-0">
            <div className="h-1 w-10 rounded-full" style={{ background: border.drag }} />
          </div>
        )}

        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: `1px solid ${border.divider}` }}
        >
          <h2 className="text-base font-semibold" style={{ color: colors.text.primary }}>{title}</h2>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {headerActions}
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
        </div>

        {/* Content */}
        <div className="overflow-y-auto px-5 py-5 flex-1">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div
            className="flex items-center justify-end gap-2.5 px-5 py-4 flex-shrink-0"
            style={{ borderTop: `1px solid ${border.divider}` }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
