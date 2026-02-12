import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOrganization } from '../context/OrganizationContext'
import { useTimer } from '../context/TimerContext'
import { api } from '../api/client'
import { TicketKanbanBoard } from '../components/tickets/TicketKanbanBoard'
import { TicketForm, PRIORITY_LEVELS } from '../components/tickets/TicketForm'
import { Heading } from '@/components/ui/heading'
import { Text } from '@/components/ui/text'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTitle, DialogBody } from '@/components/ui/dialog'
import { Field, Label } from '@/components/ui/fieldset'
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

export default function Dashboard() {
  const navigate = useNavigate()
  const { currentOrg, membership, isClient } = useOrganization()
  const { runningTimer, startTimer, stopTimer } = useTimer()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)

  // Modal state
  const [isNewTicketOpen, setIsNewTicketOpen] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [selectedClientId, setSelectedClientId] = useState('')

  // Filters
  const [filterProject, setFilterProject] = useState('')
  const [filterAssignee, setFilterAssignee] = useState('')
  const [filterPriority, setFilterPriority] = useState('')

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

  const loadData = async () => {
    setLoading(true)
    try {
      const [ticketsData, projectsData, staffData, clientsData] = await Promise.all([
        api.getTickets({
          projectId: filterProject || undefined,
          ownerId: filterAssignee || undefined,
          priorityLevel: filterPriority || undefined
        }),
        api.getProjects(),
        api.getStaffMembers(),
        api.getClients()
      ])
      setTickets(ticketsData)
      setProjects(projectsData)
      setStaffMembers(staffData)
      setClients(clientsData)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadTickets = async () => {
    try {
      const ticketsData = await api.getTickets({
        projectId: filterProject || undefined,
        ownerId: filterAssignee || undefined,
        priorityLevel: filterPriority || undefined
      })
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
      // Update local state
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

  const handleCreateTicket = async (data: any) => {
    if (!selectedProjectId) {
      throw new Error('Please select a project')
    }
    if (!selectedClientId) {
      throw new Error('Please select a client')
    }

    try {
      const ticket = await api.createTicket({
        ...data,
        projectId: selectedProjectId,
        clientId: selectedClientId
      })
      setIsNewTicketOpen(false)
      setSelectedProjectId('')
      setSelectedClientId('')
      // Navigate to the new ticket
      navigate(`/projects/${ticket.projectId}/tickets/${ticket.id}`)
    } catch (error) {
      console.error('Failed to create ticket:', error)
      throw error
    }
  }

  // Get clients that have access to the selected project
  const availableClients = selectedProjectId
    ? clients.filter(client =>
        client.projectAssignments.some(pa => pa.project.id === selectedProjectId)
      )
    : []

  // Reset client when project changes
  const handleProjectChange = (projectId: string) => {
    setSelectedProjectId(projectId)
    setSelectedClientId('') // Reset client when project changes
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
            {PRIORITY_LEVELS.map((priority) => (
              <option key={priority.value} value={priority.value}>
                {priority.label}
              </option>
            ))}
          </Select>
        </div>

        {(filterProject || filterAssignee || filterPriority) && (
          <button
            onClick={() => {
              setFilterProject('')
              setFilterAssignee('')
              setFilterPriority('')
            }}
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Kanban Board */}
      {tickets.length === 0 && !filterProject && !filterAssignee && !filterPriority ? (
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
      <Dialog open={isNewTicketOpen} onClose={() => setIsNewTicketOpen(false)} size="2xl">
        <DialogTitle>Create New Ticket</DialogTitle>
        <DialogBody>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <Field>
              <Label>Project *</Label>
              <Select
                value={selectedProjectId}
                onChange={e => handleProjectChange(e.target.value)}
                required
              >
                <option value="">Select a project</option>
                {projects.map(project => (
                  <option key={project.id} value={project.id}>
                    {project.name} ({project.projectCode})
                  </option>
                ))}
              </Select>
            </Field>

            <Field>
              <Label>Client *</Label>
              <Select
                value={selectedClientId}
                onChange={e => setSelectedClientId(e.target.value)}
                disabled={!selectedProjectId}
                required
              >
                <option value="">
                  {selectedProjectId ? 'Select a client' : 'Select a project first'}
                </option>
                {availableClients.map(client => (
                  <option key={client.id} value={client.id}>
                    {client.user.name} ({client.user.email})
                  </option>
                ))}
              </Select>
              {selectedProjectId && availableClients.length === 0 && (
                <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
                  No clients assigned to this project. Assign a client first from the Users page.
                </p>
              )}
            </Field>
          </div>

          <TicketForm
            projects={projects.filter(p => p.id === selectedProjectId)}
            onSubmit={handleCreateTicket}
            showPriority={true}
            showContactFields={true}
            preselectedProjectId={selectedProjectId}
          />
        </DialogBody>
      </Dialog>
    </div>
  )
}
