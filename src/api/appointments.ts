import client from './client'
import type {
  AppointmentResponse,
  BookAppointmentRequest,
  CreateSlotRequest,
  SlotResponse,
  UpdateAppointmentStatusRequest,
} from '../types'

const unwrap = <T>(res: { data: { data: T } }) => res.data.data

export const slotsApi = {
  list: (therapistId?: string) =>
    client.get<{ data: SlotResponse[] }>('/availability-slots', {
      params: therapistId ? { therapistId } : undefined,
    }).then(unwrap),

  create: (body: CreateSlotRequest) =>
    client.post<{ data: SlotResponse }>('/availability-slots', body).then(unwrap),

  delete: (id: string) =>
    client.delete(`/availability-slots/${id}`),
}

export const appointmentsApi = {
  list: () =>
    client.get<{ data: AppointmentResponse[] }>('/appointments').then(unwrap),

  book: (body: BookAppointmentRequest) =>
    client.post<{ data: AppointmentResponse }>('/appointments', body).then(unwrap),

  updateStatus: (id: string, body: UpdateAppointmentStatusRequest) =>
    client.patch<{ data: AppointmentResponse }>(`/appointments/${id}/status`, body).then(unwrap),
}
