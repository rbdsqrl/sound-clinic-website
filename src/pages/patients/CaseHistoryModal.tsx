import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { caseHistoryApi } from '../../api/caseHistory'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { RadioGroup } from '../../components/ui/RadioGroup'
import { MultiSelectChips } from '../../components/ui/MultiSelectChips'
import { useToast } from '../../hooks/useToast'
import { getApiError } from '../../lib/apiError'
import { colors, border, surface } from '../../theme'
import type { CaseHistoryResponse, UpdateCaseHistoryRequest, MilestoneSkill } from '../../types'

// ── Fixed option lists ───────────────────────────────────────────────────────

const chip = (labels: string[]) => labels.map(l => ({ value: l, label: l }))

const HABITS_OPTIONS = chip([
  'Stubborn', 'Hyperactive', 'Inactive', 'Aggressive/Hitting', 'Food Fads', 'Stealing/Lying',
  'Anxiety/Fear', 'Night Terror', 'Nail Biting', 'Stammering', 'Bed Wetting', 'Teeth Grinding',
])
const PRENATAL_HEALTH_OPTIONS = chip([
  'Hypertension', 'Miscarriages', 'Diabetes', 'Viral Infections', 'Convulsions', 'Endocrinal Disorders',
  'Any Medication', 'Rh Incompatibility', 'Hyperthyroidism', 'Physical And Emotional Trauma',
  'History Of Miscarriage', 'Emotional Instability',
])
const POSTNATAL_HEALTH_OPTIONS = chip([
  'Viral Infections', 'Respiratory Infections', 'Neurological Problems', 'Head Injury', 'Allergic Conditions',
  'Convulsions', 'Visual Problems', 'Hearing Loss', 'Hypoxia', 'RH-Incompatibility', 'Congenital Deformities', 'Jaundice',
])
const COMMUNICATIONS_OPTIONS = chip([
  'Non Verbal', 'Inadequate Language To Express', 'Unclear/Misarticulated', 'Not Interested In Communication',
  'Communicates Only Needs', 'Not Able To Maintain Conversation', 'Communication Skills Below Age Level', 'Clear Communication',
])
const BEHAVIORAL_PROBLEMS_OPTIONS = chip([
  'Exhibit Behavioural Problems In School', 'Exhibit Behavioural Problems At Home',
  'Exhibit Behavioural Problems In All Public Places', 'No Behavioural Concerns',
])

