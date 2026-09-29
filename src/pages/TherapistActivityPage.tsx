import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import {
  ClipboardCheck, StickyNote, Clapperboard, FileText, Image as ImageIcon, Video, ExternalLink,
} from 'lucide-react'
import { therapistActivityApi } from '../api/therapistActivity'
import { usersApi } from '../api/users'
import { Card, CardHeader, StatCard } from '../components/ui/Card'
import { Select } from '../components/ui/Select'
import { DateInput } from '../components/ui/DateInput'
import { EmptyState } from '../components/ui/EmptyState'
import { PageLoader } from '../components/ui/Spinner'
import { viewFile } from '../lib/fileActions'
import { formatTimeStr, formatDateStr, formatDateTimeStr } from '../lib/format'
import { colors, border, surface } from '../theme'
import type { ChildFreeTextNotes, ChildMedia, ChildSessionNotes } from '../types'

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

function ChildGroupCard({ patientName, children }: { patientName: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-3.5" style={{ background: surface.card, border: border.card }}>
      <p className="text-sm font-semibold" style={{ color: colors.text.heading }}>{patientName}</p>
      <div className="mt-2 space-y-3">{children}</div>
    </div>
  )
}

function SessionNotesSection({ groups }: { groups: ChildSessionNotes[] }) {
  return (
    <Card>
      <CardHeader title="Therapy Session Notes" subtitle="From the session's own notes / progress report / feedback fields" />
      {groups.length === 0 ? (
        <EmptyState icon={<ClipboardCheck size={28} />} title="No session notes"
          description="No session in this range had notes, a progress report or feedback filled in." />
      ) : (
        <div className="space-y-3">
          {groups.map(g => (
            <ChildGroupCard key={g.patientId} patientName={g.patientName}>
              {g.entries.map(e => (
                <div key={e.sessionId} className="pb-3 border-b last:border-b-0 last:pb-0" style={{ borderColor: `${colors.text.dim}20` }}>
                  <p className="text-xs" style={{ color: colors.text.muted }}>{formatDateStr(e.sessionDate)} · {formatTimeStr(e.startTime)}</p>
                  <NoteField label="Notes" value={e.notes} />
                  <NoteField label="Progress Report" value={e.progressReport} />
                  <NoteField label="Feedback" value={e.feedback} />
                </div>
              ))}
            </ChildGroupCard>
          ))}
        </div>
      )}
    </Card>
  )
}

function FreeTextNotesSection({ groups }: { groups: ChildFreeTextNotes[] }) {
  return (
    <Card>
      <CardHeader title="Free-Text Notes" subtitle="From the Media & Notes channel" />
      {groups.length === 0 ? (
        <EmptyState icon={<StickyNote size={28} />} title="No free-text notes"
          description="No note was shared through Media & Notes in this range." />
      ) : (
        <div className="space-y-3">
          {groups.map(g => (
            <ChildGroupCard key={g.patientId} patientName={g.patientName}>
              {g.entries.map(e => (
                <div key={e.id} className="pb-3 border-b last:border-b-0 last:pb-0" style={{ borderColor: `${colors.text.dim}20` }}>
                  <p className="text-xs" style={{ color: colors.text.muted }}>{formatDateTimeStr(e.createdAt)}</p>
                  <p className="text-sm mt-1 whitespace-pre-wrap" style={{ color: colors.text.primary }}>{e.note}</p>
                </div>
              ))}
            </ChildGroupCard>
          ))}
        </div>
      )}
    </Card>
  )
}

function MediaSection({ groups }: { groups: ChildMedia[] }) {
  return (
    <Card>
      <CardHeader title="Media / Videos" subtitle="From the Media & Notes channel" />
      {groups.length === 0 ? (
        <EmptyState icon={<Clapperboard size={28} />} title="No media uploaded"
          description="No video or file was shared through Media & Notes in this range." />
      ) : (
        <div className="space-y-3">
          {groups.map(g => (
            <ChildGroupCard key={g.patientId} patientName={g.patientName}>
              {g.entries.map(e => (
                <div key={e.id} className="flex items-start justify-between gap-3 pb-3 border-b last:border-b-0 last:pb-0" style={{ borderColor: `${colors.text.dim}20` }}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5" style={{ color: colors.text.primary }}>
                      {fileKindIcon(e.contentType)}
                      <span className="text-sm truncate">{e.fileName ?? 'Untitled file'}</span>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: colors.text.muted }}>{formatDateTimeStr(e.createdAt)}</p>
                    {e.note && <p className="text-sm mt-1 whitespace-pre-wrap" style={{ color: colors.text.primary }}>{e.note}</p>}
                  </div>
                  {e.fileUrl && (
                    <button
                      onClick={() => viewFile(e.fileUrl!)}
                      className="flex items-center gap-1 text-xs font-medium flex-shrink-0"
                      style={{ color: colors.accent }}
                    >
                      <ExternalLink size={12} /> View
                    </button>
                  )}
                </div>
              ))}
            </ChildGroupCard>
          ))}
        </div>
      )}
    </Card>
  )
}

export default function TherapistActivityPage() {
  const [therapistId, setTherapistId] = useState('')
  const today = format(new Date(), 'yyyy-MM-dd')
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)

  const { data: therapists = [] } = useQuery({
    queryKey: ['users', 'therapists'],
    queryFn: () => usersApi.listTherapists(),
  })
  const therapistOptions = therapists.map(t => ({ value: t.id, label: `${t.firstName} ${t.lastName}` }))

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

          <SessionNotesSection groups={activity.therapySessionNotesByChild} />
          <FreeTextNotesSection groups={activity.freeTextNotesByChild} />
          <MediaSection groups={activity.mediaByChild} />
        </>
      ) : null}
    </div>
  )
}
