import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { OrganizationProvider, useOrganization } from './context/OrganizationContext'
import { TimerProvider } from './context/TimerContext'
import { NotificationProvider } from './context/NotificationContext'
import { Layout } from './components/Layout'
import { PortalLayout } from './components/PortalLayout'
import Login from './pages/Login'
import Register from './pages/Register'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import Reports from './pages/Reports'
import AdminMembers from './pages/admin/Members'
import AdminProjects from './pages/admin/Projects'
import AdminProjectNew from './pages/admin/ProjectNew'
import AdminProjectEdit from './pages/admin/ProjectEdit'
import AdminProjectDetail from './pages/admin/ProjectDetail'
import AdminClientDetail from './pages/admin/ClientDetail'
import SuperAdmin from './pages/admin/SuperAdmin'
import Settings from './pages/Settings'
// Ticket pages
import ProjectTickets from './pages/ProjectTickets'
import TicketDetail from './pages/TicketDetail'
import NewTicket from './pages/NewTicket'
// Portal pages
import PortalDashboard from './pages/portal/PortalDashboard'
import PortalTickets from './pages/portal/PortalTickets'
import PortalTicketDetail from './pages/portal/PortalTicketDetail'
import PortalNewTicket from './pages/portal/PortalNewTicket'
import PortalSettings from './pages/portal/PortalSettings'
import PortalProjectSoftware from './pages/portal/PortalProjectSoftware'
import PortalProjectSoftwareDetail from './pages/portal/PortalProjectSoftwareDetail'
import PortalCatalog from './pages/portal/PortalCatalog'
import AcceptInvitation from './pages/AcceptInvitation'
// Project Software pages
import ProjectSoftwareCatalog from './pages/admin/ProjectSoftwareCatalog'
import ProjectSoftwareDetail from './pages/admin/ProjectSoftwareDetail'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  const { loading: orgLoading, organizations, isClient } = useOrganization()

  if (isLoading || orgLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-zinc-500">Loading...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // If user has no organizations, redirect to onboarding
  if (organizations.length === 0) {
    return <Navigate to="/onboarding" replace />
  }

  // If user is a client, redirect to portal
  if (isClient) {
    return <Navigate to="/portal" replace />
  }

  return <Layout>{children}</Layout>
}

function ClientRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  const { loading: orgLoading, organizations, isClient } = useOrganization()

  if (isLoading || orgLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-zinc-500">Loading...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (organizations.length === 0) {
    return <Navigate to="/onboarding" replace />
  }

  // Only allow clients to access portal routes
  if (!isClient) {
    return <Navigate to="/" replace />
  }

  return <PortalLayout>{children}</PortalLayout>
}

function StaffRoute({ children }: { children: React.ReactNode }) {
  const { isClient } = useOrganization()

  if (isClient) {
    return <Navigate to="/portal" replace />
  }

  return <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useOrganization()

  if (!isAdmin) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  const { isSuperAdmin } = useAuth()

  if (!isSuperAdmin) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-zinc-500">Loading...</div>
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route
        path="/login"
        element={
          <AuthRoute>
            <Login />
          </AuthRoute>
        }
      />
      <Route
        path="/register"
        element={
          <AuthRoute>
            <Register />
          </AuthRoute>
        }
      />

      {/* Onboarding - requires auth but not org */}
      <Route path="/onboarding" element={<Onboarding />} />

      {/* Accept invitation - public route that handles auth internally */}
      <Route path="/accept-invitation" element={<AcceptInvitation />} />

      {/* Protected routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects"
        element={
          <ProtectedRoute>
            <Projects />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <ProtectedRoute>
            <Reports />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        }
      />

      {/* Ticket routes (staff) */}
      <Route
        path="/projects/:projectId/tickets"
        element={
          <ProtectedRoute>
            <StaffRoute>
              <ProjectTickets />
            </StaffRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects/:projectId/tickets/new"
        element={
          <ProtectedRoute>
            <StaffRoute>
              <NewTicket />
            </StaffRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects/:projectId/tickets/:ticketId"
        element={
          <ProtectedRoute>
            <StaffRoute>
              <TicketDetail />
            </StaffRoute>
          </ProtectedRoute>
        }
      />

      {/* Client Portal routes */}
      <Route
        path="/portal"
        element={
          <ClientRoute>
            <PortalDashboard />
          </ClientRoute>
        }
      />
      <Route
        path="/portal/tickets"
        element={
          <ClientRoute>
            <PortalTickets />
          </ClientRoute>
        }
      />
      <Route
        path="/portal/tickets/new"
        element={
          <ClientRoute>
            <PortalNewTicket />
          </ClientRoute>
        }
      />
      <Route
        path="/portal/tickets/:id"
        element={
          <ClientRoute>
            <PortalTicketDetail />
          </ClientRoute>
        }
      />
      <Route
        path="/portal/settings"
        element={
          <ClientRoute>
            <PortalSettings />
          </ClientRoute>
        }
      />
      <Route
        path="/portal/catalog"
        element={
          <ClientRoute>
            <PortalCatalog />
          </ClientRoute>
        }
      />
      <Route
        path="/portal/projects/:projectId/software"
        element={
          <ClientRoute>
            <PortalProjectSoftware />
          </ClientRoute>
        }
      />
      <Route
        path="/portal/projects/:projectId/software/:id"
        element={
          <ClientRoute>
            <PortalProjectSoftwareDetail />
          </ClientRoute>
        }
      />

      {/* Admin routes */}
      <Route
        path="/admin/members"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminMembers />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/projects/:projectId/software"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <ProjectSoftwareCatalog />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/projects/:projectId/software/:id"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <ProjectSoftwareDetail />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/projects"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminProjects />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/projects/new"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminProjectNew />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/projects/:id"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminProjectDetail />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/projects/:id/edit"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminProjectEdit />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/clients/:memberId"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminClientDetail />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      {/* Super Admin routes */}
      <Route
        path="/super-admin"
        element={
          <ProtectedRoute>
            <SuperAdminRoute>
              <SuperAdmin />
            </SuperAdminRoute>
          </ProtectedRoute>
        }
      />

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <OrganizationProvider>
          <TimerProvider>
            <NotificationProvider>
              <AppRoutes />
            </NotificationProvider>
          </TimerProvider>
        </OrganizationProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
