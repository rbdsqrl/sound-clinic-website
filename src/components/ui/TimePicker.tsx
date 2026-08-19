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

const HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]

function parse(value: string): { h24: number; min: number } {
  if (!value || !value.includes(':')) return { h24: 8, min: 0 }
  const [h, m] = value.split(':').map(Number)
  return { h24: isNaN(h) ? 8 : h, min: isNaN(m) ? 0 : m }
}

function to12(h24: number): { hour: number; ampm: 'AM' | 'PM' } {
  return { hour: h24 % 12 || 12, ampm: h24 >= 12 ? 'PM' : 'AM' }
}

function to24h(hour: number, ampm: 'AM' | 'PM'): number {
  return ampm === 'PM' ? (hour % 12) + 12 : hour % 12
}

export function TimePicker({ value, onChange, label, error, placeholder = 'Select time' }: TimePickerProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const hourListRef = useRef<HTMLDivElement>(null)
  const minListRef = useRef<HTMLDivElement>(null)

  const { h24, min } = parse(value)
  const { hour, ampm } = to12(h24)
  const displayValue = value
    ? `${hour}:${String(min).padStart(2, '0')} ${ampm}`
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
    onChange(`${String(to24h(h, ampm)).padStart(2, '0')}:${String(min).padStart(2, '0')}`)

  const setMin = (m: number) =>
    onChange(`${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`)

  const setAmpm = (ap: 'AM' | 'PM') =>
    onChange(`${String(to24h(hour, ap)).padStart(2, '0')}:${String(min).padStart(2, '0')}`)

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
            width: '208px',
          }}
        >
          {/* Column headers */}
          <div
            className="grid text-[11.5px] font-semibold uppercase tracking-wider"
            style={{
              gridTemplateColumns: '1fr 1fr 52px',
              borderBottom: `1px solid ${border.divider}`,
              color: colors.text.muted,
            }}
          >
            <span className="px-3 py-2 text-center">Hour</span>
            <span className="px-3 py-2 text-center" style={{ borderLeft: `1px solid ${border.divider}` }}>Min</span>
            <span className="px-3 py-2 text-center" style={{ borderLeft: `1px solid ${border.divider}` }} />
          </div>

          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 52px' }}>
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
              style={{ maxHeight: '180px', borderRight: `1px solid ${border.divider}` }}
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

            {/* AM / PM */}
            <div className="flex flex-col items-center justify-center gap-1.5 p-1.5">
              {(['AM', 'PM'] as const).map(ap => (
                <button
                  key={ap}
                  type="button"
                  onClick={() => setAmpm(ap)}
                  className="w-full py-2 rounded-xl text-xs font-semibold transition-all"
                  style={{
                    background: ap === ampm ? accentAlpha(0.14) : 'transparent',
                    color: ap === ampm ? colors.accent : colors.text.muted,
                    border: `1px solid ${ap === ampm ? accentAlpha(0.28) : 'transparent'}`,
                  }}
                >
                  {ap}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
