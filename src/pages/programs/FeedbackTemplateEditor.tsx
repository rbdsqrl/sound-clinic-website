import { useRef, useState } from 'react'
import { useQuery, useQueries } from '@tanstack/react-query'
import { Plus, Trash2, X, FileUp, Copy } from 'lucide-react'
import { programsApi } from '../../api/programs'
import { Select } from '../../components/ui/Select'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useToast } from '../../hooks/useToast'
import { colors, border, surface, accentAlpha } from '../../theme'
import type { ProgramFeedbackQuestionInput } from '../../types'

export type EditableQuestion = { questionText: string; options: string[] }

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

/** True when every header has a name and at least one non-empty option. */
export const feedbackQuestionsValid = (questions: EditableQuestion[]) =>
  questions.every(q => q.questionText.trim() && q.options.some(o => o.trim()))

/** Trimmed API payload — drops blank options and headers left empty. */
export function toQuestionInputs(questions: EditableQuestion[]): ProgramFeedbackQuestionInput[] {
  return questions
    .map(q => ({
      questionText: q.questionText.trim(),
      questionType: 'MULTI_CHOICE' as const,
      options: q.options.map(o => o.trim()).filter(Boolean),
    }))
    .filter(q => q.questionText && q.options.length > 0)
}

/** CSV upload + header/option builder for a program's session feedback checklist.
 *  Controlled — used by the template modal and by the Add Program form. */
export default function FeedbackTemplateEditor({
  questions, setQuestions, onError, excludeProgramId,
}: {
  /** The program being edited, so it isn't offered as its own copy source. */
  excludeProgramId?: string
  questions: EditableQuestion[]
  setQuestions: React.Dispatch<React.SetStateAction<EditableQuestion[]>>
  onError: (message: string | null) => void
}) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const setFormError = onError

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

  // Merge into headers already on screen (matched case-insensitively) instead of
  // duplicating them; anything new is appended as a fresh header block.
  const mergeGroups = (groups: { questionText: string; options: string[] }[], verb: string) => {
    setQuestions(qs => {
      const next = qs.map(q => ({ ...q, options: [...q.options] }))
      let added = 0
      for (const group of groups) {
        const existing = next.find(q => q.questionText.trim().toLowerCase() === group.questionText.toLowerCase())
        if (existing) {
          for (const opt of group.options) if (!existing.options.includes(opt)) existing.options.push(opt)
        } else {
          next.push({ questionText: group.questionText, options: [...group.options] })
        }
        added += group.options.length
      }
      toast(`${verb} ${added} option${added !== 1 ? 's' : ''} across ${groups.length} header${groups.length !== 1 ? 's' : ''}`, 'success')
      return next
    })
  }

  // Copy from another program — only programs that actually have a checklist are offered.
  const [copyFromId, setCopyFromId] = useState('')
  const { data: programs = [] } = useQuery({ queryKey: ['programs'], queryFn: () => programsApi.list() })
  const others = programs.filter(p => p.id !== excludeProgramId)
  const templates = useQueries({
    queries: others.map(p => ({
      queryKey: ['program-feedback-template', p.id],
      queryFn: () => programsApi.getFeedbackTemplate(p.id),
    })),
  })
  const sources = others
    .map((p, i) => ({ program: p, template: templates[i]?.data ?? [] }))
    .filter(x => x.template.length > 0)
  const copySource = sources.find(x => x.program.id === copyFromId)

  const copyFromProgram = () => {
    if (!copySource) return
    mergeGroups(
      copySource.template.map(q => ({ questionText: q.questionText, options: q.options.map(o => o.optionText) })),
      `Copied from ${copySource.program.name}:`,
    )
    setCopyFromId('')
  }

  const handleCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const parsed = parseFeedbackCsv(ev.target?.result as string)
      if (parsed.length === 0) {
        setFormError('No valid rows found. Expected columns: header, option')
        return
      }
      setFormError(null)
      mergeGroups(parsed, 'Imported')
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <>
      {sources.length > 0 && (
        <div className="rounded-xl p-3 mb-3" style={{ background: surface.rowHover }}>
          <p className="text-xs font-semibold mb-2" style={{ color: colors.text.primary }}>
            Copy from another program
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Select
              className="flex-1 text-sm"
              placeholder="Choose a program with feedback questions…"
              value={copyFromId}
              onChange={e => setCopyFromId(e.target.value)}
              options={sources.map(x => ({
                value: x.program.id,
                label: `${x.program.name} (${x.template.length} header${x.template.length !== 1 ? 's' : ''})`,
              }))}
            />
            <Button size="sm" variant="secondary" disabled={!copySource} onClick={copyFromProgram}>
              <Copy size={13} /> Copy
            </Button>
          </div>
          <p className="text-xs mt-2" style={{ color: colors.text.muted }}>
            Adds that program's headers and options below — matching headers are merged, and you can edit anything afterwards.
          </p>
        </div>
      )}

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
    </>
  )
}
