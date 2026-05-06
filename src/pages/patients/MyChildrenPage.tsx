import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Baby, ChevronRight, Heart } from 'lucide-react'
import { patientsApi } from '../../api/patients'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageLoader } from '../../components/ui/Spinner'
import { colors, border, accentAlpha } from '../../theme'
import { format } from 'date-fns'

export default function MyChildrenPage() {
  const { data: children, isLoading } = useQuery({
    queryKey: ['my-children'],
    queryFn: patientsApi.myChildren,
  })

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: colors.text.heading }}>My Children</h1>
        <p className="mt-1 text-sm" style={{ color: colors.text.muted }}>
          Patients you are linked to as a parent or guardian.
        </p>
      </div>

      {!children?.length ? (
        <Card>
          <EmptyState
            icon={<Baby size={32} />}
            title="No children linked"
            description="Ask your clinic administrator to link your account to your child's patient record."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {children.map((child) => (
            <Link key={child.id} to={`/patients/${child.id}`}>
              <Card className="cursor-pointer transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className="flex h-11 w-11 items-center justify-center rounded-full font-semibold text-sm flex-shrink-0"
                      style={{ background: 'rgba(236,72,153,0.10)', color: '#db2777' }}
                    >
                      {child.firstName[0]}{child.lastName[0]}
                    </div>
                    <div>
                      <p className="font-semibold" style={{ color: colors.text.primary }}>
                        {child.firstName} {child.lastName}
                      </p>
                      <div className="mt-0.5 flex items-center gap-3 text-xs" style={{ color: colors.text.muted }}>
                        {child.dateOfBirth && (
                          <span>DOB: {format(new Date(child.dateOfBirth), 'MMM d, yyyy')}</span>
                        )}
                        {child.conditions.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Heart size={11} style={{ color: '#60a5fa' }} />
                            {child.conditions.length} condition{child.conditions.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      {child.conditions.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {child.conditions.map((c) => (
                            <span
                              key={c.id}
                              className="inline-flex rounded-full px-2 py-0.5 text-xs"
                              style={{ background: 'rgba(96,165,250,0.12)', color: '#2563eb' }}
                            >
                              {c.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={16} className="flex-shrink-0" style={{ color: colors.text.dim }} />
                </div>

                {child.therapists.length > 0 && (
                  <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${border.divider}` }}>
                    <p className="text-xs mb-1.5" style={{ color: colors.text.dim }}>Assigned therapists</p>
                    <div className="flex flex-wrap gap-2">
                      {child.therapists.map((t) => (
                        <span
                          key={t.id}
                          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs"
                          style={{ background: 'rgba(168,85,247,0.10)', color: '#7c3aed' }}
                        >
                          <span
                            className="h-4 w-4 rounded-full flex items-center justify-center font-medium text-[10px]"
                            style={{ background: 'rgba(168,85,247,0.20)', color: '#7c3aed' }}
                          >
                            {t.firstName[0]}
                          </span>
                          {t.firstName} {t.lastName}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
