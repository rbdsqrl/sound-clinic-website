import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { accentAlpha, colors } from '../../theme'

const THRESHOLD = 64  // px of pull before release triggers a refresh
const MAX_PULL = 90   // px cap — pulling past the threshold gets resistance, not a 1:1 drag
const INDICATOR_H = 44

/**
 * Wraps the app's single shared scroll container (see AppLayout.tsx) so every page gets
 * pull-to-refresh for free — no per-page wiring. Release past the threshold calls
 * `queryClient.refetchQueries({ type: 'active' })`, which refetches whatever queries the
 * current page has mounted, without needing to know what page that is.
 *
 * Touch handling is native (not JSX onTouch* props) because React attaches touchmove listeners
 * as passive by default, which silently drops preventDefault() — without it, the browser's own
 * overscroll/bounce fights this component's indicator instead of being suppressed by it.
 */
export function PullToRefresh({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const containerRef = useRef<HTMLElement>(null)
  const startY = useRef<number | null>(null)
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onTouchStart = (e: TouchEvent) => {
      if (refreshing) return
      startY.current = el.scrollTop <= 0 ? e.touches[0].clientY : null
    }

    const onTouchMove = (e: TouchEvent) => {
      if (startY.current === null || refreshing) return
      if (el.scrollTop > 0) { startY.current = null; setDragging(false); setPull(0); return }
      const delta = e.touches[0].clientY - startY.current
      if (delta <= 0) { setDragging(false); setPull(0); return }
      e.preventDefault()
      setDragging(true)
      const resisted = delta < THRESHOLD ? delta : THRESHOLD + (delta - THRESHOLD) * 0.35
      setPull(Math.min(MAX_PULL, resisted))
    }

    const onTouchEnd = () => {
      if (startY.current === null) return
      startY.current = null
      setDragging(false)
      setPull(current => {
        if (current >= THRESHOLD) {
          setRefreshing(true)
          queryClient.refetchQueries({ type: 'active' }).finally(() => {
            setRefreshing(false)
            setPull(0)
          })
          return THRESHOLD
        }
        return 0
      })
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [refreshing, queryClient])

  const progress = Math.min(1, pull / THRESHOLD)
  const indicatorHeight = refreshing ? INDICATOR_H : pull

  return (
    <main ref={containerRef} className="flex-1 overflow-y-auto">
      <div
        className="flex items-end justify-center overflow-hidden"
        style={{ height: indicatorHeight, transition: dragging ? 'none' : 'height 200ms ease-out' }}
      >
        <div className="pb-2.5" style={{ opacity: refreshing ? 1 : progress }}>
          <div
            className="h-5 w-5 rounded-full"
            style={{
              border: `2px solid ${accentAlpha(0.15)}`,
              borderTopColor: colors.accent,
              transform: refreshing ? undefined : `rotate(${progress * 360}deg)`,
              animation: refreshing ? 'ptr-spin 0.6s linear infinite' : undefined,
            }}
          />
        </div>
      </div>
      {children}
      <style>{'@keyframes ptr-spin { to { transform: rotate(360deg) } }'}</style>
    </main>
  )
}
