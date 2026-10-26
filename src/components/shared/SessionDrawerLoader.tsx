import { useQuery } from '@tanstack/react-query'
import { therapySessionsApi } from '../../api/therapySessions'
import { useAuth } from '../../contexts/AuthContext'
import { Modal } from '../ui/Modal'
import { Spinner } from '../ui/Spinner'
import { SessionEventModal } from './SessionEventModal'
import { colors } from '../../theme'

/** Fetches the full session when a row is clicked (so lists can stay slim) and opens the same
 *  Session Notes side drawer the calendar uses — notes, progress report, score, checklist, attachments and
 *  status — with the same access rules, so a therapist can add notes straight from the dashboard. */
export function SessionDrawerLoader({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const { user, activeRole } = useAuth()
  const { data: session, isError } = useQuery({
    queryKey: ['therapy-session', sessionId],
    queryFn: () => therapySessionsApi.get(sessionId),
    gcTime: 0,   // always read fresh when reopened — never show stale notes or ratings
  })

  if (session) {
    const adminTier = activeRole === 'BUSINESS_OWNER' || activeRole === 'CLINIC_HEAD' || activeRole === 'OFFICE_ADMIN'
    return (
      <SessionEventModal
        key={session.id}
        session={session}
        canAccessNotes={adminTier || session.therapistId === user?.id}
        canCancel={adminTier}
        canReschedule={adminTier}
        hideFeedback={activeRole === 'PARENT'}
        onClose={onClose}
      />
    )
  }

  return (
    <Modal open title="Session" onClose={onClose} variant="side" size="lg">
      {isError
        ? <p className="text-sm py-6 text-center" style={{ color: colors.status.danger }}>Couldn't load this session.</p>
        : <div className="py-10 flex justify-center"><Spinner /></div>}
    </Modal>
  )
}
