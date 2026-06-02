import client from './client'
import type { ApiResponse, AttendanceResponse, CheckInRequest, CheckOutRequest, EnrollFaceRequest, VerifyAttendanceRequest } from '../types'

export const attendanceApi = {
  checkIn: (data: CheckInRequest) =>
    client.post<ApiResponse<AttendanceResponse>>('/attendance/check-in', data).then(r => r.data.data),

  checkOut: (data: CheckOutRequest) =>
    client.post<ApiResponse<AttendanceResponse>>('/attendance/check-out', data).then(r => r.data.data),

  today: () =>
    client.get<ApiResponse<AttendanceResponse | null>>('/attendance/today').then(r => r.data.data),

  listMine: () =>
    client.get<ApiResponse<AttendanceResponse[]>>('/attendance/my').then(r => r.data.data),

  listAll: (from?: string, to?: string) =>
    client.get<ApiResponse<AttendanceResponse[]>>('/attendance', {
      params: { ...(from && { from }), ...(to && { to }) },
    }).then(r => r.data.data),

  enrollFace: (data: EnrollFaceRequest) =>
    client.post<ApiResponse<null>>('/attendance/enroll-face', data).then(r => r.data),

  verify: (data: VerifyAttendanceRequest) =>
    client.patch<ApiResponse<AttendanceResponse>>('/attendance/today/verify', data).then(r => r.data.data),
}
