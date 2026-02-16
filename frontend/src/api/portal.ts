import { request, upload } from './base'
import type {
  PortalSoftware,
  SoftwareCategory,
  PortalAccessRequest
} from './types'

// ==========================================
// Portal - Tickets
// ==========================================

export async function getPortalInboxes() {
  return request<any[]>('/portal/inboxes')
}

export async function getPortalDashboard() {
  return request<any>('/portal/dashboard')
}

export async function getPortalTickets(filters: { inboxId?: string; status?: string } = {}) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.append(key, value)
  })
  const query = params.toString()
  return request<any[]>(`/portal/tickets${query ? `?${query}` : ''}`)
}

export async function getPortalTicket(id: string) {
  return request<any>(`/portal/tickets/${id}`)
}

export async function submitPortalTicket(data: {
  inboxId: string
  subject: string
  requestType?: string
  priorityLevel?: string
  description: string
  screenRecordingLink?: string
}) {
  return request<any>('/portal/tickets', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function uploadPortalTicketAttachments(ticketId: string, files: File[]) {
  const formData = new FormData()
  files.forEach(file => formData.append('attachments', file))
  return upload<any[]>(`/portal/tickets/${ticketId}/attachments`, formData)
}

export async function addPortalMessage(ticketId: string, content: string, contentHtml?: string, files?: File[]) {
  if (files && files.length > 0) {
    const formData = new FormData()
    formData.append('content', content)
    if (contentHtml) formData.append('contentHtml', contentHtml)
    files.forEach(file => formData.append('attachments', file))
    return upload<any>(`/portal/tickets/${ticketId}/messages`, formData)
  }
  return request<any>(`/portal/tickets/${ticketId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content, contentHtml })
  })
}

export async function uploadPortalInlineImage(ticketId: string, file: File) {
  const formData = new FormData()
  formData.append('image', file)
  return upload<{ key: string }>(`/portal/tickets/${ticketId}/inline-image`, formData)
}

export async function getPortalTicketMentionableMembers(ticketId: string) {
  return request<Array<{
    id: string
    role: string
    user: { id: string; name: string; email: string }
  }>>(`/portal/tickets/${ticketId}/mentionable-members`)
}

// ==========================================
// Portal - Software
// ==========================================

export async function getPortalInboxSoftware(inboxId: string, params: {
  categoryId?: string
  filter?: 'my-software'
} = {}) {
  const queryParams = new URLSearchParams()
  if (params.categoryId) queryParams.append('categoryId', params.categoryId)
  if (params.filter) queryParams.append('filter', params.filter)

  const query = queryParams.toString()
  return request<PortalSoftware[]>(
    `/portal/software/inboxes/${inboxId}/software${query ? `?${query}` : ''}`
  )
}

export async function getPortalInboxSoftwareById(inboxId: string, id: string) {
  return request<PortalSoftware>(`/portal/software/inboxes/${inboxId}/software/${id}`)
}

export async function getPortalSoftwareCategories(inboxId: string) {
  return request<SoftwareCategory[]>(
    `/portal/software/inboxes/${inboxId}/software/categories`
  )
}

export async function submitPortalAccessRequest(inboxId: string, softwareId: string, reason?: string) {
  return request<{
    id: string
    status: string
    reason?: string
    createdAt: string
    software: { id: string; name: string }
  }>(`/portal/software/inboxes/${inboxId}/software/${softwareId}/request`, {
    method: 'POST',
    body: JSON.stringify({ reason })
  })
}

export async function getPortalMyRequests(params: { status?: string; inboxId?: string } = {}) {
  const queryParams = new URLSearchParams()
  if (params.status) queryParams.append('status', params.status)
  if (params.inboxId) queryParams.append('inboxId', params.inboxId)

  const query = queryParams.toString()
  return request<PortalAccessRequest[]>(
    `/portal/software/my-requests${query ? `?${query}` : ''}`
  )
}
