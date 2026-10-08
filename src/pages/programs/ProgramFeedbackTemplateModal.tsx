import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { programsApi } from '../../api/programs'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import FeedbackTemplateEditor, { feedbackQuestionsValid, toQuestionInputs, type EditableQuestion } from './FeedbackTemplateEditor'
import { useToast } from '../../hooks/useToast'
import { getApiError } from '../../lib/apiError'
import { colors } from '../../theme'

export default function ProgramFeedbackTemplateModal({
  programId, programName, onClose,
}: {
  programId: string
  programName: string
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [questions, setQuestions] = useState<EditableQuestion[]>([])
  const [loaded, setLoaded] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['program-feedback-template', programId],
    queryFn: () => programsApi.getFeedbackTemplate(programId),
  })

  useEffect(() => {
    if (data && !loaded) {
      setQuestions(data.map(q => ({ questionText: q.questionText, options: q.options.map(o => o.optionText) })))
      setLoaded(true)
    }
  }, [data, loaded])

  const saveMut = useMutation({
    mutationFn: () => {
      return programsApi.updateFeedbackTemplate(programId, { questions: toQuestionInputs(questions) })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['program-feedback-template', programId] })
      qc.invalidateQueries({ queryKey: ['session-feedback'] })
      toast('Feedback template saved', 'success')
      onClose()
    },
    onError: (err) => setFormError(getApiError(err, 'Failed to save the template. Nothing was changed — please try again.')),
  })

  const canSave = feedbackQuestionsValid(questions)

  return (
    <Modal
      open
      title={`Feedback template — ${programName}`}
      onClose={onClose}
      size="lg"
      error={formError}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={saveMut.isPending} disabled={!canSave} onClick={() => { setFormError(null); saveMut.mutate() }}>
            Save
          </Button>
        </>
      }
    >
      <p className="text-xs mb-3" style={{ color: colors.text.muted }}>
        Add headers with checkbox options. Therapists will see this checklist when writing up a session under this program.
      </p>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="h-5 w-5 animate-spin rounded-full border-2" style={{ borderColor: `${colors.accent}30`, borderTopColor: colors.accent }} />
        </div>
      ) : (
        <FeedbackTemplateEditor questions={questions} setQuestions={setQuestions} onError={setFormError} excludeProgramId={programId} />
      )}
    </Modal>
  )
}

/** The same checklist builder, but for a program that doesn't exist yet (Add Program):
 *  nothing is sent to the server — "Done" hands the questions back to the form, which
 *  saves them once the program has been created. */
export function FeedbackDraftModal({
  programName, initial, onDone, onClose,
}: {
  programName: string
  initial: EditableQuestion[]
  onDone: (questions: EditableQuestion[]) => void
  onClose: () => void
}) {
  const [questions, setQuestions] = useState<EditableQuestion[]>(initial)
  const [formError, setFormError] = useState<string | null>(null)

  return (
    <Modal
      open
      title={`Feedback template — ${programName || 'New program'}`}
      onClose={onClose}
      size="lg"
      error={formError}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!feedbackQuestionsValid(questions)} onClick={() => onDone(questions)}>
            Done
          </Button>
        </>
      }
    >
      <p className="text-xs mb-3" style={{ color: colors.text.muted }}>
        Add headers with checkbox options. Therapists will see this checklist when writing up a session under this program. It is saved when you add the program.
      </p>
      <FeedbackTemplateEditor questions={questions} setQuestions={setQuestions} onError={setFormError} />
    </Modal>
  )
}
