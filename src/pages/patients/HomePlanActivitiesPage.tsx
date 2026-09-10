import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Home, Paperclip, Download } from 'lucide-react'
import { patientsApi } from '../../api/patients'
import { resourcesApi } from '../../api/resources'
import { TYPE_META, ResourceViewerModal } from '../resources/ResourcesPage'
import ActivitiesTab from './ActivitiesTab'
import { Card, CardHeader } from '../../components/ui/Card'
import { Select } from '../../components/ui/Select'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageLoader } from '../../components/ui/Spinner'
import { viewFile } from '../../lib/fileActions'
import { colors, styles, surface, paletteStyle } from '../../theme'
import type { ResourceAssignmentResponse, ResourceResponse } from '../../types'

/** Parent-facing "Home Plan Activities" — a child picker plus everything a therapist has
 *  assigned that child for home practice: checklist activities and shared resources. */
export default function HomePlanActivitiesPage() {
  const [patientId, setPatientId] = useState('')
  const [viewerTarget, setViewerTarget] = useState<ResourceResponse | null>(null)

  const { data: children, isLoading: childrenLoading } = useQuery({
    queryKey: ['my-children'],
    queryFn: patientsApi.myChildren,
  })

  useEffect(() => {
    if (!patientId && children?.length) setPatientId(children[0].id)
  }, [patientId, children])

  const { data: resourceAssignments, isLoading: resourcesLoading } = useQuery({
    queryKey: ['resource-assignments', patientId],
    queryFn: () => resourcesApi.listAssignments(patientId),
    enabled: !!patientId,
  })

  if (childrenLoading) return <PageLoader />

  if (!children || children.length === 0) {
    return (
      <div className="max-w-6xl mx-auto">
        <Card>
          <EmptyState icon={<Home size={22} />} title="No children linked"
            description="Activities and resources shared by your clinic will show up here once a child is linked to your account." />
        </Card>
      </div>
    )
  }

  const openViewer = (a: ResourceAssignmentResponse) => setViewerTarget({
    id: a.resourceId, folderId: null, name: a.resourceName, type: a.resourceType,
    url: a.resourceUrl, hosted: a.hosted, createdAt: a.createdAt,
  })

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-lg md:text-xl font-bold" style={{ color: colors.text.heading }}>Home Plan Activities</h1>
        <p className="text-sm mt-0.5" style={{ color: colors.text.muted }}>
          Activities and resources your clinic has assigned for home practice
        </p>
      </div>

      {children.length > 1 && (
        <div className="max-w-xs">
          <Select
            label="Child"
            value={patientId}
            onChange={e => setPatientId(e.target.value)}
            options={children.map(c => ({ value: c.id, label: `${c.firstName} ${c.lastName}` }))}
          />
        </div>
      )}

      {patientId && (
        <>
          <ActivitiesTab patientId={patientId} readOnly />

          <Card>
            <CardHeader title="Resources" subtitle="Printables and worksheets your clinic has shared with you" />
            {resourcesLoading ? (
              <PageLoader />
            ) : !resourceAssignments || resourceAssignments.length === 0 ? (
              <EmptyState icon={<Paperclip size={22} />} title="Nothing shared yet"
                description="Resources your clinic assigns for take-home practice will show up here." />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {resourceAssignments.map(a => {
                  const meta = TYPE_META[a.resourceType]
                  const Icon = meta.icon
                  return (
                    <div
                      key={a.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => a.hosted ? openViewer(a) : viewFile(a.resourceUrl)}
                      onKeyDown={e => { if (e.key === 'Enter') (a.hosted ? openViewer(a) : viewFile(a.resourceUrl)) }}
                      className="rounded-2xl p-4 flex items-center gap-3 cursor-pointer transition-colors"
                      style={styles.card}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = surface.rowHover}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = surface.card}
                    >
                      <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0" style={paletteStyle(meta.color, 0.14, 0)}>
                        <Icon size={17} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate" style={{ color: colors.text.primary }}>{a.resourceName}</p>
                        <p className="text-xs mt-0.5" style={{ color: colors.text.muted }}>{meta.label}</p>
                      </div>
                      {a.hosted && <Download size={14} style={{ color: colors.text.dim }} className="flex-shrink-0" />}
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </>
      )}

      {viewerTarget && (
        <ResourceViewerModal resource={viewerTarget} onClose={() => setViewerTarget(null)} />
      )}
    </div>
  )
}
