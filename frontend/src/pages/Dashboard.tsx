import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOrganization } from '../context/OrganizationContext'
import { useTimer } from '../context/TimerContext'
import { api, SoftwareAccessRequest } from '../api/client'
import { TicketKanbanBoard } from '../components/tickets/TicketKanbanBoard'
import { SoftwareAccessRequestReview } from '../components/dashboard/SoftwareAccessRequestReview'
import { NewTicketDialog } from '../components/dashboard/NewTicketDialog'
import { useDashboardFilters } from '../hooks/useDashboardFilters'
import { Heading } from '@/components/ui/heading'
import { Text } from '@/components/ui/text'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { PlusIcon } from '@heroicons/react/24/outline'

interface Project {
  id: string
  name: string
  projectCode: string
}

interface StaffMember {
  id: string
  role: string
  user: { id: string; name: string; email: string }
}

interface Client {
  id: string
  user: { id: string; name: string; email: string }
  projectAssignments: Array<{
    id: string
    project: { id: string; name: string; projectCode: string; isActive: boolean }
  }>
}

interface Ticket {
  id: string
  subject: string
  firstName: string
  lastName: string
  status: 'NEW_REQUEST' | 'IN_PROGRESS' | 'WAITING_FOR_INFO' | 'REVIEW' | 'RESOLVED'
  priorityLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  dueDate?: string | null
  project?: {
    id: string
    name: string
    projectCode: string
  } | null
  owner?: {
    id: string
    user: { name: string }
  } | null
  _count?: {
    comments: number
    timeEntries: number
  }
}

interface PendingSoftwareRequest extends SoftwareAccessRequest {
  projectSoftware: {
    software: { id: string; name: string; iconUrl?: string }
    project: { id: string; name: string; projectCode: string; defaultAssigneeId?: string }
  }
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { currentOrg, membership, isClient } = useOrganization()
  const { runningTimer, startTimer, stopTimer } = useTimer()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [pendingRequests, setPendingRequests] = useState<PendingSoftwareRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [isNewTicketOpen, setIsNewTicketOpen] = useState(false)

  const {
    filterProject, setFilterProject,
    filterAssignee, setFilterAssignee,
    filterPriority, setFilterPriority,
    hasActiveFilters, clearFilters, filterParams,
  } = useDashboardFilters()

  useEffect(() => {
    if (currentOrg && !isClient) {
      loadData()
    }
  }, [currentOrg, isClient])

  useEffect(() => {
    if (currentOrg && !isClient) {
      loadTickets()
    }
  }, [filterProject, filterAssignee, filterPriority])

  useEffect(() => {
    if (currentOrg && !isClient) {
      loadPendingRequests()
    }
  }, [currentOrg, isClient, filterProject])

  const loadData = async () => {
    setLoading(true)
    try {
      const [ticketsData, projectsData, staffData, clientsData, requestsData] = await Promise.all([
        api.getTickets(filterParams),
        api.getProjects(),
        api.getStaffMembers(),
        api.getClients(),
        api.getAllPendingAccessRequests()
      ])
      setTickets(ticketsData)
      setProjects(projectsData)
      setStaffMembers(staffData)
      setClients(clientsData)
      setPendingRequests(requestsData)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadPendingRequests = async () => {
    try {
      const requestsData = await api.getAllPendingAccessRequests(filterProject || undefined)
      setPendingRequests(requestsData)
    } catch (error) {
      console.error('Failed to load pending requests:', error)
    }
  }

  const loadTickets = async () => {
    try {
      const ticketsData = await api.getTickets(filterParams)
      setTickets(ticketsData)
    } catch (error) {
      console.error('Failed to load tickets:', error)
    }
  }

  const handleStatusChange = async (ticketId: string, newStatus: string) => {
    try {
      await api.updateTicketStatus(ticketId, newStatus)
      setTickets(tickets.map(t =>
        t.id === ticketId ? { ...t, status: newStatus as Ticket['status'] } : t
      ))
    } catch (error) {
      console.error('Failed to update ticket status:', error)
    }
  }

  const handleTicketClick = (ticket: Ticket) => {
    if (ticket.project) {
      navigate(`/projects/${ticket.project.id}/tickets/${ticket.id}`)
    }
  }

  const handleAssign = async (ticketId: string, ownerId: string | null) => {
    try {
      await api.assignTicket(ticketId, ownerId)
      const assignedMember = ownerId ? staffMembers.find(m => m.id === ownerId) : null
      setTickets(tickets.map(t =>
        t.id === ticketId
          ? {
              ...t,
              owner: assignedMember
                ? { id: assignedMember.id, user: { name: assignedMember.user.name } }
                : null
            }
          : t
      ))
    } catch (error) {
      console.error('Failed to assign ticket:', error)
    }
  }

  const handleStartTimer = async (ticketId: string) => {
    try {
      await startTimer(ticketId)
    } catch (error) {
      console.error('Failed to start timer:', error)
    }
  }

  const handleStopTimer = async () => {
    try {
      await stopTimer()
    } catch (error) {
      console.error('Failed to stop timer:', error)
    }
  }

  const handleAssignRequest = async (requestId: string, assigneeId: string | null) => {
    try {
      await api.assignAccessRequest(requestId, assigneeId)
      setPendingRequests(prev => prev.map(req => {
        if (req.id === requestId) {
          const assignedMember = assigneeId ? staffMembers.find(m => m.id === assigneeId) : null
          return {
            ...req,
            assigneeId: assigneeId || undefined,
            assignee: assignedMember ? { id: assignedMember.id, user: assignedMember.user } : undefined
          }
        }
        return req
      }))
    } catch (error) {
      console.error('Failed to assign request:', error)
    }
  }

  // Redirect clients to portal
  if (isClient) {
    navigate('/portal')
    return null
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Heading>Ticket Dashboard</Heading>
        <Button onClick={() => setIsNewTicketOpen(true)}>
          <PlusIcon className="w-4 h-4" />
          New Ticket
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-4 rounded-lg bg-white p-4 shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
        <div className="w-48">
          <Select
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
          >
            <option value="">All Projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="w-48">
          <Select
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
          >
            <option value="">All Assignees</option>
            {staffMembers.map((member) => (
              <option key={member.id} value={member.id}>
                {member.user.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="w-48">
          <Select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
          >
            <option value="">All Priorities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </Select>
        </div>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Pending Software Requests */}
      <SoftwareAccessRequestReview
        pendingRequests={pendingRequests}
        staffMembers={staffMembers}
        onRequestReviewed={loadPendingRequests}
        onRequestAssigned={handleAssignRequest}
      />

      {/* Kanban Board */}
      {tickets.length === 0 && !hasActiveFilters ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
          <Text className="text-zinc-500">
            No tickets yet. Create tickets from project pages to see them here.
          </Text>
        </div>
      ) : (
        <TicketKanbanBoard
          tickets={tickets}
          onStatusChange={handleStatusChange}
          onTicketClick={handleTicketClick}
          showProject={true}
          staffMembers={staffMembers}
          currentUserId={membership?.id}
          onAssign={handleAssign}
          runningTimer={runningTimer}
          onStartTimer={handleStartTimer}
          onStopTimer={handleStopTimer}
        />
      )}

      {/* New Ticket Modal */}
      <NewTicketDialog
        open={isNewTicketOpen}
        onClose={() => setIsNewTicketOpen(false)}
        projects={projects}
        clients={clients}
      />
    </div>
  )
}
