import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, X, FileUp, AlertTriangle } from 'lucide-react'
import { programsApi } from '../../api/programs'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useToast } from '../../hooks/useToast'
import { getApiError } from '../../lib/apiError'
import { colors, border, surface, accentAlpha, dangerAlpha } from '../../theme'
import type { ProgramFeedbackQuestionInput } from '../../types'

type EditableQuestion = { questionText: string; options: string[] }

const SAMPLE_CSV = `header,option
Engagement,Attentive
Engagement,Distracted
Engagement,Cooperative
Behavior,Calm
Behavior,Anxious`

// One row per checkbox option; rows sharing the same header value (case-insensitively)
// are grouped into a single header block, in the order first seen.
function parseFeedbackCsv(text: string): { questionText: string; options: string[] }[] {
  const rows = text.trim().split(/\r?\n/).filter(Boolean)
  const order: string[] = []
  const byHeader = new Map<string, string[]>()

  for (const row of rows) {
    const parts = row.split(',').map(p => p.trim().replace(/^"|"$/g, ''))
    const [header, ...rest] = parts
    // The option text itself may contain commas (e.g. a description) — everything
    // after the first comma belongs to it, not just the second field.
    const option = rest.join(',').trim()
    if (!header) continue
    if (/^header$/i.test(header) && /^option$/i.test(option)) continue // title row
    if (!option) continue

    const key = header.toLowerCase()
    if (!byHeader.has(key)) { byHeader.set(key, []); order.push(header) }
    byHeader.get(key)!.push(option)
  }

  return order.map(header => ({ questionText: header, options: byHeader.get(header.toLowerCase())! }))
}

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
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      const cleaned: ProgramFeedbackQuestionInput[] = questions
        .map(q => ({
          questionText: q.questionText.trim(),
          questionType: 'MULTI_CHOICE' as const,
          options: q.options.map(o => o.trim()).filter(Boolean),
        }))
        .filter(q => q.questionText && q.options.length > 0)
      return programsApi.updateFeedbackTemplate(programId, { questions: cleaned })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['program-feedback-template', programId] })
      qc.invalidateQueries({ queryKey: ['session-feedback'] })
      toast('Feedback template saved', 'success')
      onClose()
    },
    onError: (err) => toast(getApiError(err, 'Failed to save template'), 'error'),
  })

  const addHeader = () => setQuestions(qs => [...qs, { questionText: '', options: [''] }])
  const removeHeader = (qi: number) => setQuestions(qs => qs.filter((_, i) => i !== qi))
  const setHeaderText = (qi: number, text: string) =>
    setQuestions(qs => qs.map((q, i) => i === qi ? { ...q, questionText: text } : q))
  const addOption = (qi: number) =>
    setQuestions(qs => qs.map((q, i) => i === qi ? { ...q, options: [...q.options, ''] } : q))
  const removeOption = (qi: number, oi: number) =>
    setQuestions(qs => qs.map((q, i) => i === qi ? { ...q, options: q.options.filter((_, j) => j !== oi) } : q))
  const setOptionText = (qi: number, oi: number, text: string) =>
    setQuestions(qs => qs.map((q, i) => i === qi
      ? { ...q, options: q.options.map((o, j) => j === oi ? text : o) }
      : q))

  const canSave = questions.every(q => q.questionText.trim() && q.options.some(o => o.trim()))

  const handleCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const parsed = parseFeedbackCsv(ev.target?.result as string)
      if (parsed.length === 0) {
        toast('No valid rows found. Expected columns: header, option', 'error')
        return
      }
      // Merge into headers already on screen (matched case-insensitively) instead of
      // duplicating them; anything new is appended as a fresh header block.
      setQuestions(qs => {
        const next = qs.map(q => ({ ...q, options: [...q.options] }))
        let added = 0
        for (const group of parsed) {
          const existing = next.find(q => q.questionText.trim().toLowerCase() === group.questionText.toLowerCase())
          if (existing) {
            for (const opt of group.options) if (!existing.options.includes(opt)) existing.options.push(opt)
          } else {
            next.push({ questionText: group.questionText, options: group.options })
          }
          added += group.options.length
        }
        toast(`Imported ${added} option${added !== 1 ? 's' : ''} across ${parsed.length} header${parsed.length !== 1 ? 's' : ''}`, 'success')
        return next
      })
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <Modal
      open
      title={`Feedback template — ${programName}`}
      onClose={onClose}
      size="lg"
      footer={
        <div className="flex flex-col gap-3 w-full">
          {saveMut.isError && (
            <div className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm"
              style={{ background: dangerAlpha(0.08), border: `1px solid ${dangerAlpha(0.2)}` }}>
              <AlertTriangle size={14} style={{ color: colors.status.danger, flexShrink: 0, marginTop: 1 }} />
              <span style={{ color: colors.text.primary }}>
                {getApiError(saveMut.error, 'Failed to save the template. Nothing was changed — please try again.')}
              </span>
            </div>
          )}
          <div className="flex items-center justify-end gap-2.5">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="primary" loading={saveMut.isPending} disabled={!canSave} onClick={() => saveMut.mutate()}>
              Save
            </Button>
          </div>
        </div>
      }
    >
      <p className="text-xs mb-3" style={{ color: colors.text.muted }}>
        Add headers with checkbox options. Therapists will see this checklist when writing up a session under this program.
      </p>

      <div className="rounded-xl p-3 mb-5" style={{ background: surface.rowHover }}>
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-xs font-semibold" style={{ color: colors.text.primary }}>
            Bulk upload from CSV
          </p>
          <label className="cursor-pointer flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg flex-shrink-0"
            style={{ color: colors.accent, background: accentAlpha(0.08) }}>
            <FileUp size={12} /> Upload CSV
            <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleCsvFile} />
          </label>
        </div>
        <p className="text-xs mb-2" style={{ color: colors.text.muted }}>
          One row per checkbox option. Rows sharing the same header are grouped together — matching headers already on screen get merged in.
        </p>
        <pre className="text-[11px] font-mono rounded-lg p-2.5 overflow-x-auto"
          style={{ background: surface.filterStrip, color: colors.text.muted, border: border.card }}>
{SAMPLE_CSV}
        </pre>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="h-5 w-5 animate-spin rounded-full border-2" style={{ borderColor: `${colors.accent}30`, borderTopColor: colors.accent }} />
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {questions.map((q, qi) => (
            <div key={qi} className="rounded-xl p-4" style={{ border: border.card }}>
              <div className="flex items-start gap-2 mb-3">
                <Input
                  className="flex-1"
                  placeholder="Header (e.g. Engagement)"
                  value={q.questionText}
                  onChange={e => setHeaderText(qi, e.target.value)}
                />
                <button
                  onClick={() => removeHeader(qi)}
                  className="p-2 rounded-lg flex-shrink-0"
                  style={{ color: colors.text.dim }}
                  title="Remove header"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <div className="flex flex-col gap-2 pl-1">
                {q.options.map((opt, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded flex-shrink-0" style={{ border: `1.5px solid ${border.card}` }} />
                    <Input
                      className="flex-1"
                      placeholder="Checkbox option"
                      value={opt}
                      onChange={e => setOptionText(qi, oi, e.target.value)}
                    />
                    <button
                      onClick={() => removeOption(qi, oi)}
                      className="p-1.5 rounded-lg flex-shrink-0"
                      style={{ color: colors.text.dim }}
                      title="Remove option"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => addOption(qi)}
                  className="flex items-center gap-1.5 text-xs font-medium self-start mt-1"
                  style={{ color: colors.accent }}
                >
                  <Plus size={12} /> Add option
                </button>
              </div>
            </div>
          ))}

          <button
            onClick={addHeader}
            className="flex items-center justify-center gap-1.5 text-sm font-semibold py-2.5 rounded-xl"
            style={{ background: `${colors.accent}14`, color: colors.accent }}
          >
            <Plus size={14} /> Add Header
          </button>
        </div>
      )}
    </Modal>
  )
}
