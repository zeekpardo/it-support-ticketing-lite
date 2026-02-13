import { request, upload } from './base'
import type {
  GlobalSoftware,
  SoftwareCategory,
  ProjectSoftware,
  ProjectSoftwareDetail,
  SoftwareBudgetSummary,
  ProjectSoftwareAdmin,
  SoftwareAccessRequest
} from './types'

// ==========================================
// Global Catalog (read-only for org users)
// ==========================================

export async function getGlobalCatalog(params: { categoryId?: string; search?: string } = {}) {
  const queryParams = new URLSearchParams()
  if (params.categoryId) queryParams.append('categoryId', params.categoryId)
  if (params.search) queryParams.append('search', params.search)

  const query = queryParams.toString()
  return request<GlobalSoftware[]>(`/software/catalog${query ? `?${query}` : ''}`)
}

export async function getGlobalCatalogCategories() {
  return request<SoftwareCategory[]>('/software/catalog/categories')
}

export async function submitNewSoftware(data: {
  name: string
  description?: string
  iconUrl?: string
  vendor?: string
  websiteUrl?: string
  categoryId?: string
}) {
  return request<GlobalSoftware>('/software/submit', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

// ==========================================
// Project Software Management
// ==========================================

export async function getProjectSoftware(projectId: string) {
  return request<ProjectSoftware[]>(`/software/projects/${projectId}/software`)
}

export async function getProjectSoftwareById(projectId: string, id: string) {
  return request<ProjectSoftwareDetail>(`/software/projects/${projectId}/software/${id}`)
}

export async function addSoftwareToProject(projectId: string, softwareId: string, notes?: string) {
  return request<ProjectSoftware>(`/software/projects/${projectId}/software/${softwareId}`, {
    method: 'POST',
    body: JSON.stringify({ notes })
  })
}

export async function updateProjectSoftware(projectId: string, id: string, data: {
  notes?: string
  renewalDate?: string | null
  billingCycle?: 'MONTHLY' | 'YEARLY' | null
  cost?: string | null
  costType?: 'PER_USER' | 'PER_ORGANIZATION' | null
  autoRenewal?: boolean
  licenseType?: 'PER_SEAT' | 'ENTERPRISE' | 'FREE' | 'OTHER' | null
  totalSeats?: number | null
  vendorContactEmail?: string | null
  vendorContactPhone?: string | null
  contractUrl?: string | null
  loginUrl?: string | null
}) {
  return request<ProjectSoftware>(`/software/projects/${projectId}/software/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

export async function getProjectSoftwareBudget(projectId: string) {
  return request<SoftwareBudgetSummary>(`/software/projects/${projectId}/software-budget`)
}

export async function removeProjectSoftware(projectId: string, id: string) {
  return request<{ message: string }>(`/software/projects/${projectId}/software/${id}`, {
    method: 'DELETE'
  })
}

// ==========================================
// Project Software Admins
// ==========================================

export async function getProjectSoftwareAdmins(projectId: string, softwareId: string) {
  return request<ProjectSoftwareAdmin[]>(
    `/software/projects/${projectId}/software/${softwareId}/admins`
  )
}

export async function addProjectSoftwareAdmin(projectId: string, softwareId: string, data: {
  memberId: string
  role?: 'OWNER' | 'ADMIN'
}) {
  return request<ProjectSoftwareAdmin>(
    `/software/projects/${projectId}/software/${softwareId}/admins`,
    {
      method: 'POST',
      body: JSON.stringify(data)
    }
  )
}

export async function updateProjectSoftwareAdmin(projectId: string, softwareId: string, adminId: string, data: {
  role: 'OWNER' | 'ADMIN'
}) {
  return request<ProjectSoftwareAdmin>(
    `/software/projects/${projectId}/software/${softwareId}/admins/${adminId}`,
    {
      method: 'PUT',
      body: JSON.stringify(data)
    }
  )
}

export async function removeProjectSoftwareAdmin(projectId: string, softwareId: string, adminId: string) {
  return request<{ message: string }>(
    `/software/projects/${projectId}/software/${softwareId}/admins/${adminId}`,
    { method: 'DELETE' }
  )
}

// ==========================================
// Project Software Access Requests
// ==========================================

export async function getProjectSoftwareRequests(projectId: string, softwareId: string, status?: string) {
  const queryParams = new URLSearchParams()
  if (status) queryParams.append('status', status)
  const query = queryParams.toString()

  return request<SoftwareAccessRequest[]>(
    `/software/projects/${projectId}/software/${softwareId}/requests${query ? `?${query}` : ''}`
  )
}

export async function getAllProjectRequests(projectId: string) {
  return request<SoftwareAccessRequest[]>(`/software/projects/${projectId}/requests`)
}

export async function getAllPendingAccessRequests(projectId?: string) {
  const queryParams = new URLSearchParams()
  if (projectId) queryParams.append('projectId', projectId)
  const query = queryParams.toString()
  return request<Array<SoftwareAccessRequest & {
    projectSoftware: {
      software: { id: string; name: string; iconUrl?: string }
      project: { id: string; name: string; projectCode: string; defaultAssigneeId?: string }
    }
  }>>(`/software/requests/pending${query ? `?${query}` : ''}`)
}

export async function assignAccessRequest(requestId: string, assigneeId: string | null) {
  return request<SoftwareAccessRequest>(`/software/requests/${requestId}/assign`, {
    method: 'PUT',
    body: JSON.stringify({ assigneeId })
  })
}

export async function reviewAccessRequest(projectId: string, softwareId: string, requestId: string, data: {
  status: 'APPROVED' | 'DECLINED' | 'REVOKED' | 'PENDING'
  reviewNotes?: string
}) {
  return request<SoftwareAccessRequest>(
    `/software/projects/${projectId}/software/${softwareId}/requests/${requestId}`,
    {
      method: 'PUT',
      body: JSON.stringify(data)
    }
  )
}

export async function deleteAccessRequest(projectId: string, softwareId: string, requestId: string) {
  return request<{ message: string }>(
    `/software/projects/${projectId}/software/${softwareId}/requests/${requestId}`,
    {
      method: 'DELETE'
    }
  )
}

// ==========================================
// Super Admin - Software Catalog
// ==========================================

export async function getSuperAdminSoftware(params: {
  limit?: number
  offset?: number
  status?: string
  categoryId?: string
  search?: string
} = {}) {
  const queryParams = new URLSearchParams()
  if (params.limit) queryParams.append('limit', params.limit.toString())
  if (params.offset) queryParams.append('offset', params.offset.toString())
  if (params.status) queryParams.append('status', params.status)
  if (params.categoryId) queryParams.append('categoryId', params.categoryId)
  if (params.search) queryParams.append('search', params.search)

  const query = queryParams.toString()
  return request<{ software: GlobalSoftware[]; total: number }>(
    `/super-admin/software${query ? `?${query}` : ''}`
  )
}

export async function getSuperAdminSoftwareById(id: string) {
  return request<GlobalSoftware>(`/super-admin/software/${id}`)
}

export async function createSuperAdminSoftware(data: {
  name: string
  description?: string
  iconUrl?: string
  vendor?: string
  websiteUrl?: string
  categoryId?: string
}) {
  return request<GlobalSoftware>('/super-admin/software', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function updateSuperAdminSoftware(id: string, data: {
  name?: string
  description?: string
  iconUrl?: string
  vendor?: string
  websiteUrl?: string
  categoryId?: string
}) {
  return request<GlobalSoftware>(`/super-admin/software/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

export async function uploadSoftwareIcon(softwareId: string, file: File) {
  const formData = new FormData()
  formData.append('icon', file)
  return upload<GlobalSoftware>(`/super-admin/software/${softwareId}/icon`, formData)
}

export async function deleteSuperAdminSoftware(id: string) {
  return request<{ message: string }>(`/super-admin/software/${id}`, {
    method: 'DELETE'
  })
}

export async function approveSoftware(id: string) {
  return request<GlobalSoftware>(`/super-admin/software/${id}/approve`, {
    method: 'PUT'
  })
}

export async function rejectSoftware(id: string) {
  return request<GlobalSoftware>(`/super-admin/software/${id}/reject`, {
    method: 'PUT'
  })
}

// ==========================================
// Super Admin - Categories
// ==========================================

export async function getSuperAdminCategories() {
  return request<SoftwareCategory[]>('/super-admin/software/categories')
}

export async function createSuperAdminCategory(data: { name: string; description?: string }) {
  return request<SoftwareCategory>('/super-admin/software/categories', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function updateSuperAdminCategory(id: string, data: { name?: string; description?: string }) {
  return request<SoftwareCategory>(`/super-admin/software/categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

export async function deleteSuperAdminCategory(id: string) {
  return request<{ message: string }>(`/super-admin/software/categories/${id}`, {
    method: 'DELETE'
  })
}
