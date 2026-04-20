import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { authApi } from '../api/auth'
import { tokenStorage } from '../api/client'
import type { UserResponse, LoginRequest, RegisterRequest } from '../types'

// ── DEV bypass mock user ───────────────────────────────────────────────────────
const DEV_MOCK_USER: UserResponse = {
  id: '00000000-0000-0000-0000-000000000001',
  orgId: '00000000-0000-0000-0000-000000000002',
  clinicId: null,
  email: 'dev@simplehearing.com',
  firstName: 'Dev',
  lastName: 'User',
  phone: null,
  dateOfBirth: null,
  gender: null,
  role: 'BUSINESS_OWNER',
  isActive: true,
  createdAt: new Date().toISOString(),
}
const BYPASS_AUTH = true

interface AuthContextValue {
  user: UserResponse | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (data: LoginRequest) => Promise<void>
  register: (data: RegisterRequest) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserResponse | null>(() => {
    if (BYPASS_AUTH) return DEV_MOCK_USER
    try {
      const stored = localStorage.getItem('user')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })
  const [isLoading, setIsLoading] = useState(!BYPASS_AUTH && !!tokenStorage.getAccess() && !localStorage.getItem('user'))

  // Hydrate user from /me on mount if we have a token but no stored user
  useEffect(() => {
    const token = tokenStorage.getAccess()
    if (token && !user) {
      authApi.me()
        .then((u) => {
          setUser(u)
          localStorage.setItem('user', JSON.stringify(u))
        })
        .catch(() => tokenStorage.clear())
        .finally(() => setIsLoading(false))
    } else {
      setIsLoading(false)
    }
  }, [])

  const login = async (data: LoginRequest) => {
    const res = await authApi.login(data)
    tokenStorage.set(res.accessToken, res.refreshToken)
    localStorage.setItem('user', JSON.stringify(res.user))
    setUser(res.user)
  }

  const register = async (data: RegisterRequest) => {
    const res = await authApi.register(data)
    tokenStorage.set(res.accessToken, res.refreshToken)
    localStorage.setItem('user', JSON.stringify(res.user))
    setUser(res.user)
  }

  const logout = async () => {
    const refresh = tokenStorage.getRefresh()
    if (refresh) {
      try { await authApi.logout(refresh) } catch { /* best effort */ }
    }
    tokenStorage.clear()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
