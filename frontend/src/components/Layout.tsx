import { ReactNode, Suspense } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useOrganization } from '../context/OrganizationContext'
import { useBranding } from '../context/BrandingContext'
import {
  Sidebar,
  SidebarBody,
  SidebarFooter,
  SidebarHeader,
  SidebarItem,
  SidebarLabel,
  SidebarSection,
  SidebarSpacer,
} from '@/components/ui/sidebar'
import { SidebarLayout } from '@/components/ui/sidebar-layout'
import { Navbar, NavbarItem, NavbarSection, NavbarSpacer } from '@/components/ui/navbar'
import { Avatar } from '@/components/ui/avatar'
import { Dropdown, DropdownButton, DropdownItem, DropdownLabel, DropdownMenu, DropdownDivider } from '@/components/ui/dropdown'
import {
  ClockIcon,
  FolderIcon,
  UsersIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  ArrowRightStartOnRectangleIcon,
  ArrowLeftIcon,
  ChevronUpIcon,
  BuildingOfficeIcon,
  PlusIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  UserCircleIcon,
  EnvelopeIcon,
  PaintBrushIcon,
} from '@heroicons/react/24/outline'
import { NotificationBell } from './notifications'
import { Button } from '@/components/ui/button'

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout, isSuperAdmin, isImpersonating, stopImpersonating } = useAuth()
  const { currentOrg, organizations, isAdmin, selectOrganization } = useOrganization()
  const { branding } = useBranding()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const isSettingsPage = location.pathname.startsWith('/admin') || location.pathname.startsWith('/super-admin')

  const navItems = [
    { href: '/', label: 'Dashboard', icon: ClockIcon },
    { href: '/projects', label: 'Projects', icon: FolderIcon },
    { href: '/reports', label: 'Reports', icon: ChartBarIcon },
  ]

  const settingsItems = [
    ...(isAdmin ? [
      { href: '/admin/members', label: 'Users', icon: UsersIcon },
      { href: '/admin/projects', label: 'Manage Projects', icon: Cog6ToothIcon },
      { href: '/admin/email-rules', label: 'Email Rules', icon: EnvelopeIcon },
      { href: '/admin/branding', label: 'Branding', icon: PaintBrushIcon },
    ] : []),
    ...(isSuperAdmin ? [
      { href: '/super-admin', label: 'Super Admin', icon: ShieldCheckIcon },
    ] : []),
  ]

  return (
    <SidebarLayout
      sidebar={
        <Sidebar>
          <SidebarHeader>
            <Dropdown>
              <DropdownButton as={SidebarItem}>
                {branding.logoUrl ? (
                  <img src={branding.logoUrl} alt={currentOrg?.name || ''} className="h-6 w-6 rounded object-contain" />
                ) : (
                  <Avatar
                    initials={currentOrg?.name?.charAt(0) || '?'}
                    className="bg-primary text-white"
                  />
                )}
                <SidebarLabel>{currentOrg?.name || 'Select Organization'}</SidebarLabel>
                <ChevronUpIcon className="h-4 w-4" />
              </DropdownButton>
              <DropdownMenu anchor="top start" className="min-w-64">
                <DropdownLabel>Organizations</DropdownLabel>
                {organizations.map((org) => (
                  <DropdownItem
                    key={org.id}
                    onClick={() => selectOrganization(org)}
                  >
                    <BuildingOfficeIcon className="h-4 w-4" />
                    <DropdownLabel>{org.name}</DropdownLabel>
                  </DropdownItem>
                ))}
                <DropdownDivider />
                <DropdownItem onClick={() => navigate('/onboarding')}>
                  <PlusIcon className="h-4 w-4" />
                  <DropdownLabel>Create Organization</DropdownLabel>
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </SidebarHeader>

          <SidebarBody>
            {isSettingsPage ? (
              <>
                <SidebarSection>
                  <SidebarItem
                    onClick={(e) => {
                      e.preventDefault()
                      navigate('/')
                    }}
                  >
                    <ArrowLeftIcon className="h-5 w-5" />
                    <SidebarLabel>Back</SidebarLabel>
                  </SidebarItem>
                </SidebarSection>
                <SidebarSection>
                  <SidebarLabel>Settings</SidebarLabel>
                  {settingsItems.map((item) => (
                    <SidebarItem
                      key={item.href}
                      href={item.href}
                      current={location.pathname === item.href || location.pathname.startsWith(item.href + '/')
                        || (item.href === '/admin/email-rules' && location.pathname === '/admin/email-logs')}
                      onClick={(e) => {
                        e.preventDefault()
                        navigate(item.href)
                      }}
                    >
                      <item.icon className="h-5 w-5" />
                      <SidebarLabel>{item.label}</SidebarLabel>
                    </SidebarItem>
                  ))}
                </SidebarSection>
              </>
            ) : (
              <SidebarSection>
                {navItems.map((item) => (
                  <SidebarItem
                    key={item.href}
                    href={item.href}
                    current={location.pathname === item.href}
                    onClick={(e) => {
                      e.preventDefault()
                      navigate(item.href)
                    }}
                  >
                    <item.icon className="h-5 w-5" />
                    <SidebarLabel>{item.label}</SidebarLabel>
                  </SidebarItem>
                ))}
                {(isAdmin || isSuperAdmin) && (
                  <SidebarItem
                    href="/admin/members"
                    current={false}
                    onClick={(e) => {
                      e.preventDefault()
                      navigate(isAdmin ? '/admin/members' : '/super-admin')
                    }}
                  >
                    <Cog6ToothIcon className="h-5 w-5" />
                    <SidebarLabel>Settings</SidebarLabel>
                  </SidebarItem>
                )}
              </SidebarSection>
            )}

            <SidebarSpacer />
          </SidebarBody>

          <SidebarFooter>
            <Dropdown>
              <DropdownButton as={SidebarItem}>
                <Avatar
                  initials={user?.name?.split(' ').map(n => n[0]).join('') || '?'}
                  className="bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200"
                />
                <SidebarLabel>{user?.name}</SidebarLabel>
                <ChevronUpIcon className="h-4 w-4" />
              </DropdownButton>
              <DropdownMenu anchor="top start">
                <DropdownItem onClick={() => navigate('/settings')}>
                  <UserCircleIcon className="h-4 w-4" />
                  <DropdownLabel>Settings</DropdownLabel>
                </DropdownItem>
                <DropdownDivider />
                <DropdownItem onClick={handleLogout}>
                  <ArrowRightStartOnRectangleIcon className="h-4 w-4" />
                  <DropdownLabel>Sign out</DropdownLabel>
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </SidebarFooter>
        </Sidebar>
      }
      navbar={
        <Navbar>
          <NavbarSpacer />
          <NavbarSection>
            <NotificationBell />
            <Dropdown>
              <DropdownButton as={NavbarItem}>
                <Avatar
                  initials={user?.name?.split(' ').map(n => n[0]).join('') || '?'}
                  className="bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200"
                />
              </DropdownButton>
              <DropdownMenu anchor="bottom end">
                <DropdownLabel>{user?.email}</DropdownLabel>
                <DropdownDivider />
                <DropdownItem onClick={() => navigate('/settings')}>
                  <UserCircleIcon className="h-4 w-4" />
                  <DropdownLabel>Settings</DropdownLabel>
                </DropdownItem>
                <DropdownItem onClick={handleLogout}>
                  <ArrowRightStartOnRectangleIcon className="h-4 w-4" />
                  <DropdownLabel>Sign out</DropdownLabel>
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </NavbarSection>
        </Navbar>
      }
    >
      {isImpersonating && (
        <div className="flex items-center justify-between bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950">
          <div className="flex items-center gap-2">
            <ExclamationTriangleIcon className="h-5 w-5" />
            <span>You are impersonating <strong>{user?.name}</strong> ({user?.email})</span>
          </div>
          <Button
            color="amber"
            onClick={stopImpersonating}
            className="!bg-amber-700 !text-white hover:!bg-amber-800"
          >
            Stop Impersonating
          </Button>
        </div>
      )}
      {/* Desktop header with notifications */}
      <div className="hidden lg:flex items-center justify-end px-6 pt-4 pb-2">
        <NotificationBell />
      </div>
      <div className="p-6 lg:pt-2">
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-32">
              <div className="text-zinc-500">Loading...</div>
            </div>
          }
        >
          {children}
        </Suspense>
      </div>
    </SidebarLayout>
  )
}
