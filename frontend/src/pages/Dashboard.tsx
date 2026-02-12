import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOrganization } from '../context/OrganizationContext'
import { useTimer } from '../context/TimerContext'
import { api, SoftwareAccessRequest } from '../api/client'
import { TicketKanbanBoard } from '../components/tickets/TicketKanbanBoard'
import { TicketForm, PRIORITY_LEVELS } from '../components/tickets/TicketForm'
import { Heading, Subheading } from '@/components/ui/heading'
import { Text } from '@/components/ui/text'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTitle, DialogBody, DialogActions } from '@/components/ui/dialog'
import { Field, Label } from '@/components/ui/fieldset'
import { Textarea } from '@/components/ui/textarea'
import { PlusIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline'

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

  // Review modal state
  const [reviewingRequest, setReviewingRequest] = useState<PendingSoftwareRequest | null>(null)
  const [reviewAction, setReviewAction] = useState<'APPROVED' | 'DECLINED'>('APPROVED')
  const [reviewNotes, setReviewNotes] = useState('')
  const [reviewLoading, setReviewLoading] = useState(false)

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

  useEffect(() => {
    if (currentOrg && !isClient) {
      loadPendingRequests()
    }
  }, [currentOrg, isClient, filterProject])

  const loadData = async () => {
    setLoading(true)
    try {
      const [ticketsData, projectsData, staffData, clientsData, requestsData] = await Promise.all([
        api.getTickets({
          projectId: filterProject || undefined,
          ownerId: filterAssignee || undefined,
          priorityLevel: filterPriority || undefined
        }),
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

  const handleReviewClick = (request: PendingSoftwareRequest, action: 'APPROVED' | 'DECLINED') => {
    setReviewingRequest(request)
    setReviewAction(action)
    setReviewNotes('')
  }

  const handleSubmitReview = async () => {
    if (!reviewingRequest) return
    setReviewLoading(true)
    try {
      await api.reviewAccessRequest(
        reviewingRequest.projectSoftware.project.id,
        reviewingRequest.projectSoftwareId,
        reviewingRequest.id,
        { status: reviewAction, reviewNotes: reviewNotes.trim() || undefined }
      )
      setReviewingRequest(null)
      loadPendingRequests()
    } catch (error) {
      console.error('Failed to review request:', error)
    } finally {
      setReviewLoading(false)
    }
  }

  const handleAssignRequest = async (requestId: string, assigneeId: string | null) => {
    try {
      await api.assignAccessRequest(requestId, assigneeId)
      // Update local state
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

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
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

      {/* Pending Software Requests */}
      {pendingRequests.length > 0 && (
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10">
          <Subheading className="mb-4">Pending Software Requests ({pendingRequests.length})</Subheading>
          <div className="space-y-3">
            {pendingRequests.map((request) => (
              <div
                key={request.id}
                className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {request.projectSoftware.software.iconUrl && (
                        <img
                          src={request.projectSoftware.software.iconUrl}
                          alt=""
                          className="w-6 h-6 rounded"
                        />
                      )}
                      <p className="text-sm font-medium text-zinc-900 dark:text-white">
                        {request.projectSoftware.software.name}
                      </p>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300">
                        {request.projectSoftware.project.name}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-1">
                      <span className="font-medium">{request.requester?.user.name}</span>
                      <span className="text-zinc-400 dark:text-zinc-500"> ({request.requester?.user.email})</span>
                    </p>
                    {request.reason && (
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                        <span className="font-medium">Reason:</span> {request.reason}
                      </p>
                    )}
                    <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                      Requested {formatDate(request.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-40">
                      <Select
                        value={request.assigneeId || ''}
                        onChange={(e) => handleAssignRequest(request.id, e.target.value || null)}
                      >
                        <option value="">Unassigned</option>
                        {staffMembers.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.user.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <Button
                      color="green"
                      onClick={() => handleReviewClick(request, 'APPROVED')}
                    >
                      <CheckIcon className="w-4 h-4" />
                      Approve
                    </Button>
                    <Button
                      color="red"
                      onClick={() => handleReviewClick(request, 'DECLINED')}
                    >
                      <XMarkIcon className="w-4 h-4" />
                      Decline
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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

      {/* Review Access Request Modal */}
      <Dialog open={!!reviewingRequest} onClose={() => setReviewingRequest(null)}>
        <DialogTitle>
          {reviewAction === 'APPROVED' ? 'Approve' : 'Decline'} Access Request
        </DialogTitle>
        <DialogBody>
          {reviewingRequest && (
            <div className="space-y-4">
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                {reviewAction === 'APPROVED'
                  ? `Grant ${reviewingRequest.requester?.user.name} access to ${reviewingRequest.projectSoftware.software.name}?`
                  : `Decline ${reviewingRequest.requester?.user.name}'s request for ${reviewingRequest.projectSoftware.software.name}?`}
              </p>
              <Field>
                <Label>Notes (optional)</Label>
                <Textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder={
                    reviewAction === 'APPROVED'
                      ? 'Any additional instructions or information...'
                      : 'Reason for declining...'
                  }
                  rows={3}
                />
              </Field>
            </div>
          )}
        </DialogBody>
        <DialogActions>
          <Button plain onClick={() => setReviewingRequest(null)}>
            Cancel
          </Button>
          <Button
            color={reviewAction === 'APPROVED' ? 'green' : 'red'}
            onClick={handleSubmitReview}
            disabled={reviewLoading}
          >
            {reviewLoading ? 'Saving...' : reviewAction === 'APPROVED' ? 'Approve' : 'Decline'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  )
}
