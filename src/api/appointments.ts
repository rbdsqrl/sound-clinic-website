import client from './client'
import type {
  CreateSlotRequest,
  SlotResponse,
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
