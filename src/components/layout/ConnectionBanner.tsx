import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { WifiOff, RefreshCw } from 'lucide-react'
import { isServerProblem, describeServerProblem } from '../../lib/queryRetry'
import { colors, warningAlpha } from '../../theme'

/**
 * Shown while any on-screen data failed to load because the server couldn't be reached or errored (as opposed
 * to it answering "nothing here"). Without it a failed Cases or Sessions request renders the same empty state
 * as a genuinely empty list, which reads as "my cases are gone". Retry re-requests everything that failed;
 * the banner disappears by itself once they succeed.
 */
export function ConnectionBanner() {
  const qc = useQueryClient()
  const [failed, setFailed] = useState<{ count: number; headline: string; detail: string } | null>(null)
  const [retrying, setRetrying] = useState(false)

  useEffect(() => {
    const cache = qc.getQueryCache()
    const read = () => {
      const errored = cache.getAll()
        .filter(q => q.getObserversCount() > 0 && q.state.status === 'error' && isServerProblem(q.state.error))
      if (errored.length === 0) return null
      // An answered 5xx is the more specific story; otherwise it's a timeout / unreachable server.
      const described = errored.map(q => describeServerProblem(q.state.error))
      const d = described.find(x => x.kind === 'error') ?? described[0]
      return { count: errored.length, headline: d.headline, detail: d.detail }
    }
    setFailed(read())
    return cache.subscribe(() => setFailed(read()))
  }, [qc])

  // While the banner is up, keep trying quietly so it clears by itself once the server is back (a free-tier
  // backend can take a minute to wake) — whoever is looking at the screen doesn't have to keep pressing Retry.
  const hasFailures = !!failed
  useEffect(() => {
    if (!hasFailures) return
    const id = window.setInterval(() => {
      qc.refetchQueries({ predicate: q => q.getObserversCount() > 0 && q.state.status === 'error' && isServerProblem(q.state.error) })
    }, 15_000)
    return () => window.clearInterval(id)
  }, [hasFailures, qc])

  if (!failed) return null

  const retry = async () => {
    setRetrying(true)
    try {
      await qc.refetchQueries({ predicate: q => q.state.status === 'error' && isServerProblem(q.state.error) })
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm flex-shrink-0"
      style={{ background: warningAlpha(0.14), color: colors.status.warning, borderBottom: `1px solid ${warningAlpha(0.3)}` }}
    >
      <span className="flex items-center gap-2 min-w-0">
        <WifiOff size={16} className="flex-shrink-0" />
        <span className="min-w-0">
          <strong className="font-semibold">{failed.headline}.</strong>{' '}
          {failed.detail} Anything that looks empty below may simply not have loaded.
        </span>
      </span>
      <button
        type="button"
        onClick={retry}
        disabled={retrying}
        className="flex items-center gap-1.5 font-semibold flex-shrink-0 disabled:opacity-60"
        style={{ color: colors.status.warning }}
      >
        <RefreshCw size={14} className={retrying ? 'animate-spin' : ''} /> {retrying ? 'Retrying…' : 'Retry'}
      </button>
    </div>
  )
}
