import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, parseISO, subDays } from 'date-fns'
import {
  ClipboardCheck, StickyNote, Clapperboard, FileText, Image as ImageIcon, Video, Star,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import { therapistActivityApi } from '../api/therapistActivity'
import { usersApi } from '../api/users'
import { Card, StatCard } from '../components/ui/Card'
import { Select } from '../components/ui/Select'
import { DateInput } from '../components/ui/DateInput'
import { EmptyState } from '../components/ui/EmptyState'
import { PageLoader } from '../components/ui/Spinner'
import { SharedMediaDetailModal } from '../components/shared/SharedMediaDetail'
import { SessionDrawerLoader } from '../components/shared/SessionDrawerLoader'
import { formatTimeStr, formatDateTimeStr } from '../lib/format'
import { colors, border, surface, accentAlpha, paletteStyle } from '../theme'
import type { ChildFreeTextNotes, ChildMedia, ChildSessionNotes, FreeTextNoteEntry, MediaEntry, SharedMediaResponse } from '../types'

function fileKindIcon(contentType: string | null) {
  if (contentType?.startsWith('video/')) return <Video size={14} />
  if (contentType?.startsWith('image/')) return <ImageIcon size={14} />
  return <FileText size={14} />
}

/** Entries per page — rows are compact, so ten fit where five cards used to. */
const PAGE_SIZE = 10

/** One-line preview of free text: line breaks collapsed so a long note doesn't stretch the row. */
const oneLine = (v: string | null | undefined) => (v ?? '').replace(/\s+/g, ' ').trim()

/** Groups an already-sorted list by calendar day, keeping the order. */
function groupByDay<T>(items: T[], dayOf: (x: T) => string): { day: string; items: T[] }[] {
  const out: { day: string; items: T[] }[] = []
  for (const it of items) {
    const day = dayOf(it)
    const last = out[out.length - 1]
    if (last && last.day === day) last.items.push(it)
    else out.push({ day, items: [it] })
  }
  return out
}

/** "Tue 3 Nov · 6 notes" — the count is for the whole day across pages, not just the rows on this one. */
function DayHeading({ day, count, noun }: { day: string; count: number; noun: string }) {
  return (
    <div className="flex items-center gap-3 mb-1">
      <h3 className="text-xs font-semibold uppercase tracking-wide whitespace-nowrap" style={{ color: colors.text.dim }}>
        {format(parseISO(`${day}T00:00:00`), 'EEE d MMM')} · {count} {noun}{count !== 1 ? 's' : ''}
      </h3>
      <div className="flex-1 h-px" style={{ background: border.divider }} />
    </div>
  )
}

/** Five filled/empty stars for a 1–5 rating. */
function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map(n => (
        <Star key={n} size={12}
          style={n <= value ? { color: colors.status.warning, fill: colors.status.warning } : { color: colors.text.dim }} />
      ))}
    </span>
  )
}

/** A small "what was written" chip. */
function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap" style={paletteStyle('teal', 0.12, 0)}>
      {children}
    </span>
  )
}

/** A clickable list row — hover highlight, whole row opens the entry. */
function RowButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className="w-full text-left flex items-center gap-3 px-2 sm:px-3 py-2.5 rounded-lg transition-colors"
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = surface.rowHover}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
      {children}
      <ChevronRight size={14} className="flex-shrink-0" style={{ color: colors.text.dim }} />
    </button>
  )
}

/** Flattens the per-child groups into one list, newest first. */
function flatten<E>(
  groups: { patientId: string; patientName: string; entries: E[] }[], when: (e: E) => string,
): { patientId: string; patientName: string; entry: E }[] {
  return groups
    .flatMap(g => g.entries.map(entry => ({ patientId: g.patientId, patientName: g.patientName, entry, when: when(entry) })))
    .sort((x, y) => (x.when < y.when ? 1 : x.when > y.when ? -1 : 0))
    .map(({ patientId, patientName, entry }) => ({ patientId, patientName, entry }))
}

