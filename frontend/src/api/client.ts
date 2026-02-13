const API_BASE = '/api'

interface RequestOptions extends RequestInit {
  headers?: Record<string, string>
}

// ==========================================
// Software Catalog Types
// ==========================================

export interface SoftwareCategory {
  id: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
  _count?: { software: number }
}

export interface GlobalSoftware {
  id: string
  name: string
  description?: string
  iconUrl?: string
  vendor?: string
  websiteUrl?: string
  categoryId?: string
  category?: SoftwareCategory
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  submittedById?: string
  submittedBy?: { id: string; name: string; email: string }
  createdAt: string
  updatedAt: string
  _count?: { projectSoftware: number }
}

export interface ProjectSoftware {
  id: string
  projectId: string
  softwareId: string
  software: GlobalSoftware
  notes?: string
  addedBy: {
    id: string
    user: { id: string; name: string; email: string }
  }
  createdAt: string
  updatedAt: string
  _count?: { admins: number; accessRequests: number }

  // Renewal & Billing
  renewalDate?: string | null
  billingCycle?: 'MONTHLY' | 'YEARLY' | null
  cost?: string | null
  costType?: 'PER_USER' | 'PER_ORGANIZATION' | null
  autoRenewal?: boolean

  // License Management
  licenseType?: 'PER_SEAT' | 'ENTERPRISE' | 'FREE' | 'OTHER' | null
  totalSeats?: number | null

  // Vendor & Contract Info
  vendorContactEmail?: string | null
  vendorContactPhone?: string | null
  contractUrl?: string | null
  loginUrl?: string | null
}

export interface SoftwareBudgetSummary {
  totalMonthly: number
  totalYearly: number
  softwareCount: number
  breakdown: Array<{
    id: string
    name: string
    iconUrl?: string
    cost: number
    costType: 'PER_USER' | 'PER_ORGANIZATION' | null
    billingCycle: 'MONTHLY' | 'YEARLY' | null
    users: number
    effectiveCost: number
    monthly: number
    yearly: number
    renewalDate?: string | null
    autoRenewal: boolean
  }>
}

export interface ProjectSoftwareAdmin {
  id: string
  projectSoftwareId: string
  memberId: string
  member: {
    id: string
    user: { id: string; name: string; email: string }
  }
  role: 'OWNER' | 'ADMIN'
  createdAt: string
}

export interface SoftwareAccessRequest {
  id: string
  projectSoftwareId: string
  requesterId: string
  requester: {
    id: string
    user: { id: string; name: string; email: string }
  }
  reason?: string
  status: 'PENDING' | 'APPROVED' | 'DECLINED' | 'REVOKED'
  assigneeId?: string
  assignee?: {
    id: string
    user: { id: string; name: string; email: string }
  }
  reviewerId?: string
  reviewer?: {
    id: string
    user: { id: string; name: string; email: string }
  }
  reviewNotes?: string
  createdAt: string
  updatedAt: string
}

export interface ProjectSoftwareDetail extends ProjectSoftware {
  admins: ProjectSoftwareAdmin[]
  accessRequests: SoftwareAccessRequest[]
}

export interface PortalSoftware {
  id: string
  softwareId: string
  name: string
  description?: string
  iconUrl?: string
  vendor?: string
  websiteUrl?: string
  category?: { id: string; name: string }
  notes?: string
  myAccessRequest?: {
    id: string
    status: 'PENDING' | 'APPROVED' | 'DECLINED' | 'REVOKED'
    createdAt: string
  } | null
}

export interface PortalAccessRequest {
  id: string
  status: 'PENDING' | 'APPROVED' | 'DECLINED' | 'REVOKED'
  reason?: string
  reviewNotes?: string
  createdAt: string
  updatedAt: string
  projectSoftwareId: string
  project: { id: string; name: string; projectCode: string }
  software: { id: string; name: string; iconUrl?: string; vendor?: string }
  reviewer?: { id: string; user: { name: string } }
}

// ==========================================
// Ticket Stage Types
// ==========================================

export interface TicketStage {
  id: string
  projectId: string
  name: string
  slug: string
  color: string
  position: number
  isDefault: boolean
  isResolved: boolean
  createdAt?: string
  updatedAt?: string
  _count?: { tickets: number }
}

// ==========================================
// Notification Types
// ==========================================

