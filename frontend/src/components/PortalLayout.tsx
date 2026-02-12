import { ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useOrganization } from '../context/OrganizationContext'
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
  HomeIcon,
  TicketIcon,
  PlusCircleIcon,
  ArrowRightStartOnRectangleIcon,
  ChevronUpIcon,
  BuildingOfficeIcon,
  UserCircleIcon,
  ComputerDesktopIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/button'
import { NotificationBell } from './notifications'

interface PortalLayoutProps {
  children: ReactNode
}

export function PortalLayout({ children }: PortalLayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout, isImpersonating, stopImpersonating } = useAuth()
  const { currentOrg, organizations, selectOrganization } = useOrganization()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const navItems = [
    { href: '/portal', label: 'Dashboard', icon: HomeIcon },
    { href: '/portal/tickets', label: 'My Tickets', icon: TicketIcon },
    { href: '/portal/tickets/new', label: 'New Ticket', icon: PlusCircleIcon },
    { href: '/portal/catalog', label: 'Catalog', icon: ComputerDesktopIcon },
  ]

  return (
    <SidebarLayout
      sidebar={
        <Sidebar>
          <SidebarHeader>
            <Dropdown>
              <DropdownButton as={SidebarItem}>
                <Avatar
                  initials={currentOrg?.name?.charAt(0) || '?'}
                  className="bg-purple-600 text-white"
                />
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
              </DropdownMenu>
            </Dropdown>
          </SidebarHeader>

          <SidebarBody>
            <SidebarSection>
              <SidebarLabel>Support Portal</SidebarLabel>
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
            </SidebarSection>

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
                <DropdownItem onClick={() => navigate('/portal/settings')}>
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
                <DropdownItem onClick={() => navigate('/portal/settings')}>
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
        {children}
      </div>
    </SidebarLayout>
  )
}