const DELIVERY_TYPE_OPTIONS = [
  { value: 'FT', label: 'FT' }, { value: 'PREMATURE', label: 'Premature' },
  { value: 'NORMAL', label: 'Normal' }, { value: 'OTHER', label: 'Other' },
]
const LABOUR_TYPE_OPTIONS = [
  { value: 'NORMAL', label: 'Normal' }, { value: 'PROLONGED', label: 'Prolonged' }, { value: 'VACUUM', label: 'Vacuum' },
  { value: 'EPIDURAL', label: 'Epidural' }, { value: 'C_SECTION', label: 'C-Section' },
]
const BIRTH_CRY_OPTIONS = [
  { value: 'NORMAL', label: 'Normal' }, { value: 'DELAYED', label: 'Delayed' }, { value: 'ABSENT', label: 'Absent' },
]
const MILESTONE_STATUS_OPTIONS = [{ value: 'NORMAL', label: 'Normal' }, { value: 'DELAYED', label: 'Delayed' }]
const HANDEDNESS_OPTIONS = [
  { value: 'RIGHT_HAND', label: 'Right Hand' }, { value: 'LEFT_HAND', label: 'Left Hand' },
  { value: 'MIXED_LATERALITY', label: 'Mixed Laterality' },
]
const FAMILY_TYPE_OPTIONS = [
  { value: 'NUCLEAR', label: 'Nuclear' }, { value: 'JOINT', label: 'Joint' }, { value: 'SINGLE_PARENT', label: 'Single Parent' },
]
const EYE_CONTACT_OPTIONS = [
  { value: 'NOT_PRESENT', label: 'Not Present' }, { value: 'AVOIDS', label: 'Avoids' }, { value: 'LIMITED', label: 'Limited' },
  { value: 'FLEETING', label: 'Fleeting' }, { value: 'MAINTAINS_ONLY_IF_INTERESTED', label: 'Maintains Only if Interested' },
  { value: 'MAINTAINS', label: 'Maintains' },
]
const STUTTERING_FREQUENCY_OPTIONS = [
  { value: 'NONE', label: 'None' }, { value: 'RARELY', label: 'Rarely' },
  { value: 'OCCASIONALLY', label: 'Occasionally' }, { value: 'FREQUENTLY', label: 'Frequently' },
]
const PLAY_BEHAVIOR_OPTIONS = [
  { value: 'UNOCCUPIED', label: 'Unoccupied' }, { value: 'SOLITARY_PLAY', label: 'Solitary Play' },
  { value: 'REPETITIVE_PLAY', label: 'Repetitive Play' }, { value: 'PARALLEL_PLAY', label: 'Parallel Play' },
  { value: 'ASSOCIATED_PLAY', label: 'Associated Play' }, { value: 'COOPERATIVE_PLAY', label: 'Cooperative Play' },
  { value: 'GROUP', label: 'Group' },
]
const SOCIAL_SMILING_OPTIONS = [
  { value: 'NONE', label: 'None' }, { value: 'RARE', label: 'Rare' },
  { value: 'LIMITED', label: 'Limited' }, { value: 'APPROPRIATE', label: 'Appropriate' },
]
const SELF_REGULATION_OPTIONS = [
  { value: 'VERY_POOR', label: 'Very Poor' }, { value: 'POOR', label: 'Poor' }, { value: 'AVERAGE', label: 'Average' },
  { value: 'GOOD', label: 'Good' }, { value: 'EXCELLENT', label: 'Excellent' },
]
const FRIENDSHIP_OPTIONS = [
  { value: 'NO_FRIENDS', label: 'No Friends' }, { value: 'CASUAL_FRIENDS', label: 'Casual Friends' },
  { value: 'CLOSE_FRIENDS', label: 'Close Friends' }, { value: 'OVER_INVOLVED_WITH_FRIENDS', label: 'Over Involved with Friends' },
]
const LISTENING_OPTIONS = [
  { value: 'DISINTERESTED', label: 'Disinterested' },
  { value: 'NOT_ABLE_TO_SUSTAIN_FOCUS', label: 'Not Able to Sustain Focus to Listen and Understand' },
  { value: 'POOR_VOCABULARY', label: 'Poor Vocabulary for Comprehension' },
  { value: 'ACTIVE_LISTENING', label: 'Active Listening and Understanding' },
]

const MILESTONE_SKILL_NAMES = [
  'Head Control', 'Turn Over', 'Babbling', 'Crawling', 'Sitting', 'Standing', 'Walking',
  'Monosyllable', 'First Word', 'Combination Of Words', 'Sentences',
  'Bladder And Bowel Control', 'Feeding By Self', 'Speech', 'Dressing',
]

function emptyMilestoneSkills(): MilestoneSkill[] {
  return MILESTONE_SKILL_NAMES.map(skill => ({ skill, notPresent: false, unaware: false, ageInMonths: null, status: null }))
}

