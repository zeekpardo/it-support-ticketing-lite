import { request, upload } from './base'

// ==========================================
// Time Entries
// ==========================================

export async function getTimeEntries(filters: {
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
  return request<any[]>(`/time-entries${query ? `?${query}` : ''}`)
}

export async function getTimeEntry(id: string) {
  return request<any>(`/time-entries/${id}`)
}

export async function createTimeEntry(data: {
  projectId: string
  taskName: string
  startTime?: string
  endTime?: string
  notes?: string
  isRunning?: boolean
}) {
  return request<any>('/time-entries', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function updateTimeEntry(id: string, data: {
  projectId?: string
  taskName?: string
  startTime?: string
  endTime?: string
  notes?: string
}) {
  return request<any>(`/time-entries/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

export async function deleteTimeEntry(id: string) {
  return request<{ message: string }>(`/time-entries/${id}`, {
    method: 'DELETE'
  })
}

export async function stopTimer(id: string) {
  return request<any>(`/time-entries/${id}/stop`, {
    method: 'POST'
  })
}

// ==========================================
// Tickets (Staff)
// ==========================================

export async function getTickets(filters: {
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
  return request<any[]>(`/tickets${query ? `?${query}` : ''}`)
}

export async function getTicket(id: string) {
  return request<any>(`/tickets/${id}`)
}

export async function createTicket(data: {
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
  return request<any>('/tickets', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function updateTicket(id: string, data: {
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
  return request<any>(`/tickets/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

export async function updateTicketStatus(id: string, status: string) {
  return request<any>(`/tickets/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status })
  })
}

export async function updateTicketStage(id: string, stageId: string) {
  return request<any>(`/tickets/${id}/stage`, {
    method: 'PUT',
    body: JSON.stringify({ stageId })
  })
}

export async function assignTicket(id: string, ownerId: string | null) {
  return request<any>(`/tickets/${id}/assign`, {
    method: 'PUT',
    body: JSON.stringify({ ownerId })
  })
}

export async function deleteTicket(id: string) {
  return request<{ message: string }>(`/tickets/${id}`, {
    method: 'DELETE'
  })
}

// ==========================================
// Ticket Comments
// ==========================================

export async function getTicketComments(ticketId: string) {
  return request<any[]>(`/tickets/${ticketId}/comments`)
}

export async function addTicketComment(ticketId: string, data: { content: string; contentHtml?: string; isInternal?: boolean; files?: File[]; status?: string }) {
  const { files, ...rest } = data
  if (files && files.length > 0) {
    const formData = new FormData()
    formData.append('content', rest.content)
    if (rest.contentHtml) formData.append('contentHtml', rest.contentHtml)
    formData.append('isInternal', String(rest.isInternal || false))
    if (rest.status) formData.append('status', rest.status)
    files.forEach(file => formData.append('attachments', file))
    return upload<any>(`/tickets/${ticketId}/comments`, formData)
  }
  return request<any>(`/tickets/${ticketId}/comments`, {
    method: 'POST',
    body: JSON.stringify(rest)
  })
}

export async function getTicketMentionableMembers(ticketId: string) {
  return request<Array<{
    id: string
    role: string
    user: { id: string; name: string; email: string }
  }>>(`/tickets/${ticketId}/mentionable-members`)
}

// ==========================================
// Ticket Time Entries
// ==========================================

export async function getTicketTimeEntries(ticketId: string) {
  return request<any[]>(`/tickets/${ticketId}/time-entries`)
}

export async function startTicketTimer(ticketId: string) {
  return request<any>(`/tickets/${ticketId}/time-entries`, {
    method: 'POST'
  })
}

// ==========================================
// Ticket Attachments
// ==========================================

export async function getTicketAttachments(ticketId: string) {
  return request<any[]>(`/tickets/${ticketId}/attachments`)
}

export async function deleteTicketAttachment(ticketId: string, attachmentId: string) {
  return request<{ message: string }>(`/tickets/${ticketId}/attachments/${attachmentId}`, {
    method: 'DELETE'
  })
}

export async function uploadTicketAttachments(ticketId: string, files: File[]) {
  const formData = new FormData()
  files.forEach(file => formData.append('attachments', file))
  return upload<any[]>(`/tickets/${ticketId}/attachments`, formData)
}

export async function uploadInlineImage(ticketId: string, file: File) {
  const formData = new FormData()
  formData.append('image', file)
  return upload<{ key: string }>(`/tickets/${ticketId}/inline-image`, formData)
}
