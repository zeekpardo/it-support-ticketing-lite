import { request } from './base'

// ==========================================
// Reports
// ==========================================

export async function getReportSummary(filters: {
  startDate?: string
  endDate?: string
  inboxId?: string
  userId?: string
  groupBy?: 'inbox' | 'user' | 'date'
} = {}) {
  const params = new URLSearchParams()
  if (filters.startDate) params.append('startDate', filters.startDate)
  if (filters.endDate) params.append('endDate', filters.endDate)
  if (filters.inboxId) params.append('inboxId', filters.inboxId)
  if (filters.userId) params.append('userId', filters.userId)
  if (filters.groupBy) params.append('groupBy', filters.groupBy)

  const query = params.toString()
  return request<any>(`/reports/summary${query ? `?${query}` : ''}`)
}

export async function exportTimeEntries(filters: {
  startDate?: string
  endDate?: string
  inboxId?: string
  userId?: string
} = {}) {
  const params = new URLSearchParams()
  if (filters.startDate) params.append('startDate', filters.startDate)
  if (filters.endDate) params.append('endDate', filters.endDate)
  if (filters.inboxId) params.append('inboxId', filters.inboxId)
  if (filters.userId) params.append('userId', filters.userId)

  const query = params.toString()
  return request<Blob>(`/reports/export${query ? `?${query}` : ''}`)
}

export async function getBillingReport(filters: {
  startDate?: string
  endDate?: string
  hourlyRate?: number
} = {}) {
  const params = new URLSearchParams()
  if (filters.startDate) params.append('startDate', filters.startDate)
  if (filters.endDate) params.append('endDate', filters.endDate)
  if (filters.hourlyRate) params.append('hourlyRate', filters.hourlyRate.toString())

  const query = params.toString()
  return request<any>(`/reports/billing${query ? `?${query}` : ''}`)
}