/** Shapes an activity entry like a Media & Notes post, so it opens in the same note popup. */
function toSharedPost(
  e: FreeTextNoteEntry | MediaEntry, patientId: string, patientName: string,
  therapist: { id: string; name: string },
): SharedMediaResponse {
  const media = 'fileUrl' in e ? e : null
  return {
    id: e.id, patientId, patientName, direction: e.direction,
    fileName: media?.fileName ?? null, fileUrl: media?.fileUrl ?? null,
    contentType: media?.contentType ?? null, fileSizeBytes: media?.fileSizeBytes ?? null,
    note: e.note, uploadedById: therapist.id, uploadedByName: therapist.name, uploadedByRole: 'THERAPIST',
    createdAt: e.createdAt, readAt: e.readAt, readByName: e.readByName,
  }
}

/** One page of entries at a time. The parent keys the section on therapist + range, so it restarts on page one. */
function usePaged<T>(items: T[], size = PAGE_SIZE) {
  const [page, setPage] = useState(0)
  const totalPages = Math.max(1, Math.ceil(items.length / size))
  const current = Math.min(page, totalPages - 1)
  return {
    pageItems: items.slice(current * size, current * size + size),
    page: current, totalPages, total: items.length, setPage,
  }
}

function Pager({ page, totalPages, total, setPage, noun }: {
  page: number; totalPages: number; total: number; setPage: (p: number) => void; noun: string
}) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between pt-3">
      <p className="text-xs" style={{ color: colors.text.dim }}>
        Page {page + 1} of {totalPages} · {total} {noun}{total !== 1 ? 's' : ''}
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setPage(Math.max(0, page - 1))}
          disabled={page === 0}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
          style={{ border: border.card, color: colors.text.primary }}
        >
          <ChevronLeft size={14} /> Previous
        </button>
        <button
          onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
          disabled={page + 1 >= totalPages}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
          style={{ border: border.card, color: colors.text.primary }}
        >
          Next <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}

function SessionNotesSection({ groups, onOpen }: { groups: ChildSessionNotes[]; onOpen: (sessionId: string) => void }) {
  // Newest session first; the start time breaks ties within a day.
  const items = flatten(groups, e => `${e.sessionDate} ${e.startTime}`)
  const perDay = new Map<string, number>()
  items.forEach(i => perDay.set(i.entry.sessionDate, (perDay.get(i.entry.sessionDate) ?? 0) + 1))
  const { pageItems, ...pager } = usePaged(items)
  if (items.length === 0) {
    return (
      <EmptyState icon={<ClipboardCheck size={28} />} title="No session notes"
        description="No session in this range had notes, a progress report or feedback filled in." />
    )
  }
  return (
    <>
      {groupByDay(pageItems, i => i.entry.sessionDate).map(g => (
        <div key={g.day} className="mb-4">
          <DayHeading day={g.day} count={perDay.get(g.day) ?? g.items.length} noun="note" />
          {g.items.map(({ patientName, entry: e }) => {
            const rating = e.feedback && /^[1-5]$/.test(e.feedback.trim()) ? parseInt(e.feedback, 10) : null
            const snippet = oneLine(e.notes) || oneLine(e.progressReport) || (rating === null ? oneLine(e.feedback) : '')
            return (
              <RowButton key={e.sessionId} onClick={() => onOpen(e.sessionId)}>
                <span className="w-16 flex-shrink-0 text-xs tabular-nums" style={{ color: colors.text.muted }}>{formatTimeStr(e.startTime)}</span>
                <span className="w-32 sm:w-40 flex-shrink-0 truncate text-sm font-semibold" style={{ color: colors.text.heading }}>{patientName}</span>
                <span className="hidden sm:flex w-28 flex-shrink-0 items-center gap-1.5">
                  {rating !== null ? <Stars value={rating} /> : <span className="text-xs" style={{ color: colors.text.dim }}>—</span>}
                  {e.performanceScore !== null && (
                    <span className="text-[11px] tabular-nums" style={{ color: colors.text.muted }}>{e.performanceScore}%</span>
                  )}
                </span>
                <span className="hidden md:flex items-center gap-1 flex-shrink-0">
                  {e.notes && <Chip>Notes</Chip>}
                  {e.progressReport && <Chip>Progress</Chip>}
                </span>
                <span className="flex-1 min-w-0 truncate text-sm" style={{ color: colors.text.muted }}>{snippet}</span>
              </RowButton>
            )
          })}
        </div>
      ))}
      <Pager {...pager} noun="note" />
    </>
  )
}

