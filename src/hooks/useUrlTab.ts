import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

/** "Baseline Report" → "baseline-report" — what appears in the address bar. */
const slug = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

/**
 * Tab state that lives in the URL (`?tab=parents`) instead of component state, so a reload, the browser's
 * Back button, or a shared link lands on the same tab rather than the first one.
 *
 * - An unknown or missing value falls back to `fallback`, which is also the tab with no `?tab=` at all
 *   (so the default URL stays clean).
 * - Switching replaces the history entry rather than adding one, so Back leaves the page instead of
 *   stepping through every tab you clicked.
 * - `reset` names other params to drop when the tab changes (e.g. a sub-tab that belongs to the old tab).
 */
export function useUrlTab<T extends string>(
  allowed: readonly T[],
  fallback: T,
  opts: { param?: string; reset?: string[] } = {},
): [T, (next: T) => void] {
  const { param = 'tab', reset = [] } = opts
  const [searchParams, setSearchParams] = useSearchParams()

  const raw = searchParams.get(param)
  const value = (raw && allowed.find(a => slug(a) === raw)) || fallback

  const setValue = useCallback((next: T) => {
    setSearchParams(prev => {
      const params = new URLSearchParams(prev)
      if (next === fallback) params.delete(param)
      else params.set(param, slug(next))
      reset.forEach(r => params.delete(r))
      return params
    }, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fallback, param, setSearchParams, reset.join('|')])

  return [value, setValue]
}
