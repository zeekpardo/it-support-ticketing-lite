import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { SortableTicketCard } from './SortableTicketCard'

interface Ticket {
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

interface TicketColumnProps {
  id: string
  title: string
  tickets: Ticket[]
  color: string
  onTicketClick: (ticket: Ticket) => void
}

export function TicketColumn({ id, title, tickets, color, onTicketClick }: TicketColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      className={`
        flex flex-col flex-1 min-w-[200px] bg-zinc-50 dark:bg-zinc-900 rounded-lg
        ${isOver ? 'ring-2 ring-blue-500' : ''}
      `}
    >
      <div className={`px-3 py-2 rounded-t-lg ${color}`}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <span className="text-xs text-white/80 bg-white/20 px-2 py-0.5 rounded-full">
            {tickets.length}
          </span>
        </div>
      </div>

      <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-280px)]">
        <SortableContext items={tickets.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tickets.map(ticket => (
            <SortableTicketCard
              key={ticket.id}
              ticket={ticket}
              onClick={() => onTicketClick(ticket)}
            />
          ))}
        </SortableContext>

        {tickets.length === 0 && (
          <div className="text-center py-8 text-zinc-400 dark:text-zinc-500 text-sm">
            No tickets
          </div>
        )}
      </div>
    </div>
  )
}
