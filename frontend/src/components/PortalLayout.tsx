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
} from '@heroicons/react/24/outline'

interface PortalLayoutProps {
  children: ReactNode
}

export function PortalLayout({ children }: PortalLayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()
  const { currentOrg, organizations, selectOrganization } = useOrganization()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const navItems = [
    { href: '/portal', label: 'Dashboard', icon: HomeIcon },
    { href: '/portal/tickets', label: 'My Tickets', icon: TicketIcon },
    { href: '/portal/tickets/new', label: 'New Ticket', icon: PlusCircleIcon },
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
      <div className="p-6">
        {children}
      </div>
    </SidebarLayout>
  )
}
