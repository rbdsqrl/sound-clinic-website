import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ClipboardList, Plus, Clock, Users2, Download, Globe } from 'lucide-react'
import { activitiesApi } from '../../api/activities'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Badge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageLoader } from '../../components/ui/Spinner'
import { ToastContainer } from '../../components/ui/Toast'
import { useToast } from '../../hooks/useToast'
import { getApiError } from '../../lib/apiError'
import { colors, accentAlpha } from '../../theme'
import { ROUTES } from '../../lib/routes'
import type { ActivityResponse, ActivityDifficulty } from '../../types'

type Tab = 'mine' | 'shared'

const DIFFICULTY_VARIANT: Record<ActivityDifficulty, 'green' | 'yellow' | 'red'> = {
  EASY: 'green', MEDIUM: 'yellow', HARD: 'red',
}

function ActivityCard({ activity, footer }: { activity: ActivityResponse; footer?: React.ReactNode }) {
  return (
    <Card className="h-full flex flex-col">
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
      {footer && <div className="mt-4">{footer}</div>}
    </Card>
  )
}

export default function ActivitiesPage() {
  const [tab, setTab] = useState<Tab>('mine')
  const [search, setSearch] = useState('')
  const [difficulty, setDifficulty] = useState<ActivityDifficulty | ''>('')
  const { toasts, toast, dismiss } = useToast()
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
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: colors.text.heading }}>Activities</h1>
          <p className="text-sm mt-0.5" style={{ color: colors.text.dim }}>Create activities and assign them to cases to track progress.</p>
        </div>
        <Link to={ROUTES.createActivity}>
          <Button><Plus size={16} /> Create Activity</Button>
        </Link>
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
        <Input placeholder="Search by title…" value={search} onChange={(e) => setSearch(e.target.value)} />
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
              <Link key={a.id} to={ROUTES.activity(a.id)}>
                <ActivityCard activity={a} />
              </Link>
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

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
