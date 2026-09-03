import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, User, X } from 'lucide-react'
import { usersApi } from '../../api/users'
import type { UserResponse, Role } from '../../types'
import { clsx } from '../../lib/clsx'

interface UserSearchPickerProps {
  /** Optional role filter — only show users who hold this role */
  role?: Role
  /** Called when user selects a result */
  onSelect: (user: UserResponse) => void
  /** Currently selected user (to show confirmed selection) */
  selected: UserResponse | null
  /** Clear current selection */
  onClear: () => void
  label?: string
  placeholder?: string
}

export function UserSearchPicker({
  role,
  onSelect,
  selected,
  onClear,
  label = 'Search by name or email',
  placeholder = 'Type a name or email…',
}: UserSearchPickerProps) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Debounce — wait 350 ms after the user stops typing
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 350)
    return () => clearTimeout(t)
  }, [query])

  const { data: results, isFetching } = useQuery({
    queryKey: ['user-search', debouncedQuery, role],
    queryFn: () => usersApi.search(debouncedQuery, role),
    enabled: debouncedQuery.length >= 2,
    staleTime: 10_000,
  })

  // Close dropdown when clicking outside
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  // If a user is already confirmed, show a confirmation chip
  if (selected) {
    return (
      <div className="space-y-1">
        {label && <p className="form-label">{label}</p>}
        <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-700 text-sm font-semibold flex-shrink-0">
            {selected.firstName[0]}{selected.lastName[0] ?? ''}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800 truncate">
              {selected.firstName} {selected.lastName}
            </p>
            <p className="text-xs text-slate-500 truncate">{selected.email}</p>
          </div>
          <button
            type="button"
            onClick={onClear}
            className="ml-2 rounded-full p-1 text-slate-400 hover:bg-green-100 hover:text-slate-600"
            aria-label="Clear selection"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    )
  }

  const showDropdown = open && debouncedQuery.length >= 2

  return (
    <div ref={containerRef} className="space-y-1">
      {label && <p className="form-label">{label}</p>}

      {/* Search input */}
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
          <Search size={15} />
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="form-input pl-9"
          autoComplete="off"
        />
        {isFetching && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-primary-500" />
          </span>
        )}
      </div>

      {/* Results dropdown */}
      {showDropdown && (
        <div className="relative z-20">
          <ul className="absolute w-full rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden max-h-48 overflow-y-auto">
            {!results || results.length === 0 ? (
              <li className="flex items-center gap-2 px-4 py-3 text-sm text-slate-400">
                <User size={14} />
                {debouncedQuery.length >= 2 && !isFetching
                  ? 'No matching users found'
                  : 'Searching…'}
              </li>
            ) : (
              results.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    className={clsx(
                      'w-full flex items-center gap-3 px-4 py-3 text-left text-sm',
                      'hover:bg-primary-50 transition-colors'
                    )}
                    onClick={() => {
                      onSelect(u)
                      setQuery('')
                      setDebouncedQuery('')
                      setOpen(false)
                    }}
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 text-xs font-semibold flex-shrink-0">
                      {u.firstName[0]}{u.lastName[0] ?? ''}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800 truncate">
                        {u.firstName} {u.lastName}
                      </p>
                      <p className="text-xs text-slate-500 truncate">{u.email}</p>
                    </div>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}

      {debouncedQuery.length > 0 && debouncedQuery.length < 2 && (
        <p className="text-xs text-slate-400">Type at least 2 characters to search</p>
      )}
    </div>
  )
}
