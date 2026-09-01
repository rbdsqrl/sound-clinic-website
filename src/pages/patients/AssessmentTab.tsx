import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Plus, ClipboardList, Download, Paperclip, Check } from 'lucide-react'
import { assessmentsApi } from '../../api/assessments'
import { useAuth } from '../../contexts/AuthContext'
import { Card, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageLoader } from '../../components/ui/Spinner'
import { useToast } from '../../hooks/useToast'
import { getApiError } from '../../lib/apiError'
import { colors, border, accentAlpha, type PaletteKey } from '../../theme'
import ScoreChart, { type ScorePoint } from '../../components/charts/ScoreChart'
import type { AssessmentDefinitionResponse, AssessmentItem, AssessmentItemAnswer, AssessmentType, PatientAssessmentResponse } from '../../types'

const CLASSIFICATION_COLOR: Record<string, PaletteKey> = {
  'No Autism': 'green',
  'Mild Autism': 'yellow',
  'Moderate Autism': 'amber',
  'Severe Autism': 'red',
  'Adequate': 'green',
  'Inadequate': 'red',
  'Low Risk': 'green',
  'Medium Risk': 'amber',
  'High Risk': 'red',
}

const CAN_FILL_ROLES = ['BUSINESS_OWNER', 'CLINIC_HEAD', 'THERAPIST', 'DOCTOR']

