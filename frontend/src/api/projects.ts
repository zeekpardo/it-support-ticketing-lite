import { request } from './base'
import type { TicketStage } from './types'

// ==========================================
// Projects
// ==========================================

export async function getProjects(includeInactive = false) {
  const params = includeInactive ? '?includeInactive=true' : ''
  return request<any[]>(`/projects${params}`)
}

export async function getProject(id: string) {
  return request<any>(`/projects/${id}`)
}

export async function createProject(data: {
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
  return request<any>('/projects', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function updateProject(id: string, data: {
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
  autoReplyEnabled?: boolean
  autoReplyHtml?: string | null
}) {
  return request<any>(`/projects/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

export async function deleteProject(id: string) {
  return request<{ message: string }>(`/projects/${id}`, {
    method: 'DELETE'
  })
}

export async function getProjectStats(id: string, filters: { startDate?: string; endDate?: string } = {}) {
  const params = new URLSearchParams()
  if (filters.startDate) params.append('startDate', filters.startDate)
  if (filters.endDate) params.append('endDate', filters.endDate)

  const query = params.toString()
  return request<any>(`/projects/${id}/stats${query ? `?${query}` : ''}`)
}

// ==========================================
// Project Stages
// ==========================================

export async function getProjectStages(projectId: string) {
  return request<TicketStage[]>(`/projects/${projectId}/stages`)
}

export async function createStage(projectId: string, data: {
  name: string
  color: string
  isDefault?: boolean
  isResolved?: boolean
}) {
  return request<TicketStage>(`/projects/${projectId}/stages`, {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function updateStage(projectId: string, stageId: string, data: {
  name?: string
  color?: string
  isDefault?: boolean
  isResolved?: boolean
}) {
  return request<TicketStage>(`/projects/${projectId}/stages/${stageId}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

export async function reorderStages(projectId: string, stageIds: string[]) {
  return request<TicketStage[]>(`/projects/${projectId}/stages/reorder`, {
    method: 'PUT',
    body: JSON.stringify({ stageIds })
  })
}

export async function deleteStage(projectId: string, stageId: string, moveTicketsToStageId: string) {
  return request<{ message: string }>(`/projects/${projectId}/stages/${stageId}`, {
    method: 'DELETE',
    body: JSON.stringify({ moveTicketsToStageId })
  })
}
