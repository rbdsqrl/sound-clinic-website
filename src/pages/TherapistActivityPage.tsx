import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, subDays } from 'date-fns'
import {
  ClipboardCheck, StickyNote, Clapperboard, FileText, Image as ImageIcon, Video, ExternalLink,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import { therapistActivityApi } from '../api/therapistActivity'
import { usersApi } from '../api/users'
import { Card, CardHeader, StatCard } from '../components/ui/Card'
import { Select } from '../components/ui/Select'
import { DateInput } from '../components/ui/DateInput'
import { EmptyState } from '../components/ui/EmptyState'
import { PageLoader } from '../components/ui/Spinner'
import { SharedMediaDetailModal } from '../components/shared/SharedMediaDetail'
import { SessionDrawerLoader } from '../components/shared/SessionDrawerLoader'
import { formatTimeStr, formatDateStr, formatDateTimeStr } from '../lib/format'
import { colors, border, surface } from '../theme'
import type { ChildFreeTextNotes, ChildMedia, ChildSessionNotes, FreeTextNoteEntry, MediaEntry, SharedMediaResponse } from '../types'

function fileKindIcon(contentType: string | null) {
  if (contentType?.startsWith('video/')) return <Video size={14} />
  if (contentType?.startsWith('image/')) return <ImageIcon size={14} />
  return <FileText size={14} />
}

/** One field row inside a note entry — only rendered when that field actually has content. */
function NoteField({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <div className="mt-1.5">
      <p className="text-xs font-medium uppercase tracking-wider" style={{ color: colors.text.dim }}>{label}</p>
      <p className="text-sm mt-0.5 whitespace-pre-wrap" style={{ color: colors.text.primary }}>{value}</p>
    </div>
  )
}

const PAGE_SIZE = 5

/** One entry in a section's flat, newest-first list — the child it belongs to is shown on the entry itself.
 *  With `onOpen` the whole card is a button that opens the entry. */
function EntryCard({ patientName, onOpen, openLabel, children }: {
  patientName: string
  onOpen?: () => void
  openLabel?: string
  children: React.ReactNode
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold" style={{ color: colors.text.heading }}>{patientName}</p>
        {onOpen && (
          <span className="flex items-center gap-1 text-xs font-medium flex-shrink-0" style={{ color: colors.accent }}>
            <ExternalLink size={12} /> {openLabel ?? 'Open'}
          </span>
        )}
      </div>
      <div className="mt-1.5">{children}</div>
    </>
  )
  const style = { background: surface.card, border: border.card }
  return onOpen ? (
    <button type="button" onClick={onOpen} className="w-full text-left rounded-xl p-3.5 transition-colors"
      style={style}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = surface.rowHover}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = surface.card}>
      {body}
    </button>
  ) : (
    <div className="rounded-xl p-3.5" style={style}>{body}</div>
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

/** Five entries at a time. The parent keys the section on therapist + range, so it restarts on page one. */
function usePaged<T>(items: T[]) {
  const [page, setPage] = useState(0)
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  const current = Math.min(page, totalPages - 1)
  return {
    pageItems: items.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE),
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
  const { pageItems, ...pager } = usePaged(items)
  return (
    <Card>
      <CardHeader title="Therapy Session Notes" subtitle="From the session's own notes / progress report / feedback fields" />
      {items.length === 0 ? (
        <EmptyState icon={<ClipboardCheck size={28} />} title="No session notes"
          description="No session in this range had notes, a progress report or feedback filled in." />
      ) : (
        <>
          <div className="space-y-3">
            {pageItems.map(({ patientName, entry: e }) => (
              <EntryCard key={e.sessionId} patientName={patientName} onOpen={() => onOpen(e.sessionId)} openLabel="Open session">
                <p className="text-xs" style={{ color: colors.text.muted }}>{formatDateStr(e.sessionDate)} · {formatTimeStr(e.startTime)}</p>
                <NoteField label="Notes" value={e.notes} />
                <NoteField label="Progress Report" value={e.progressReport} />
                <NoteField label="Feedback" value={e.feedback} />
              </EntryCard>
            ))}
          </div>
          <Pager {...pager} noun="note" />
        </>
      )}
    </Card>
  )
}

function FreeTextNotesSection({ groups, onOpen }: { groups: ChildFreeTextNotes[]; onOpen: (item: FreeTextNoteEntry, patientId: string, patientName: string) => void }) {
  const items = flatten(groups, e => e.createdAt)
  const { pageItems, ...pager } = usePaged(items)
  return (
    <Card>
      <CardHeader title="Free-Text Notes" subtitle="From the Media & Notes channel" />
      {items.length === 0 ? (
        <EmptyState icon={<StickyNote size={28} />} title="No free-text notes"
          description="No note was shared through Media & Notes in this range." />
      ) : (
        <>
          <div className="space-y-3">
            {pageItems.map(({ patientId, patientName, entry: e }) => (
              <EntryCard key={e.id} patientName={patientName} onOpen={() => onOpen(e, patientId, patientName)} openLabel="Open note">
                <p className="text-xs" style={{ color: colors.text.muted }}>{formatDateTimeStr(e.createdAt)}</p>
                <p className="text-sm mt-1 whitespace-pre-wrap" style={{ color: colors.text.primary }}>{e.note}</p>
              </EntryCard>
            ))}
          </div>
          <Pager {...pager} noun="note" />
        </>
      )}
    </Card>
  )
}

function MediaSection({ groups, onOpen }: { groups: ChildMedia[]; onOpen: (item: MediaEntry, patientId: string, patientName: string) => void }) {
  const items = flatten(groups, e => e.createdAt)
  const { pageItems, ...pager } = usePaged(items)
  return (
    <Card>
      <CardHeader title="Media / Videos" subtitle="From the Media & Notes channel" />
      {items.length === 0 ? (
        <EmptyState icon={<Clapperboard size={28} />} title="No media uploaded"
          description="No video or file was shared through Media & Notes in this range." />
      ) : (
        <>
          <div className="space-y-3">
            {pageItems.map(({ patientId, patientName, entry: e }) => (
              <EntryCard key={e.id} patientName={patientName} onOpen={() => onOpen(e, patientId, patientName)}
                openLabel={e.contentType?.startsWith('video/') ? 'Play video' : 'Open file'}>
                <div className="flex items-center gap-1.5" style={{ color: colors.text.primary }}>
                  {fileKindIcon(e.contentType)}
                  <span className="text-sm truncate">{e.fileName ?? 'Untitled file'}</span>
                </div>
                <p className="text-xs mt-0.5" style={{ color: colors.text.muted }}>{formatDateTimeStr(e.createdAt)}</p>
                {e.note && <p className="text-sm mt-1 whitespace-pre-wrap line-clamp-3" style={{ color: colors.text.primary }}>{e.note}</p>}
              </EntryCard>
            ))}
          </div>
          <Pager {...pager} noun="file" />
        </>
      )}
    </Card>
  )
}

export default function TherapistActivityPage() {
  const [therapistId, setTherapistId] = useState('')
  const today = format(new Date(), 'yyyy-MM-dd')
  const [from, setFrom] = useState(format(subDays(new Date(), 6), 'yyyy-MM-dd'))
  const [to, setTo] = useState(today)
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
    <div className="p-4 md:p-6 lg:p-8 max-w-5xl mx-auto space-y-5">
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
            <StatCard icon={<ClipboardCheck size={20} />} label="Therapy Session Notes" value={activity.therapySessionNotesCount} color="teal" />
            <StatCard icon={<StickyNote size={20} />} label="Free-Text Notes" value={activity.freeTextNotesCount} color="blue" />
            <StatCard icon={<Clapperboard size={20} />} label="Media / Videos" value={activity.mediaCount} color="purple" />
          </div>

          {/* Keyed on therapist + range so each section starts back on page one when they change. */}
          <SessionNotesSection key={`s-${therapistId}-${from}-${to}`} groups={activity.therapySessionNotesByChild}
            onOpen={setOpenSessionId} />
          <FreeTextNotesSection key={`f-${therapistId}-${from}-${to}`} groups={activity.freeTextNotesByChild}
            onOpen={(e, pid, pname) => setOpenPost(toSharedPost(e, pid, pname, { id: activity.therapistId, name: activity.therapistName }))} />
          <MediaSection key={`m-${therapistId}-${from}-${to}`} groups={activity.mediaByChild}
            onOpen={(e, pid, pname) => setOpenPost(toSharedPost(e, pid, pname, { id: activity.therapistId, name: activity.therapistName }))} />
        </>
      ) : null}

      {openPost && <SharedMediaDetailModal item={openPost} onClose={() => setOpenPost(null)} />}
      {openSessionId && <SessionDrawerLoader sessionId={openSessionId} onClose={() => setOpenSessionId(null)} />}
    </div>
  )
}
