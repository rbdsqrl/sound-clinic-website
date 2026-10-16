import { isAxiosError } from 'axios'

/** The server couldn't be reached, or failed — as opposed to it answering "no" (a 4xx), which retrying won't change. */
export function isServerProblem(error: unknown): boolean {
  if (!isAxiosError(error)) return false
  const status = error.response?.status
  return status === undefined || status >= 500
}

/**
 * Retry rule for queries. A sleeping or restarting backend (a cold start, a memory-limit restart) can take
 * tens of seconds to answer, so server and network failures are retried a few times with growing pauses
 * before the screen gives up. An answered request (401 is handled by the client's token refresh; 403, 404 and
 * the like) is never retried.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  return isServerProblem(error) && failureCount < 4
}

/**
 * Plain-language wording for a server failure, so a screen can say "this is the server" instead of showing an
 * empty list. `kind` separates "no answer in time / unreachable" (a sleeping or restarting backend) from "the
 * server answered with an error", which is what lets someone tell an outage from a real functional bug.
 */
export function describeServerProblem(error: unknown): { kind: 'timeout' | 'error'; headline: string; detail: string } {
  const status = isAxiosError(error) ? error.response?.status : undefined
  if (status !== undefined && status >= 500) {
    return {
      kind: 'error',
      headline: `Server error (${status})`,
      detail: 'The server ran into a problem handling this request. This is a server issue, not a problem with your data or account — please try again in a moment.',
    }
  }
  return {
    kind: 'timeout',
    headline: 'Server is taking too long to respond',
    detail: 'The server is slow to wake up or temporarily unavailable. This is a server issue, not a problem with your data or account — please try again in a moment.',
  }
}

/** 1s, 2s, 4s, 8s — capped. */
export const queryRetryDelay = (attempt: number) => Math.min(1000 * 2 ** attempt, 8000)
