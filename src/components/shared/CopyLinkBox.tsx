import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { colors, border, surface, accentAlpha } from '../../theme'

interface CopyLinkBoxProps {
  /** A path relative to this origin (e.g. an invite/sign-up link) — the full URL is built from it. */
  link: string
  title?: string
  footer?: string
}

/** Sign-up/invite link with a copy-to-clipboard button and a 2.5s "Copied" confirmation. */
export function CopyLinkBox({
  link,
  title = 'Sign-up link — share this with the person',
  footer = "Valid for 72 hours. The person sets their own name and password when they open it.",
}: CopyLinkBoxProps) {
  const [copied, setCopied] = useState(false)
  const fullUrl = `${window.location.origin}${link}`
  const copy = async () => {
    await navigator.clipboard.writeText(fullUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }
  return (
    <div className="rounded-xl p-4" style={{ border: border.card, background: accentAlpha(0.08) }}>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: colors.text.primary }}>
        {title}
      </p>
      <div className="flex items-center gap-2">
        <code
          className="flex-1 rounded-lg px-3 py-2 text-xs font-mono break-all select-all"
          style={{ background: surface.filterStrip, color: colors.text.primary, border: border.card }}
        >
          {fullUrl}
        </code>
        <button
          type="button"
          onClick={copy}
          className="flex-shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium"
          style={{ background: colors.accent, color: '#fff' }}
        >
          {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
        </button>
      </div>
      <p className="mt-2 text-xs" style={{ color: colors.text.muted }}>
        {footer}
      </p>
    </div>
  )
}
