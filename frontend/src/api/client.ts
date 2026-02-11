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
}

export const api = new ApiClient()