function FreeTextNotesSection({ groups, onOpen }: { groups: ChildFreeTextNotes[]; onOpen: (item: FreeTextNoteEntry, patientId: string, patientName: string) => void }) {
  const items = flatten(groups, e => e.createdAt)
  const dayOf = (i: { entry: FreeTextNoteEntry }) => format(parseISO(i.entry.createdAt), 'yyyy-MM-dd')
  const perDay = new Map<string, number>()
  items.forEach(i => perDay.set(dayOf(i), (perDay.get(dayOf(i)) ?? 0) + 1))
  const { pageItems, ...pager } = usePaged(items)
  if (items.length === 0) {
    return (
      <EmptyState icon={<StickyNote size={28} />} title="No free-text notes"
        description="No note was shared through Media & Notes in this range." />
    )
  }
  return (
    <>
      {groupByDay(pageItems, dayOf).map(g => (
        <div key={g.day} className="mb-4">
          <DayHeading day={g.day} count={perDay.get(g.day) ?? g.items.length} noun="note" />
          {g.items.map(({ patientId, patientName, entry: e }) => (
            <RowButton key={e.id} onClick={() => onOpen(e, patientId, patientName)}>
              <span className="w-16 flex-shrink-0 text-xs tabular-nums" style={{ color: colors.text.muted }}>
                {format(parseISO(e.createdAt), 'h:mm a')}
              </span>
              <span className="w-32 sm:w-40 flex-shrink-0 truncate text-sm font-semibold" style={{ color: colors.text.heading }}>{patientName}</span>
              <span className="flex-1 min-w-0 text-sm line-clamp-2" style={{ color: colors.text.muted }}>{oneLine(e.note)}</span>
            </RowButton>
          ))}
        </div>
      ))}
      <Pager {...pager} noun="note" />
    </>
  )
}

