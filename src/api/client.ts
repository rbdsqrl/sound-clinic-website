import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { Capacitor } from '@capacitor/core'

// The web build's relative '/api/v1' only resolves because it's served from the same origin
// as the API (via the dev proxy, or a reverse proxy in production). A Capacitor app has no
// such origin — its pages load from a capacitor://|https://localhost URL — so it needs an
// absolute backend URL instead. These two are stable, network-independent aliases (unlike this
// dev machine's LAN IP, which changes with the Wi-Fi network) for reaching the *same host
// machine's* backend from each platform's emulator/simulator:
//   - Android emulator: 10.0.2.2 is a fixed alias the AVD maps back to the host's localhost.
//   - iOS Simulator: shares the host's network namespace, so plain 'localhost' just works.
// Neither of these reaches a real device on Wi-Fi — for that, override with VITE_API_BASE_URL
// set to the host's current LAN IP. Once there's a real deployed backend, set VITE_API_BASE_URL
// to that at build time instead; it always takes priority over the values below.
function nativeDevApiBaseUrl(): string {
  const platform = Capacitor.getPlatform()
  if (platform === 'android') return 'http://10.0.2.2:8080/api/v1'
  if (platform === 'ios') return 'http://localhost:8080/api/v1'
  return '/api/v1'
}

const BASE_URL = import.meta.env.VITE_API_BASE_URL
  ?? (Capacitor.isNativePlatform() ? nativeDevApiBaseUrl() : '/api/v1')

export const client = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

/** Unauthenticated client for public endpoints (e.g. inquiry submission).
 *  Uses the same base URL as `client` but carries no auth interceptors. */
export const publicClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// ── Token storage ──────────────────────────────────────────────────────────────
export const tokenStorage = {
  getAccess: () => localStorage.getItem('access_token'),
  getRefresh: () => localStorage.getItem('refresh_token'),
  set: (access: string, refresh: string) => {
    localStorage.setItem('access_token', access)
    localStorage.setItem('refresh_token', refresh)
  },
  clear: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user')
  },
}

/** The active role a dual-role user has switched to in the UI (e.g. viewing "as Parent" vs
 *  "as Therapist") — persisted per-user by AuthContext as `activeRole_<userId>`. Sent on every
 *  request so the backend can scope genuinely role-dependent views (a Therapist-who-is-also-a-
 *  Parent's calendar, their session list) to whichever "hat" is currently selected, rather than
 *  everything the account is capable of. Read straight from localStorage (not React context)
 *  since this module lives outside the component tree, same as tokenStorage below. */
function activeRoleHeader(): string | null {
  try {
    const raw = localStorage.getItem('user')
    if (!raw) return null
    const userId = (JSON.parse(raw) as { id?: string }).id
    if (!userId) return null
    return localStorage.getItem(`activeRole_${userId}`)
  } catch {
    return null
  }
}

// ── Request: attach Bearer token + active role ─────────────────────────────────
client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStorage.getAccess()
  if (token) config.headers.Authorization = `Bearer ${token}`
  const activeRole = activeRoleHeader()
  if (activeRole) config.headers['X-Active-Role'] = activeRole
  return config
})

// ── Response: auto-refresh on 401 ─────────────────────────────────────────────
let isRefreshing = false
let failedQueue: Array<{ resolve: (t: string) => void; reject: (e: unknown) => void }> = []

const processQueue = (error: unknown, token: string | null) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)))
  failedQueue = []
}

const AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/refresh']

client.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
    const isAuthEndpoint = AUTH_PATHS.some((p) => original?.url?.includes(p))

    if (error.response?.status === 401 && !original._retry && !isAuthEndpoint) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`
          return client(original)
        })
      }

      original._retry = true
      isRefreshing = true

      const refreshToken = tokenStorage.getRefresh()
      if (!refreshToken) {
        tokenStorage.clear()
        window.location.href = '/login'
        return Promise.reject(error)
      }

      try {
        const res = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken })
        const { accessToken, refreshToken: newRefresh } = res.data.data
        tokenStorage.set(accessToken, newRefresh)
        processQueue(null, accessToken)
        original.headers.Authorization = `Bearer ${accessToken}`
        return client(original)
      } catch (refreshError) {
        processQueue(refreshError, null)
        tokenStorage.clear()
        window.location.href = '/login'
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

export default client
