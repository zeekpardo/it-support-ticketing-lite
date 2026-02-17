import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { organization } from '../lib/auth-client'
import { useAuth } from './AuthContext'
import { useTenant } from './TenantContext'
import { api } from '../api/client'

interface Organization {
  id: string
  name: string
  slug: string
  logo?: string
}

interface Membership {
  id: string
  role: 'owner' | 'manager' | 'member' | 'client'
  organizationId: string
  userId: string
}

interface OrganizationContextType {
  currentOrg: Organization | null
  organizations: Organization[]
  membership: Membership | null
  loading: boolean
  isAdmin: boolean
  isOwner: boolean
  isClient: boolean
  isStaff: boolean
  selectOrganization: (org: Organization) => Promise<void>
  createOrganization: (name: string, slug: string) => Promise<Organization>
  inviteMember: (email: string, role: string) => Promise<string>
  removeMember: (memberId: string) => Promise<void>
  updateMemberRole: (memberId: string, role: string) => Promise<void>
  refreshOrganizations: () => Promise<void>
}

const OrganizationContext = createContext<OrganizationContextType | null>(null)

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const { tenant } = useTenant()
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [membership, setMembership] = useState<Membership | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isAuthenticated) {
      loadOrganizations()
    } else {
      setOrganizations([])
      setCurrentOrg(null)
      setMembership(null)
      setLoading(false)
    }
  }, [isAuthenticated])

  // Update API client when org changes
  useEffect(() => {
    if (currentOrg) {
      api.setOrganizationId(currentOrg.id)
    }
  }, [currentOrg])

  const loadOrganizations = async () => {
    try {
      setLoading(true)
      const result = await organization.list()

      if (result.data) {
        setOrganizations(result.data as Organization[])

        // On a subdomain, auto-select the tenant's org (highest priority)
        if (tenant?.organizationId) {
          const tenantOrg = result.data.find((o: Organization) => o.id === tenant.organizationId)
          if (tenantOrg) {
            await selectOrganization(tenantOrg as Organization)
            return
          }
        }

        // Try to restore previously selected org from localStorage
        const savedOrgId = localStorage.getItem('currentOrgId')
        const savedOrg = result.data.find((o: Organization) => o.id === savedOrgId)

        if (savedOrg) {
          await selectOrganization(savedOrg as Organization)
        } else if (result.data.length > 0) {
          await selectOrganization(result.data[0] as Organization)
        }
      }
    } catch (error) {
      console.error('Failed to load organizations:', error)
    } finally {
      setLoading(false)
    }
  }

  const selectOrganization = async (org: Organization) => {
    try {
      // Set as active organization in session
      await organization.setActive({ organizationId: org.id })

      // Get membership details
      const memberResult = await organization.getActiveMember()

      setCurrentOrg(org)
      setMembership(memberResult.data as Membership)
      localStorage.setItem('currentOrgId', org.id)
    } catch (error) {
      console.error('Failed to select organization:', error)
    }
  }

  const createOrganization = async (name: string, slug: string): Promise<Organization> => {
    const result = await organization.create({ name, slug })

    if (result.error) {
      throw new Error(result.error.message || 'Failed to create organization')
    }

    if (result.data) {
      await loadOrganizations()
      await selectOrganization(result.data as Organization)
      return result.data as Organization
    }

    throw new Error('Failed to create organization')
  }

  const inviteMember = async (email: string, role: string): Promise<string> => {
    if (!currentOrg) throw new Error('No organization selected')

    const result = await organization.inviteMember({
      email,
      role,
      organizationId: currentOrg.id
    })

    if (result.error) {
      throw new Error(result.error.message || 'Failed to invite member')
    }

    return (result.data as { id: string }).id
  }

  const removeMember = async (memberId: string) => {
    if (!currentOrg) throw new Error('No organization selected')

    await organization.removeMember({
      memberIdOrEmail: memberId,
      organizationId: currentOrg.id
    })
  }

  const updateMemberRole = async (memberId: string, role: string) => {
    if (!currentOrg) throw new Error('No organization selected')

    await organization.updateMemberRole({
      memberId,
      role,
      organizationId: currentOrg.id
    })
  }

  const isAdmin = membership?.role === 'manager' || membership?.role === 'owner'
  const isOwner = membership?.role === 'owner'
  const isClient = membership?.role === 'client'
  const isStaff = membership?.role !== 'client' && membership?.role !== undefined

  return (
    <OrganizationContext.Provider
      value={{
        currentOrg,
        organizations,
        membership,
        loading,
        isAdmin,
        isOwner,
        isClient,
        isStaff,
        selectOrganization,
        createOrganization,
        inviteMember,
        removeMember,
        updateMemberRole,
        refreshOrganizations: loadOrganizations
      }}
    >
      {children}
    </OrganizationContext.Provider>
  )
}

export function useOrganization() {
  const context = useContext(OrganizationContext)
  if (!context) {
    throw new Error('useOrganization must be used within an OrganizationProvider')
  }
  return context
}
