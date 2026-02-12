import { ClockIcon, ChatBubbleLeftIcon, CalendarIcon, UserIcon } from '@heroicons/react/24/outline'
import { PriorityBadge } from './PriorityBadge'

interface TicketCardProps {
  ticket: {
    id: string
    subject: string
    firstName: string
    lastName: string
    status: string
    priorityLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
    dueDate?: string | null
    owner?: {
      id: string
      user: { name: string }
    } | null
    _count?: {
      comments: number
      timeEntries: number
    }
  }
  onClick?: () => void
  isDragging?: boolean
}

export function TicketCard({ ticket, onClick, isDragging }: TicketCardProps) {
  const isOverdue = ticket.dueDate && new Date(ticket.dueDate) < new Date()

  return (
    <div
      onClick={onClick}
      className={`
        bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700
        p-3 cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-600
        transition-all shadow-sm hover:shadow
        ${isDragging ? 'opacity-50 rotate-2 scale-105' : ''}
      `}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-sm font-medium text-zinc-900 dark:text-white line-clamp-2">
          {ticket.subject}
        </h4>
        <PriorityBadge priority={ticket.priorityLevel} />
      </div>

      <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
        {ticket.firstName} {ticket.lastName}
      </p>

      <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
        <div className="flex items-center gap-3">
          {ticket._count?.comments ? (
            <span className="flex items-center gap-1">
              <ChatBubbleLeftIcon className="w-3.5 h-3.5" />
              {ticket._count.comments}
            </span>
          ) : null}
          {ticket._count?.timeEntries ? (
            <span className="flex items-center gap-1">
              <ClockIcon className="w-3.5 h-3.5" />
              {ticket._count.timeEntries}
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {ticket.dueDate && (
            <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-500' : ''}`}>
              <CalendarIcon className="w-3.5 h-3.5" />
              {new Date(ticket.dueDate).toLocaleDateString()}
            </span>
          )}
          {ticket.owner && (
            <span className="flex items-center gap-1" title={ticket.owner.user.name}>
              <UserIcon className="w-3.5 h-3.5" />
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
