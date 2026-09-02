import client from './client'
import type { ApiResponse, DayOfWeek, OrganisationResponse, UpdateOrganisationRequest } from '../types'

export const organisationApi = {
  get: () =>
    client.get<ApiResponse<OrganisationResponse>>('/organisation').then((r) => r.data.data),

  update: (data: UpdateOrganisationRequest) =>
    client.patch<ApiResponse<OrganisationResponse>>('/organisation', data).then((r) => r.data.data),

  /** Narrower than `get` — callable by Clinic Head / Office Admin too, who can schedule
   *  sessions but can't read the full org profile. Used to default a new plan's Session
   *  Days away from days that would never generate a session anyway. */
  getWeeklyOffDays: () =>
    client.get<ApiResponse<DayOfWeek[]>>('/organisation/weekly-off-days').then((r) => r.data.data),
}
