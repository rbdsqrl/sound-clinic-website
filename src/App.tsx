import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import AppLayout from './components/layout/AppLayout'
import { ROUTES } from './lib/routes'

import LandingPage from './pages/LandingPage'
import LoginPage from './pages/auth/LoginPage'
import AcceptInvitePage from './pages/auth/AcceptInvitePage'
import DashboardPage from './pages/DashboardPage'
import OrganisationPage from './pages/OrganisationPage'
import ClinicsPage from './pages/clinics/ClinicsPage'
import ClinicDetailPage from './pages/clinics/ClinicDetailPage'
import PatientsPage from './pages/patients/PatientsPage'
import PatientDetailPage from './pages/patients/PatientDetailPage'
import MyChildrenPage from './pages/patients/MyChildrenPage'
import AvailabilityPage from './pages/availability/AvailabilityPage'
import CalendarPage from './pages/calendar/CalendarPage'
import InquiriesPage from './pages/inquiries/InquiriesPage'
import TasksPage from './pages/tasks/TasksPage'
import WorkforcePage from './pages/workforce/WorkforcePage'
import MembersPage from './pages/members/MembersPage'

// ── DEV BYPASS ────────────────────────────────────────────────────────────────
// Set to true to skip authentication entirely during development.
const BYPASS_AUTH = false

function PrivateRoute({ children }: { children: JSX.Element }) {
  if (BYPASS_AUTH) return children
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return <div className="flex h-screen items-center justify-center"><Spinner /></div>
  return isAuthenticated ? children : <Navigate to={ROUTES.login} replace />
}

function PublicRoute({ children }: { children: JSX.Element }) {
  if (BYPASS_AUTH) return children
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return null
  return isAuthenticated ? <Navigate to={ROUTES.dashboard} replace /> : children
}

function Spinner() {
  return (
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
  )
}

function AppRoutes() {
  return (
    <Routes>
      {/* Landing — always public, no auth redirect */}
      <Route path={ROUTES.home} element={<LandingPage />} />

      {/* Auth */}
      <Route path={ROUTES.login}        element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path={ROUTES.acceptInvite} element={<AcceptInvitePage />} />

      {/* Protected app */}
      <Route element={<PrivateRoute><AppLayout /></PrivateRoute>}>
        <Route path={ROUTES.dashboard}    element={<DashboardPage />} />
        <Route path={ROUTES.organisation} element={<OrganisationPage />} />
        <Route path={ROUTES.clinics}      element={<ClinicsPage />} />
        <Route path="/clinics/:id"        element={<ClinicDetailPage />} />
        <Route path={ROUTES.patients}     element={<PatientsPage />} />
        <Route path="/patients/:id"       element={<PatientDetailPage />} />
        <Route path={ROUTES.myChildren}   element={<MyChildrenPage />} />
        <Route path={ROUTES.calendar}     element={<CalendarPage />} />
        <Route path={ROUTES.availability} element={<AvailabilityPage />} />
        <Route path={ROUTES.inquiries}    element={<InquiriesPage />} />
        <Route path={ROUTES.tasks}        element={<TasksPage />} />
        <Route path={ROUTES.workforce}    element={<WorkforcePage />} />
        <Route path={ROUTES.members}      element={<MembersPage />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to={ROUTES.home} replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  )
}
