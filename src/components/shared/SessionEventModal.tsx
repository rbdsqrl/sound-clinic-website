import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { therapySessionsApi } from '../../api/therapySessions'
import { SessionNotesModal, RescheduleSessionModal } from '../../pages/patients/EnrollmentSessions'
import { getApiError } from '../../lib/apiError'
import { useToast } from '../../hooks/useToast'
import type { TherapySessionResponse } from '../../types'

// A therapy session gets the same Session Notes modal used on the Patient → Therapy tab
// (Performance Score, Rating, Progress Report, checklist, Attachments, Mark-as), rather than
// the lighter drawer used for every other calendar event kind. This wrapper adds the two
// actions that only make sense from the calendar — reschedule, and approving/rejecting a
// pending cancellation — as optional props on the shared modal.
export function SessionEventModal({
  session, canAccessNotes, canCancel, canReschedule, hideFeedback = false, onClose,
}: {
  session: TherapySessionResponse
  canAccessNotes: boolean
  canCancel: boolean
  canReschedule: boolean
  /** Parents can see that a session exists but never the clinical write-up left for it. */
  hideFeedback?: boolean
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [rescheduleOpen, setRescheduleOpen] = useState(false)

  const invalidateAndClose = () => {
    qc.invalidateQueries({ queryKey: ['therapy-sessions-cal'] })
    qc.invalidateQueries({ queryKey: ['therapy-sessions-enrollment'] })
    onClose()
  }

  const approveCancellationMut = useMutation({
    mutationFn: () => therapySessionsApi.approveCancellation(session.id),
    onSuccess: invalidateAndClose,
  })
  const rejectCancellationMut = useMutation({
    mutationFn: () => therapySessionsApi.rejectCancellation(session.id),
    onSuccess: invalidateAndClose,
  })

  const cancellationRequested = canCancel && session.status === 'CANCELLATION_REQUESTED'

  // A parent can ask the clinic to move a session. The server enforces how many requests a plan
  // allows and says so if the limit is reached, so there's nothing to pre-check here.
  const canRequestReschedule = hideFeedback && !canReschedule
    && session.status === 'SCHEDULED' && !session.awaitingPayment
  const requestRescheduleMut = useMutation({
    mutationFn: () => therapySessionsApi.requestReschedule(session.id),
    onSuccess: () => { toast('Reschedule request sent to the clinic', 'success'); invalidateAndClose() },
    onError: (err) => toast(getApiError(err, 'Could not send the request'), 'error'),
  })

  return (
    <>
      <SessionNotesModal
        session={session}
        canEdit={canAccessNotes && !session.awaitingPayment}
        canDirectlyCancel={canCancel}
        hideFeedback={hideFeedback}
        enrollmentId={session.enrollmentId}
        onClose={onClose}
        onReschedule={
          canReschedule && session.status === 'SCHEDULED' ? () => setRescheduleOpen(true)
          : canRequestReschedule ? () => requestRescheduleMut.mutate()
          : undefined
        }
        rescheduleLabel={canRequestReschedule ? 'Request reschedule' : undefined}
        rescheduleDisabled={canRequestReschedule && requestRescheduleMut.isPending}
        cancellationRequested={cancellationRequested}
        onApproveCancellation={cancellationRequested ? () => approveCancellationMut.mutate() : undefined}
        onRejectCancellation={cancellationRequested ? () => rejectCancellationMut.mutate() : undefined}
      />
      {rescheduleOpen && (
        <RescheduleSessionModal
          session={session}
          onClose={() => setRescheduleOpen(false)}
          onDone={() => { setRescheduleOpen(false); invalidateAndClose() }}
        />
      )}
    </>
  )
}
