import { useState, useRef, useEffect } from 'react'
import { Clock } from 'lucide-react'
import { colors, surface, border, accentAlpha } from '../../theme'
import { clsx } from '../../lib/clsx'

interface TimePickerProps {
  value: string
  onChange: (value: string) => void
  label?: string
  error?: string
  placeholder?: string
}

// 24-hour format throughout — an explicit AM/PM picker still left room to fat-finger the wrong
// half of the day (and a native <input type="time"> is worse still, rendering 12h or 24h
// depending on the browser/OS locale). A single 00–23 hour column removes the ambiguity outright.
const HOURS = Array.from({ length: 24 }, (_, i) => i)
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]

function parse(value: string): { hour: number; min: number } {
  if (!value || !value.includes(':')) return { hour: 8, min: 0 }
  const [h, m] = value.split(':').map(Number)
  return { hour: isNaN(h) ? 8 : h, min: isNaN(m) ? 0 : m }
}

export function TimePicker({ value, onChange, label, error, placeholder = 'Select time' }: TimePickerProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const hourListRef = useRef<HTMLDivElement>(null)
  const minListRef = useRef<HTMLDivElement>(null)

  const { hour, min } = parse(value)
  const displayValue = value
    ? `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`
    : ''

  useEffect(() => {
    if (!open) return
    const id = setTimeout(() => {
      hourListRef.current?.querySelector<HTMLElement>('[data-selected="true"]')
        ?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      minListRef.current?.querySelector<HTMLElement>('[data-selected="true"]')
        ?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }, 30)
    return () => clearTimeout(id)
  }, [open])

  useEffect(() => {
    if (!open) return
    const handle = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  const setHour = (h: number) =>
    onChange(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`)

  const setMin = (m: number) =>
    onChange(`${String(hour).padStart(2, '0')}:${String(m).padStart(2, '0')}`)

  return (
    <div className="space-y-1 relative" ref={containerRef}>
      {label && <label className="form-label">{label}</label>}

      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={clsx(
          'form-input w-full flex items-center gap-2 cursor-pointer text-left',
          open && 'ring-2',
          error && 'border-red-500/50'
        )}
        style={open ? { outline: 'none', borderColor: colors.accent } : undefined}
      >
        <Clock size={14} style={{ color: colors.text.muted, flexShrink: 0 }} />
        <span style={{ color: displayValue ? colors.text.primary : colors.text.dim }}>
          {displayValue || placeholder}
        </span>
      </button>

      {error && <p className="form-error">{error}</p>}

      {open && (
        <div
          className="absolute left-0 top-full mt-1.5 z-50 rounded-2xl overflow-hidden"
          style={{
            background: surface.card,
            border: `1px solid ${border.medium}`,
            boxShadow: '0 12px 40px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)',
            width: '160px',
          }}
        >
          {/* Column headers */}
          <div
            className="grid text-[11.5px] font-semibold uppercase tracking-wider"
            style={{
              gridTemplateColumns: '1fr 1fr',
              borderBottom: `1px solid ${border.divider}`,
              color: colors.text.muted,
            }}
          >
            <span className="px-3 py-2 text-center">Hour</span>
            <span className="px-3 py-2 text-center" style={{ borderLeft: `1px solid ${border.divider}` }}>Min</span>
          </div>

          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            {/* Hours */}
            <div
              ref={hourListRef}
              className="overflow-y-auto"
              style={{ maxHeight: '180px', borderRight: `1px solid ${border.divider}` }}
            >
              {HOURS.map(h => (
                <button
                  key={h}
                  type="button"
                  data-selected={h === hour ? 'true' : 'false'}
                  onClick={() => setHour(h)}
                  className="w-full py-2 text-sm text-center transition-colors"
                  style={{
                    background: h === hour ? accentAlpha(0.12) : 'transparent',
                    color: h === hour ? colors.accent : colors.text.primary,
                    fontWeight: h === hour ? 600 : 400,
                  }}
                  onMouseEnter={e => { if (h !== hour) (e.currentTarget as HTMLElement).style.background = accentAlpha(0.05) }}
                  onMouseLeave={e => { if (h !== hour) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  {String(h).padStart(2, '0')}
                </button>
              ))}
            </div>

            {/* Minutes */}
            <div
              ref={minListRef}
              className="overflow-y-auto"
              style={{ maxHeight: '180px' }}
            >
              {MINUTES.map(m => (
                <button
                  key={m}
                  type="button"
                  data-selected={m === min ? 'true' : 'false'}
                  onClick={() => setMin(m)}
                  className="w-full py-2 text-sm text-center transition-colors"
                  style={{
                    background: m === min ? accentAlpha(0.12) : 'transparent',
                    color: m === min ? colors.accent : colors.text.primary,
                    fontWeight: m === min ? 600 : 400,
                  }}
                  onMouseEnter={e => { if (m !== min) (e.currentTarget as HTMLElement).style.background = accentAlpha(0.05) }}
                  onMouseLeave={e => { if (m !== min) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  {String(m).padStart(2, '0')}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
