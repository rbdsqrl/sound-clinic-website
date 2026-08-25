import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, ClipboardList } from 'lucide-react'
import { caseHistoryApi } from '../../api/caseHistory'
import { Card, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { colors } from '../../theme'
import { CaseHistoryModal } from './CaseHistoryModal'
import type { MilestoneSkill } from '../../types'

function formatAge(months: number | null): string {
  if (months === null || Number.isNaN(months)) return 'N/A'
  if (months >= 12) {
    const years = Math.floor(months / 12)
    const rem = months % 12
    return `${years}Y ${rem}M`
  }
  return `${months} M`
}

function PreviewColumn({ title, items, more }: { title: string; items: string[]; more?: number }) {
  return (
    <div className="min-w-0">
      <p className="text-sm font-medium mb-2" style={{ color: colors.text.primary }}>{title}</p>
      {items.length === 0 ? (
        <p className="text-xs" style={{ color: colors.text.dim }}>No data recorded</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item, i) => (
            <li key={i} className="text-xs flex items-start gap-1.5" style={{ color: colors.text.muted }}>
              <span className="mt-1 h-1 w-1 rounded-full flex-shrink-0" style={{ background: colors.text.dim }} />
              <span className="truncate">{item}</span>
            </li>
          ))}
          {!!more && more > 0 && (
            <li className="text-xs font-semibold" style={{ color: colors.accent }}>+{more} More</li>
          )}
        </ul>
      )}
    </div>
  )
}

export function CaseHistoryCard({ patientId, canEdit }: { patientId: string; canEdit: boolean }) {
  const [modalOpen, setModalOpen] = useState(false)

  const { data: caseHistory, isLoading } = useQuery({
    queryKey: ['case-history', patientId],
    queryFn: () => caseHistoryApi.get(patientId),
  })

  if (isLoading) return null

  if (!caseHistory) {
    return (
      <>
        <Card>
          <CardHeader
            title="Case History"
            subtitle="Detailed intake record"
            action={canEdit ? (
              <Button size="sm" onClick={() => setModalOpen(true)}>
                <ClipboardList size={14} /> Add
              </Button>
            ) : undefined}
          />
          <p className="text-sm" style={{ color: colors.text.dim }}>No case history recorded.</p>
        </Card>
        {modalOpen && (
          <CaseHistoryModal patientId={patientId} caseHistory={null} onClose={() => setModalOpen(false)} />
        )}
      </>
    )
  }

  const birthBullets = [
    caseHistory.deliveryType && `Delivery Type: ${caseHistory.deliveryType.replace(/_/g, ' ')}`,
    caseHistory.labourType && `Labour Type: ${caseHistory.labourType.replace(/_/g, ' ')}`,
    caseHistory.birthCry && `Birth Cry: ${caseHistory.birthCry.replace(/_/g, ' ')}`,
  ].filter(Boolean) as string[]

  const familyBullets: string[] = [
    caseHistory.familyType && caseHistory.familyType.replace(/_/g, ' '),
    ...(caseHistory.familyMembers.length
      ? caseHistory.familyMembers.map(m => m.name).filter(Boolean)
      : ['No Member Added']),
  ].filter(Boolean) as string[]

  const schoolBullets = [
    caseHistory.school && `School: ${caseHistory.school}`,
    caseHistory.currentGrade && `Grade: ${caseHistory.currentGrade}`,
    caseHistory.syllabus && `Syllabus: ${caseHistory.syllabus}`,
  ].filter(Boolean) as string[]

  const recordedMilestones = caseHistory.milestoneSkills.filter(
    (m: MilestoneSkill) => m.ageInMonths !== null || m.status
  )
  const milestoneBullets = recordedMilestones
    .slice(0, 3)
    .map((m: MilestoneSkill) => `${m.skill}: ${formatAge(m.ageInMonths)}`)

  return (
    <>
      <Card>
        <CardHeader
          title="Case History"
          subtitle="Detailed intake record"
          action={
            <Button size="sm" variant="secondary" onClick={() => setModalOpen(true)}>
              {canEdit ? 'View / Edit' : 'View'} <ArrowRight size={14} />
            </Button>
          }
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5">
          <PreviewColumn title="Habits" items={caseHistory.habits.slice(0, 3)} more={caseHistory.habits.length - 3} />
          <PreviewColumn title="Family History" items={familyBullets.slice(0, 3)} more={familyBullets.length - 3} />
          <PreviewColumn title="Birth History" items={birthBullets} />
          <PreviewColumn title="School History" items={schoolBullets} />
          <PreviewColumn
            title="Milestones"
            items={milestoneBullets}
            more={recordedMilestones.length - milestoneBullets.length}
          />
        </div>
      </Card>
      {modalOpen && (
        <CaseHistoryModal patientId={patientId} caseHistory={caseHistory} onClose={() => setModalOpen(false)} />
      )}
    </>
  )
}
