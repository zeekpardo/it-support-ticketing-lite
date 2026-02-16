import { request, publicRequest, publicUpload } from './base'
import type { TicketStage } from './types'

// ==========================================
// Inboxes
// ==========================================

export async function getInboxes(includeInactive = false) {
  const params = includeInactive ? '?includeInactive=true' : ''
  return request<any[]>(`/inboxes${params}`)
}

export async function getInbox(id: string) {
  return request<any>(`/inboxes/${id}`)
}

export async function createInbox(data: {
  name: string
  inboxCode: string
  clientName?: string
  description?: string
  defaultAssigneeId?: string | null
  dueDateLowDays?: number | null
  dueDateMediumDays?: number | null
  dueDateHighDays?: number | null
  dueDateUrgentDays?: number | null
  allowedEmailDomains?: string[]
}) {
  return request<any>('/inboxes', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function updateInbox(id: string, data: {
  name?: string
  inboxCode?: string
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
  allowedEmailDomains?: string[]
}) {
  return request<any>(`/inboxes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

export async function deleteInbox(id: string) {
  return request<{ message: string }>(`/inboxes/${id}`, {
    method: 'DELETE'
  })
}

export async function getInboxStats(id: string, filters: { startDate?: string; endDate?: string } = {}) {
  const params = new URLSearchParams()
  if (filters.startDate) params.append('startDate', filters.startDate)
  if (filters.endDate) params.append('endDate', filters.endDate)

  const query = params.toString()
  return request<any>(`/inboxes/${id}/stats${query ? `?${query}` : ''}`)
}

// ==========================================
// Inbox Stages
// ==========================================

export async function getInboxStages(inboxId: string) {
  return request<TicketStage[]>(`/inboxes/${inboxId}/stages`)
}

export async function createStage(inboxId: string, data: {
  name: string
  color: string
  isDefault?: boolean
  isResolved?: boolean
}) {
  return request<TicketStage>(`/inboxes/${inboxId}/stages`, {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function updateStage(inboxId: string, stageId: string, data: {
  name?: string
  color?: string
  isDefault?: boolean
  isResolved?: boolean
}) {
  return request<TicketStage>(`/inboxes/${inboxId}/stages/${stageId}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

export async function reorderStages(inboxId: string, stageIds: string[]) {
  return request<TicketStage[]>(`/inboxes/${inboxId}/stages/reorder`, {
    method: 'PUT',
    body: JSON.stringify({ stageIds })
  })
}

export async function deleteStage(inboxId: string, stageId: string, moveTicketsToStageId: string) {
  return request<{ message: string }>(`/inboxes/${inboxId}/stages/${stageId}`, {
    method: 'DELETE',
    body: JSON.stringify({ moveTicketsToStageId })
  })
}

// ==========================================
// Client Signup Links
// ==========================================

export async function generateSignupLink(inboxId: string) {
  return request<{ token: string; enabled: boolean }>(`/inboxes/${inboxId}/signup-link`, {
    method: 'POST',
  })
}

export async function toggleSignupLink(inboxId: string, enabled: boolean) {
  return request<{ token: string; enabled: boolean }>(`/inboxes/${inboxId}/signup-link`, {
    method: 'PATCH',
    body: JSON.stringify({ enabled }),
  })
}

export async function deleteSignupLink(inboxId: string) {
  return request<{ success: boolean }>(`/inboxes/${inboxId}/signup-link`, {
    method: 'DELETE',
  })
}

export async function getSignupInfo(token: string) {
  return publicRequest<{
    organizationName: string
    inboxName: string
    branding: { appName: string; primaryColor: string; logoUrl: string | null }
  }>(`/client-signup/${token}`)
}

export async function submitClientSignup(token: string, data: { name: string; email: string; password: string }) {
  return publicRequest<{ success: boolean; message?: string }>(`/client-signup/${token}`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// ==========================================
// Public Ticket Form
// ==========================================

export async function getPublicFormInfo(token: string) {
  return publicRequest<{
    inboxId: string
    inboxName: string
    allowedEmailDomains: string[]
    branding: { appName: string; primaryColor: string; logoUrl: string | null }
  }>(`/public/submit/${token}`)
}

export async function submitPublicTicket(token: string, data: {
  firstName: string
  lastName: string
  email: string
  subject: string
  description: string
  priorityLevel?: string
}) {
  return publicRequest<{ success: boolean; ticketId: string }>(`/public/submit/${token}`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function uploadPublicTicketAttachments(token: string, ticketId: string, files: File[]) {
  const formData = new FormData()
  files.forEach(file => formData.append('attachments', file))
  return publicUpload<any[]>(`/public/submit/${token}/attachments/${ticketId}`, formData)
}
