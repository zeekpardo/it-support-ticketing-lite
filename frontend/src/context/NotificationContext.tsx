import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react'
import { api, Notification } from '../api/client'
import { useOrganization } from './OrganizationContext'
import { API_BASE } from '../api/base'
import { getOrganizationId } from '../api/base'

const browserNotificationsSupported = 'Notification' in window

interface NotificationContextType {
  notifications: Notification[]
  unreadCount: number
  isLoading: boolean
  hasMore: boolean
  fetchNotifications: (reset?: boolean) => Promise<void>
  markAsRead: (id: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  deleteNotification: (id: string) => Promise<void>
  browserPermission: NotificationPermission
  requestBrowserNotifications: () => Promise<NotificationPermission>
}

const NotificationContext = createContext<NotificationContextType | null>(null)

const PAGE_SIZE = 20

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { currentOrg } = useOrganization()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(0)
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission>(
    browserNotificationsSupported ? Notification.permission : 'denied'
  )
  const eventSourceRef = useRef<EventSource | null>(null)

  const requestBrowserNotifications = useCallback(async () => {
    if (!browserNotificationsSupported) return 'denied' as NotificationPermission
    const permission = await Notification.requestPermission()
    setBrowserPermission(permission)
    return permission
  }, [])

  const showBrowserNotification = useCallback((data: { title: string; message: string; link?: string; id: string }) => {
    if (!browserNotificationsSupported || Notification.permission !== 'granted') return

    const notification = new window.Notification(data.title, {
      body: data.message,
      tag: data.id,
    })

    notification.onclick = () => {
      window.focus()
      if (data.link) {
        window.location.href = data.link
      }
      notification.close()
    }
  }, [])

  const fetchNotifications = useCallback(async (reset = false) => {
    if (!currentOrg) {
      setNotifications([])
      return
    }

    const currentOffset = reset ? 0 : offset

    setIsLoading(true)
    try {
      const { notifications: newNotifications, total } = await api.getNotifications({
        limit: PAGE_SIZE,
        offset: currentOffset,
      })

      if (reset) {
        setNotifications(newNotifications)
        setOffset(PAGE_SIZE)
      } else {
        setNotifications(prev => [...prev, ...newNotifications])
        setOffset(currentOffset + PAGE_SIZE)
      }

      setHasMore(currentOffset + newNotifications.length < total)
    } catch (error) {
      console.error('Failed to fetch notifications:', error)
    } finally {
      setIsLoading(false)
    }
  }, [currentOrg, offset])

  const markAsRead = useCallback(async (id: string) => {
    try {
      await api.markNotificationAsRead(id)

      // Update local state immediately
      setNotifications(prev =>
        prev.map(n =>
          n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
        )
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
      throw error
    }
  }, [])

  const markAllAsRead = useCallback(async () => {
    try {
      await api.markAllNotificationsAsRead()

      // Update local state immediately
      setNotifications(prev =>
        prev.map(n => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
      )
      setUnreadCount(0)
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error)
      throw error
    }
  }, [])

  const deleteNotification = useCallback(async (id: string) => {
    try {
      await api.deleteNotification(id)

      // Update local state immediately
      const notification = notifications.find(n => n.id === id)
      setNotifications(prev => prev.filter(n => n.id !== id))
      if (notification && !notification.isRead) {
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
    } catch (error) {
      console.error('Failed to delete notification:', error)
      throw error
    }
  }, [notifications])

  // SSE connection for real-time unread count + browser notifications
  useEffect(() => {
    if (!currentOrg) {
      setUnreadCount(0)
      return
    }

    const orgId = getOrganizationId()
    const url = `${API_BASE}/notifications/stream${orgId ? `?orgId=${orgId}` : ''}`
    const es = new EventSource(url, { withCredentials: true })
    eventSourceRef.current = es

    es.onmessage = (event) => {
      try {
        const { count } = JSON.parse(event.data)
        setUnreadCount(count)
      } catch {
        // Ignore malformed messages
      }
    }

    // Listen for named notification events (for browser notifications)
    es.addEventListener('notification', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data)
        showBrowserNotification(data)

        // Prepend to local notification list so dropdown stays current
        setNotifications(prev => {
          if (prev.length === 0) return prev // list not loaded yet
          if (prev.some(n => n.id === data.id)) return prev // already present
          return [{
            id: data.id,
            type: data.type,
            title: data.title,
            message: data.message,
            link: data.link,
            isRead: false,
            createdAt: new Date().toISOString(),
            organizationId: '',
            recipientId: '',
          } as Notification, ...prev]
        })
      } catch {
        // Ignore malformed notification events
      }
    })

    es.onerror = () => {
      // EventSource auto-reconnects; nothing to do here
    }

    return () => {
      es.close()
      eventSourceRef.current = null
    }
  }, [currentOrg, showBrowserNotification])

  // Reset notification list when org changes
  useEffect(() => {
    if (currentOrg) {
      setNotifications([])
      setOffset(0)
      setHasMore(true)
    }
  }, [currentOrg])

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        isLoading,
        hasMore,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        browserPermission,
        requestBrowserNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}
