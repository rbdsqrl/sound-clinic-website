import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Target } from 'lucide-react'
import { patientsApi } from '../../api/patients'
import IEPTab from './IEPTab'
import { Card } from '../../components/ui/Card'
import { Select } from '../../components/ui/Select'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageLoader } from '../../components/ui/Spinner'
import { colors } from '../../theme'

/** Parent-facing "IEP" — a child picker plus the IEP plans/goals the clinic has assigned
 *  that child. Read-only: IEPTab itself locks all edit affordances for the PARENT role. */
export default function MyIEPPage() {
  const [patientId, setPatientId] = useState('')

  const { data: children, isLoading: childrenLoading } = useQuery({
    queryKey: ['my-children'],
    queryFn: patientsApi.myChildren,
  })

  useEffect(() => {
    if (!patientId && children?.length) setPatientId(children[0].id)
  }, [patientId, children])

  if (childrenLoading) return <PageLoader />

  if (!children || children.length === 0) {
    return (
      <div className="max-w-6xl mx-auto">
        <Card>
          <EmptyState icon={<Target size={22} />} title="No children linked"
            description="IEP plans and goals shared by your clinic will show up here once a child is linked to your account." />
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-lg md:text-xl font-bold" style={{ color: colors.text.heading }}>IEP</h1>
        <p className="text-sm mt-0.5" style={{ color: colors.text.muted }}>
          IEP plans and goals your clinic has assigned
        </p>
      </div>

      {children.length > 1 && (
        <div className="max-w-xs">
          <Select
            label="Child"
            value={patientId}
            onChange={e => setPatientId(e.target.value)}
            options={children.map(c => ({ value: c.id, label: `${c.firstName} ${c.lastName}` }))}
          />
        </div>
      )}

      {patientId && (
        <Card>
          <IEPTab patientId={patientId} readOnly />
        </Card>
      )}
    </div>
  )
}
