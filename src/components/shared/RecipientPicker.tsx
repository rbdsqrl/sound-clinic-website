import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, X } from 'lucide-react'
import { usersApi } from '../../api/users'
import { Avatar } from './Avatar'
import { colors, border, surface } from '../../theme'
import type { FeedPostRecipient, Role } from '../../types'

/** Multi-select search picker for "who should see this" — leaving `selected` empty means
 *  visible to everyone in the org, which the caller is responsible for saying explicitly
 *  somewhere nearby (this component only handles picking specific people).
 *  `roles`, when given, restricts results client-side to those roles (e.g. staff-only for a
 *  meeting attendee list). `minChars` sets how many characters trigger a search (default 2). */
export function RecipientPicker({ selected, onChange, roles, minChars = 2, placeholder = 'Search people to add…' }: {
  selected: FeedPostRecipient[]
  onChange: (next: FeedPostRecipient[]) => void
  roles?: Role[]
  minChars?: number
  placeholder?: string
}) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300)
    return () => clearTimeout(t)
  }, [query])

  const { data: rawResults, isFetching } = useQuery({
    queryKey: ['user-search-multi', debouncedQuery],
    queryFn: () => usersApi.search(debouncedQuery),
    enabled: debouncedQuery.length >= minChars,
    staleTime: 10_000,
  })
  const results = roles ? rawResults?.filter(u => roles.includes(u.role)) : rawResults

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  const selectedIds = new Set(selected.map(s => s.id))
  const matches = (results ?? []).filter(u => !selectedIds.has(u.id))

  const add = (u: { id: string; firstName: string; lastName: string }) => {
    onChange([...selected, { id: u.id, firstName: u.firstName, lastName: u.lastName }])
    setQuery('')
    setDebouncedQuery('')
    setOpen(false)
  }
  const remove = (id: string) => onChange(selected.filter(s => s.id !== id))

  return (
    <div ref={containerRef} className="space-y-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map(s => (
            <span key={s.id} className="inline-flex items-center gap-1.5 rounded-full pl-1 pr-2 py-1 text-xs font-medium"
              style={{ background: surface.rowHover, color: colors.text.primary }}>
              <Avatar initials={`${s.firstName[0] ?? ''}${s.lastName[0] ?? ''}`} name={`${s.firstName} ${s.lastName}`} size="xs" />
              {s.firstName} {s.lastName}
              <button type="button" onClick={() => remove(s.id)} className="rounded-full p-0.5" style={{ color: colors.text.dim }} aria-label={`Remove ${s.firstName}`}>
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: colors.text.dim }} />
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="form-input pl-8 w-full text-sm"
          autoComplete="off"
        />
      </div>

      {open && debouncedQuery.length >= minChars && (
        <div className="relative z-20">
          <div className="absolute w-full max-h-48 overflow-y-auto rounded-xl shadow-lg" style={{ background: surface.card, border: border.card }}>
            {isFetching ? (
              <p className="px-3.5 py-2.5 text-xs" style={{ color: colors.text.dim }}>Searching…</p>
            ) : matches.length === 0 ? (
              <p className="px-3.5 py-2.5 text-xs" style={{ color: colors.text.dim }}>No matching people found</p>
            ) : (
              matches.map(u => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => add(u)}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-sm transition-colors"
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = surface.rowHover}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                >
                  <Avatar initials={`${u.firstName[0] ?? ''}${u.lastName[0] ?? ''}`} name={`${u.firstName} ${u.lastName}`} size="sm" />
                  <div className="min-w-0">
                    <p className="font-medium truncate" style={{ color: colors.text.primary }}>{u.firstName} {u.lastName}</p>
                    <p className="text-xs truncate" style={{ color: colors.text.dim }}>{u.email}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
      {debouncedQuery.length > 0 && debouncedQuery.length < minChars && (
        <p className="text-xs" style={{ color: colors.text.dim }}>Type at least {minChars} characters to search</p>
      )}
    </div>
  )
}
