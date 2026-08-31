import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import { Menu } from 'lucide-react'
import { colors, styles, surface, LOGO_SRC } from '../../theme'
import { useInquiryBadge } from '../../hooks/useInquiryBadge'
import { useCalendarBadge } from '../../hooks/useCalendarBadge'

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen]   = useState(false)
  const [collapsed,   setCollapsed]     = useState(false)

  // Badge counts — used to show a notification dot on the mobile hamburger
  const inquiryBadge  = useInquiryBadge()
  const calendarBadge = useCalendarBadge()
  const totalBadge    = inquiryBadge + calendarBadge

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: surface.app }}>

      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 lg:hidden"
          style={{ background: surface.mobileOverlay, backdropFilter: 'blur(4px)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — slides in on mobile, always visible on desktop */}
      <div className={`
        fixed inset-y-0 left-0 z-30 transition-all duration-300 ease-in-out
        lg:static lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <Sidebar
          onClose={() => setSidebarOpen(false)}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed(c => !c)}
        />
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">

        {/* Mobile top bar */}
        <header
          className="flex items-center gap-3 px-4 py-3 lg:hidden flex-shrink-0"
          style={styles.mobileHeader}
        >
          {/* Hamburger — shows notification dot when badges are pending */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="relative rounded-lg p-1.5 transition-colors"
            style={{ color: colors.textLight.muted }}
            aria-label="Open menu"
          >
            <Menu size={22} />
            {totalBadge > 0 && (
              <span
                className="absolute top-0.5 right-0.5 h-2.5 w-2.5 rounded-full border-2"
                style={{
                  background:   colors.accent,
                  borderColor:  'var(--surface-mobile-header, #fff)',
                }}
              />
            )}
          </button>

          <div className="flex items-center gap-2">
            <img src={LOGO_SRC} alt="SimpleHearing" className="h-8 w-auto brand-logo" />
            <span className="text-sm font-semibold" style={{ color: colors.textLight.primary }}>
              SimpleHearing
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="px-4 py-6 sm:px-6 sm:py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
