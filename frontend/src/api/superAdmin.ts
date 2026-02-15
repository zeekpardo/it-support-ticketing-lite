import { request } from './base'

// ==========================================
// Super Admin - Users
// ==========================================

export async function getSuperAdminUsers(params: { limit?: number; offset?: number; search?: string } = {}) {
  const queryParams = new URLSearchParams()
  if (params.limit) queryParams.append('limit', params.limit.toString())
  if (params.offset) queryParams.append('offset', params.offset.toString())
  if (params.search) queryParams.append('search', params.search)

  const query = queryParams.toString()
  return request<{
    users: Array<{
      id: string
      name: string
      email: string
      role?: string
      banned?: boolean
      banReason?: string
      banExpires?: string
      createdAt: string
      members: Array<{
        id: string
        role: string
        organization: {
          id: string
          name: string
          slug: string
        }
        projectAssignments: Array<{
          project: {
            id: string
            name: string
            projectCode: string
          }
        }>
      }>
    }>
    total: number
  }>(`/super-admin/users${query ? `?${query}` : ''}`)
}

// ==========================================
// Super Admin - Accounts (Organizations)
// ==========================================

export interface SuperAdminAccount {
  id: string
  name: string
  slug: string
  logo?: string | null
  appName?: string | null
  primaryColor?: string | null
  favicon?: string | null
  createdAt: string
  _count: {
    members: number
    projects: number
    tickets: number
    timeEntries: number
  }
}

export interface SuperAdminAccountMember {
  id: string
  role: string
  createdAt: string
  user: {
    id: string
    name: string
    email: string
    image?: string | null
    banned?: boolean
  }
  projectAssignments: Array<{
    project: {
      id: string
      name: string
      projectCode: string
    }
  }>
}

export async function getSuperAdminAccounts(params: { limit?: number; offset?: number; search?: string } = {}) {
  const queryParams = new URLSearchParams()
  if (params.limit) queryParams.append('limit', params.limit.toString())
  if (params.offset) queryParams.append('offset', params.offset.toString())
  if (params.search) queryParams.append('search', params.search)

  const query = queryParams.toString()
  return request<{
    accounts: SuperAdminAccount[]
    total: number
  }>(`/super-admin/accounts${query ? `?${query}` : ''}`)
}

export async function getSuperAdminAccountMembers(accountId: string) {
  return request<SuperAdminAccountMember[]>(`/super-admin/accounts/${accountId}/members`)
}

export async function updateSuperAdminAccount(id: string, data: { name: string; slug?: string; appName?: string; primaryColor?: string }) {
  return request<SuperAdminAccount>(`/super-admin/accounts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function updateSuperAdminAccountMember(accountId: string, memberId: string, data: { role: string }) {
  return request<SuperAdminAccountMember>(`/super-admin/accounts/${accountId}/members/${memberId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function deleteSuperAdminAccount(id: string) {
  return request<{ message: string }>(`/super-admin/accounts/${id}`, {
    method: 'DELETE',
  })
}

export interface AccountProject {
  id: string
  name: string
  projectCode: string
  isActive: boolean
}

export async function getSuperAdminAccountProjects(accountId: string) {
  return request<AccountProject[]>(`/super-admin/accounts/${accountId}/projects`)
}

export async function updateSuperAdminMemberProjects(accountId: string, memberId: string, projectIds: string[]) {
  return request<SuperAdminAccountMember>(`/super-admin/accounts/${accountId}/members/${memberId}/projects`, {
    method: 'PUT',
    body: JSON.stringify({ projectIds }),
  })
}

export async function removeSuperAdminAccountMember(accountId: string, memberId: string) {
  return request<{ message: string }>(`/super-admin/accounts/${accountId}/members/${memberId}`, {
    method: 'DELETE',
  })
}
