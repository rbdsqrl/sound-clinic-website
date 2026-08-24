import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Plus, Trash2, Sparkles, Upload, Link2, GripVertical, ChevronRight } from 'lucide-react'
import { activitiesApi } from '../../api/activities'
import { therapiesApi } from '../../api/therapies'
import { skillsApi, languagesApi, propsApi } from '../../api/activityLookups'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Button } from '../../components/ui/Button'
import { MultiSelectChips } from '../../components/ui/MultiSelectChips'
import { PageLoader } from '../../components/ui/Spinner'
import { ToastContainer } from '../../components/ui/Toast'
import { useToast } from '../../hooks/useToast'
import { getApiError } from '../../lib/apiError'
import { colors, border, surface } from '../../theme'
import { ROUTES } from '../../lib/routes'
import type {
  AgeUnit, ActivityDifficulty, ChecklistQuestionType, ChecklistQuestionInput, CreateActivityRequest,
} from '../../types'

interface FormFields {
  title: string
  aboutActivity: string
  therapyId: string
  durationWeeks: number
  ageMinValue: number
  ageMinUnit: AgeUnit
  ageMaxValue: number
  ageMaxUnit: AgeUnit
  difficulty: ActivityDifficulty
  tipsAndSuggestions: string
  isShared: boolean
}

interface LocalQuestion extends ChecklistQuestionInput {
  _key: string
}

const newKey = () => Math.random().toString(36).slice(2)

function SectionCard({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: colors.text.dim }}>{title}</h3>
        {action}
      </div>
      {children}
    </Card>
  )
}

function MagicFillButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <Button type="button" variant="secondary" size="sm" onClick={onClick} loading={loading}>
      <Sparkles size={14} /> Magic Fill
    </Button>
  )
}

