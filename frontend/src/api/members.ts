import { request, upload } from './base'

// ==========================================
// Members
// ==========================================

export async function createUserAndAddToOrg(data: {
  name: string
  email: string
  phone?: string
  password: string
  role: 'manager' | 'member' | 'client'
  projectIds?: string[]
}) {
  return request<{
    success: boolean
    message: string
    member: {
      id: string
      role: string
      user: {
        id: string
        name: string
        email: string
      }
    }
  }>('/members/create-user', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function getStaffMembers() {
  return request<Array<{
    id: string
    role: string
    user: { id: string; name: string; email: string }
  }>>('/members/staff')
}

export async function getClients() {
  return request<Array<{
    id: string
    role: string
    user: { id: string; name: string; email: string }
    projectAssignments: Array<{
      id: string
      project: { id: string; name: string; projectCode: string; isActive: boolean }
    }>
  }>>('/members/clients')
}

export async function getClientDetail(memberId: string) {
  return request<{
    id: string
    role: string
    user: { id: string; name: string; email: string; phone?: string }
    projectAssignments: Array<{
      id: string
      project: { id: string; name: string; projectCode: string; isActive: boolean }
    }>
    tickets: Array<{
      id: string
      subject: string
      status: string
      priorityLevel: string
      requestType: string
      createdAt: string
      project: { id: string; name: string; projectCode: string }
      owner?: { id: string; user: { id: string; name: string } }
    }>
    softwareAccess: Array<{
      id: string
      status: string
      reason?: string
      reviewNotes?: string
      createdAt: string
      projectSoftware: {
        id: string
        software: { id: string; name: string; iconUrl?: string; vendor?: string }
        project: { id: string; name: string; projectCode: string }
      }
      reviewer?: { id: string; user: { id: string; name: string } }
    }>
  }>(`/members/clients/${memberId}`)
}

export async function updateClient(memberId: string, data: { name?: string; phone?: string }) {
  return request<{ id: string; name: string; email: string; phone?: string }>(
    `/members/clients/${memberId}`,
    { method: 'PATCH', body: JSON.stringify(data) }
  )
}

// ==========================================
// Project Assignments
// ==========================================

export async function getMemberProjects(memberId: string) {
  return request<Array<{
    id: string
    project: { id: string; name: string; projectCode: string; isActive: boolean }
  }>>(`/members/${memberId}/projects`)
}

export async function assignProject(memberId: string, projectId: string) {
  return request<{
    id: string
    project: { id: string; name: string; projectCode: string; isActive: boolean }
  }>(`/members/${memberId}/projects`, {
    method: 'POST',
    body: JSON.stringify({ projectId })
  })
}

export async function unassignProject(memberId: string, projectId: string) {
  return request<{ message: string }>(`/members/${memberId}/projects/${projectId}`, {
    method: 'DELETE'
  })
}

export async function updateMemberProjects(memberId: string, projectIds: string[]) {
  return request<Array<{
    id: string
    project: { id: string; name: string; projectCode: string; isActive: boolean }
  }>>(`/members/${memberId}/projects`, {
    method: 'PUT',
    body: JSON.stringify({ projectIds })
  })
}

// ==========================================
// Profile
// ==========================================

export async function getProfile() {
  return request<{
    id: string
    name: string
    email: string
    phone: string | null
  }>('/members/profile')
}

export async function updateProfile(data: { phone?: string }) {
  return request<{
    id: string
    name: string
    email: string
    phone: string | null
  }>('/members/profile', {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

export async function uploadAvatar(file: File) {
  const formData = new FormData()
  formData.append('avatar', file)
  return upload<{ id: string; name: string; email: string; phone: string | null; image: string; imageUrl: string }>('/members/profile/avatar', formData)
}

export async function removeAvatar() {
  return request<{ message: string }>('/members/profile/avatar', {
    method: 'DELETE'
  })
}

export async function getAvatarUrl() {
  return request<{ url: string | null }>('/members/profile/avatar-url')
}

// ==========================================
// Import
// ==========================================

export async function importClients(projectId: string, clients: Array<{
  firstName: string
  lastName: string
  email: string
  phone?: string
}>) {
  return request<{
    success: boolean
    summary: {
      total: number
      created: number
      existingUsersAdded: number
      alreadyMembers: number
      failed: number
      magicLinksSent: number
    }
    results: Array<{
      email: string
      status: 'created' | 'existing_added' | 'already_member' | 'error'
      message: string
    }>
  }>('/import/clients', {
    method: 'POST',
    body: JSON.stringify({ projectId, clients })
  })
}