function buildInitialState(caseHistory: CaseHistoryResponse | null): UpdateCaseHistoryRequest {
  if (!caseHistory) {
    return {
      presentComplaints: '', habits: [], physicalOtherProblems: '',
      prenatalHealth: [], deliveryType: null, labourType: null, birthCry: null,
      prenatalNotes: '', birthAdditionalNotes: '',
      birthHeight: null, birthHeightUnit: 'cm', birthWeight: null, birthWeightUnit: 'kg',
      postnatalHealth: [], phototherapyDays: null, postnatalNotes: '',
      motorMilestones: null, speechMilestones: null,
      milestoneSkills: emptyMilestoneSkills(), milestonesAdditionalNotes: '', handedness: null,
      familyType: null, familyMembers: [], consanguinityHistory: null, familyImpairmentsNotes: '',
      eyeContact: null, stutteringFrequency: null, playBehavior: null, socialSmiling: null,
      behaviouralSelfRegulation: null, emotionalSelfRegulation: null, friendships: null, listening: null,
      communications: [], behavioralProblems: [], provisionalDiagnosis: '',
      currentGrade: '', school: '', syllabus: '', ageOfJoining: null,
      performanceAndProgress: '', attitudeTowardsStudies: '', schoolAdditionalNotes: '',
    }
  }
  const { id: _id, patientId: _pid, createdAt: _c, updatedAt: _u, ...rest } = caseHistory
  const bySkill = new Map(rest.milestoneSkills.map(m => [m.skill, m]))
  return {
    ...rest,
    birthHeightUnit: rest.birthHeightUnit || 'cm',
    birthWeightUnit: rest.birthWeightUnit || 'kg',
    milestoneSkills: MILESTONE_SKILL_NAMES.map(skill => bySkill.get(skill) ?? { skill, notPresent: false, unaware: false, ageInMonths: null, status: null }),
  }
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-4" style={{ border: `1px solid ${border.divider}` }}>
      <h3 className="text-sm font-bold mb-4" style={{ color: colors.accent }}>{title}</h3>
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  )
}

function TextArea({ label, value, onChange, placeholder, rows = 2 }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number
}) {
  return (
    <div>
      <label className="form-label">{label}</label>
      <textarea
        className="form-input w-full resize-none"
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  )
}

