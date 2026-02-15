import { useNavigate } from 'react-router-dom'
import { Notification } from '../../api/client'
import { NotificationIcon } from './NotificationIcon'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { formatTimeAgo } from '../../utils/time'

interface NotificationItemProps {
  notification: Notification
  onMarkAsRead: (id: string) => void
  onDelete: (id: string) => void
  onClose?: () => void
}

export function NotificationItem({
  notification,
  onMarkAsRead,
  onDelete,
  onClose,
}: NotificationItemProps) {
  const navigate = useNavigate()

  const handleClick = () => {
    if (!notification.isRead) {
      onMarkAsRead(notification.id)
    }
    if (notification.link) {
      navigate(notification.link)
      onClose?.()
    }
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete(notification.id)
  }

  return (
    <div
      onClick={handleClick}
      className={`
        group relative flex items-start gap-3 px-4 py-3 cursor-pointer
        hover:bg-zinc-50 dark:hover:bg-zinc-800
        ${!notification.isRead ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}
      `}
    >
      {/* Unread indicator */}
      {!notification.isRead && (
        <div className="absolute left-1.5 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-blue-500" />
      )}

      {/* Icon */}
      <div className="flex-shrink-0 mt-0.5">
        <NotificationIcon type={notification.type} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${!notification.isRead ? 'font-medium' : ''} text-zinc-900 dark:text-white`}>
          {notification.title}
        </p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 truncate">
          {notification.message}
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
          {formatTimeAgo(notification.createdAt)}
        </p>
      </div>

      {/* Delete button */}
      <button
        onClick={handleDelete}
        className="flex-shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-opacity"
        title="Delete notification"
      >
        <XMarkIcon className="h-4 w-4 text-zinc-500" />
      </button>
    </div>
  )
}
