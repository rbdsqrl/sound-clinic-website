import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { authApi } from '../api/auth'
import { tokenStorage } from '../api/client'
import { usersApi } from '../api/users'
import type { UserResponse, Role, LoginRequest, RegisterRequest } from '../types'
import { allRoles } from '../types'

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
  additionalRoles: ['PARENT'],   // dev mock holds both so the switcher is visible
  isActive: true,
  faceEnrolled: false,
  createdAt: new Date().toISOString(),
}
const BYPASS_AUTH = false

interface AuthContextValue {
  user: UserResponse | null
  activeRole: Role | null
  isLoading: boolean
  isAuthenticated: boolean
  switchRole: (role: Role) => void
  addRole: (role: Role) => Promise<void>
  removeRole: (role: Role) => Promise<void>
  refreshUser: () => Promise<void>
  login: (data: LoginRequest) => Promise<void>
  register: (data: RegisterRequest) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** Persist active role per user so a page refresh keeps the last chosen role. */
function storedActiveRole(user: UserResponse): Role {
  const key = `activeRole_${user.id}`
  const stored = localStorage.getItem(key) as Role | null
  const roles = allRoles(user)
  return stored && roles.includes(stored) ? stored : user.role
}

function persistActiveRole(userId: string, role: Role) {
  localStorage.setItem(`activeRole_${userId}`, role)
}

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

  const [activeRole, setActiveRoleState] = useState<Role | null>(() => {
    const u = BYPASS_AUTH ? DEV_MOCK_USER : (() => {
      try {
        const s = localStorage.getItem('user')
        return s ? (JSON.parse(s) as UserResponse) : null
      } catch { return null }
    })()
    return u ? storedActiveRole(u) : null
  })

  const [isLoading, setIsLoading] = useState(
    !BYPASS_AUTH && !!tokenStorage.getAccess() && !localStorage.getItem('user')
  )

  useEffect(() => {
    const token = tokenStorage.getAccess()
    if (token && !user) {
      authApi.me()
        .then((u) => {
          setUser(u)
          localStorage.setItem('user', JSON.stringify(u))
          setActiveRoleState(storedActiveRole(u))
        })
        .catch(() => tokenStorage.clear())
        .finally(() => setIsLoading(false))
    } else {
      setIsLoading(false)
    }
  }, [])

  const switchRole = (role: Role) => {
    if (!user || !allRoles(user).includes(role)) return
    setActiveRoleState(role)
    persistActiveRole(user.id, role)
  }

  const addRole = async (role: Role) => {
    const updated = await usersApi.addRole(role)
    setUser(updated)
    localStorage.setItem('user', JSON.stringify(updated))
  }

  const removeRole = async (role: Role) => {
    const updated = await usersApi.removeRole(role)
    setUser(updated)
    localStorage.setItem('user', JSON.stringify(updated))
    if (activeRole === role) {
      setActiveRoleState(updated.role)
      persistActiveRole(updated.id, updated.role)
    }
  }

  const refreshUser = async () => {
    const updated = await authApi.me()
    setUser(updated)
    localStorage.setItem('user', JSON.stringify(updated))
  }

  const login = async (data: LoginRequest) => {
    const res = await authApi.login(data)
    tokenStorage.set(res.accessToken, res.refreshToken)
    localStorage.setItem('user', JSON.stringify(res.user))
    setUser(res.user)
    setActiveRoleState(storedActiveRole(res.user))
  }

  const register = async (data: RegisterRequest) => {
    const res = await authApi.register(data)
    tokenStorage.set(res.accessToken, res.refreshToken)
    localStorage.setItem('user', JSON.stringify(res.user))
    setUser(res.user)
    setActiveRoleState(res.user.role)
  }

  const logout = async () => {
    const refresh = tokenStorage.getRefresh()
    if (refresh) {
      try { await authApi.logout(refresh) } catch { /* best effort */ }
    }
    tokenStorage.clear()
    setUser(null)
    setActiveRoleState(null)
  }

  return (
    <AuthContext.Provider value={{
      user, activeRole, isLoading, isAuthenticated: !!user,
      switchRole, addRole, removeRole, refreshUser, login, register, logout,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
