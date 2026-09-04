import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Folder, Link2, Video, Image as ImageIcon, ChevronRight, Home, Check } from 'lucide-react'
import { resourcesApi } from '../../api/resources'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { colors, border, accentAlpha, surface, paletteStyle, type PaletteKey } from '../../theme'
import type { ResourceResponse, ResourceType } from '../../types'

const TYPE_META: Record<ResourceType, { icon: typeof Link2; color: PaletteKey }> = {
  LINK:  { icon: Link2,     color: 'pink' },
  VIDEO: { icon: Video,     color: 'amber' },
  IMAGE: { icon: ImageIcon, color: 'blue' },
}

/** Lets the user browse the org-wide Resources library (folders + resources) and multi-select
 *  items to attach elsewhere (e.g. to an Activity) — mirrors the folder-browsing UX in
 *  ResourcesPage.tsx, but for picking rather than managing. */
export function ResourcePickerModal({ selected, onConfirm, onClose }: {
  selected: ResourceResponse[]
  onConfirm: (chosen: ResourceResponse[]) => void
  onClose: () => void
}) {
  const [folderId, setFolderId] = useState<string | undefined>(undefined)
  const [draft, setDraft] = useState<ResourceResponse[]>(selected)

  const { data, isLoading } = useQuery({
    queryKey: ['resources', folderId ?? 'root'],
    queryFn: () => resourcesApi.browse(folderId),
  })

  const folder = data?.folder ?? null
  const breadcrumb = data?.breadcrumb ?? []
  const subfolders = data?.subfolders ?? []
  const resources = data?.resources ?? []
  const isEmpty = !isLoading && subfolders.length === 0 && resources.length === 0

  const isSelected = (r: ResourceResponse) => draft.some(d => d.id === r.id)
  const toggle = (r: ResourceResponse) =>
    setDraft(prev => isSelected(r) ? prev.filter(d => d.id !== r.id) : [...prev, r])

  return (
    <Modal open title="Add from Resources library" onClose={onClose} size="lg">
      {/* Selected chips */}
      {draft.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3 pb-3" style={{ borderBottom: `1px solid ${border.divider}` }}>
          {draft.map(r => (
            <span key={r.id} className="flex items-center gap-1 text-xs px-2 py-1 rounded-full truncate max-w-[200px]"
              style={{ background: accentAlpha(0.10), color: colors.accent }}>
              <span className="truncate">{r.name}</span>
            </span>
          ))}
        </div>
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 flex-wrap text-sm mb-3">
        <button
          onClick={() => setFolderId(undefined)}
          className="flex items-center gap-1 px-2 py-1 rounded-lg transition-colors"
          style={{ color: folder ? colors.text.muted : colors.accent, fontWeight: folder ? 400 : 600 }}
        >
          <Home size={13} /> Resources
        </button>
        {breadcrumb.map(b => (
          <span key={b.id} className="flex items-center gap-1.5">
            <ChevronRight size={13} style={{ color: colors.text.dim }} />
            <button onClick={() => setFolderId(b.id)} className="px-2 py-1 rounded-lg transition-colors" style={{ color: colors.text.muted }}>
              {b.name}
            </button>
          </span>
        ))}
        {folder && (
          <span className="flex items-center gap-1.5">
            <ChevronRight size={13} style={{ color: colors.text.dim }} />
            <span className="px-2 py-1 font-semibold" style={{ color: colors.accent }}>{folder.name}</span>
          </span>
        )}
      </div>

      {/* Browse list */}
      <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${border.card}`, minHeight: 240 }}>
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" style={{ color: colors.accent }} />
          </div>
        ) : isEmpty ? (
          <div className="py-10">
            <EmptyState icon={<Folder size={22} />} title="Nothing here" description="No folders or resources in this location." />
          </div>
        ) : (
          <>
            {resources.map((r, i) => {
              const meta = TYPE_META[r.type]
              const Icon = meta.icon
              const picked = isSelected(r)
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => toggle(r)}
                  className="w-full flex items-center gap-3 px-4 py-3 transition-colors text-left"
                  style={{
                    borderBottom: i < resources.length - 1 || subfolders.length > 0 ? `1px solid ${border.divider}` : undefined,
                    background: picked ? accentAlpha(0.06) : 'transparent',
                  }}
                  onMouseEnter={e => { if (!picked) (e.currentTarget as HTMLElement).style.background = surface.rowHover }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = picked ? accentAlpha(0.06) : 'transparent' }}
                >
                  <span className="flex-shrink-0 h-4 w-4 rounded flex items-center justify-center"
                    style={{ border: picked ? 'none' : `2px solid ${border.divider}`, background: picked ? colors.accent : 'transparent' }}>
                    {picked && <Check size={10} style={{ color: '#fff' }} />}
                  </span>
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0" style={paletteStyle(meta.color, 0.14, 0)}>
                    <Icon size={14} />
                  </div>
                  <span className="text-sm font-medium truncate flex-1" style={{ color: colors.text.primary }}>{r.name}</span>
                </button>
              )
            })}

            {subfolders.map((f, i) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFolderId(f.id)}
                className="w-full flex items-center gap-3 px-4 py-3 transition-colors text-left"
                style={{ borderBottom: i < subfolders.length - 1 ? `1px solid ${border.divider}` : undefined }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = surface.rowHover}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                <span className="h-4 w-4 flex-shrink-0" />
                <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: accentAlpha(0.10) }}>
                  <Folder size={14} style={{ color: colors.accent }} />
                </div>
                <span className="text-sm font-medium truncate flex-1" style={{ color: colors.text.primary }}>{f.name}</span>
                <ChevronRight size={14} style={{ color: colors.text.dim }} className="flex-shrink-0" />
              </button>
            ))}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-4" style={{ borderTop: `1px solid ${border.divider}` }}>
        <span className="text-sm" style={{ color: colors.text.muted }}>
          {draft.length > 0 ? `${draft.length} resource${draft.length > 1 ? 's' : ''} selected` : 'Nothing selected yet'}
        </span>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => { onConfirm(draft); onClose() }}>
            Add{draft.length > 0 ? ` (${draft.length})` : ''}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
