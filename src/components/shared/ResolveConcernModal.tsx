import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { concernsApi } from '../../api/concerns'
import { getApiError } from '../../lib/apiError'
import { colors, accentAlpha } from '../../theme'
import { formatDateStr } from '../../lib/format'
import type { ConcernResponse } from '../../types'

/** Resolve action for a concern, with an optional remark — shared by the Dashboard's
 *  "Action Needed" panel and the Case details page's concerns banner. */
export function ResolveConcernModal({ concern, onClose, onResolved }: {
  concern: ConcernResponse
  onClose: () => void
  onResolved: () => void
}) {
  const [notes, setNotes] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const resolveMut = useMutation({
    mutationFn: () => concernsApi.resolve(concern.id, notes.trim() || undefined),
    onSuccess: () => onResolved(),
    onError: (err) => setFormError(getApiError(err, 'Failed to resolve concern')),
  })

  return (
    <Modal open onClose={onClose} title="Resolve concern" error={formError}>
      <div className="space-y-4">
        <div className="rounded-xl p-3 text-sm" style={{ background: accentAlpha(0.07), color: colors.text.muted }}>
          <p className="font-medium" style={{ color: colors.text.primary }}>
            {concern.patientFirstName} {concern.patientLastName} · {concern.programName}
          </p>
          <p className="mt-1">{concern.description}</p>
          <p className="mt-1 text-xs" style={{ color: colors.text.dim }}>Raised {formatDateStr(concern.raisedAt)}</p>
        </div>

        <div className="space-y-1">
          <label className="form-label">Remark (optional)</label>
          <textarea
            className="form-input w-full"
            rows={3}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="How this was addressed…"
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => { setFormError(null); resolveMut.mutate() }}
            loading={resolveMut.isPending}
          >
            Resolve
          </Button>
        </div>
      </div>
    </Modal>
  )
}
