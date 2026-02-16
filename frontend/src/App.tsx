import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { OrganizationProvider, useOrganization } from './context/OrganizationContext'
import { BrandingProvider } from './context/BrandingContext'
import { NotificationProvider } from './context/NotificationContext'
import { Layout } from './components/Layout'
import { PortalLayout } from './components/PortalLayout'
// Static imports — always needed on first load
import Login from './pages/Login'
import Register from './pages/Register'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'
import AcceptInvitation from './pages/AcceptInvitation'
import ResetPassword from './pages/ResetPassword'
import ClientSignup from './pages/ClientSignup'

// Lazy-loaded staff pages
const Inboxes = lazy(() => import('./pages/Inboxes'))
const Reports = lazy(() => import('./pages/Reports'))
const Settings = lazy(() => import('./pages/Settings'))
const InboxTickets = lazy(() => import('./pages/InboxTickets'))
const TicketDetail = lazy(() => import('./pages/TicketDetail'))
const NewTicket = lazy(() => import('./pages/NewTicket'))

// Lazy-loaded admin pages
const AdminMembers = lazy(() => import('./pages/admin/Members'))
const AdminInboxes = lazy(() => import('./pages/admin/Inboxes'))
const AdminInboxNew = lazy(() => import('./pages/admin/InboxNew'))
const AdminInboxEdit = lazy(() => import('./pages/admin/InboxEdit'))
const AdminInboxDetail = lazy(() => import('./pages/admin/InboxDetail'))
const AdminClientDetail = lazy(() => import('./pages/admin/ClientDetail'))
const SuperAdmin = lazy(() => import('./pages/admin/SuperAdmin'))
const InboxSoftwareCatalog = lazy(() => import('./pages/admin/InboxSoftwareCatalog'))
const InboxSoftwareDetail = lazy(() => import('./pages/admin/InboxSoftwareDetail'))
const InboxEmailRules = lazy(() => import('./pages/admin/InboxEmailRules'))
const InboundEmailLogs = lazy(() => import('./pages/admin/InboundEmailLogs'))
const AdminBranding = lazy(() => import('./pages/admin/Branding'))

// Lazy-loaded portal pages
const PortalDashboard = lazy(() => import('./pages/portal/PortalDashboard'))
const PortalTickets = lazy(() => import('./pages/portal/PortalTickets'))
const PortalTicketDetail = lazy(() => import('./pages/portal/PortalTicketDetail'))
const PortalNewTicket = lazy(() => import('./pages/portal/PortalNewTicket'))
const PortalSettings = lazy(() => import('./pages/portal/PortalSettings'))
const PortalInboxSoftware = lazy(() => import('./pages/portal/PortalInboxSoftware'))
const PortalInboxSoftwareDetail = lazy(() => import('./pages/portal/PortalInboxSoftwareDetail'))
const PortalCatalog = lazy(() => import('./pages/portal/PortalCatalog'))

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
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <div className="text-zinc-500">Loading...</div>
        </div>
      }
    >
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

      {/* Public routes that handle their own state */}
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/accept-invitation" element={<AcceptInvitation />} />
      <Route path="/join/:token" element={<ClientSignup />} />

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
        path="/inboxes"
        element={
          <ProtectedRoute>
            <Inboxes />
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
        path="/inboxes/:inboxId/tickets"
        element={
          <ProtectedRoute>
            <StaffRoute>
              <InboxTickets />
            </StaffRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/inboxes/:inboxId/tickets/new"
        element={
          <ProtectedRoute>
            <StaffRoute>
              <NewTicket />
            </StaffRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/inboxes/:inboxId/tickets/:ticketId"
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
        path="/portal/inboxes/:inboxId/software"
        element={
          <ClientRoute>
            <PortalInboxSoftware />
          </ClientRoute>
        }
      />
      <Route
        path="/portal/inboxes/:inboxId/software/:id"
        element={
          <ClientRoute>
            <PortalInboxSoftwareDetail />
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
        path="/admin/email-rules"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <InboxEmailRules />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/email-logs"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <InboundEmailLogs />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/inboxes/:inboxId/software"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <InboxSoftwareCatalog />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/inboxes/:inboxId/software/:id"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <InboxSoftwareDetail />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/inboxes"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminInboxes />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/inboxes/new"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminInboxNew />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/inboxes/:id"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminInboxDetail />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/inboxes/:id/edit"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminInboxEdit />
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
      <Route
        path="/admin/branding"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminBranding />
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
    </Suspense>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <OrganizationProvider>
          <BrandingProvider>
              <NotificationProvider>
                <AppRoutes />
              </NotificationProvider>
          </BrandingProvider>
        </OrganizationProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
