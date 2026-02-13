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
