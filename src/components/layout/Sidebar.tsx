import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Building2, Stethoscope, Users, Mail,
  LogOut, Baby, X, CalendarDays,
  Sun, Moon, UserRound, CalendarOff, Inbox, BookOpen,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import { useCalendarBadge } from '../../hooks/useCalendarBadge'
import { allRoles } from '../../types'
import type { Role } from '../../types'
import { clsx } from '../../lib/clsx'
import { colors, styles, surface, border, shadow, dangerAlpha, LOGO_SRC } from '../../theme'

const NAV_BY_ROLE: Record<Role, { to: string; label: string; icon: React.ElementType }[]> = {
  BUSINESS_OWNER: [
    { to: '/dashboard',        label: 'Dashboard',      icon: LayoutDashboard },
    { to: '/inquiries',        label: 'Inquiries',      icon: Inbox },
    { to: '/organisation',     label: 'Organisation',   icon: Building2 },
    { to: '/clinics',          label: 'Clinics',        icon: Stethoscope },
    { to: '/therapists',       label: 'Therapists',     icon: UserRound },
    { to: '/patients',         label: 'Patients',       icon: Users },
    { to: '/programs',         label: 'Programs',       icon: BookOpen },
    { to: '/calendar',         label: 'Calendar',       icon: CalendarDays },
    { to: '/leave-management', label: 'Leave Requests', icon: CalendarOff },
    { to: '/invitations',      label: 'Add Members',    icon: Mail },
  ],
  OFFICE_ADMIN: [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/inquiries', label: 'Inquiries', icon: Inbox },
    { to: '/patients',  label: 'Patients',  icon: Users },
    { to: '/calendar',  label: 'Calendar',  icon: CalendarDays },
  ],
  THERAPIST: [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/clinics',   label: 'Clinics',   icon: Stethoscope },
    { to: '/patients',  label: 'Patients',  icon: Users },
    { to: '/calendar',  label: 'Calendar',  icon: CalendarDays },
    { to: '/my-leave',  label: 'My Leave',  icon: CalendarOff },
  ],
  DOCTOR: [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/clinics',   label: 'Clinics',   icon: Stethoscope },
    { to: '/patients',  label: 'Patients',  icon: Users },
    { to: '/calendar',  label: 'Calendar',  icon: CalendarDays },
    { to: '/my-leave',  label: 'My Leave',  icon: CalendarOff },
  ],
  PARENT: [
    { to: '/dashboard',   label: 'Dashboard',  icon: LayoutDashboard },
    { to: '/my-children', label: 'My Children', icon: Baby },
    { to: '/calendar',    label: 'Calendar',   icon: CalendarDays },
  ],
  ADMIN: [
    { to: '/dashboard',        label: 'Dashboard',      icon: LayoutDashboard },
    { to: '/inquiries',        label: 'Inquiries',      icon: Inbox },
    { to: '/organisation',     label: 'Organisation',   icon: Building2 },
    { to: '/clinics',          label: 'Clinics',        icon: Stethoscope },
    { to: '/therapists',       label: 'Therapists',     icon: UserRound },
    { to: '/patients',         label: 'Patients',       icon: Users },
    { to: '/programs',         label: 'Programs',       icon: BookOpen },
    { to: '/calendar',         label: 'Calendar',       icon: CalendarDays },
    { to: '/leave-management', label: 'Leave Requests', icon: CalendarOff },
    { to: '/invitations',      label: 'Add Members',    icon: Mail },
  ],
  PATIENT: [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  ],
}

const ROLE_LABELS: Record<Role, string> = {
  BUSINESS_OWNER: 'Business Owner',
  OFFICE_ADMIN:   'Office Admin',
  THERAPIST:      'Therapist',
  DOCTOR:         'Doctor',
  PARENT:         'Parent',
  ADMIN:          'Admin',
  PATIENT:        'Patient',
}

const ROLE_COLORS = colors.role