function MediaSection({ groups, onOpen }: { groups: ChildMedia[]; onOpen: (item: MediaEntry, patientId: string, patientName: string) => void }) {
  const items = flatten(groups, e => e.createdAt)
  const dayOf = (i: { entry: MediaEntry }) => format(parseISO(i.entry.createdAt), 'yyyy-MM-dd')
  const perDay = new Map<string, number>()
  items.forEach(i => perDay.set(dayOf(i), (perDay.get(dayOf(i)) ?? 0) + 1))
  const { pageItems, ...pager } = usePaged(items, 12)
  if (items.length === 0) {
    return (
      <EmptyState icon={<Clapperboard size={28} />} title="No media uploaded"
        description="No video or file was shared through Media & Notes in this range." />
    )
  }
  return (
    <>
      {groupByDay(pageItems, dayOf).map(g => (
        <div key={g.day} className="mb-4">
          <DayHeading day={g.day} count={perDay.get(g.day) ?? g.items.length} noun="file" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {g.items.map(({ patientId, patientName, entry: e }) => (
              <button key={e.id} type="button" onClick={() => onOpen(e, patientId, patientName)}
                className="text-left flex items-start gap-3 rounded-xl p-3 transition-colors"
                style={{ background: surface.card, border: border.card }}
                onMouseEnter={ev => (ev.currentTarget as HTMLElement).style.background = surface.rowHover}
                onMouseLeave={ev => (ev.currentTarget as HTMLElement).style.background = surface.card}>
                <span className="rounded-lg p-2 flex-shrink-0" style={{ background: accentAlpha(0.1), color: colors.accent }}>
                  {fileKindIcon(e.contentType)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium truncate" style={{ color: colors.text.primary }}>{e.fileName ?? 'Untitled file'}</span>
                  <span className="block text-xs truncate" style={{ color: colors.text.muted }}>
                    {patientName} · {formatDateTimeStr(e.createdAt)}
                  </span>
                  {e.note && <span className="block text-xs mt-1 line-clamp-1" style={{ color: colors.text.dim }}>{oneLine(e.note)}</span>}
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
      <Pager {...pager} noun="file" />
    </>
  )
}

export default function TherapistActivityPage() {
  const [therapistId, setTherapistId] = useState('')
  const today = format(new Date(), 'yyyy-MM-dd')
  const [from, setFrom] = useState(format(subDays(new Date(), 6), 'yyyy-MM-dd'))
  const [to, setTo] = useState(today)
  const [tab, setTab] = useState<'sessions' | 'notes' | 'media'>('sessions')
  const [openSessionId, setOpenSessionId] = useState<string | null>(null)
  const [openPost, setOpenPost] = useState<SharedMediaResponse | null>(null)

  const { data: therapists = [] } = useQuery({
    queryKey: ['users', 'therapists'],
    queryFn: () => usersApi.listTherapists(),
  })
  const therapistOptions = therapists.map(t => ({ value: t.id, label: `${t.firstName} ${t.lastName}` }))

  // Start on the first therapist in the list rather than an empty "Select a therapist" screen.
  useEffect(() => {
    if (!therapistId && therapists.length > 0) setTherapistId(therapists[0].id)
  }, [therapists, therapistId])

  const { data: activity, isLoading } = useQuery({
    queryKey: ['therapist-activity', therapistId, from, to],
    queryFn: () => therapistActivityApi.get(therapistId, from, to),
    enabled: !!therapistId && !!from && !!to && from <= to,
  })

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-lg md:text-xl font-bold" style={{ color: colors.text.heading }}>Therapist Activity</h1>
        <p className="text-sm mt-0.5" style={{ color: colors.text.muted }}>
          Documentation check — did a therapist keep session notes and share media over this range
        </p>
      </div>

      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Select
            label="Therapist"
            placeholder="Select a therapist…"
            value={therapistId}
            onChange={e => setTherapistId(e.target.value)}
            options={therapistOptions}
          />
          <DateInput label="From" value={from} max={to || today} onChange={v => setFrom(v)} />
          <DateInput label="To" value={to} min={from} max={today} onChange={v => setTo(v)} />
        </div>
        {from > to && (
          <p className="form-error mt-2">"From" cannot be after "To"</p>
        )}
      </Card>

      {!therapistId ? (
        <Card>
          <EmptyState
            icon={<ClipboardCheck size={32} />}
            title="Select a therapist"
            description="Pick a therapist and a date range above to see their notes and media."
          />
        </Card>
      ) : isLoading ? (
        <PageLoader />
      ) : activity ? (
        <>
          {/* The three counts double as the tabs — one list at a time instead of three stacked ones. */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4" role="tablist">
            {([
              ['sessions', <StatCard key="s" icon={<ClipboardCheck size={20} />} label="Therapy Session Notes" value={activity.therapySessionNotesCount} color="teal" />],
              ['notes',    <StatCard key="n" icon={<StickyNote size={20} />} label="Free-Text Notes" value={activity.freeTextNotesCount} color="blue" />],
              ['media',    <StatCard key="m" icon={<Clapperboard size={20} />} label="Media / Videos" value={activity.mediaCount} color="purple" />],
            ] as ['sessions' | 'notes' | 'media', React.ReactNode][]).map(([key, card]) => (
              <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
                className="text-left rounded-2xl transition-shadow"
                style={tab === key ? { boxShadow: `0 0 0 2px ${colors.accent}` } : { opacity: 0.75 }}>
                {card}
              </button>
            ))}
          </div>

          <Card>
            <p className="text-xs mb-3" style={{ color: colors.text.dim }}>
              {tab === 'sessions' ? "From the session's own notes / progress report / feedback fields" : 'From the Media & Notes channel'}
            </p>
            {/* Keyed on therapist + range so the list starts back on page one when they change. */}
            {tab === 'sessions' && (
              <SessionNotesSection key={`s-${therapistId}-${from}-${to}`} groups={activity.therapySessionNotesByChild}
                onOpen={setOpenSessionId} />
            )}
            {tab === 'notes' && (
              <FreeTextNotesSection key={`f-${therapistId}-${from}-${to}`} groups={activity.freeTextNotesByChild}
                onOpen={(e, pid, pname) => setOpenPost(toSharedPost(e, pid, pname, { id: activity.therapistId, name: activity.therapistName }))} />
            )}
            {tab === 'media' && (
              <MediaSection key={`m-${therapistId}-${from}-${to}`} groups={activity.mediaByChild}
                onOpen={(e, pid, pname) => setOpenPost(toSharedPost(e, pid, pname, { id: activity.therapistId, name: activity.therapistName }))} />
            )}
          </Card>
        </>
      ) : null}

      {openPost && <SharedMediaDetailModal item={openPost} onClose={() => setOpenPost(null)} />}
      {openSessionId && <SessionDrawerLoader sessionId={openSessionId} onClose={() => setOpenSessionId(null)} />}
    </div>
  )
}
