import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Building2, Stethoscope, Users,
  LogOut, Baby, X, CalendarDays,
  Sun, Moon, Inbox, Briefcase,
  ChevronLeft, ChevronRight, ListTodo, UserCog, TrendingUp, ClipboardList,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import { useCalendarBadge } from '../../hooks/useCalendarBadge'
import { useInquiryBadge } from '../../hooks/useInquiryBadge'
import { allRoles } from '../../types'
import type { Role } from '../../types'
import { clsx } from '../../lib/clsx'
import { colors, styles, surface, border, shadow, dangerAlpha, LOGO_SRC } from '../../theme'
import { ROUTES } from '../../lib/routes'

const NAV_BY_ROLE: Record<Role, { to: string; label: string; icon: React.ElementType }[]> = {
  BUSINESS_OWNER: [
    { to: ROUTES.dashboard,    label: 'Dashboard',    icon: LayoutDashboard },
    { to: ROUTES.inquiries,    label: 'Inquiries',    icon: Inbox },
    { to: ROUTES.organisation, label: 'Organisation', icon: Building2 },
    { to: ROUTES.patients,     label: 'Patients',     icon: Users },
    { to: ROUTES.activities,   label: 'Activities',   icon: ClipboardList },
    { to: ROUTES.analytics,    label: 'Analytics',    icon: TrendingUp },
    { to: ROUTES.tasks,        label: 'Tasks',        icon: ListTodo },
    { to: ROUTES.calendar,     label: 'Calendar',     icon: CalendarDays },
    { to: ROUTES.workforce,    label: 'Workforce',    icon: Briefcase },
    { to: ROUTES.members,      label: 'Members',      icon: UserCog },
  ],
  OFFICE_ADMIN: [
    { to: ROUTES.dashboard,  label: 'Dashboard', icon: LayoutDashboard },
    { to: ROUTES.inquiries,  label: 'Inquiries', icon: Inbox },
    { to: ROUTES.patients,   label: 'Patients',  icon: Users },
    { to: ROUTES.activities, label: 'Activities', icon: ClipboardList },
    { to: ROUTES.analytics,  label: 'Analytics', icon: TrendingUp },
    { to: ROUTES.tasks,      label: 'My Tasks',  icon: ListTodo },
    { to: ROUTES.calendar,   label: 'Calendar',  icon: CalendarDays },
    { to: ROUTES.workforce,  label: 'Workforce', icon: Briefcase },
  ],
  THERAPIST: [
    { to: ROUTES.dashboard, label: 'Dashboard', icon: LayoutDashboard },
    { to: ROUTES.clinics,   label: 'Clinics',   icon: Stethoscope },
    { to: ROUTES.patients,  label: 'Patients',  icon: Users },
    { to: ROUTES.activities, label: 'Activities', icon: ClipboardList },
    { to: ROUTES.tasks,     label: 'My Tasks',  icon: ListTodo },
    { to: ROUTES.calendar,  label: 'Calendar',  icon: CalendarDays },
    { to: ROUTES.workforce, label: 'Workforce', icon: Briefcase },
  ],
  DOCTOR: [
    { to: ROUTES.dashboard, label: 'Dashboard', icon: LayoutDashboard },
    { to: ROUTES.clinics,   label: 'Clinics',   icon: Stethoscope },
    { to: ROUTES.patients,  label: 'Patients',  icon: Users },
    { to: ROUTES.tasks,     label: 'My Tasks',  icon: ListTodo },
    { to: ROUTES.calendar,  label: 'Calendar',  icon: CalendarDays },
    { to: ROUTES.workforce, label: 'Workforce', icon: Briefcase },
  ],
  PARENT: [
    { to: ROUTES.dashboard,  label: 'Dashboard',   icon: LayoutDashboard },
    { to: ROUTES.myChildren, label: 'My Children', icon: Baby },
    { to: ROUTES.analytics,  label: 'Progress',    icon: TrendingUp },
    { to: ROUTES.calendar,   label: 'Calendar',    icon: CalendarDays },
  ],
  ADMIN: [
    { to: ROUTES.dashboard,    label: 'Dashboard',    icon: LayoutDashboard },
    { to: ROUTES.inquiries,    label: 'Inquiries',    icon: Inbox },
    { to: ROUTES.organisation, label: 'Organisation', icon: Building2 },
    { to: ROUTES.patients,     label: 'Patients',     icon: Users },
    { to: ROUTES.activities,   label: 'Activities',   icon: ClipboardList },
    { to: ROUTES.analytics,    label: 'Analytics',    icon: TrendingUp },
    { to: ROUTES.tasks,        label: 'Tasks',        icon: ListTodo },
    { to: ROUTES.calendar,     label: 'Calendar',     icon: CalendarDays },
    { to: ROUTES.workforce,    label: 'Workforce',    icon: Briefcase },
    { to: ROUTES.members,      label: 'Members',      icon: UserCog },
  ],
  PATIENT: [
    { to: ROUTES.dashboard, label: 'Dashboard', icon: LayoutDashboard },
    { to: ROUTES.workforce, label: 'Workforce', icon: Briefcase },
  ],
}