export type NotificationType =
  | 'ticket_assigned'
  | 'ticket_comment'
  | 'ticket_comment_client'
  | 'mention'
  | 'mention_client'
  | 'ticket_status_changed'
  | 'access_request_submitted'
  | 'access_request_approved'
  | 'access_request_declined'
  | 'access_request_revoked'

export interface Notification {
  id: string
  organizationId: string
  recipientId: string
  type: NotificationType
  title: string
  message: string
  link?: string
  isRead: boolean
  readAt?: string
  createdAt: string
  entityType?: string
  entityId?: string
}

class ApiClient {
  private organizationId: string | null = null

  setOrganizationId(orgId: string | null) {
    this.organizationId = orgId
  }

  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers
    }

    if (this.organizationId) {
      headers['X-Organization-Id'] = this.organizationId
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include'
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }))
      throw new Error(error.error || 'Request failed')
    }

    // Handle CSV/file downloads
    const contentType = response.headers.get('content-type')
    if (contentType && contentType.includes('text/csv')) {
      return response.blob() as unknown as T
    }

    return response.json()
  }

  async upload<T>(endpoint: string, formData: FormData): Promise<T> {
    const headers: Record<string, string> = {}

    if (this.organizationId) {
      headers['X-Organization-Id'] = this.organizationId
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers,
      body: formData,
      credentials: 'include'
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }))
      throw new Error(error.error || 'Upload failed')
    }

    return response.json()
  }

  // Time Entries
  async getTimeEntries(filters: {
    startDate?: string
    endDate?: string
    projectId?: string
    userId?: string
  } = {}) {
    const params = new URLSearchParams()
    if (filters.startDate) params.append('startDate', filters.startDate)
    if (filters.endDate) params.append('endDate', filters.endDate)
    if (filters.projectId) params.append('projectId', filters.projectId)
    if (filters.userId) params.append('userId', filters.userId)

    const query = params.toString()
    return this.request<any[]>(`/time-entries${query ? `?${query}` : ''}`)
  }

  async getTimeEntry(id: string) {
    return this.request<any>(`/time-entries/${id}`)
  }

  async createTimeEntry(data: {
    projectId: string
    taskName: string
    startTime?: string
    endTime?: string
    notes?: string
    isRunning?: boolean
  }) {
    return this.request<any>('/time-entries', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  async updateTimeEntry(id: string, data: {
    projectId?: string
    taskName?: string
    startTime?: string
    endTime?: string
    notes?: string
  }) {
    return this.request<any>(`/time-entries/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  }

  async deleteTimeEntry(id: string) {
    return this.request<{ message: string }>(`/time-entries/${id}`, {
      method: 'DELETE'
    })
  }

  async stopTimer(id: string) {
    return this.request<any>(`/time-entries/${id}/stop`, {
      method: 'POST'
    })
  }

  async getRunningTimer() {
    return this.request<any | null>('/time-entries/running/current')
  }

  // Projects
  async getProjects(includeInactive = false) {
    const params = includeInactive ? '?includeInactive=true' : ''
    return this.request<any[]>(`/projects${params}`)
  }

  async getProject(id: string) {
    return this.request<any>(`/projects/${id}`)
  }

  async createProject(data: {
    name: string
    projectCode: string
    clientName?: string
    description?: string
    defaultAssigneeId?: string | null
    dueDateLowDays?: number | null
    dueDateMediumDays?: number | null
    dueDateHighDays?: number | null
    dueDateUrgentDays?: number | null
  }) {
    return this.request<any>('/projects', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  async updateProject(id: string, data: {
    name?: string
    projectCode?: string
    clientName?: string
    description?: string
    isActive?: boolean
    defaultAssigneeId?: string | null
    dueDateLowDays?: number | null
    dueDateMediumDays?: number | null
    dueDateHighDays?: number | null
    dueDateUrgentDays?: number | null
  }) {
    return this.request<any>(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  }

  async deleteProject(id: string) {
    return this.request<{ message: string }>(`/projects/${id}`, {
      method: 'DELETE'
    })
  }

  async getProjectStats(id: string, filters: { startDate?: string; endDate?: string } = {}) {
    const params = new URLSearchParams()
    if (filters.startDate) params.append('startDate', filters.startDate)
    if (filters.endDate) params.append('endDate', filters.endDate)

    const query = params.toString()
    return this.request<any>(`/projects/${id}/stats${query ? `?${query}` : ''}`)
  }

  // Project Stages
  async getProjectStages(projectId: string) {
    return this.request<TicketStage[]>(`/projects/${projectId}/stages`)
  }

  async createStage(projectId: string, data: {
    name: string
    color: string
    isDefault?: boolean
    isResolved?: boolean
  }) {
    return this.request<TicketStage>(`/projects/${projectId}/stages`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  async updateStage(projectId: string, stageId: string, data: {
    name?: string
    color?: string
    isDefault?: boolean
    isResolved?: boolean
  }) {
    return this.request<TicketStage>(`/projects/${projectId}/stages/${stageId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  }

  async reorderStages(projectId: string, stageIds: string[]) {
    return this.request<TicketStage[]>(`/projects/${projectId}/stages/reorder`, {
      method: 'PUT',
      body: JSON.stringify({ stageIds })
    })
  }

  async deleteStage(projectId: string, stageId: string, moveTicketsToStageId: string) {
    return this.request<{ message: string }>(`/projects/${projectId}/stages/${stageId}`, {
      method: 'DELETE',
      body: JSON.stringify({ moveTicketsToStageId })
    })
  }

  // Reports
  async getReportSummary(filters: {
    startDate?: string
    endDate?: string
    projectId?: string
    userId?: string
    groupBy?: 'project' | 'user' | 'date'
  } = {}) {
    const params = new URLSearchParams()
    if (filters.startDate) params.append('startDate', filters.startDate)
    if (filters.endDate) params.append('endDate', filters.endDate)
    if (filters.projectId) params.append('projectId', filters.projectId)
    if (filters.userId) params.append('userId', filters.userId)
    if (filters.groupBy) params.append('groupBy', filters.groupBy)

    const query = params.toString()
    return this.request<any>(`/reports/summary${query ? `?${query}` : ''}`)
  }

  async exportTimeEntries(filters: {
    startDate?: string
    endDate?: string
    projectId?: string
    userId?: string
  } = {}) {
    const params = new URLSearchParams()
    if (filters.startDate) params.append('startDate', filters.startDate)
    if (filters.endDate) params.append('endDate', filters.endDate)
    if (filters.projectId) params.append('projectId', filters.projectId)
    if (filters.userId) params.append('userId', filters.userId)

    const query = params.toString()
    return this.request<Blob>(`/reports/export${query ? `?${query}` : ''}`)
  }

  async getBillingReport(filters: {
    startDate?: string
    endDate?: string
    hourlyRate?: number
  } = {}) {
    const params = new URLSearchParams()
    if (filters.startDate) params.append('startDate', filters.startDate)
    if (filters.endDate) params.append('endDate', filters.endDate)
    if (filters.hourlyRate) params.append('hourlyRate', filters.hourlyRate.toString())

    const query = params.toString()
    return this.request<any>(`/reports/billing${query ? `?${query}` : ''}`)
  }

  // === TICKETS (Staff) ===

  async getTickets(filters: {
    projectId?: string
    status?: string
    ownerId?: string
    clientId?: string
    priorityLevel?: string
  } = {}) {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, value)
    })
    const query = params.toString()
    return this.request<any[]>(`/tickets${query ? `?${query}` : ''}`)
  }

  async getTicket(id: string) {
    return this.request<any>(`/tickets/${id}`)
  }

  async createTicket(data: {
    projectId: string
    clientId: string
    firstName: string
    lastName: string
    email: string
    phone?: string
    subject: string
    requestType?: string
    priorityLevel?: string
    description: string
    screenRecordingLink?: string
    dueDate?: string
  }) {
    return this.request<any>('/tickets', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  async updateTicket(id: string, data: {
    firstName?: string
    lastName?: string
    email?: string
    phone?: string
    subject?: string
    requestType?: string
    priorityLevel?: string
    description?: string
    screenRecordingLink?: string
    status?: string
    ownerId?: string | null
    dueDate?: string | null
  }) {
    return this.request<any>(`/tickets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  }

  async updateTicketStatus(id: string, status: string) {
    return this.request<any>(`/tickets/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    })
  }

  async updateTicketStage(id: string, stageId: string) {
    return this.request<any>(`/tickets/${id}/stage`, {
      method: 'PUT',
      body: JSON.stringify({ stageId })
    })
  }

  async assignTicket(id: string, ownerId: string | null) {
    return this.request<any>(`/tickets/${id}/assign`, {
      method: 'PUT',
      body: JSON.stringify({ ownerId })
    })
  }

  async deleteTicket(id: string) {
    return this.request<{ message: string }>(`/tickets/${id}`, {
      method: 'DELETE'
    })
  }

  // Ticket Comments
  async getTicketComments(ticketId: string) {
    return this.request<any[]>(`/tickets/${ticketId}/comments`)
  }

  async addTicketComment(ticketId: string, data: { content: string; isInternal?: boolean }) {
    return this.request<any>(`/tickets/${ticketId}/comments`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  async getTicketMentionableMembers(ticketId: string) {
    return this.request<Array<{
      id: string
      role: string
      user: { id: string; name: string; email: string }
    }>>(`/tickets/${ticketId}/mentionable-members`)
  }

  // Ticket Time Entries
  async getTicketTimeEntries(ticketId: string) {
    return this.request<any[]>(`/tickets/${ticketId}/time-entries`)
  }

  async startTicketTimer(ticketId: string) {
    return this.request<any>(`/tickets/${ticketId}/time-entries`, {
      method: 'POST'
    })
  }

  // Ticket Attachments
  async getTicketAttachments(ticketId: string) {
    return this.request<any[]>(`/tickets/${ticketId}/attachments`)
  }

  async deleteTicketAttachment(ticketId: string, attachmentId: string) {
    return this.request<{ message: string }>(`/tickets/${ticketId}/attachments/${attachmentId}`, {
      method: 'DELETE'
    })
  }

  async uploadTicketAttachments(ticketId: string, files: File[]) {
    const formData = new FormData()
    files.forEach(file => formData.append('attachments', file))
    return this.upload<any[]>(`/tickets/${ticketId}/attachments`, formData)
  }

  // === PORTAL (Client) ===

  async getPortalProjects() {
    return this.request<any[]>('/portal/projects')
  }

  async getPortalDashboard() {
    return this.request<any>('/portal/dashboard')
  }

  async getPortalTickets(filters: { projectId?: string; status?: string } = {}) {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, value)
    })
    const query = params.toString()
    return this.request<any[]>(`/portal/tickets${query ? `?${query}` : ''}`)
  }

  async getPortalTicket(id: string) {
    return this.request<any>(`/portal/tickets/${id}`)
  }

  async submitPortalTicket(data: {
    projectId: string
    subject: string
    requestType?: string
    priorityLevel?: string
    description: string
    screenRecordingLink?: string
  }) {
    return this.request<any>('/portal/tickets', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  async uploadPortalTicketAttachments(ticketId: string, files: File[]) {
    const formData = new FormData()
    files.forEach(file => formData.append('attachments', file))
    return this.upload<any[]>(`/portal/tickets/${ticketId}/attachments`, formData)
  }

  async addPortalMessage(ticketId: string, content: string) {
    return this.request<any>(`/portal/tickets/${ticketId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content })
    })
  }

  async getPortalTicketMentionableMembers(ticketId: string) {
    return this.request<Array<{
      id: string
      role: string
      user: { id: string; name: string; email: string }
    }>>(`/portal/tickets/${ticketId}/mentionable-members`)
  }

  // === MEMBERS ===

  async createUserAndAddToOrg(data: {
    name: string
    email: string
    phone?: string
    password: string
    role: 'manager' | 'member' | 'client'
    projectIds?: string[]
  }) {
    return this.request<{
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

  // Get all staff members (non-clients) for ticket assignment
  async getStaffMembers() {
    return this.request<Array<{
      id: string
      role: string
      user: { id: string; name: string; email: string }
    }>>('/members/staff')
  }

  // Get all clients with their project assignments
  async getClients() {
    return this.request<Array<{
      id: string
      role: string
      user: { id: string; name: string; email: string }
      projectAssignments: Array<{
        id: string
        project: { id: string; name: string; projectCode: string; isActive: boolean }
      }>
    }>>('/members/clients')
  }

  // Get a single client with their tickets and software access
  async getClientDetail(memberId: string) {
    return this.request<{
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

  // Get project assignments for a specific member
  async getMemberProjects(memberId: string) {
    return this.request<Array<{
      id: string
      project: { id: string; name: string; projectCode: string; isActive: boolean }
    }>>(`/members/${memberId}/projects`)
  }

  // Assign a project to a member
  async assignProject(memberId: string, projectId: string) {
    return this.request<{
      id: string
      project: { id: string; name: string; projectCode: string; isActive: boolean }
    }>(`/members/${memberId}/projects`, {
      method: 'POST',
      body: JSON.stringify({ projectId })
    })
  }

  // Remove a project assignment
  async unassignProject(memberId: string, projectId: string) {
    return this.request<{ message: string }>(`/members/${memberId}/projects/${projectId}`, {
      method: 'DELETE'
    })
  }

  // Bulk update project assignments for a member
  async updateMemberProjects(memberId: string, projectIds: string[]) {
    return this.request<Array<{
      id: string
      project: { id: string; name: string; projectCode: string; isActive: boolean }
    }>>(`/members/${memberId}/projects`, {
      method: 'PUT',
      body: JSON.stringify({ projectIds })
    })
  }

  // Get current user's profile
  async getProfile() {
    return this.request<{
      id: string
      name: string
      email: string
      phone: string | null
    }>('/members/profile')
  }

  // Update current user's profile (phone)
  async updateProfile(data: { phone?: string }) {
    return this.request<{
      id: string
      name: string
      email: string
      phone: string | null
    }>('/members/profile', {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  }

  async uploadAvatar(file: File) {
    const formData = new FormData()
    formData.append('avatar', file)
    return this.upload<{ id: string; name: string; email: string; phone: string | null; image: string }>('/members/profile/avatar', formData)
  }

  async removeAvatar() {
    return this.request<{ message: string }>('/members/profile/avatar', {
      method: 'DELETE'
    })
  }

  // === SUPER ADMIN ===

  // Get all users with their organization memberships and project assignments
  async getSuperAdminUsers(params: { limit?: number; offset?: number; search?: string } = {}) {
    const queryParams = new URLSearchParams()
    if (params.limit) queryParams.append('limit', params.limit.toString())
    if (params.offset) queryParams.append('offset', params.offset.toString())
    if (params.search) queryParams.append('search', params.search)

    const query = queryParams.toString()
    return this.request<{
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
  // SUPER ADMIN - Software Catalog
  // ==========================================

  async getSuperAdminSoftware(params: {
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
    return this.request<{ software: GlobalSoftware[]; total: number }>(
      `/super-admin/software${query ? `?${query}` : ''}`
    )
  }

  async getSuperAdminSoftwareById(id: string) {
    return this.request<GlobalSoftware>(`/super-admin/software/${id}`)
  }

  async createSuperAdminSoftware(data: {
    name: string
    description?: string
    iconUrl?: string
    vendor?: string
    websiteUrl?: string
    categoryId?: string
  }) {
    return this.request<GlobalSoftware>('/super-admin/software', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  async updateSuperAdminSoftware(id: string, data: {
    name?: string
    description?: string
    iconUrl?: string
    vendor?: string
    websiteUrl?: string
    categoryId?: string
  }) {
    return this.request<GlobalSoftware>(`/super-admin/software/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  }

  async uploadSoftwareIcon(softwareId: string, file: File) {
    const formData = new FormData()
    formData.append('icon', file)
    return this.upload<GlobalSoftware>(`/super-admin/software/${softwareId}/icon`, formData)
  }

  async deleteSuperAdminSoftware(id: string) {
    return this.request<{ message: string }>(`/super-admin/software/${id}`, {
      method: 'DELETE'
    })
  }

  async approveSoftware(id: string) {
    return this.request<GlobalSoftware>(`/super-admin/software/${id}/approve`, {
      method: 'PUT'
    })
  }

  async rejectSoftware(id: string) {
    return this.request<GlobalSoftware>(`/super-admin/software/${id}/reject`, {
      method: 'PUT'
    })
  }

  // Super Admin Categories
  async getSuperAdminCategories() {
    return this.request<SoftwareCategory[]>('/super-admin/software/categories')
  }

  async createSuperAdminCategory(data: { name: string; description?: string }) {
    return this.request<SoftwareCategory>('/super-admin/software/categories', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  async updateSuperAdminCategory(id: string, data: { name?: string; description?: string }) {
    return this.request<SoftwareCategory>(`/super-admin/software/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  }

  async deleteSuperAdminCategory(id: string) {
    return this.request<{ message: string }>(`/super-admin/software/categories/${id}`, {
      method: 'DELETE'
    })
  }

  // ==========================================
  // PROJECT SOFTWARE (Admin)
  // ==========================================

  // Global catalog (read-only for org users)
  async getGlobalCatalog(params: { categoryId?: string; search?: string } = {}) {
    const queryParams = new URLSearchParams()
    if (params.categoryId) queryParams.append('categoryId', params.categoryId)
    if (params.search) queryParams.append('search', params.search)

    const query = queryParams.toString()
    return this.request<GlobalSoftware[]>(`/software/catalog${query ? `?${query}` : ''}`)
  }

  async getGlobalCatalogCategories() {
    return this.request<SoftwareCategory[]>('/software/catalog/categories')
  }

  async submitNewSoftware(data: {
    name: string
    description?: string
    iconUrl?: string
    vendor?: string
    websiteUrl?: string
    categoryId?: string
  }) {
    return this.request<GlobalSoftware>('/software/submit', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  // Project software management
  async getProjectSoftware(projectId: string) {
    return this.request<ProjectSoftware[]>(`/software/projects/${projectId}/software`)
  }

  async getProjectSoftwareById(projectId: string, id: string) {
    return this.request<ProjectSoftwareDetail>(`/software/projects/${projectId}/software/${id}`)
  }

  async addSoftwareToProject(projectId: string, softwareId: string, notes?: string) {
    return this.request<ProjectSoftware>(`/software/projects/${projectId}/software/${softwareId}`, {
      method: 'POST',
      body: JSON.stringify({ notes })
    })
  }

  async updateProjectSoftware(projectId: string, id: string, data: {
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
    return this.request<ProjectSoftware>(`/software/projects/${projectId}/software/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  }

  async getProjectSoftwareBudget(projectId: string) {
    return this.request<SoftwareBudgetSummary>(`/software/projects/${projectId}/software-budget`)
  }

  async removeProjectSoftware(projectId: string, id: string) {
    return this.request<{ message: string }>(`/software/projects/${projectId}/software/${id}`, {
      method: 'DELETE'
    })
  }

  // Project software admins
  async getProjectSoftwareAdmins(projectId: string, softwareId: string) {
    return this.request<ProjectSoftwareAdmin[]>(
      `/software/projects/${projectId}/software/${softwareId}/admins`
    )
  }

  async addProjectSoftwareAdmin(projectId: string, softwareId: string, data: {
    memberId: string
    role?: 'OWNER' | 'ADMIN'
  }) {
    return this.request<ProjectSoftwareAdmin>(
      `/software/projects/${projectId}/software/${softwareId}/admins`,
      {
        method: 'POST',
        body: JSON.stringify(data)
      }
    )
  }

  async updateProjectSoftwareAdmin(projectId: string, softwareId: string, adminId: string, data: {
    role: 'OWNER' | 'ADMIN'
  }) {
    return this.request<ProjectSoftwareAdmin>(
      `/software/projects/${projectId}/software/${softwareId}/admins/${adminId}`,
      {
        method: 'PUT',
        body: JSON.stringify(data)
      }
    )
  }

  async removeProjectSoftwareAdmin(projectId: string, softwareId: string, adminId: string) {
    return this.request<{ message: string }>(
      `/software/projects/${projectId}/software/${softwareId}/admins/${adminId}`,
      { method: 'DELETE' }
    )
  }

  // Project software access requests
  async getProjectSoftwareRequests(projectId: string, softwareId: string, status?: string) {
    const queryParams = new URLSearchParams()
    if (status) queryParams.append('status', status)
    const query = queryParams.toString()

    return this.request<SoftwareAccessRequest[]>(
      `/software/projects/${projectId}/software/${softwareId}/requests${query ? `?${query}` : ''}`
    )
  }

  async getAllProjectRequests(projectId: string) {
    return this.request<SoftwareAccessRequest[]>(`/software/projects/${projectId}/requests`)
  }

  async getAllPendingAccessRequests(projectId?: string) {
    const queryParams = new URLSearchParams()
    if (projectId) queryParams.append('projectId', projectId)
    const query = queryParams.toString()
    return this.request<Array<SoftwareAccessRequest & {
      projectSoftware: {
        software: { id: string; name: string; iconUrl?: string }
        project: { id: string; name: string; projectCode: string; defaultAssigneeId?: string }
      }
    }>>(`/software/requests/pending${query ? `?${query}` : ''}`)
  }

  async assignAccessRequest(requestId: string, assigneeId: string | null) {
    return this.request<SoftwareAccessRequest>(`/software/requests/${requestId}/assign`, {
      method: 'PUT',
      body: JSON.stringify({ assigneeId })
    })
  }

  async reviewAccessRequest(projectId: string, softwareId: string, requestId: string, data: {
    status: 'APPROVED' | 'DECLINED' | 'REVOKED' | 'PENDING'
    reviewNotes?: string
  }) {
    return this.request<SoftwareAccessRequest>(
      `/software/projects/${projectId}/software/${softwareId}/requests/${requestId}`,
      {
        method: 'PUT',
        body: JSON.stringify(data)
      }
    )
  }

  async deleteAccessRequest(projectId: string, softwareId: string, requestId: string) {
    return this.request<{ message: string }>(
      `/software/projects/${projectId}/software/${softwareId}/requests/${requestId}`,
      {
        method: 'DELETE'
      }
    )
  }

  // ==========================================
  // PORTAL SOFTWARE
  // ==========================================

  async getPortalProjectSoftware(projectId: string, params: {
    categoryId?: string
    filter?: 'my-software'
  } = {}) {
    const queryParams = new URLSearchParams()
    if (params.categoryId) queryParams.append('categoryId', params.categoryId)
    if (params.filter) queryParams.append('filter', params.filter)

    const query = queryParams.toString()
    return this.request<PortalSoftware[]>(
      `/portal/software/projects/${projectId}/software${query ? `?${query}` : ''}`
    )
  }

  async getPortalProjectSoftwareById(projectId: string, id: string) {
    return this.request<PortalSoftware>(`/portal/software/projects/${projectId}/software/${id}`)
  }

  async getPortalSoftwareCategories(projectId: string) {
    return this.request<SoftwareCategory[]>(
      `/portal/software/projects/${projectId}/software/categories`
    )
  }

  async submitPortalAccessRequest(projectId: string, softwareId: string, reason?: string) {
    return this.request<{
      id: string
      status: string
      reason?: string
      createdAt: string
      software: { id: string; name: string }
    }>(`/portal/software/projects/${projectId}/software/${softwareId}/request`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    })
  }

  async getPortalMyRequests(params: { status?: string; projectId?: string } = {}) {
    const queryParams = new URLSearchParams()
    if (params.status) queryParams.append('status', params.status)
    if (params.projectId) queryParams.append('projectId', params.projectId)

    const query = queryParams.toString()
    return this.request<PortalAccessRequest[]>(
      `/portal/software/my-requests${query ? `?${query}` : ''}`
    )
  }

  // ==========================================
  // IMPORT
  // ==========================================

  async importClients(projectId: string, clients: Array<{
    firstName: string
    lastName: string
    email: string
    phone?: string
  }>) {
    return this.request<{
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

  // ==========================================
  // NOTIFICATIONS
  // ==========================================

  async getNotifications(params: { limit?: number; offset?: number; unreadOnly?: boolean } = {}) {
    const queryParams = new URLSearchParams()
    if (params.limit) queryParams.append('limit', params.limit.toString())
    if (params.offset) queryParams.append('offset', params.offset.toString())
    if (params.unreadOnly) queryParams.append('unreadOnly', 'true')

    const query = queryParams.toString()
    return this.request<{
      notifications: Notification[]
      total: number
      limit: number
      offset: number
    }>(`/notifications${query ? `?${query}` : ''}`)
  }

  async getUnreadNotificationCount() {
    return this.request<{ count: number }>('/notifications/unread-count')
  }

  async markNotificationAsRead(id: string) {
    return this.request<{ success: boolean }>(`/notifications/${id}/read`, {
      method: 'PUT'
    })
  }

  async markAllNotificationsAsRead() {
    return this.request<{ success: boolean; count: number }>('/notifications/read-all', {
      method: 'PUT'
    })
  }

  async deleteNotification(id: string) {
    return this.request<{ success: boolean }>(`/notifications/${id}`, {
      method: 'DELETE'
    })
  }
}

export const api = new ApiClient()
