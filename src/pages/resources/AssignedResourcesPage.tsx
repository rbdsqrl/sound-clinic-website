import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Paperclip, Download } from 'lucide-react'
import { resourcesApi } from '../../api/resources'
import { patientsApi } from '../../api/patients'
import { TYPE_META, ResourceViewerModal } from './ResourcesPage'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageLoader } from '../../components/ui/Spinner'
import { Avatar } from '../../components/shared/Avatar'
import { viewFile } from '../../lib/fileActions'
import { colors, styles, surface, paletteStyle } from '../../theme'
import type { ResourceAssignmentResponse, ResourceResponse } from '../../types'

/** The Parent app's whole view of "Resources" — never the org-wide library, only what a
 *  therapist or admin has specifically assigned to their child. */
export default function AssignedResourcesPage() {
  const [patientId, setPatientId] = useState('')
  const [viewerTarget, setViewerTarget] = useState<ResourceResponse | null>(null)

  const { data: children, isLoading: childrenLoading } = useQuery({
    queryKey: ['my-children'],
    queryFn: patientsApi.myChildren,
  })

  useEffect(() => {
    if (!patientId && children?.length === 1) setPatientId(children[0].id)
  }, [patientId, children])

  const { data: assignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['resource-assignments', patientId],
    queryFn: () => resourcesApi.listAssignments(patientId),
    enabled: !!patientId,
  })

  if (childrenLoading) return <PageLoader />

  if (!children || children.length === 0) {
    return (
      <div className="max-w-6xl mx-auto">
        <Card>
          <EmptyState icon={<Paperclip size={22} />} title="No children linked" description="Resources shared by your clinic will show up here once a child is linked to your account." />
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
        <h1 className="text-lg md:text-xl font-bold" style={{ color: colors.text.heading }}>Resources</h1>
        <p className="text-sm mt-0.5" style={{ color: colors.text.muted }}>
          Activities, printables and worksheets your clinic has shared with you
        </p>
      </div>

      {children.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {children.map(c => (
            <button
              key={c.id}
              onClick={() => setPatientId(c.id)}
              className="flex-shrink-0 flex items-center gap-2 pl-2 pr-3.5 py-1.5 rounded-full text-sm font-medium transition-colors"
              style={patientId === c.id
                ? { background: 'var(--color-accent)', color: '#fff' }
                : { background: surface.filterStrip, color: colors.text.muted }}
            >
              <Avatar initials={`${c.firstName[0]}${c.lastName[0] ?? ''}`} name={`${c.firstName} ${c.lastName}`} size="xs" />
              {c.firstName} {c.lastName}
            </button>
          ))}
        </div>
      )}

      {assignmentsLoading ? (
        <PageLoader />
      ) : !assignments || assignments.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Paperclip size={22} />}
            title="Nothing shared yet"
            description="Resources your clinic assigns for take-home practice will show up here."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {assignments.map(a => {
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

      {viewerTarget && (
        <ResourceViewerModal resource={viewerTarget} onClose={() => setViewerTarget(null)} />
      )}
    </div>
  )
}
