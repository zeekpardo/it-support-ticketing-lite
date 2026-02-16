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
        inboxAssignments: Array<{
          inbox: {
            id: string
            name: string
            inboxCode: string
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
    inboxes: number
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
  inboxAssignments: Array<{
    inbox: {
      id: string
      name: string
      inboxCode: string
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

export interface AccountInbox {
  id: string
  name: string
  inboxCode: string
  isActive: boolean
}

export async function getSuperAdminAccountInboxes(accountId: string) {
  return request<AccountInbox[]>(`/super-admin/accounts/${accountId}/inboxes`)
}

export async function updateSuperAdminMemberInboxes(accountId: string, memberId: string, inboxIds: string[]) {
  return request<SuperAdminAccountMember>(`/super-admin/accounts/${accountId}/members/${memberId}/inboxes`, {
    method: 'PUT',
    body: JSON.stringify({ inboxIds }),
  })
}

export async function removeSuperAdminAccountMember(accountId: string, memberId: string) {
  return request<{ message: string }>(`/super-admin/accounts/${accountId}/members/${memberId}`, {
    method: 'DELETE',
  })
}
