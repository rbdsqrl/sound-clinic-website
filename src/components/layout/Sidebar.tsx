import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Building2, Stethoscope, Users, Mail,
  LogOut, ChevronRight, Ear
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { clsx } from '../../lib/clsx'

const nav = [
  { to: '/dashboard',    label: 'Dashboard',     icon: LayoutDashboard },
  { to: '/organisation', label: 'Organisation',   icon: Building2 },
  { to: '/clinics',      label: 'Clinics',        icon: Stethoscope },
  { to: '/patients',     label: 'Patients',       icon: Users },
  { to: '/invitations',  label: 'Invitations',    icon: Mail },
]

export default function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <aside className="flex h-screen w-60 flex-col bg-slate-900 text-slate-300 flex-shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-500">
          <Ear size={20} className="text-white" />
        </div>
        <span className="text-base font-semibold text-white tracking-tight">SimpleHearing</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-3">
        {nav.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary-600 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={18} />
                <span className="flex-1">{label}</span>
                {isActive && <ChevronRight size={14} className="opacity-60" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-slate-800 p-3">
        <div className="rounded-xl p-3">
          <p className="truncate text-sm font-medium text-white">
            {user?.firstName} {user?.lastName}
          </p>
          <p className="truncate text-xs text-slate-500">{user?.email}</p>
          <button
            onClick={handleLogout}
            className="mt-3 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </div>
    </aside>
  )
}