export default function CreateActivityPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const navigate = useNavigate()
  const { toasts, toast, dismiss } = useToast()

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ['activity', id],
    queryFn: () => activitiesApi.get(id!),
    enabled: isEdit,
  })

  const { data: therapies = [] } = useQuery({ queryKey: ['therapies'], queryFn: therapiesApi.list })
  const { data: skills = [] } = useQuery({ queryKey: ['skills'], queryFn: skillsApi.list })
  const { data: languages = [] } = useQuery({ queryKey: ['languages'], queryFn: languagesApi.list })
  const { data: propsList = [] } = useQuery({ queryKey: ['activity-props'], queryFn: propsApi.list })
  const { data: aiStatus } = useQuery({ queryKey: ['activities-ai-status'], queryFn: activitiesApi.aiStatus })

  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<FormFields>({
    defaultValues: {
      durationWeeks: 2, ageMinValue: 0, ageMinUnit: 'YEAR', ageMaxValue: 1, ageMaxUnit: 'YEAR',
      difficulty: 'EASY', isShared: false,
    },
  })

  const [skillIds, setSkillIds] = useState<string[]>([])
  const [languageIds, setLanguageIds] = useState<string[]>([])
  const [propIds, setPropIds] = useState<string[]>([])
  const [instructions, setInstructions] = useState<string[]>([])
  const [checklist, setChecklist] = useState<LocalQuestion[]>([])
  const [links, setLinks] = useState<string[]>([])
  const [stagedFiles, setStagedFiles] = useState<File[]>([])
  const [magicFillLoading, setMagicFillLoading] = useState<'instructions' | 'checklist' | null>(null)

  useEffect(() => {
    if (!existing) return
    reset({
      title: existing.title,
      aboutActivity: existing.aboutActivity,
      therapyId: existing.therapyId ?? '',
      durationWeeks: existing.durationWeeks,
      ageMinValue: existing.ageMinValue,
      ageMinUnit: existing.ageMinUnit,
      ageMaxValue: existing.ageMaxValue,
      ageMaxUnit: existing.ageMaxUnit,
      difficulty: existing.difficulty,
      tipsAndSuggestions: existing.tipsAndSuggestions ?? '',
      isShared: existing.isShared,
    })
    setSkillIds(existing.skills.map((s) => s.id))
    setLanguageIds(existing.languages.map((l) => l.id))
    setPropIds(existing.props.map((p) => p.id))
    setInstructions(existing.instructions)
    setChecklist(existing.checklist.map((q) => ({
      _key: newKey(), questionText: q.questionText, questionType: q.questionType,
      options: q.options.map((o) => o.optionText),
    })))
    setLinks(existing.links)
  }, [existing, reset])

  const saveMut = useMutation({
    mutationFn: async (payload: CreateActivityRequest) => {
      const saved = isEdit ? await activitiesApi.update(id!, payload) : await activitiesApi.create(payload)
      if (!isEdit && stagedFiles.length > 0) {
        for (const file of stagedFiles) {
          await activitiesApi.uploadResource(saved.id, file)
        }
      }
      return saved
    },
    onSuccess: (saved) => {
      toast(isEdit ? 'Activity updated' : 'Activity created', 'success')
      navigate(ROUTES.activity(saved.id))
    },
    onError: (err) => toast(getApiError(err, 'Failed to save activity'), 'error'),
  })

  const onSubmit = (d: FormFields) => {
    saveMut.mutate({
      title: d.title,
      aboutActivity: d.aboutActivity,
      therapyId: d.therapyId || undefined,
      skillIds,
      languageIds,
      durationWeeks: Number(d.durationWeeks),
      ageMinValue: Number(d.ageMinValue),
      ageMinUnit: d.ageMinUnit,
      ageMaxValue: Number(d.ageMaxValue),
      ageMaxUnit: d.ageMaxUnit,
      difficulty: d.difficulty,
      instructions: instructions.filter((s) => s.trim()),
      checklist: checklist
        .filter((q) => q.questionText.trim())
        .map((q) => ({ questionText: q.questionText, questionType: q.questionType, options: q.options.filter((o) => o.trim()) })),
      propIds,
      tipsAndSuggestions: d.tipsAndSuggestions || undefined,
      links: links.filter((l) => l.trim()),
      isShared: d.isShared,
    })
  }

  const runMagicFill = async (section: 'instructions' | 'checklist') => {
    setMagicFillLoading(section)
    try {
      const values = watch()
      const result = await activitiesApi.magicFill({
        title: values.title || 'Untitled activity',
        aboutActivity: values.aboutActivity,
        therapyName: therapies.find((t) => t.id === values.therapyId)?.name,
        skillNames: skills.filter((s) => skillIds.includes(s.id)).map((s) => s.name),
        ageMinValue: Number(values.ageMinValue), ageMinUnit: values.ageMinUnit,
        ageMaxValue: Number(values.ageMaxValue), ageMaxUnit: values.ageMaxUnit,
        difficulty: values.difficulty,
        section,
      })
      if (section === 'instructions') {
        setInstructions((prev) => [...prev.filter((s) => s.trim()), ...result.instructions])
      } else {
        setChecklist((prev) => [
          ...prev,
          ...result.checklist.map((q) => ({ _key: newKey(), ...q })),
        ])
      }
      toast('Draft added — review and edit before saving', 'success')
    } catch (err) {
      toast(getApiError(err, 'Magic fill failed'), 'error')
    } finally {
      setMagicFillLoading(null)
    }
  }

  if (isEdit && loadingExisting) return <PageLoader />

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-1.5 text-sm mb-4" style={{ color: colors.text.dim }}>
        <Link to={ROUTES.activities} className="hover:underline">My Activities</Link>
        <ChevronRight size={14} />
        <span style={{ color: colors.text.primary }}>{isEdit ? 'Edit Activity' : 'Create Activity'}</span>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <Card>
          <div className="space-y-4">
            <Input label="Title *" error={errors.title?.message}
              {...register('title', { required: 'Title is required' })} />
            <div>
              <label className="form-label">About the Activity *</label>
              <textarea className="form-input resize-none min-h-[100px]"
                {...register('aboutActivity', { required: true })} />
            </div>
          </div>
        </Card>

        <Card>
          <div className="space-y-4">
            <Select label="Therapy" placeholder="Select a therapy…" options={therapies.map((t) => ({ value: t.id, label: t.name }))}
              {...register('therapyId')} />
            <MultiSelectChips
              label="Skills"
              options={skills.map((s) => ({ value: s.id, label: s.name }))}
              selected={skillIds}
              onChange={setSkillIds}
              emptyMessage="No skills set up yet — a Business Owner or Admin can add them in Organisation → Manage."
            />
            <Input label="Duration (In Weeks) *" type="number" min={1} error={errors.durationWeeks?.message}
              {...register('durationWeeks', { required: true, valueAsNumber: true, min: 1 })} />
            <div>
              <label className="form-label">Age Group *</label>
              <div className="grid grid-cols-2 sm:grid-cols-[1fr_auto_1fr] gap-3 items-end">
                <div className="grid grid-cols-2 gap-2">
                  <Input type="number" min={0} {...register('ageMinValue', { valueAsNumber: true, min: 0 })} />
                  <Select options={[{ value: 'YEAR', label: 'Year' }, { value: 'MONTH', label: 'Month' }]} {...register('ageMinUnit')} />
                </div>
                <span className="hidden sm:block text-sm text-center" style={{ color: colors.text.dim }}>to</span>
                <div className="grid grid-cols-2 gap-2 col-span-2 sm:col-span-1">
                  <Input type="number" min={0} {...register('ageMaxValue', { valueAsNumber: true, min: 0 })} />
                  <Select options={[{ value: 'YEAR', label: 'Year' }, { value: 'MONTH', label: 'Month' }]} {...register('ageMaxUnit')} />
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="space-y-4">
            <div>
              <label className="form-label">Difficulty Level</label>
              <div className="flex gap-5 mt-1">
                {(['EASY', 'MEDIUM', 'HARD'] as ActivityDifficulty[]).map((d) => (
                  <label key={d} className="inline-flex items-center gap-1.5 text-sm cursor-pointer" style={{ color: colors.text.primary }}>
                    <input type="radio" value={d} {...register('difficulty')} /> {d.charAt(0) + d.slice(1).toLowerCase()}
                  </label>
                ))}
              </div>
            </div>
            <MultiSelectChips
              label="Language"
              options={languages.map((l) => ({ value: l.id, label: l.name }))}
              selected={languageIds}
              onChange={setLanguageIds}
              emptyMessage="No languages set up yet — a Business Owner or Admin can add them in Organisation → Manage."
            />
          </div>
        </Card>

        <SectionCard
          title="Instructions"
          action={aiStatus?.enabled ? <MagicFillButton onClick={() => runMagicFill('instructions')} loading={magicFillLoading === 'instructions'} /> : undefined}
        >
          <div className="space-y-2">
            {instructions.map((text, i) => (
              <div key={i} className="flex items-center gap-2">
                <GripVertical size={14} style={{ color: colors.text.dim }} />
                <input
                  className="form-input flex-1"
                  placeholder={`Step ${i + 1}`}
                  value={text}
                  onChange={(e) => setInstructions((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))}
                />
                <button type="button" onClick={() => setInstructions((prev) => prev.filter((_, idx) => idx !== i))}
                  style={{ color: colors.text.dim }}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
          <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={() => setInstructions((prev) => [...prev, ''])}>
            <Plus size={14} /> Add Instructions
          </Button>
        </SectionCard>

        <SectionCard
          title="Checklist"
          action={aiStatus?.enabled ? <MagicFillButton onClick={() => runMagicFill('checklist')} loading={magicFillLoading === 'checklist'} /> : undefined}
        >
          <div className="space-y-4">
            {checklist.map((q, qi) => (
              <div key={q._key} className="rounded-xl p-4" style={{ border: `1px solid ${border.divider}` }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold" style={{ color: colors.accent }}>Question {qi + 1}</p>
                  <button type="button" onClick={() => setChecklist((prev) => prev.filter((v) => v._key !== q._key))} style={{ color: colors.text.dim }}>
                    <Trash2 size={16} />
                  </button>
                </div>
                <input
                  className="form-input mb-2"
                  placeholder="Type your question here…"
                  value={q.questionText}
                  onChange={(e) => setChecklist((prev) => prev.map((v) => (v._key === q._key ? { ...v, questionText: e.target.value } : v)))}
                />
                <div className="flex gap-4 mb-3 text-sm">
                  {([
                    ['SINGLE_CHOICE', 'Multiple Choice (Choose One)'],
                    ['MULTI_CHOICE', 'Multiple Choice (Choose many)'],
                    ['TEXT', 'Text'],
                  ] as [ChecklistQuestionType, string][]).map(([val, label]) => (
                    <label key={val} className="inline-flex items-center gap-1.5 cursor-pointer" style={{ color: colors.text.primary }}>
                      <input
                        type="radio"
                        checked={q.questionType === val}
                        onChange={() => setChecklist((prev) => prev.map((v) => (v._key === q._key ? { ...v, questionType: val } : v)))}
                      /> {label}
                    </label>
                  ))}
                </div>
                {q.questionType !== 'TEXT' && (
                  <div className="space-y-2">
                    {q.options.map((opt, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <span className="text-xs w-4" style={{ color: colors.text.dim }}>{oi + 1}</span>
                        <input
                          className="form-input flex-1"
                          value={opt}
                          onChange={(e) => setChecklist((prev) => prev.map((v) =>
                            v._key === q._key ? { ...v, options: v.options.map((o, idx) => (idx === oi ? e.target.value : o)) } : v))}
                        />
                        <button type="button" style={{ color: colors.text.dim }}
                          onClick={() => setChecklist((prev) => prev.map((v) =>
                            v._key === q._key ? { ...v, options: v.options.filter((_, idx) => idx !== oi) } : v))}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    <button type="button" className="text-sm font-medium" style={{ color: colors.accent }}
                      onClick={() => setChecklist((prev) => prev.map((v) => (v._key === q._key ? { ...v, options: [...v.options, ''] } : v)))}>
                      Add Option
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <Button
            type="button" variant="secondary" size="sm" className="mt-3"
            onClick={() => setChecklist((prev) => [...prev, { _key: newKey(), questionText: '', questionType: 'SINGLE_CHOICE', options: ['', '', '', ''] }])}
          >
            <Plus size={14} /> Add Question
          </Button>
        </SectionCard>

        <Card>
          <div className="space-y-4">
            <MultiSelectChips
              label="Props Required"
              options={propsList.map((p) => ({ value: p.id, label: p.name }))}
              selected={propIds}
              onChange={setPropIds}
              emptyMessage="No props set up yet — a Business Owner or Admin can add them in Organisation → Manage."
            />
            <div>
              <label className="form-label">Tips and Suggestions</label>
              <textarea className="form-input resize-none min-h-[80px]" {...register('tipsAndSuggestions')} />
            </div>
          </div>
        </Card>

        <SectionCard title="Resources: Images, Videos, and Documents">
          {!isEdit && (
            <label
              className="flex flex-col items-center justify-center gap-2 rounded-xl p-8 cursor-pointer text-center"
              style={{ border: `1px dashed ${border.divider}`, background: surface.card }}
            >
              <Upload size={22} style={{ color: colors.accent }} />
              <span className="text-sm" style={{ color: colors.text.dim }}>Drag and Drop or Click to browse</span>
              <input type="file" multiple className="hidden" onChange={(e) => {
                const files = Array.from(e.target.files ?? [])
                setStagedFiles((prev) => [...prev, ...files])
              }} />
            </label>
          )}
          {isEdit && existing && (
            <ResourcesEditor activityId={existing.id} resources={existing.resources} />
          )}
          {stagedFiles.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {stagedFiles.map((f, i) => (
                <li key={i} className="flex items-center justify-between text-sm">
                  <span style={{ color: colors.text.primary }}>{f.name}</span>
                  <button type="button" onClick={() => setStagedFiles((prev) => prev.filter((_, idx) => idx !== i))} style={{ color: colors.text.dim }}>
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4">
            <label className="form-label">Links</label>
            <div className="space-y-2">
              {links.map((url, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Link2 size={14} style={{ color: colors.text.dim }} />
                  <input
                    className="form-input flex-1"
                    placeholder="https://…"
                    value={url}
                    onChange={(e) => setLinks((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))}
                  />
                  <button type="button" onClick={() => setLinks((prev) => prev.filter((_, idx) => idx !== i))} style={{ color: colors.text.dim }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            <button type="button" className="text-sm font-medium mt-2" style={{ color: colors.accent }}
              onClick={() => setLinks((prev) => [...prev, ''])}>
              + Click to add the link
            </button>
          </div>
        </SectionCard>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <label className="inline-flex items-center gap-2 text-sm" style={{ color: colors.text.primary }}>
            <input type="checkbox" {...register('isShared')} />
            Share this activity with others outside your organisation
          </label>
          <Button type="submit" loading={isSubmitting || saveMut.isPending}>
            {isEdit ? 'Save Changes' : 'Create Activity'}
          </Button>
        </div>
      </form>

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}

function ResourcesEditor({ activityId, resources }: { activityId: string; resources: { id: string; fileName: string }[] }) {
  const { toast, toasts, dismiss } = useToast()
  const qc = useQueryClient()
  const uploadMut = useMutation({
    mutationFn: (file: File) => activitiesApi.uploadResource(activityId, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['activity', activityId] }),
    onError: (err) => toast(getApiError(err, 'Upload failed'), 'error'),
  })
  const deleteMut = useMutation({
    mutationFn: (resourceId: string) => activitiesApi.deleteResource(activityId, resourceId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['activity', activityId] }),
    onError: (err) => toast(getApiError(err, 'Failed to delete'), 'error'),
  })
  return (
    <div>
      <label
        className="flex flex-col items-center justify-center gap-2 rounded-xl p-8 cursor-pointer text-center"
        style={{ border: `1px dashed ${border.divider}`, background: surface.card }}
      >
        <Upload size={22} style={{ color: colors.accent }} />
        <span className="text-sm" style={{ color: colors.text.dim }}>Drag and Drop or Click to browse</span>
        <input type="file" multiple className="hidden" onChange={(e) => {
          Array.from(e.target.files ?? []).forEach((f) => uploadMut.mutate(f))
        }} />
      </label>
      {resources.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {resources.map((r) => (
            <li key={r.id} className="flex items-center justify-between text-sm">
              <span style={{ color: colors.text.primary }}>{r.fileName}</span>
              <button type="button" onClick={() => deleteMut.mutate(r.id)} style={{ color: colors.text.dim }}>
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
