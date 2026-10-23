import client from './client'
import type {
  ApiResponse,
  SubscriptionResponse,
  CreateSubscriptionRequest,
  UpdatePaymentRequest,
  AddPaymentRequest,
  SubscriptionPaymentResponse,
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

  /** A plan's payments, newest first (admin roles) */
  listPayments: (id: string) =>
    client.get<ApiResponse<SubscriptionPaymentResponse[]>>(`/subscriptions/${id}/payments`).then(r => r.data.data),

  /** Register one more payment — added to what has already been paid (admin roles) */
  addPayment: (id: string, data: AddPaymentRequest) =>
    client.post<ApiResponse<SubscriptionResponse>>(`/subscriptions/${id}/payments`, data).then(r => r.data.data),

  /** Cancel a subscription (BUSINESS_OWNER / CLINIC_HEAD) */
  cancel: (id: string) =>
    client.patch<ApiResponse<SubscriptionResponse>>(`/subscriptions/${id}/cancel`).then(r => r.data.data),
}
