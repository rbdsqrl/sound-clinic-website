import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Home, Paperclip, Download, Folder, ChevronRight } from 'lucide-react'
import { patientsApi } from '../../api/patients'
import { resourcesApi } from '../../api/resources'
import { TYPE_META, ResourceViewerModal } from '../resources/ResourcesPage'
import ActivitiesTab from './ActivitiesTab'
import { Card, CardHeader } from '../../components/ui/Card'
import { Select } from '../../components/ui/Select'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageLoader } from '../../components/ui/Spinner'
import { viewFile } from '../../lib/fileActions'
import { colors, styles, surface, accentAlpha, paletteStyle } from '../../theme'
import type { ResourceAssignmentResponse, ResourceResponse } from '../../types'

/** Parent-facing "Home Plan Activities" — a child picker plus everything a therapist has
 *  assigned that child for home practice: checklist activities and shared Activity Resources. */
export default function HomePlanActivitiesPage() {
  const [patientId, setPatientId] = useState('')

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
            description="Activities and Activity Resources shared by your clinic will show up here once a child is linked to your account." />
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-lg md:text-xl font-bold" style={{ color: colors.text.heading }}>Home Plan Activities</h1>
        <p className="text-sm mt-0.5" style={{ color: colors.text.muted }}>
          Activities and Activity Resources your clinic has assigned for home practice
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
            <CardHeader title="Activity Resources" subtitle="Printables and worksheets your clinic has shared with you" />
            {resourcesLoading ? (
              <PageLoader />
            ) : !resourceAssignments || resourceAssignments.length === 0 ? (
              <EmptyState icon={<Paperclip size={22} />} title="Nothing shared yet"
                description="Activity Resources your clinic assigns for take-home practice will show up here." />
            ) : (
              // Keyed by patientId so switching children starts the browser back at the root
              // instead of carrying over a folder path that may not exist for the new child.
              <AssignedResourcesBrowser key={patientId} assignments={resourceAssignments} />
            )}
          </Card>
        </>
      )}
    </div>
  )
}

// ── Folder-structured browser for a patient's assigned Activity Resources ──────────────────
// Mirrors the folder-browsing UX from the staff Activity Resources library (ResourcesPage) —
// folders are clickable cards with a breadcrumb trail, rather than a flat "path" label per
// group — but scoped to only what's been assigned to this child, and rebuilt client-side from
// each assignment's `folderPath` since an assignment only carries the library's real folder id
// for its own immediate folder, not every ancestor along the path.

interface AssignedFolderNode {
  name: string
  children: Map<string, AssignedFolderNode>
  resources: ResourceAssignmentResponse[]
}

function buildAssignedTree(assignments: ResourceAssignmentResponse[]): AssignedFolderNode {
  const root: AssignedFolderNode = { name: '', children: new Map(), resources: [] }
  for (const a of assignments) {
    if (!a.folderPath) { root.resources.push(a); continue }
    let node = root
    for (const segment of a.folderPath.split(' / ')) {
      let child = node.children.get(segment)
      if (!child) {
        child = { name: segment, children: new Map(), resources: [] }
        node.children.set(segment, child)
      }
      node = child
    }
    node.resources.push(a)
  }
  return root
}

function AssignedResourcesBrowser({ assignments }: { assignments: ResourceAssignmentResponse[] }) {
  const [path, setPath] = useState<string[]>([])
  const [viewerTarget, setViewerTarget] = useState<ResourceResponse | null>(null)

  const tree = useMemo(() => buildAssignedTree(assignments), [assignments])

  const node = useMemo(() => {
    let current = tree
    for (const segment of path) {
      const next = current.children.get(segment)
      if (!next) return tree // stale path (assignments changed underneath) — fall back to root
      current = next
    }
    return current
  }, [tree, path])

  const openViewer = (a: ResourceAssignmentResponse) => setViewerTarget({
    id: a.resourceId, folderId: a.folderId, name: a.resourceName, type: a.resourceType,
    url: a.resourceUrl, hosted: a.hosted, createdAt: a.createdAt,
  })

  const subfolders = [...node.children.values()].sort((a, b) => a.name.localeCompare(b.name))
  const isEmpty = subfolders.length === 0 && node.resources.length === 0

  return (
    <>
      {/* Breadcrumb — same pattern as the staff library's folder browser */}
      <div className="flex items-center gap-1.5 flex-wrap text-sm mb-4">
        <button
          onClick={() => setPath([])}
          className="flex items-center gap-1 px-2 py-1 rounded-lg transition-colors"
          style={{ color: path.length === 0 ? colors.accent : colors.text.muted, fontWeight: path.length === 0 ? 600 : 400 }}
        >
          <Home size={13} /> Activity Resources
        </button>
        {path.map((segment, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <ChevronRight size={13} style={{ color: colors.text.dim }} />
            <button
              onClick={() => setPath(path.slice(0, i + 1))}
              className="px-2 py-1 rounded-lg transition-colors"
              style={{
                color: i === path.length - 1 ? colors.accent : colors.text.muted,
                fontWeight: i === path.length - 1 ? 600 : 400,
              }}
            >
              {segment}
            </button>
          </span>
        ))}
      </div>

      {isEmpty ? (
        <EmptyState icon={<Folder size={22} />} title="Nothing here" description="No Activity Resources in this folder." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Resources first, folders last within a level — matches the staff library browser */}
          {node.resources.map(a => {
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

          {subfolders.map(f => {
            const resourceCount = f.resources.length
            const subfolderCount = f.children.size
            return (
              <div
                key={f.name}
                onClick={() => setPath([...path, f.name])}
                role="button"
                tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter') setPath([...path, f.name]) }}
                className="rounded-2xl p-4 flex items-center gap-3 cursor-pointer transition-colors"
                style={styles.card}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = surface.rowHover}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = surface.card}
              >
                <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: accentAlpha(0.10) }}>
                  <Folder size={17} style={{ color: colors.accent }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate" style={{ color: colors.text.primary }}>{f.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: colors.text.muted }}>
                    {subfolderCount > 0 && `${subfolderCount} folder${subfolderCount !== 1 ? 's' : ''}`}
                    {subfolderCount > 0 && resourceCount > 0 && ' · '}
                    {(resourceCount > 0 || subfolderCount === 0) && `${resourceCount} resource${resourceCount !== 1 ? 's' : ''}`}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {viewerTarget && (
        <ResourceViewerModal resource={viewerTarget} onClose={() => setViewerTarget(null)} />
      )}
    </>
  )
}
