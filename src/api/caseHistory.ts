import client from './client'
import { num } from './analytics'
import type { ApiResponse, CaseHistoryResponse, UpdateCaseHistoryRequest } from '../types'

/** Jackson NON_NULL omits null/empty fields, so they arrive as `undefined` — coerce back. */
const normalise = (c: CaseHistoryResponse): CaseHistoryResponse => ({
  ...c,
  habits: c.habits ?? [],
  physicalOtherProblems: c.physicalOtherProblems ?? null,
  prenatalHealth: c.prenatalHealth ?? [],
  prenatalNotes: c.prenatalNotes ?? null,
  birthAdditionalNotes: c.birthAdditionalNotes ?? null,
  birthHeight: num(c.birthHeight),
  birthWeight: num(c.birthWeight),
  postnatalHealth: c.postnatalHealth ?? [],
  phototherapyDays: num(c.phototherapyDays),
  postnatalNotes: c.postnatalNotes ?? null,
  // Nested list items go through the JSON-text DB column and back out through Jackson NON_NULL
  // twice, so a null ageInMonths/status inside a milestone entry arrives as `undefined`, not `null`.
  milestoneSkills: (c.milestoneSkills ?? []).map(m => ({
    ...m,
    ageInMonths: num(m.ageInMonths),
    status: m.status ?? null,
    notPresent: m.notPresent ?? false,
    unaware: m.unaware ?? false,
  })),
  milestonesAdditionalNotes: c.milestonesAdditionalNotes ?? null,
  familyMembers: (c.familyMembers ?? []).map(m => ({
    name: m.name ?? '',
    relation: m.relation ?? '',
    age: m.age ?? '',
    notes: m.notes ?? '',
  })),
  consanguinityHistory: c.consanguinityHistory ?? null,
  familyImpairmentsNotes: c.familyImpairmentsNotes ?? null,
  communications: c.communications ?? [],
  behavioralProblems: c.behavioralProblems ?? [],
  provisionalDiagnosis: c.provisionalDiagnosis ?? null,
  ageOfJoining: num(c.ageOfJoining),
  performanceAndProgress: c.performanceAndProgress ?? null,
  attitudeTowardsStudies: c.attitudeTowardsStudies ?? null,
  schoolAdditionalNotes: c.schoolAdditionalNotes ?? null,
})

export const caseHistoryApi = {
  /** Null data means the patient has no case history recorded yet. */
  get: (patientId: string) =>
    client.get<ApiResponse<CaseHistoryResponse | null>>(`/patients/${patientId}/case-history`)
      .then(r => (r.data.data ? normalise(r.data.data) : null)),

  /** Saves the whole form at once — creates the record on first save. */
  update: (patientId: string, data: UpdateCaseHistoryRequest) =>
    client.put<ApiResponse<CaseHistoryResponse>>(`/patients/${patientId}/case-history`, data)
      .then(r => normalise(r.data.data)),
}
