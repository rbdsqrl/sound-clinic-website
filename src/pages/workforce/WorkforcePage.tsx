import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import AttendancePage from '../attendance/AttendancePage'
import AttendanceManagementPage from '../attendance/AttendanceManagementPage'
import MyLeavePage from '../leave/MyLeavePage'
import LeaveManagementPage from '../leave/LeaveManagementPage'
import { colors, border, styles } from '../../theme'
import type { Role } from '../../types'

type TabKey = 'my-attendance' | 'staff-attendance' | 'my-leave' | 'leave-requests'

const TABS_BY_ROLE: Partial<Record<Role, { key: TabKey; label: string }[]>> = {
  BUSINESS_OWNER: [
    { key: 'my-attendance',    label: 'My Attendance' },
    { key: 'staff-attendance', label: 'Staff Attendance' },
    { key: 'my-leave',         label: 'My Leave' },
    { key: 'leave-requests',   label: 'Leave Requests' },
  ],
  ADMIN: [
    { key: 'my-attendance',    label: 'My Attendance' },
    { key: 'staff-attendance', label: 'Staff Attendance' },
    { key: 'my-leave',         label: 'My Leave' },
    { key: 'leave-requests',   label: 'Leave Requests' },
  ],
  THERAPIST: [
    { key: 'my-attendance', label: 'My Attendance' },
    { key: 'my-leave',      label: 'My Leave' },
  ],
  DOCTOR: [
    { key: 'my-attendance', label: 'My Attendance' },
    { key: 'my-leave',      label: 'My Leave' },
  ],
  OFFICE_ADMIN: [
    { key: 'my-attendance', label: 'My Attendance' },
    { key: 'my-leave',      label: 'My Leave' },
  ],
  PATIENT: [
    { key: 'my-attendance', label: 'My Attendance' },
  ],
}

const DEFAULT_TABS = TABS_BY_ROLE.BUSINESS_OWNER!

export default function WorkforcePage() {
  const { activeRole, user } = useAuth()
  const role = (activeRole ?? user?.role ?? 'BUSINESS_OWNER') as Role
  const tabs = TABS_BY_ROLE[role] ?? DEFAULT_TABS
  const [activeTab, setActiveTab] = useState<TabKey>(tabs[0].key)

  const currentTab = tabs.find(t => t.key === activeTab) ?? tabs[0]

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-5">
      <div>
        <h1 className="text-lg md:text-xl font-bold" style={{ color: colors.text.heading }}>Workforce</h1>
        <p className="text-sm mt-0.5" style={{ color: colors.text.muted }}>Attendance and leave management</p>
      </div>

      <div className="flex gap-2 border-b overflow-x-auto" style={{ borderColor: border.divider }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className="px-4 py-2.5 text-sm font-medium -mb-px transition-colors whitespace-nowrap flex-shrink-0"
            style={currentTab.key === t.key ? styles.tabActive : styles.tabInactive}
          >
            {t.label}
          </button>
        ))}
      </div>

      {currentTab.key === 'my-attendance'    && <AttendancePage asTab />}
      {currentTab.key === 'staff-attendance' && <AttendanceManagementPage asTab />}
      {currentTab.key === 'my-leave'         && <MyLeavePage asTab />}
      {currentTab.key === 'leave-requests'   && <LeaveManagementPage asTab />}
    </div>
  )
}
