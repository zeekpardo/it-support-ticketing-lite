import { request } from './base'
import type { Notification } from './types'

// ==========================================
// Notifications
// ==========================================

export async function getNotifications(params: { limit?: number; offset?: number; unreadOnly?: boolean } = {}) {
  const queryParams = new URLSearchParams()
  if (params.limit) queryParams.append('limit', params.limit.toString())
  if (params.offset) queryParams.append('offset', params.offset.toString())
  if (params.unreadOnly) queryParams.append('unreadOnly', 'true')

  const query = queryParams.toString()
  return request<{
    notifications: Notification[]
    total: number
    limit: number
    offset: number
  }>(`/notifications${query ? `?${query}` : ''}`)
}

export async function getUnreadNotificationCount() {
  return request<{ count: number }>('/notifications/unread-count')
}

export async function markNotificationAsRead(id: string) {
  return request<{ success: boolean }>(`/notifications/${id}/read`, {
    method: 'PUT'
  })
}

export async function markAllNotificationsAsRead() {
  return request<{ success: boolean; count: number }>('/notifications/read-all', {
    method: 'PUT'
  })
}

export async function deleteNotification(id: string) {
  return request<{ success: boolean }>(`/notifications/${id}`, {
    method: 'DELETE'
  })
}
