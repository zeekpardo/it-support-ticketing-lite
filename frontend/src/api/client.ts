const API_BASE = '/api'

interface RequestOptions extends RequestInit {
  headers?: Record<string, string>
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

  async addPortalMessage(ticketId: string, content: string) {
    return this.request<any>(`/portal/tickets/${ticketId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content })
    })
  }

  // === MEMBERS ===

  async createUserAndAddToOrg(data: {
    name: string
    email: string
    phone?: string
    password: string
    role: 'manager' | 'member' | 'client'
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
}

export const api = new ApiClient()
