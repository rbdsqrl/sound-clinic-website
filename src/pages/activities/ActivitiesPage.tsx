import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { ClipboardList, Plus, Clock, Users2, Download, Globe, ChevronDown, FilePlus, UserPlus, Paperclip } from 'lucide-react'
import { activitiesApi } from '../../api/activities'
import ResourcesPage, { type ResourcesPageHandle } from '../resources/ResourcesPage'
import { AssignActivityModal } from '../../components/shared/AssignActivityModal'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Badge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageLoader } from '../../components/ui/Spinner'
import { useToast } from '../../hooks/useToast'
import { getApiError } from '../../lib/apiError'
import { colors, border, surface, accentAlpha } from '../../theme'
import { ROUTES } from '../../lib/routes'
import type { ActivityResponse, ActivityDifficulty } from '../../types'

type Tab = 'mine' | 'shared'

const DIFFICULTY_VARIANT: Record<ActivityDifficulty, 'green' | 'yellow' | 'red'> = {
  EASY: 'green', MEDIUM: 'yellow', HARD: 'red',
}

/** `linkTo` covers only the title/description/meta block — action buttons in `footer` sit
 *  outside that link as a sibling, so a click on "Assign to Patient" can never also navigate. */
function ActivityCard({ activity, linkTo, footer }: { activity: ActivityResponse; linkTo?: string; footer?: React.ReactNode }) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold truncate" style={{ color: colors.text.primary }}>{activity.title}</p>
          {activity.programName && (
            <p className="text-xs mt-0.5 truncate" style={{ color: colors.text.dim }}>{activity.programName}</p>
          )}
        </div>
        <Badge variant={DIFFICULTY_VARIANT[activity.difficulty]}>{activity.difficulty}</Badge>
      </div>
      <p className="text-sm mt-3 line-clamp-2 flex-1" style={{ color: colors.text.muted }}>{activity.aboutActivity}</p>
      <div className="flex items-center gap-3 mt-4 text-xs" style={{ color: colors.text.dim }}>
        <span className="inline-flex items-center gap-1"><Clock size={13} /> {activity.durationWeeks}w</span>
        <span className="inline-flex items-center gap-1"><Users2 size={13} /> {activity.ageMinValue}-{activity.ageMaxValue} {activity.ageMaxUnit.toLowerCase()}</span>
        {activity.isShared && <span className="inline-flex items-center gap-1"><Globe size={13} /> Shared</span>}
      </div>
    </>
  )

  return (
    <Card className="h-full flex flex-col">
      {linkTo
        ? <Link to={linkTo} className="flex-1 flex flex-col">{body}</Link>
        : <div className="flex-1 flex flex-col">{body}</div>}
      {footer && <div className="mt-4">{footer}</div>}
    </Card>
  )
}

/** The unified "Add" button — one entry point offering both creation types, so a therapist
 *  doesn't need to already know which of two separate buttons in two separate places to use. */
