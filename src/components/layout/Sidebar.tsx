import { useState, useRef, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Building2, Stethoscope, Users,
  LogOut, Baby, X, CalendarDays,
  Sun, Moon, Inbox, Briefcase,
  ChevronLeft, ChevronRight, ChevronUp, ListTodo, UserCog, TrendingUp, ClipboardList, Newspaper, Library,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import { useCalendarBadge } from '../../hooks/useCalendarBadge'
import { useInquiryBadge } from '../../hooks/useInquiryBadge'
import { allRoles } from '../../types'
import type { Role } from '../../types'
import { clsx } from '../../lib/clsx'
import { colors, styles, surface, border, shadow, dangerAlpha, accentAlpha, LOGO_SRC } from '../../theme'
import { ROUTES } from '../../lib/routes'
import { Avatar } from '../shared/Avatar'
import { roleLabel } from '../ui/Badge'

const NAV_BY_ROLE: Record<Role, { to: string; label: string; icon: React.ElementType }[]> = {
  BUSINESS_OWNER: [
    { to: ROUTES.dashboard,    label: 'Dashboard',    icon: LayoutDashboard },
    { to: ROUTES.feed,         label: 'Feed',         icon: Newspaper },
    { to: ROUTES.inquiries,    label: 'Inquiries',    icon: Inbox },
    { to: ROUTES.organisation, label: 'Organisation', icon: Building2 },
    { to: ROUTES.patients,     label: 'Cases',        icon: Users },
    { to: ROUTES.activities,   label: 'Activities',   icon: ClipboardList },
    { to: ROUTES.resources,    label: 'Resources',    icon: Library },
    { to: ROUTES.analytics,    label: 'Analytics',    icon: TrendingUp },
    { to: ROUTES.tasks,        label: 'Tasks',        icon: ListTodo },
    { to: ROUTES.calendar,     label: 'Calendar',     icon: CalendarDays },
    { to: ROUTES.workforce,    label: 'Workforce',    icon: Briefcase },
    { to: ROUTES.members,      label: 'Members',      icon: UserCog },
  ],
  CLINIC_HEAD: [
    { to: ROUTES.dashboard,    label: 'Dashboard',    icon: LayoutDashboard },
    { to: ROUTES.feed,         label: 'Feed',         icon: Newspaper },
    { to: ROUTES.inquiries,    label: 'Inquiries',    icon: Inbox },
    { to: ROUTES.organisation, label: 'Organisation', icon: Building2 },
    { to: ROUTES.patients,     label: 'Cases',        icon: Users },
    { to: ROUTES.activities,   label: 'Activities',   icon: ClipboardList },
    { to: ROUTES.resources,    label: 'Resources',    icon: Library },
    { to: ROUTES.analytics,    label: 'Analytics',    icon: TrendingUp },
    { to: ROUTES.tasks,        label: 'Tasks',        icon: ListTodo },
    { to: ROUTES.calendar,     label: 'Calendar',     icon: CalendarDays },
    { to: ROUTES.workforce,    label: 'Workforce',    icon: Briefcase },
    { to: ROUTES.members,      label: 'Members',      icon: UserCog },
  ],
  THERAPIST: [
    { to: ROUTES.dashboard, label: 'Dashboard', icon: LayoutDashboard },
    { to: ROUTES.feed,      label: 'Feed',      icon: Newspaper },
    { to: ROUTES.clinics,   label: 'Clinics',   icon: Stethoscope },
    { to: ROUTES.patients,  label: 'Cases',     icon: Users },
    { to: ROUTES.activities, label: 'Activities', icon: ClipboardList },
    { to: ROUTES.resources,  label: 'Resources', icon: Library },
    { to: ROUTES.tasks,     label: 'My Tasks',  icon: ListTodo },
    { to: ROUTES.calendar,  label: 'Calendar',  icon: CalendarDays },
    { to: ROUTES.workforce, label: 'Workforce', icon: Briefcase },
  ],
  OFFICE_ADMIN: [
    { to: ROUTES.dashboard,  label: 'Dashboard',  icon: LayoutDashboard },
    { to: ROUTES.feed,       label: 'Feed',       icon: Newspaper },
    { to: ROUTES.inquiries,  label: 'Inquiries',  icon: Inbox },
    { to: ROUTES.patients,   label: 'Cases',      icon: Users },
    { to: ROUTES.activities, label: 'Activities', icon: ClipboardList },
    { to: ROUTES.resources,  label: 'Resources',  icon: Library },
    { to: ROUTES.analytics,  label: 'Analytics',  icon: TrendingUp },
    { to: ROUTES.tasks,      label: 'Tasks',      icon: ListTodo },
    { to: ROUTES.calendar,   label: 'Calendar',   icon: CalendarDays },
    { to: ROUTES.workforce,  label: 'Workforce',  icon: Briefcase },
    { to: ROUTES.members,    label: 'Members',    icon: UserCog },
  ],
  PARENT: [
    { to: ROUTES.dashboard,  label: 'Dashboard',   icon: LayoutDashboard },
    { to: ROUTES.feed,       label: 'Feed',        icon: Newspaper },
    { to: ROUTES.myChildren, label: 'My Children', icon: Baby },
    { to: ROUTES.resources,  label: 'Resources',   icon: Library },
    { to: ROUTES.analytics,  label: 'Progress',    icon: TrendingUp },
    { to: ROUTES.calendar,   label: 'Calendar',    icon: CalendarDays },
  ],
  PATIENT: [
    { to: ROUTES.dashboard, label: 'Dashboard', icon: LayoutDashboard },
    { to: ROUTES.feed,      label: 'Feed',      icon: Newspaper },
    { to: ROUTES.resources, label: 'Resources', icon: Library },
    { to: ROUTES.workforce, label: 'Workforce', icon: Briefcase },
  ],
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

  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!profileMenuOpen) return
    const handle = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [profileMenuOpen])

  const handleLogout  = async () => { setProfileMenuOpen(false); await logout(); navigate(ROUTES.login) }
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
        'relative flex flex-col items-center py-5 transition-all duration-300',
        collapsed ? 'px-2' : 'px-5',
      )}>
        {/* Desktop collapse toggle + mobile close button */}
        {!collapsed && (onToggleCollapse || onClose) && (
          <div className="absolute top-4 right-4 flex items-center">
            {onToggleCollapse && (
              <button
                onClick={onToggleCollapse}
                className="hidden lg:flex rounded-lg p-1 transition-colors flex-shrink-0"
                style={{ color: colors.textLight.muted }}
                aria-label="Collapse sidebar"
              >
                <ChevronLeft size={16} />
              </button>
            )}
            {onClose && (
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
        )}

        {/* Logo — smaller when collapsed so it fits the narrow rail without the browser
            clamping its width (Tailwind's img max-width:100% reset) and squishing it */}
        <img src={LOGO_SRC} alt="Simple Hearing And Speech Care"
          className={clsx('w-auto flex-shrink-0 brand-logo', collapsed ? 'h-7' : 'h-10')} />
        {!collapsed && (
          <div className="mt-2.5 text-center">
            <div className="brand-name text-[13px]" style={{ color: colors.textLight.primary }}>
              Simple Hearing And Speech Care
            </div>
            <div className="text-[10px] tracking-widest uppercase mt-1" style={{ color: colors.brandFixed }}>
              Clinic Portal
            </div>
          </div>
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
                <span>{roleLabel(role)}</span>
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
            title={roleLabel(currentRole)}
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
                  'flex items-center rounded-xl px-3 py-2.5 text-xs font-medium transition-all duration-150',
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

      {/* ── User footer ── */}
      <div className="p-3 relative" ref={profileMenuRef} style={{ borderTop: `1px solid ${border.sidebar}` }}>
        {profileMenuOpen && (
          <div
            className={clsx(
              'absolute bottom-full mb-2 rounded-xl p-1.5 z-10',
              collapsed ? 'left-full ml-2 w-44' : 'left-3 right-3',
            )}
            style={styles.card}
          >
            <button
              onClick={() => { toggleTheme(); setProfileMenuOpen(false) }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-all duration-150"
              style={{ color: colors.textLight.label }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = accentAlpha(0.08)}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
              {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </button>
            <div className="my-1 mx-2" style={{ height: '1px', background: border.dividerLight }} />
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-all duration-150"
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
              <LogOut size={15} />
              Sign out
            </button>
          </div>
        )}

        {collapsed ? (
          /* Collapsed: avatar only, centered — click opens the menu */
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setProfileMenuOpen(o => !o)}
              className="rounded-full cursor-pointer transition-all duration-150 hover:ring-2 hover:opacity-90"
              style={{ '--tw-ring-color': accentAlpha(0.35) } as React.CSSProperties}
              title={`${user?.firstName} ${user?.lastName} · ${roleLabel(currentRole)}`}
              aria-label="Open profile menu"
            >
              <Avatar initials={`${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`} name={`${user?.firstName ?? ''} ${user?.lastName ?? ''}`} />
            </button>
          </div>
        ) : (
          /* Expanded: full user card — click the avatar opens the menu */
          <div className="rounded-xl p-3" style={{ background: surface.sidebarFooter }}>
            <div className="flex items-center gap-2.5 mb-0.5">
              <button
                type="button"
                onClick={() => setProfileMenuOpen(o => !o)}
                className="relative rounded-full cursor-pointer transition-all duration-150 hover:ring-2 hover:opacity-90 flex-shrink-0"
                style={{ '--tw-ring-color': accentAlpha(0.35) } as React.CSSProperties}
                aria-label="Open profile menu"
              >
                <Avatar initials={`${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`} name={`${user?.firstName ?? ''} ${user?.lastName ?? ''}`} size="sm" />
                <span
                  className="absolute -bottom-1 -right-1 flex items-center justify-center rounded-full h-4 w-4"
                  style={{ background: colors.accent, color: '#fff', border: `2px solid ${surface.sidebarFooter}`, boxShadow: shadow.card }}
                >
                  <ChevronUp size={10} strokeWidth={3} />
                </span>
              </button>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium" style={{ color: colors.textLight.primary }}>
                  {user?.firstName} {user?.lastName}
                </p>
                {!hasMultipleRoles && (
                  <p className="text-[11.5px] truncate" style={{ color: ROLE_COLORS[currentRole] }}>
                    {roleLabel(currentRole)}
                  </p>
                )}
              </div>
            </div>
            <p className="truncate text-xs px-0.5 mt-1" style={{ color: colors.textLight.muted }}>
              {user?.email}
            </p>
          </div>
        )}
      </div>
    </aside>
  )
}