const ROLE_LABELS: Record<Role, string> = {
  BUSINESS_OWNER: 'Business Owner',
  OFFICE_ADMIN:   'Clinic Head',
  THERAPIST:      'Therapist',
  DOCTOR:         'Doctor',
  PARENT:         'Parent',
  ADMIN:          'Admin',
  PATIENT:        'Patient',
}

const ROLE_COLORS = colors.role

interface SidebarProps {
  onClose?:          () => void
  collapsed?:        boolean
  onToggleCollapse?: () => void
}

export default function Sidebar({ onClose, collapsed = false, onToggleCollapse }: SidebarProps) {
  const { user, activeRole, switchRole, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  const handleLogout  = async () => { await logout(); navigate(ROUTES.login) }
  const handleNavClick = () => onClose?.()

  const roles            = user ? allRoles(user) : []
  const currentRole      = activeRole ?? user?.role ?? 'BUSINESS_OWNER'
  const navItems         = NAV_BY_ROLE[currentRole] ?? NAV_BY_ROLE.BUSINESS_OWNER
  const hasMultipleRoles = roles.length > 1

  const calendarBadge = useCalendarBadge()
  const inquiryBadge  = useInquiryBadge()

  return (
    <aside
      className={clsx(
        'flex h-screen flex-col flex-shrink-0 transition-all duration-300',
        collapsed ? 'w-16' : 'w-64',
      )}
      style={styles.sidebar}
    >
      {/* ── Logo + collapse toggle ── */}
      <div className={clsx(
        'flex items-center py-5 transition-all duration-300',
        collapsed ? 'justify-center px-2' : 'justify-between px-5',
      )}>
        {/* Logo */}
        <div className={clsx('flex items-center', collapsed ? 'justify-center' : 'gap-3')}>
          <img src={LOGO_SRC} alt="SimpleHearing" className="h-9 w-auto flex-shrink-0 brand-logo" />
          {!collapsed && (
            <div>
              <span className="text-sm font-semibold tracking-tight" style={{ color: colors.textLight.primary }}>
                SimpleHearing
              </span>
              <div className="text-[10.35px] tracking-widest uppercase mt-0.5" style={{ color: colors.accent }}>
                Clinic Portal
              </div>
            </div>
          )}
        </div>

        {/* Desktop collapse toggle */}
        {!collapsed && onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex rounded-lg p-1 transition-colors flex-shrink-0"
            style={{ color: colors.textLight.muted }}
            aria-label="Collapse sidebar"
          >
            <ChevronLeft size={16} />
          </button>
        )}

        {/* Mobile close button */}
        {!collapsed && onClose && (
          <button
            onClick={onClose}
            className="rounded-lg p-1 lg:hidden transition-colors flex-shrink-0"
            style={{ color: colors.textLight.muted }}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Expand button (collapsed state, desktop only) */}
      {collapsed && onToggleCollapse && (
        <div className="hidden lg:flex justify-center pb-1">
          <button
            onClick={onToggleCollapse}
            className="rounded-lg p-1 transition-colors"
            style={{ color: colors.textLight.muted }}
            aria-label="Expand sidebar"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* ── Divider ── */}
      <div className="mx-3 mb-4" style={{ height: '1px', background: border.dividerLight }} />

      {/* ── Role switcher (hidden when collapsed) ── */}
      {hasMultipleRoles && !collapsed && (
        <div className="px-3 pb-4">
          <p className="mb-2 px-2 text-[10.35px] font-semibold uppercase tracking-widest" style={{ color: colors.textLight.muted }}>
            Active Role
          </p>
          <div className="flex flex-col gap-1">
            {roles.map((role) => (
              <button
                key={role}
                onClick={() => { switchRole(role); navigate(ROUTES.dashboard); onClose?.() }}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium transition-all"
                style={role === currentRole ? styles.roleChipActive : { color: colors.textLight.label, border: '1px solid transparent' }}
              >
                <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: ROLE_COLORS[role] }} />
                <span>{ROLE_LABELS[role]}</span>
                {role === currentRole && (
                  <span className="ml-auto text-[10.35px] rounded px-1.5 py-0.5" style={styles.roleActiveBadge}>
                    active
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="mt-4 mx-2" style={{ height: '1px', background: border.dividerLight }} />
        </div>
      )}

      {/* Role dot indicator when collapsed + multi-role */}
      {hasMultipleRoles && collapsed && (
        <div className="flex justify-center pb-3">
          <span
            className="h-2 w-2 rounded-full"
            title={ROLE_LABELS[currentRole]}
            style={{ background: ROLE_COLORS[currentRole] }}
          />
        </div>
      )}

      {/* ── Nav ── */}
      <nav className="flex-1 space-y-0.5 px-2 overflow-y-auto pb-4">
        {navItems.map(({ to, label, icon: Icon }) => {
          const badgeCount =
            to === ROUTES.calendar  ? calendarBadge :
            to === ROUTES.inquiries ? inquiryBadge  : 0
          const showBadge = badgeCount > 0

          return (
            <NavLink
              key={to}
              to={to}
              onClick={handleNavClick}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                clsx(
                  'flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150',
                  collapsed ? 'justify-center' : 'gap-3',
                  isActive ? 'nav-active' : 'nav-inactive',
                )
              }
              style={({ isActive }) => isActive ? styles.navActive : styles.navInactive}
            >
              {({ isActive }) => (
                <>
                  {/* Icon — with badge dot when collapsed */}
                  <span className="relative flex-shrink-0">
                    <Icon size={17} />
                    {collapsed && showBadge && !isActive && (
                      <span
                        className="absolute -top-1 -right-1 h-2 w-2 rounded-full"
                        style={{ background: colors.accent }}
                      />
                    )}
                  </span>

                  {/* Label + count badge (expanded only) */}
                  {!collapsed && (
                    <>
                      <span className="flex-1 tracking-wide">{label}</span>

                      {showBadge && !isActive && (
                        <span
                          className="text-[11.5px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1 flex-shrink-0"
                          style={{ background: colors.accent, color: '#fff' }}
                        >
                          {badgeCount > 9 ? '9+' : badgeCount}
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
                </>
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* ── Theme toggle ── */}
      <div className="px-2 pb-2">
        <button
          onClick={toggleTheme}
          title={collapsed ? (theme === 'dark' ? 'Light Mode' : 'Dark Mode') : undefined}
          className={clsx(
            'flex w-full items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150',
            collapsed ? 'justify-center' : 'gap-3',
          )}
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
          {!collapsed && (
            <span className="tracking-wide">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          )}
        </button>
      </div>

      {/* ── User footer ── */}
      <div className="p-3" style={{ borderTop: `1px solid ${border.sidebar}` }}>
        {collapsed ? (
          /* Collapsed: avatar only, centered */
          <div className="flex justify-center">
            <div
              className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 cursor-default"
              title={`${user?.firstName} ${user?.lastName} · ${ROLE_LABELS[currentRole]}`}
              style={styles.avatar}
            >
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
          </div>
        ) : (
          /* Expanded: full user card */
          <div className="rounded-xl p-3" style={{ background: surface.sidebarFooter }}>
            <div className="flex items-center gap-2.5 mb-0.5">
              <div
                className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
                style={styles.avatar}
              >
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium" style={{ color: colors.textLight.primary }}>
                  {user?.firstName} {user?.lastName}
                </p>
                {!hasMultipleRoles && (
                  <p className="text-[11.5px] truncate" style={{ color: ROLE_COLORS[currentRole] }}>
                    {ROLE_LABELS[currentRole]}
                  </p>
                )}
              </div>
            </div>
            <p className="truncate text-xs px-0.5 mt-1" style={{ color: colors.textLight.muted }}>
              {user?.email}
            </p>
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
        )}
      </div>
    </aside>
  )
}
