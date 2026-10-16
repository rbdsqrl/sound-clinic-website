import type { CSSProperties, ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

/**
 * A "back to the list" link that returns to exactly where the user came from — the same tab, page and
 * filters in the URL — when they arrived from inside the app, and falls back to `to` when the page was
 * opened directly (a bookmark, a shared link, a fresh tab).
 */
export function BackLink({ to, children, className, style, onMouseEnter, onMouseLeave }: {
  to: string
  children: ReactNode
  className?: string
  style?: CSSProperties
  onMouseEnter?: React.MouseEventHandler<HTMLAnchorElement>
  onMouseLeave?: React.MouseEventHandler<HTMLAnchorElement>
}) {
  const navigate = useNavigate()
  const location = useLocation()
  // React Router gives the first entry in a session the key "default"; anything else has history behind it.
  const canGoBack = location.key !== 'default'

  return (
    <Link
      to={to}
      className={className}
      style={style}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={e => {
        if (canGoBack) { e.preventDefault(); navigate(-1) }
      }}
    >
      {children}
    </Link>
  )
}