export default function Sidebar({ onClose }: { onClose?: () => void }) {
  const { user, activeRole, switchRole, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  const handleLogout = async () => { await logout(); navigate('/login') }
  const handleNavClick = () => onClose?.()

  const roles            = user ? allRoles(user) : []
  const currentRole      = activeRole ?? user?.role ?? 'BUSINESS_OWNER'
  const navItems         = NAV_BY_ROLE[currentRole] ?? NAV_BY_ROLE.BUSINESS_OWNER
  const hasMultipleRoles = roles.length > 1
  const calendarBadge    = useCalendarBadge()

  return (
    <aside className="flex h-screen w-64 flex-col flex-shrink-0" style={styles.sidebar}>

      {/* ── Logo ── */}
      <div className="flex items-center justify-between px-5 py-5">
        <div className="flex items-center gap-3">
          <img src={LOGO_SRC} alt="SimpleHearing" className="h-9 w-auto brand-logo" />
          <div>
            <span className="text-sm font-semibold tracking-tight" style={{ color: colors.textLight.primary }}>
              SimpleHearing
            </span>
            <div className="text-[9px] tracking-widest uppercase mt-0.5" style={{ color: colors.accent }}>
              Clinic Portal
            </div>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="rounded-lg p-1 lg:hidden transition-colors"
            style={{ color: colors.textLight.muted }}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* ── Divider ── */}
      <div className="mx-5 mb-4" style={{ height: '1px', background: border.dividerLight }} />

      {/* ── Role switcher ── */}
      {hasMultipleRoles && (
        <div className="px-3 pb-4">
          <p className="mb-2 px-2 text-[9px] font-semibold uppercase tracking-widest" style={{ color: colors.textLight.muted }}>
            Active Role
          </p>
          <div className="flex flex-col gap-1">
            {roles.map((role) => (
              <button
                key={role}
                onClick={() => { switchRole(role); navigate('/dashboard'); onClose?.() }}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium transition-all"
                style={role === currentRole ? styles.roleChipActive : { color: colors.textLight.label, border: '1px solid transparent' }}
              >
                <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: ROLE_COLORS[role] }} />
                <span>{ROLE_LABELS[role]}</span>
                {role === currentRole && (
                  <span className="ml-auto text-[9px] rounded px-1.5 py-0.5" style={styles.roleActiveBadge}>
                    active
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="mt-4 mx-2" style={{ height: '1px', background: border.dividerLight }} />
        </div>
      )}

      {/* ── Nav ── */}
      <nav className="flex-1 space-y-0.5 px-3 overflow-y-auto pb-4">
        {navItems.map(({ to, label, icon: Icon }) => {
          const showBadge = to === '/calendar' && calendarBadge > 0
          return (
            <NavLink
              key={to}
              to={to}
              onClick={handleNavClick}
              className={({ isActive }) =>
                clsx('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150',
                  isActive ? 'nav-active' : 'nav-inactive')
              }
              style={({ isActive }) => isActive ? styles.navActive : styles.navInactive}
            >
              {({ isActive }) => (
                <>
                  <Icon size={17} />
                  <span className="flex-1 tracking-wide">{label}</span>

                  {/* Badge: today's event count — hidden when route is active */}
                  {showBadge && !isActive && (
                    <span
                      className="text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1 flex-shrink-0"
                      style={{ background: colors.accent, color: '#fff' }}>
                      {calendarBadge > 9 ? '9+' : calendarBadge}
                    </span>
                  )}

                  {isActive && (
                    <span
                      className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                      style={{ background: colors.accent, boxShadow: shadow.navDot }}
                    />
                  )}
                </>
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* ── Theme toggle ── */}
      <div className="px-3 pb-2">
        <button
          onClick={toggleTheme}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150"
          style={styles.navInactive}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = styles.navActive.background as string
            ;(e.currentTarget as HTMLElement).style.color = colors.accent
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'transparent'
            ;(e.currentTarget as HTMLElement).style.color = styles.navInactive.color as string
          }}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          <span className="tracking-wide">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
        </button>
      </div>

      {/* ── User footer ── */}
      <div className="p-3" style={{ borderTop: `1px solid ${border.sidebar}` }}>
        <div className="rounded-xl p-3" style={{ background: surface.sidebarFooter }}>
          <div className="flex items-center gap-2.5 mb-0.5">
            <div className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0" style={styles.avatar}>
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium" style={{ color: colors.textLight.primary }}>
                {user?.firstName} {user?.lastName}
              </p>
              {!hasMultipleRoles && (
                <p className="text-[10px] truncate" style={{ color: ROLE_COLORS[currentRole] }}>
                  {ROLE_LABELS[currentRole]}
                </p>
              )}
            </div>
          </div>
          <p className="truncate text-xs px-0.5 mt-1" style={{ color: colors.textLight.muted }}>{user?.email}</p>
          <button
            onClick={handleLogout}
            className="mt-3 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-all duration-150"
            style={{ color: colors.textLight.muted }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.color = colors.status.error
              ;(e.currentTarget as HTMLElement).style.background = dangerAlpha(0.06)
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.color = colors.textLight.muted
              ;(e.currentTarget as HTMLElement).style.background = 'transparent'
            }}
          >
            <LogOut size={13} />
            Sign out
          </button>
        </div>
      </div>
    </aside>
  )
}
