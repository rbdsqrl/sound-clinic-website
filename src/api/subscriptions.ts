import client from './client'
import type {
  ApiResponse,
  SubscriptionResponse,
  CreateSubscriptionRequest,
  UpdatePaymentRequest,
} from '../types'

export const subscriptionsApi = {
  /** List subscriptions for a patient */
  listForPatient: (patientId: string) =>
    client.get<ApiResponse<SubscriptionResponse[]>>('/subscriptions', {
      params: { patientId },
    }).then(r => r.data.data),

  /** Allocate a subscription to a patient (BUSINESS_OWNER / CLINIC_HEAD) */
  create: (data: CreateSubscriptionRequest) =>
    client.post<ApiResponse<SubscriptionResponse>>('/subscriptions', data).then(r => r.data.data),

  /** Record payment and discount (CLINIC_HEAD / BUSINESS_OWNER) */
  recordPayment: (id: string, data: UpdatePaymentRequest) =>
    client.patch<ApiResponse<SubscriptionResponse>>(`/subscriptions/${id}/payment`, data).then(r => r.data.data),

  /** Cancel a subscription (BUSINESS_OWNER / CLINIC_HEAD) */
  cancel: (id: string) =>
    client.patch<ApiResponse<SubscriptionResponse>>(`/subscriptions/${id}/cancel`).then(r => r.data.data),
}