function AddMenu({ onNewResource }: { onNewResource: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  return (
    <div ref={ref} className="relative">
      <Button onClick={() => setOpen(o => !o)}>
        <Plus size={16} /> Add <ChevronDown size={14} />
      </Button>
      {open && (
        <div
          className="absolute right-0 z-20 mt-1.5 w-48 rounded-xl overflow-hidden shadow-lg"
          style={{ background: surface.card, border: border.card }}
        >
          <button
            onClick={() => { setOpen(false); navigate(ROUTES.createActivity) }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-left transition-colors"
            style={{ color: colors.text.primary }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = surface.rowHover}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
          >
            <FilePlus size={15} style={{ color: colors.text.dim }} /> New Activity
          </button>
          <button
            onClick={() => { setOpen(false); onNewResource() }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-left transition-colors"
            style={{ color: colors.text.primary, borderTop: `1px solid ${border.divider}` }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = surface.rowHover}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
          >
            <Paperclip size={15} style={{ color: colors.text.dim }} /> New Resource
          </button>
        </div>
      )}
    </div>
  )
}

export default function ActivitiesPage() {
  const [tab, setTab] = useState<Tab>('mine')
  const [search, setSearch] = useState('')
  const [difficulty, setDifficulty] = useState<ActivityDifficulty | ''>('')
  const [assignActivity, setAssignActivity] = useState<ActivityResponse | null>(null)
  const resourcesRef = useRef<ResourcesPageHandle>(null)
  const { toast } = useToast()
  const qc = useQueryClient()

  const { data: activities, isLoading } = useQuery({
    queryKey: ['activities'],
    queryFn: () => activitiesApi.list(true),
    enabled: tab === 'mine',
  })

  const { data: shared, isLoading: sharedLoading } = useQuery({
    queryKey: ['activities-shared-library'],
    queryFn: activitiesApi.sharedLibrary,
    enabled: tab === 'shared',
  })

  const importMut = useMutation({
    mutationFn: activitiesApi.importActivity,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['activities'] })
      toast('Added to My Activities', 'success')
    },
    onError: (err) => toast(getApiError(err, 'Failed to import activity'), 'error'),
  })

  const list = tab === 'mine' ? activities : shared
  const loading = tab === 'mine' ? isLoading : sharedLoading

  const filtered = useMemo(() => {
    if (!list) return []
    return list.filter((a) => {
      if (difficulty && a.difficulty !== difficulty) return false
      if (search.trim() && !a.title.toLowerCase().includes(search.trim().toLowerCase())) return false
      return true
    })
  }, [list, search, difficulty])

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: colors.text.heading }}>Activities</h1>
          <p className="text-sm mt-0.5" style={{ color: colors.text.dim }}>Create activities and assign them to cases to track progress.</p>
        </div>
        {tab === 'mine' && <AddMenu onNewResource={() => resourcesRef.current?.openCreateResource()} />}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0 mb-5">
        {([['mine', 'My Activities'], ['shared', 'Shared Library']] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="flex-shrink-0 whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-medium"
            style={tab === key ? { background: accentAlpha(0.14), color: colors.accent } : { color: colors.text.dim }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <Input
          placeholder={tab === 'mine' ? 'Search activities and resources…' : 'Search by title…'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          placeholder="All difficulties"
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value as ActivityDifficulty | '')}
          options={[
            { value: 'EASY', label: 'Easy' },
            { value: 'MEDIUM', label: 'Medium' },
            { value: 'HARD', label: 'Hard' },
          ]}
        />
      </div>

      {tab === 'mine' && (
        <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: colors.text.dim }}>Activities</h2>
      )}

      {loading ? (
        <PageLoader />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<ClipboardList size={28} />}
          title={tab === 'mine' ? 'No activities yet' : 'Nothing shared yet'}
          description={tab === 'mine'
            ? 'Create your first activity to assign to cases and track their progress.'
            : 'Activities other organisations choose to share will show up here.'}
          action={tab === 'mine' ? { label: 'Create Activity', onClick: () => { window.location.href = ROUTES.createActivity } } : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((a) => (
            tab === 'mine' ? (
              <ActivityCard
                key={a.id}
                activity={a}
                linkTo={ROUTES.activity(a.id)}
                footer={
                  <Button size="sm" variant="secondary" onClick={() => setAssignActivity(a)}>
                    <UserPlus size={14} /> Assign to Patient
                  </Button>
                }
              />
            ) : (
              <ActivityCard
                key={a.id}
                activity={a}
                footer={
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={importMut.isPending}
                    onClick={() => importMut.mutate(a.id)}
                    disabled={a.mine}
                  >
                    <Download size={14} /> {a.mine ? 'Already yours' : 'Add to My Activities'}
                  </Button>
                }
              />
            )
          ))}
        </div>
      )}

      {tab === 'mine' && (
        <>
          <hr className="my-8" style={{ borderColor: border.divider }} />
          <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: colors.text.dim }}>Activity Resources</h2>
          <ResourcesPage ref={resourcesRef} embedded externalSearch={search} hideAddResourceButton />
        </>
      )}

      {assignActivity && (
        <AssignActivityModal
          activityId={assignActivity.id}
          activityTitle={assignActivity.title}
          onClose={() => setAssignActivity(null)}
        />
      )}
    </div>
  )
}
