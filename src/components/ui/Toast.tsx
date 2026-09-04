import { CheckCircle, XCircle, Info, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import type { Toast } from '../../hooks/useToast'

interface ToastContainerProps {
  toasts: Toast[]
  onDismiss: (id: string) => void
}

const icons = {
  success: <CheckCircle size={18} className="text-green-500" />,
  error:   <XCircle size={18} className="text-red-500" />,
  info:    <Info size={18} className="text-blue-500" />,
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (!toasts.length) return null
  // Portalled to <body>, same as Modal — otherwise an ancestor with backdrop-filter/transform
  // (e.g. styles.card) can contain this `fixed` element inside a lower stacking context, letting
  // a body-portaled Modal render on top of it regardless of this z-index.
  return createPortal(
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} className="flex items-start gap-3 rounded-xl bg-white px-4 py-3 shadow-lg ring-1 ring-slate-200 min-w-[280px] max-w-[360px]">
          <div className="mt-0.5 flex-shrink-0">{icons[t.type]}</div>
          <p className="flex-1 text-sm text-slate-700">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="text-slate-400 hover:text-slate-600">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>,
    document.body
  )
}