export function CaseHistoryModal({
  patientId, caseHistory, onClose,
}: {
  patientId: string
  caseHistory: CaseHistoryResponse | null
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [form, setForm] = useState<UpdateCaseHistoryRequest>(() => buildInitialState(caseHistory))

  const set = (patch: Partial<UpdateCaseHistoryRequest>) => setForm(f => ({ ...f, ...patch }))

  const updateMilestone = (index: number, patch: Partial<MilestoneSkill>) => {
    setForm(f => ({ ...f, milestoneSkills: f.milestoneSkills.map((m, i) => (i === index ? { ...m, ...patch } : m)) }))
  }

  const addFamilyMember = () => setForm(f => ({ ...f, familyMembers: [...f.familyMembers, { name: '', relation: '', age: '', notes: '' }] }))
  const updateFamilyMember = (index: number, patch: Partial<UpdateCaseHistoryRequest['familyMembers'][number]>) => {
    setForm(f => ({ ...f, familyMembers: f.familyMembers.map((m, i) => (i === index ? { ...m, ...patch } : m)) }))
  }
  const removeFamilyMember = (index: number) => {
    setForm(f => ({ ...f, familyMembers: f.familyMembers.filter((_, i) => i !== index) }))
  }

  const saveMut = useMutation({
    mutationFn: () => caseHistoryApi.update(patientId, form),
    onSuccess: (data) => {
      qc.setQueryData(['case-history', patientId], data)
      qc.invalidateQueries({ queryKey: ['case-history', patientId] })
      toast('Case history saved', 'success')
      onClose()
    },
    onError: (err) => toast(getApiError(err, 'Failed to save case history'), 'error'),
  })

  return (
    <Modal
      open
      onClose={onClose}
      title="Case History Report"
      size="full"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => saveMut.mutate()} loading={saveMut.isPending}>Save</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <SectionCard title="Basic Concerns">
          <TextArea label="Present Complaints" value={form.presentComplaints ?? ''} onChange={v => set({ presentComplaints: v })}
            placeholder="Describe the presenting concern" />
          <MultiSelectChips label="Habits" options={HABITS_OPTIONS} selected={form.habits} onChange={v => set({ habits: v })} searchable={false} />
          <TextArea label="Any Physical Or Other Problems" value={form.physicalOtherProblems ?? ''} onChange={v => set({ physicalOtherProblems: v })}
            placeholder="Headaches, skin allergies, asthma etc." />
        </SectionCard>

        <SectionCard title="Birth History">
          <MultiSelectChips label="Prenatal Health" options={PRENATAL_HEALTH_OPTIONS} selected={form.prenatalHealth} onChange={v => set({ prenatalHealth: v })} searchable={false} />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <RadioGroup label="Delivery Type" clearable options={DELIVERY_TYPE_OPTIONS} value={form.deliveryType} onChange={v => set({ deliveryType: v as UpdateCaseHistoryRequest['deliveryType'] })} />
            <RadioGroup label="Labour Type" clearable options={LABOUR_TYPE_OPTIONS} value={form.labourType} onChange={v => set({ labourType: v as UpdateCaseHistoryRequest['labourType'] })} />
            <RadioGroup label="Birth Cry" clearable options={BIRTH_CRY_OPTIONS} value={form.birthCry} onChange={v => set({ birthCry: v as UpdateCaseHistoryRequest['birthCry'] })} />
          </div>
          <TextArea label="Prenatal Notes" value={form.prenatalNotes ?? ''} onChange={v => set({ prenatalNotes: v })}
            placeholder="Prenatal issues, complications, or illnesses during pregnancy" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Birth Height</label>
              <div className="flex gap-2">
                <Input type="number" min="0" className="flex-1" value={form.birthHeight ?? ''} onChange={e => set({ birthHeight: e.target.value === '' ? null : Number(e.target.value) })} />
                <Select className="w-24" options={[{ value: 'cm', label: 'cm' }, { value: 'in', label: 'in' }]} value={form.birthHeightUnit ?? 'cm'} onChange={e => set({ birthHeightUnit: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="form-label">Birth Weight</label>
              <div className="flex gap-2">
                <Input type="number" min="0" className="flex-1" value={form.birthWeight ?? ''} onChange={e => set({ birthWeight: e.target.value === '' ? null : Number(e.target.value) })} />
                <Select className="w-24" options={[{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }]} value={form.birthWeightUnit ?? 'kg'} onChange={e => set({ birthWeightUnit: e.target.value })} />
              </div>
            </div>
          </div>
          <MultiSelectChips label="Postnatal Health" options={POSTNATAL_HEALTH_OPTIONS} selected={form.postnatalHealth} onChange={v => set({ postnatalHealth: v })} searchable={false} />
          <Input type="number" min="0" label="Phototherapy (Days)" className="max-w-[160px]"
            value={form.phototherapyDays ?? ''} onChange={e => set({ phototherapyDays: e.target.value === '' ? null : Number(e.target.value) })} />
          <TextArea label="Postnatal Notes" value={form.postnatalNotes ?? ''} onChange={v => set({ postnatalNotes: v })}
            placeholder="Illnesses or complications after birth" />
        </SectionCard>

        <SectionCard title="Milestones">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <RadioGroup label="Motor Milestones" clearable options={MILESTONE_STATUS_OPTIONS} value={form.motorMilestones} onChange={v => set({ motorMilestones: v as UpdateCaseHistoryRequest['motorMilestones'] })} />
            <RadioGroup label="Speech Milestones" clearable options={MILESTONE_STATUS_OPTIONS} value={form.speechMilestones} onChange={v => set({ speechMilestones: v as UpdateCaseHistoryRequest['speechMilestones'] })} />
          </div>
          <div>
            <label className="form-label">Skills</label>
            <div className="flex flex-col gap-2">
              {form.milestoneSkills.map((m, i) => (
                <div key={m.skill} className="rounded-xl p-3 flex flex-col sm:flex-row sm:items-center gap-3" style={{ background: surface.filterStrip }}>
                  <p className="text-sm font-medium w-full sm:w-44 flex-shrink-0" style={{ color: colors.text.primary }}>{m.skill}</p>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" className="h-4 w-4" style={{ accentColor: colors.accent }}
                        checked={m.notPresent} onChange={e => updateMilestone(i, { notPresent: e.target.checked })} />
                      <span className="text-xs" style={{ color: colors.text.muted }}>Not Present</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" className="h-4 w-4" style={{ accentColor: colors.accent }}
                        checked={m.unaware} onChange={e => updateMilestone(i, { unaware: e.target.checked })} />
                      <span className="text-xs" style={{ color: colors.text.muted }}>Unaware</span>
                    </label>
                  </div>
                  <Input type="number" min="0" placeholder="Age in months" className="w-full sm:w-36 flex-shrink-0"
                    value={m.ageInMonths ?? ''} onChange={e => updateMilestone(i, { ageInMonths: e.target.value === '' ? null : Number(e.target.value) })} />
                  <RadioGroup options={MILESTONE_STATUS_OPTIONS} value={m.status} onChange={v => updateMilestone(i, { status: v as MilestoneSkill['status'] })} />
                </div>
              ))}
            </div>
          </div>
          <TextArea label="Additional Notes" value={form.milestonesAdditionalNotes ?? ''} onChange={v => set({ milestonesAdditionalNotes: v })} />
          <RadioGroup label="Handedness" clearable options={HANDEDNESS_OPTIONS} value={form.handedness} onChange={v => set({ handedness: v as UpdateCaseHistoryRequest['handedness'] })} />
        </SectionCard>

        <SectionCard title="Family History">
          <RadioGroup label="Family Type" clearable options={FAMILY_TYPE_OPTIONS} value={form.familyType} onChange={v => set({ familyType: v as UpdateCaseHistoryRequest['familyType'] })} />
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="form-label !mb-0">Family Members</label>
              <button type="button" onClick={addFamilyMember} className="text-xs font-semibold flex items-center gap-1" style={{ color: colors.accent }}>
                <Plus size={13} /> Add Family Member
              </button>
            </div>
            {form.familyMembers.length === 0 ? (
              <p className="text-xs" style={{ color: colors.text.dim }}>No member added.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {form.familyMembers.map((m, i) => (
                  <div key={i} className="rounded-xl p-3 grid grid-cols-2 sm:grid-cols-5 gap-2 items-end" style={{ background: surface.filterStrip }}>
                    <Input label="Name" value={m.name} onChange={e => updateFamilyMember(i, { name: e.target.value })} />
                    <Input label="Relation" value={m.relation} onChange={e => updateFamilyMember(i, { relation: e.target.value })} />
                    <Input label="Age" value={m.age} onChange={e => updateFamilyMember(i, { age: e.target.value })} />
                    <Input label="Notes" className="col-span-2 sm:col-span-1" value={m.notes} onChange={e => updateFamilyMember(i, { notes: e.target.value })} />
                    <button type="button" onClick={() => removeFamilyMember(i)} className="p-2.5 rounded-lg justify-self-start" style={{ color: colors.status.danger }}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <RadioGroup label="Consanguinity History" clearable
            options={[{ value: 'YES', label: 'Yes' }, { value: 'NO', label: 'No' }]}
            value={form.consanguinityHistory === null ? null : (form.consanguinityHistory ? 'YES' : 'NO')}
            onChange={v => set({ consanguinityHistory: v === null ? null : v === 'YES' })} />
          <TextArea label="Family History Of Impairments" value={form.familyImpairmentsNotes ?? ''} onChange={v => set({ familyImpairmentsNotes: v })}
            placeholder="Physical, genetic, chronic, mental or other impairments in the family" />
        </SectionCard>

        <SectionCard title="Social & Behavior History">
          <RadioGroup label="Eye Contact" clearable options={EYE_CONTACT_OPTIONS} value={form.eyeContact} onChange={v => set({ eyeContact: v as UpdateCaseHistoryRequest['eyeContact'] })} />
          <RadioGroup label="Frequency Of Stuttering" clearable options={STUTTERING_FREQUENCY_OPTIONS} value={form.stutteringFrequency} onChange={v => set({ stutteringFrequency: v as UpdateCaseHistoryRequest['stutteringFrequency'] })} />
          <RadioGroup label="Play Behavior" clearable options={PLAY_BEHAVIOR_OPTIONS} value={form.playBehavior} onChange={v => set({ playBehavior: v as UpdateCaseHistoryRequest['playBehavior'] })} />
          <RadioGroup label="Social Smiling" clearable options={SOCIAL_SMILING_OPTIONS} value={form.socialSmiling} onChange={v => set({ socialSmiling: v as UpdateCaseHistoryRequest['socialSmiling'] })} />
          <RadioGroup label="Behavioural Self Regulation" clearable options={SELF_REGULATION_OPTIONS} value={form.behaviouralSelfRegulation} onChange={v => set({ behaviouralSelfRegulation: v as UpdateCaseHistoryRequest['behaviouralSelfRegulation'] })} />
          <RadioGroup label="Emotional Self Regulation" clearable options={SELF_REGULATION_OPTIONS} value={form.emotionalSelfRegulation} onChange={v => set({ emotionalSelfRegulation: v as UpdateCaseHistoryRequest['emotionalSelfRegulation'] })} />
          <RadioGroup label="Friendships" clearable options={FRIENDSHIP_OPTIONS} value={form.friendships} onChange={v => set({ friendships: v as UpdateCaseHistoryRequest['friendships'] })} />
          <RadioGroup label="Listening" clearable options={LISTENING_OPTIONS} value={form.listening} onChange={v => set({ listening: v as UpdateCaseHistoryRequest['listening'] })} />
          <MultiSelectChips label="Communications" options={COMMUNICATIONS_OPTIONS} selected={form.communications} onChange={v => set({ communications: v })} searchable={false} />
          <MultiSelectChips label="Behavioral Problems" options={BEHAVIORAL_PROBLEMS_OPTIONS} selected={form.behavioralProblems} onChange={v => set({ behavioralProblems: v })} searchable={false} />
          <TextArea label="Provisional Diagnosis" value={form.provisionalDiagnosis ?? ''} onChange={v => set({ provisionalDiagnosis: v })} />
        </SectionCard>

        <SectionCard title="School History">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Input label="Current Grade" value={form.currentGrade ?? ''} onChange={e => set({ currentGrade: e.target.value })} />
            <Input label="School" value={form.school ?? ''} onChange={e => set({ school: e.target.value })} />
            <Input label="Syllabus" value={form.syllabus ?? ''} onChange={e => set({ syllabus: e.target.value })} />
            <Input type="number" min="0" label="Age Of Joining (Years)" value={form.ageOfJoining ?? ''} onChange={e => set({ ageOfJoining: e.target.value === '' ? null : Number(e.target.value) })} />
          </div>
          <TextArea label="Performance And Progress" value={form.performanceAndProgress ?? ''} onChange={v => set({ performanceAndProgress: v })}
            placeholder="Academic performance details" />
          <TextArea label="Attitude Towards Studies" value={form.attitudeTowardsStudies ?? ''} onChange={v => set({ attitudeTowardsStudies: v })}
            placeholder="Child's interest and attitude towards studies" />
          <TextArea label="Additional Notes" value={form.schoolAdditionalNotes ?? ''} onChange={v => set({ schoolAdditionalNotes: v })}
            placeholder="Other observations" />
        </SectionCard>
      </div>
    </Modal>
  )
}
