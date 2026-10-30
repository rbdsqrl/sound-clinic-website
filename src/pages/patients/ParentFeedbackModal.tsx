import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { parentFeedbackApi } from '../../api/parentFeedback'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../hooks/useToast'
import { getApiError } from '../../lib/apiError'
import { colors } from '../../theme'
import type { ParentFeedback, TherapySessionResponse } from '../../types'

const MAX_LENGTH = 2000

/** A parent's feedback on one completed session — the clinic team reads it first and decides whether to pass it on to the therapist. */
export function ParentFeedbackModal({ session, existing, enrollmentId, onClose }: {
  session: TherapySessionResponse
  existing?: ParentFeedback
  enrollmentId: string
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [message, setMessage] = useState(existing?.message ?? '')
  const [formError, setFormError] = useState<string | null>(null)

  const mut = useMutation({
    mutationFn: () => parentFeedbackApi.give(session.id, message.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parent-feedback'] })
      qc.invalidateQueries({ queryKey: ['dashboard', 'attention-counts'] })
      toast(existing ? 'Feedback updated' : 'Feedback sent to the clinic', 'success')
      onClose()
    },
    onError: err => setFormError(getApiError(err, 'Could not send your feedback')),
  })

  const when = format(parseISO(session.sessionDate), 'EEE d MMM')
  return (
    <Modal open onClose={onClose} title={existing ? 'Your feedback' : 'Give feedback'} error={formError}>
      <div className="space-y-4">
        <p className="text-sm" style={{ color: colors.text.muted }}>
          Session #{session.sessionNumber} · {when} · {session.programName}
        </p>
        <div className="space-y-1">
          <label className="form-label">How did the session go?</label>
          <textarea
            className="form-input"
            rows={5}
            maxLength={MAX_LENGTH}
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Share what went well, or anything you'd like the clinic to know."
          />
          <p className="text-[11.5px]" style={{ color: colors.text.dim }}>
            The clinic team reads this first and may share it with the therapist. {message.length}/{MAX_LENGTH}
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => { setFormError(null); mut.mutate() }} loading={mut.isPending} disabled={!message.trim()}>
            {existing ? 'Update feedback' : 'Send feedback'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
