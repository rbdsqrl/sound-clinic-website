import client from './client'
import type { ApiResponse, LeaveBalance, LeaveBalancesResponse, LeaveCategory, MyLeaveBalances } from '../types'

// Jackson omits null fields, so "no limit" arrives as a missing key — normalise it once here.
const normaliseCategory = (c: LeaveCategory): LeaveCategory => ({ ...c, annualDays: c.annualDays ?? null })
const normaliseBalance = (b: LeaveBalance): LeaveBalance => ({ ...b, allocated: b.allocated ?? null, remaining: b.remaining ?? null })

export const leavePolicyApi = {
  /** Active categories (pass all for deactivated ones too — admin roles). */
  categories: (all = false) =>
    client.get<ApiResponse<LeaveCategory[]>>('/leave-policy/categories', { params: all ? { all: true } : {} })
      .then(r => r.data.data.map(normaliseCategory)),

  createCategory: (data: { name: string; annualDays?: number }) =>
    client.post<ApiResponse<LeaveCategory>>('/leave-policy/categories', data).then(r => normaliseCategory(r.data.data)),

  updateCategory: (id: string, data: { name?: string; annualDays?: number; clearAnnualDays?: boolean; active?: boolean }) =>
    client.patch<ApiResponse<LeaveCategory>>(`/leave-policy/categories/${id}`, data).then(r => normaliseCategory(r.data.data)),

  getSettings: () =>
    client.get<ApiResponse<{ yearStartMonth: number }>>('/leave-policy/settings').then(r => r.data.data),

  updateSettings: (yearStartMonth: number) =>
    client.put<ApiResponse<{ yearStartMonth: number }>>('/leave-policy/settings', { yearStartMonth }).then(r => r.data.data),

  myBalances: (year?: number): Promise<MyLeaveBalances> =>
    client.get<ApiResponse<MyLeaveBalances>>('/leave-policy/my-balances', { params: year ? { year } : {} })
      .then(r => ({ ...r.data.data, balances: (r.data.data.balances ?? []).map(normaliseBalance) })),

  balances: (year?: number): Promise<LeaveBalancesResponse> =>
    client.get<ApiResponse<LeaveBalancesResponse>>('/leave-policy/balances', { params: year ? { year } : {} })
      .then(r => ({
        ...r.data.data,
        people: (r.data.data.people ?? []).map(p => ({ ...p, balances: (p.balances ?? []).map(normaliseBalance) })),
      })),

  /** One person's allocation for a category in a leave year; days omitted restores the category default. */
  setAllocation: (data: { userId: string; categoryId: string; year: number; days?: number }) =>
    client.put<ApiResponse<void>>('/leave-policy/allocations', data).then(() => undefined),
}
