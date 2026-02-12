import { useEffect } from 'react'
import { useNotifications } from '../../context/NotificationContext'
import { NotificationItem } from './NotificationItem'
import { Button } from '../ui/button'
import { CheckIcon } from '@heroicons/react/24/outline'

interface NotificationDropdownProps {
  onClose: () => void
}

export function NotificationDropdown({ onClose }: NotificationDropdownProps) {
  const {
    notifications,
    unreadCount,
    isLoading,
    hasMore,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications()

  // Fetch notifications when dropdown opens
  useEffect(() => {
    fetchNotifications(true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleLoadMore = () => {
    fetchNotifications(false)
  }

  return (
    <div className="w-96 max-h-[32rem] flex flex-col bg-white dark:bg-zinc-900 rounded-lg shadow-lg ring-1 ring-zinc-950/5 dark:ring-white/10">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
          Notifications
          {unreadCount > 0 && (
            <span className="ml-2 text-xs font-normal text-zinc-500">
              ({unreadCount} unread)
            </span>
          )}
        </h3>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            <CheckIcon className="h-3.5 w-3.5" />
            Mark all read
          </button>
        )}
      </div>

      {/* Notification list */}
      <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800">
        {notifications.length === 0 && !isLoading ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No notifications yet
            </p>
          </div>
        ) : (
          <>
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkAsRead={markAsRead}
                onDelete={deleteNotification}
                onClose={onClose}
              />
            ))}

            {/* Load more */}
            {hasMore && (
              <div className="px-4 py-3">
                <Button
                  plain
                  onClick={handleLoadMore}
                  disabled={isLoading}
                  className="w-full text-sm"
                >
                  {isLoading ? 'Loading...' : 'Load more'}
                </Button>
              </div>
            )}
          </>
        )}

        {isLoading && notifications.length === 0 && (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Loading...
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
