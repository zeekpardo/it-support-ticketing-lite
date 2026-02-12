import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { TicketColumn } from './TicketColumn'
import { TicketCard } from './TicketCard'
import { TICKET_STATUSES } from './StatusBadge'

interface Ticket {
  id: string
  subject: string
  firstName: string
  lastName: string
  status: 'NEW_REQUEST' | 'IN_PROGRESS' | 'WAITING_FOR_INFO' | 'REVIEW' | 'RESOLVED'
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

interface TicketKanbanBoardProps {
  tickets: Ticket[]
  onStatusChange: (ticketId: string, newStatus: string) => Promise<void>
  onTicketClick: (ticket: Ticket) => void
}

const columnColors: Record<string, string> = {
  NEW_REQUEST: 'bg-purple-600',
  IN_PROGRESS: 'bg-blue-600',
  WAITING_FOR_INFO: 'bg-amber-500',
  REVIEW: 'bg-cyan-600',
  RESOLVED: 'bg-green-600'
}

export function TicketKanbanBoard({ tickets, onStatusChange, onTicketClick }: TicketKanbanBoardProps) {
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  const handleDragStart = (event: DragStartEvent) => {
    const ticket = tickets.find(t => t.id === event.active.id)
    if (ticket) {
      setActiveTicket(ticket)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveTicket(null)

    if (!over) return

    const ticketId = active.id as string
    const ticket = tickets.find(t => t.id === ticketId)

    if (!ticket) return

    // Check if dropped on a column or another ticket
    let newStatus: string | null = null

    // If dropped directly on a column
    if (TICKET_STATUSES.some(s => s.value === over.id)) {
      newStatus = over.id as string
    } else {
      // If dropped on another ticket, find its status
      const targetTicket = tickets.find(t => t.id === over.id)
      if (targetTicket) {
        newStatus = targetTicket.status
      }
    }

    if (newStatus && newStatus !== ticket.status) {
      await onStatusChange(ticketId, newStatus)
    }
  }

  const getTicketsByStatus = (status: string) => {
    return tickets.filter(t => t.status === status)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {TICKET_STATUSES.map(status => (
          <TicketColumn
            key={status.value}
            id={status.value}
            title={status.label}
            tickets={getTicketsByStatus(status.value)}
            color={columnColors[status.value]}
            onTicketClick={onTicketClick}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTicket ? (
          <TicketCard ticket={activeTicket} isDragging />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
