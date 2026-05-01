import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Baby, ChevronRight, Heart } from 'lucide-react'
import { patientsApi } from '../../api/patients'
import { Card, CardHeader } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageLoader } from '../../components/ui/Spinner'
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
        <h1 className="text-2xl font-bold text-slate-800">My Children</h1>
        <p className="mt-1 text-sm text-slate-500">
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
              <Card className="group cursor-pointer hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-pink-100 text-pink-600 font-semibold text-sm flex-shrink-0">
                      {child.firstName[0]}{child.lastName[0]}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 group-hover:text-primary-600">
                        {child.firstName} {child.lastName}
                      </p>
                      <div className="mt-0.5 flex items-center gap-3 text-xs text-slate-500">
                        {child.dateOfBirth && (
                          <span>DOB: {format(new Date(child.dateOfBirth), 'MMM d, yyyy')}</span>
                        )}
                        {child.conditions.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Heart size={11} className="text-blue-400" />
                            {child.conditions.length} condition{child.conditions.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      {child.conditions.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {child.conditions.map((c) => (
                            <span key={c.id} className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                              {c.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-400 group-hover:text-primary-600 flex-shrink-0" />
                </div>

                {child.therapists.length > 0 && (
                  <div className="mt-3 border-t border-slate-100 pt-3">
                    <p className="text-xs text-slate-400 mb-1.5">Assigned therapists</p>
                    <div className="flex flex-wrap gap-2">
                      {child.therapists.map((t) => (
                        <span key={t.id} className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-2.5 py-1 text-xs text-purple-700">
                          <span className="h-4 w-4 rounded-full bg-purple-200 flex items-center justify-center text-purple-700 font-medium text-[10px]">
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