export default function AssessmentTab({
  patientId, type, title, description,
}: {
  patientId: string
  type: AssessmentType
  title: string
  description: string
}) {
  const { user, activeRole } = useAuth()
  const currentRole = activeRole ?? user?.role
  const canFill = CAN_FILL_ROLES.includes(currentRole ?? '')
  const { toast } = useToast()

  const [formOpen, setFormOpen] = useState(false)

  const downloadMut = useMutation({
    mutationFn: (assessmentId: string) => assessmentsApi.pdfUrl(patientId, type, assessmentId),
    onSuccess: (url) => window.open(url, '_blank', 'noopener,noreferrer'),
    onError: (err) => toast(getApiError(err, 'Failed to prepare PDF'), 'error'),
  })

  const { data: definition, isLoading: defLoading } = useQuery({
    queryKey: ['assessment-definition', patientId, type],
    queryFn: () => assessmentsApi.getDefinition(patientId, type),
  })

  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: ['assessment-history', patientId, type],
    queryFn: () => assessmentsApi.list(patientId, type),
  })

  if (defLoading || historyLoading) return <PageLoader />

  const scored = definition?.scoringType === 'SUM_SCORE'
  const points: ScorePoint[] = scored ? history
    .filter(h => h.totalScore != null && h.maxScore)
    .map(h => ({
      label: format(new Date(h.assessmentDate + 'T00:00:00'), 'd MMM'),
      value: Math.round((h.totalScore! / h.maxScore!) * 100),
      meta: `${h.totalScore}/${h.maxScore}${h.classification ? ` · ${h.classification}` : ''}`,
    })) : []

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader
          title={title}
          subtitle={description}
          action={canFill ? (
            <Button onClick={() => setFormOpen(true)}>
              <Plus size={15} /> New Assessment
            </Button>
          ) : undefined}
        />

        {history.length === 0 ? (
          <EmptyState
            icon={<ClipboardList size={22} />}
            title="No assessments recorded yet"
            description={canFill ? 'Fill the first assessment to start tracking a score over time.' : 'No assessments have been recorded for this case yet.'}
          />
        ) : (
          <>
            {scored && points.length > 0 && (
              <div className="mb-5">
                <ScoreChart points={points} variant="line" />
              </div>
            )}

            <div className="overflow-x-auto rounded-xl" style={{ border: border.card }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: `1px solid ${border.divider}` }}>
                    <th className="text-left px-3 py-2 font-medium" style={{ color: colors.text.muted }}>Date</th>
                    {scored && <th className="text-left px-3 py-2 font-medium" style={{ color: colors.text.muted }}>Score</th>}
                    {scored && <th className="text-left px-3 py-2 font-medium" style={{ color: colors.text.muted }}>Classification</th>}
                    <th className="text-left px-3 py-2 font-medium hidden md:table-cell" style={{ color: colors.text.muted }}>Filled by</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {[...history].reverse().map(h => (
                    <tr key={h.id} style={{ borderBottom: `1px solid ${border.divider}` }}>
                      <td className="px-3 py-2" style={{ color: colors.text.primary }}>
                        {format(new Date(h.assessmentDate + 'T00:00:00'), 'd MMM yyyy')}
                      </td>
                      {scored && (
                        <td className="px-3 py-2 font-semibold" style={{ color: colors.text.primary }}>
                          {h.totalScore}/{h.maxScore}
                        </td>
                      )}
                      {scored && (
                        <td className="px-3 py-2">
                          {h.classification
                            ? <Badge variant={CLASSIFICATION_COLOR[h.classification] ?? 'slate'}>{h.classification}</Badge>
                            : <span style={{ color: colors.text.dim }}>—</span>}
                        </td>
                      )}
                      <td className="px-3 py-2 hidden md:table-cell" style={{ color: colors.text.muted }}>
                        {h.filledByName ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => downloadMut.mutate(h.id)}
                          disabled={downloadMut.isPending}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg flex-shrink-0"
                          style={{ color: colors.accent, background: accentAlpha(0.10) }}
                        >
                          <Download size={12} /> PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      {formOpen && definition && (
        <NewAssessmentModal
          patientId={patientId}
          type={type}
          title={title}
          definition={definition}
          onClose={() => setFormOpen(false)}
        />
      )}
    </div>
  )
}

function answered(item: AssessmentItem, answer: AssessmentItemAnswer | undefined): boolean {
  if (!answer) return false
  switch (item.itemType) {
    case 'SINGLE_SELECT': return !!answer.optionId
    case 'MULTI_SELECT': return !!answer.optionIds && answer.optionIds.length > 0
    case 'TEXT':
    case 'FILE': return !!answer.text && answer.text.trim().length > 0
  }
}

function NewAssessmentModal({
  patientId, type, title, definition, onClose,
}: {
  patientId: string
  type: AssessmentType
  title: string
  definition: AssessmentDefinitionResponse
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [assessmentDate, setAssessmentDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [answers, setAnswers] = useState<Map<number, AssessmentItemAnswer>>(new Map())

  const allItems = definition.categories.flatMap(c => c.items)
  const totalItems = allItems.length
  const answeredCount = allItems.filter(i => answered(i, answers.get(i.number))).length
  const canSave = answeredCount === totalItems

  const setAnswer = (itemNumber: number, answer: AssessmentItemAnswer) =>
    setAnswers(prev => new Map(prev).set(itemNumber, answer))

  const saveMut = useMutation({
    mutationFn: () => assessmentsApi.create(patientId, type, {
      assessmentDate,
      responses: Object.fromEntries(answers),
    }),
    onSuccess: (created: PatientAssessmentResponse) => {
      qc.invalidateQueries({ queryKey: ['assessment-history', patientId, type] })
      const scoreMsg = created.totalScore != null
        ? ` — score ${created.totalScore}/${created.maxScore}${created.classification ? ` (${created.classification})` : ''}`
        : ''
      toast(`Saved${scoreMsg}`, 'success')
      onClose()
    },
    onError: (err) => toast(getApiError(err, 'Failed to save assessment'), 'error'),
  })

  return (
    <Modal
      open
      title={`New ${title} Assessment`}
      onClose={onClose}
      size="lg"
      footer={
        <>
          {saveMut.isError && (
            <div className="flex-1 text-xs" style={{ color: colors.status.danger }}>
              {getApiError(saveMut.error, 'Failed to save. Nothing was changed — please try again.')}
            </div>
          )}
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={saveMut.isPending} disabled={!canSave} onClick={() => saveMut.mutate()}>
            Save ({answeredCount}/{totalItems})
          </Button>
        </>
      }
    >
      <div className="mb-4 max-w-xs">
        <Input
          type="date"
          label="Assessment date"
          value={assessmentDate}
          onChange={e => setAssessmentDate(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-6">
        {definition.categories.map(category => (
          <div key={category.name}>
            <h3 className="text-sm font-semibold mb-3" style={{ color: colors.text.heading }}>{category.name}</h3>
            <div className="flex flex-col gap-4">
              {category.items.map(item => (
                <ItemInput
                  key={item.number}
                  patientId={patientId}
                  type={type}
                  item={item}
                  answer={answers.get(item.number)}
                  onChange={a => setAnswer(item.number, a)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  )
}

function ItemInput({
  patientId, type, item, answer, onChange,
}: {
  patientId: string
  type: AssessmentType
  item: AssessmentItem
  answer: AssessmentItemAnswer | undefined
  onChange: (answer: AssessmentItemAnswer) => void
}) {
  const { toast } = useToast()
  const uploadMut = useMutation({
    mutationFn: (file: File) => assessmentsApi.uploadFile(patientId, type, file),
    onSuccess: (url) => onChange({ text: url }),
    onError: (err) => toast(getApiError(err, 'Failed to upload file'), 'error'),
  })

  return (
    <div>
      <p className="text-sm mb-2" style={{ color: colors.text.primary }}>
        {item.number}. {item.text}
      </p>

      {item.itemType === 'SINGLE_SELECT' && (
        <div className="flex flex-wrap gap-2">
          {item.options.map(opt => {
            const selected = answer?.optionId === opt.id
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onChange({ optionId: opt.id })}
                className="text-xs font-medium px-3 py-1.5 rounded-full border transition-all"
                style={selected
                  ? { background: colors.accent, color: '#fff', border: `1px solid ${colors.accent}` }
                  : { background: 'transparent', color: colors.text.muted, border: `1px solid ${border.card}` }}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      )}

      {item.itemType === 'MULTI_SELECT' && (
        <div className="flex flex-wrap gap-2">
          {item.options.map(opt => {
            const selected = (answer?.optionIds ?? []).includes(opt.id)
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  const current = answer?.optionIds ?? []
                  const next = selected ? current.filter(id => id !== opt.id) : [...current, opt.id]
                  onChange({ optionIds: next })
                }}
                className="text-xs font-medium px-3 py-1.5 rounded-full border transition-all inline-flex items-center gap-1"
                style={selected
                  ? { background: colors.accent, color: '#fff', border: `1px solid ${colors.accent}` }
                  : { background: 'transparent', color: colors.text.muted, border: `1px solid ${border.card}` }}
              >
                {selected && <Check size={11} />} {opt.label}
              </button>
            )
          })}
        </div>
      )}

      {item.itemType === 'TEXT' && (
        <Input
          value={answer?.text ?? ''}
          onChange={e => onChange({ text: e.target.value })}
        />
      )}

      {item.itemType === 'FILE' && (
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border cursor-pointer transition-all"
            style={{ color: colors.text.muted, border: `1px solid ${border.card}` }}>
            <Paperclip size={12} />
            {uploadMut.isPending ? 'Uploading…' : answer?.text ? 'Replace file' : 'Attach file'}
            <input
              type="file"
              className="hidden"
              disabled={uploadMut.isPending}
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) uploadMut.mutate(file)
                e.target.value = ''
              }}
            />
          </label>
          {answer?.text && (
            <a href={answer.text} target="_blank" rel="noopener noreferrer"
              className="text-xs truncate max-w-[220px]" style={{ color: colors.accent }}>
              View uploaded file
            </a>
          )}
        </div>
      )}
    </div>
  )
}
