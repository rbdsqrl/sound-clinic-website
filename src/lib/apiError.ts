import type { AxiosError } from 'axios'

/** Extracts the human-readable error message from an API error response. */
export function getApiError(error: unknown, fallback: string): string {
  const axiosErr = error as AxiosError<{ message?: string }>
  return axiosErr?.response?.data?.message || fallback
}
