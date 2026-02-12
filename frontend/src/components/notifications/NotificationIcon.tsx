import {
  TicketIcon,
  ChatBubbleLeftIcon,
  AtSymbolIcon,
  ComputerDesktopIcon,
  BellIcon,
} from '@heroicons/react/24/outline'
import { NotificationType } from '../../api/client'

interface NotificationIconProps {
  type: NotificationType
  className?: string
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  ticket_assigned: TicketIcon,
  ticket_comment: ChatBubbleLeftIcon,
  ticket_comment_client: ChatBubbleLeftIcon,
  mention: AtSymbolIcon,
  mention_client: AtSymbolIcon,
  ticket_status_changed: TicketIcon,
  access_request_submitted: ComputerDesktopIcon,
  access_request_approved: ComputerDesktopIcon,
  access_request_declined: ComputerDesktopIcon,
  access_request_revoked: ComputerDesktopIcon,
}

const COLOR_MAP: Record<string, string> = {
  ticket_assigned: 'text-blue-500',
  ticket_comment: 'text-green-500',
  ticket_comment_client: 'text-green-500',
  mention: 'text-purple-500',
  mention_client: 'text-purple-500',
  ticket_status_changed: 'text-amber-500',
  access_request_submitted: 'text-blue-500',
  access_request_approved: 'text-green-500',
  access_request_declined: 'text-red-500',
  access_request_revoked: 'text-red-500',
}

export function NotificationIcon({ type, className = 'h-5 w-5' }: NotificationIconProps) {
  const Icon = ICON_MAP[type] || BellIcon
  const colorClass = COLOR_MAP[type] || 'text-zinc-500'

  return <Icon className={`${className} ${colorClass}`} />
}
