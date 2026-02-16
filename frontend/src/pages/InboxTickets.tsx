import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useOrganization } from '../context/OrganizationContext'
import { api } from '../api/client'
import { TicketKanbanBoard } from '../components/tickets'
import { Heading, Subheading } from '@/components/ui/heading'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { PlusIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'

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

interface Inbox {
  id: string
  name: string
  inboxCode: string
}

export default function InboxTickets() {
  const { inboxId } = useParams<{ inboxId: string }>()
  const navigate = useNavigate()
  const { currentOrg } = useOrganization()
  const [inbox, setInbox] = useState<Inbox | null>(null)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (currentOrg && inboxId) {
      loadData()
    }
  }, [currentOrg, inboxId])

  const loadData = async () => {
    setLoading(true)
    try {
      const [inboxData, ticketsData] = await Promise.all([
        api.getInbox(inboxId!),
        api.getTickets({ inboxId })
      ])
      setInbox(inboxData)
      setTickets(ticketsData)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (ticketId: string, newStatus: string) => {
    try {
      await api.updateTicketStatus(ticketId, newStatus)
      setTickets(tickets.map(t =>
        t.id === ticketId
          ? { ...t, status: newStatus as Ticket['status'] }
          : t
      ))
    } catch (error) {
      console.error('Failed to update ticket status:', error)
    }
  }

  const handleTicketClick = (ticket: Ticket) => {
    navigate(`/inboxes/${inboxId}/tickets/${ticket.id}`)
  }

  if (!currentOrg) {
    return (
      <div className="flex h-full items-center justify-center">
        <Text>Select an organization to view tickets</Text>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Text>Loading...</Text>
      </div>
    )
  }

  if (!inbox) {
    return (
      <div className="flex h-full items-center justify-center">
        <Text>Inbox not found</Text>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/inboxes"
            className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <ArrowLeftIcon className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
          </Link>
          <div>
            <Heading>{inbox.name} - Tickets</Heading>
            <Text className="text-zinc-500">{inbox.inboxCode}</Text>
          </div>
        </div>
        <Button onClick={() => navigate(`/inboxes/${inboxId}/tickets/new`)}>
          <PlusIcon className="w-4 h-4" />
          New Ticket
        </Button>
      </div>

      <div className="overflow-x-auto -mx-4 px-4">
        <TicketKanbanBoard
          tickets={tickets}
          onStatusChange={handleStatusChange}
          onTicketClick={handleTicketClick}
        />
      </div>
    </div>
  )
}
