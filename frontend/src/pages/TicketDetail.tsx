import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useOrganization } from '../context/OrganizationContext'
import { useTimer } from '../context/TimerContext'
import { api } from '../api/client'
import { TicketComments, TicketTimeEntries, TICKET_STATUSES, PRIORITY_LEVELS } from '../components/tickets'
import { Heading, Subheading } from '@/components/ui/heading'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Field, Label } from '@/components/ui/fieldset'
import { ArrowLeftIcon, TrashIcon, LinkIcon } from '@heroicons/react/24/outline'

interface Ticket {
  id: string
  subject: string
  description: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  requestType: string
  status: 'NEW_REQUEST' | 'IN_PROGRESS' | 'WAITING_FOR_INFO' | 'REVIEW' | 'RESOLVED'
  priorityLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  screenRecordingLink?: string
  dueDate?: string | null
  createdAt: string
  updatedAt: string
  project: {
    id: string
    name: string
    projectCode: string
  }
  client: {
    id: string
    user: { id: string; name: string; email: string }
  }
  owner?: {
    id: string
    user: { id: string; name: string; email: string }
  } | null
  comments: any[]
  timeEntries: any[]
  totalTimeMinutes: number
}

interface StaffMember {
  id: string
  user: { id: string; name: string; email: string }
}

export default function TicketDetail() {
  const { projectId, ticketId } = useParams<{ projectId: string; ticketId: string }>()
  const navigate = useNavigate()
  const { currentOrg, isAdmin } = useOrganization()
  const { runningTimer, startTimer, stopTimer: stopGlobalTimer, refreshTimer, isLoading: timerLoading } = useTimer()
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (currentOrg && ticketId) {
      loadData()
    }
  }, [currentOrg, ticketId])

  const loadData = async () => {
    setLoading(true)
    try {
      const [ticketData, staffData] = await Promise.all([
        api.getTicket(ticketId!),
        api.getStaffMembers()
      ])
      setTicket(ticketData)
      setStaffMembers(staffData)
    } catch (error) {
      console.error('Failed to load ticket:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    if (!ticket) return
    setSaving(true)
    try {
      await api.updateTicketStatus(ticket.id, newStatus)
      setTicket({ ...ticket, status: newStatus as Ticket['status'] })
    } catch (error) {
      console.error('Failed to update status:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleAssign = async (ownerId: string | null) => {
    if (!ticket) return
    setSaving(true)
    try {
      const updated = await api.assignTicket(ticket.id, ownerId)
      setTicket({ ...ticket, owner: updated.owner })
    } catch (error) {
      console.error('Failed to assign ticket:', error)
    } finally {
      setSaving(false)
    }
  }

  const handlePriorityChange = async (priority: string) => {
    if (!ticket) return
    setSaving(true)
    try {
      await api.updateTicket(ticket.id, { priorityLevel: priority })
      setTicket({ ...ticket, priorityLevel: priority as Ticket['priorityLevel'] })
    } catch (error) {
      console.error('Failed to update priority:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDueDateChange = async (dueDate: string) => {
    if (!ticket) return
    setSaving(true)
    try {
      await api.updateTicket(ticket.id, { dueDate: dueDate || null })
      setTicket({ ...ticket, dueDate: dueDate || null })
    } catch (error) {
      console.error('Failed to update due date:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleAddComment = async (content: string, isInternal: boolean) => {
    if (!ticket) return
    try {
      const comment = await api.addTicketComment(ticket.id, { content, isInternal })
      setTicket({ ...ticket, comments: [...ticket.comments, comment] })
    } catch (error) {
      console.error('Failed to add comment:', error)
      throw error
    }
  }

  const handleStartTimer = async () => {
    if (!ticket) return
    try {
      await startTimer(ticket.id)
      // Reload ticket to get updated time entries
      const ticketData = await api.getTicket(ticket.id)
      setTicket(ticketData)
    } catch (error) {
      console.error('Failed to start timer:', error)
    }
  }

  const handleStopTimer = async () => {
    if (!ticket) return
    try {
      await stopGlobalTimer()
      await refreshTimer()
      // Reload ticket to get updated time entries and total
      const ticketData = await api.getTicket(ticket.id)
      setTicket(ticketData)
    } catch (error) {
      console.error('Failed to stop timer:', error)
    }
  }

  const handleDelete = async () => {
    if (!ticket || !confirm('Are you sure you want to delete this ticket?')) return
    try {
      await api.deleteTicket(ticket.id)
      navigate(`/projects/${projectId}/tickets`)
    } catch (error) {
      console.error('Failed to delete ticket:', error)
    }
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

  if (!ticket) {
    return (
      <div className="flex h-full items-center justify-center">
        <Text>Ticket not found</Text>
      </div>
    )
  }

  // Check if this ticket has the running timer
  const hasRunningTimerOnThisTicket = runningTimer?.ticketId === ticket.id
  // Check if any timer is running (to disable start button)
  const anyTimerRunning = !!runningTimer

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Link
            to={`/projects/${projectId}/tickets`}
            className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 mt-1"
          >
            <ArrowLeftIcon className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
          </Link>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Heading>{ticket.subject}</Heading>
            </div>
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <span>{ticket.project.name}</span>
              <span>·</span>
              <span>Created {new Date(ticket.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
        {isAdmin && (
          <Button color="red" onClick={handleDelete}>
            <TrashIcon className="w-4 h-4" />
            Delete
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm ring-1 ring-zinc-950/5 dark:ring-white/10">
            <Subheading>Description</Subheading>
            <div className="mt-3 prose prose-sm dark:prose-invert max-w-none">
              <p className="whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                {ticket.description}
              </p>
            </div>
            {ticket.screenRecordingLink && (
              <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700">
                <a
                  href={ticket.screenRecordingLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  <LinkIcon className="w-4 h-4" />
                  View Screen Recording
                </a>
              </div>
            )}
          </div>

          {/* Time Entries */}
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm ring-1 ring-zinc-950/5 dark:ring-white/10">
            <TicketTimeEntries
              timeEntries={ticket.timeEntries}
              totalMinutes={ticket.totalTimeMinutes}
              onStartTimer={handleStartTimer}
              onStopTimer={handleStopTimer}
              hasRunningTimer={hasRunningTimerOnThisTicket}
              isLoading={timerLoading}
              disableStart={anyTimerRunning && !hasRunningTimerOnThisTicket}
            />
          </div>

          {/* Comments */}
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm ring-1 ring-zinc-950/5 dark:ring-white/10">
            <TicketComments
              comments={ticket.comments}
              onAddComment={handleAddComment}
              isStaff={true}
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status & Assignment */}
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm ring-1 ring-zinc-950/5 dark:ring-white/10 space-y-4">
            <Field>
              <Label>Status</Label>
              <Select
                value={ticket.status}
                onChange={e => handleStatusChange(e.target.value)}
                disabled={saving}
              >
                {TICKET_STATUSES.map(status => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field>
              <Label>Priority</Label>
              <Select
                value={ticket.priorityLevel}
                onChange={e => handlePriorityChange(e.target.value)}
                disabled={saving}
              >
                {PRIORITY_LEVELS.map(level => (
                  <option key={level.value} value={level.value}>
                    {level.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field>
              <Label>Assigned To</Label>
              <Select
                value={ticket.owner?.id || ''}
                onChange={e => handleAssign(e.target.value || null)}
                disabled={saving}
              >
                <option value="">Unassigned</option>
                {staffMembers.map(member => (
                  <option key={member.id} value={member.id}>
                    {member.user.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field>
              <Label>Due Date</Label>
              <Input
                type="date"
                value={ticket.dueDate ? ticket.dueDate.split('T')[0] : ''}
                onChange={e => handleDueDateChange(e.target.value)}
                disabled={saving}
              />
            </Field>
          </div>

          {/* Contact Info */}
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm ring-1 ring-zinc-950/5 dark:ring-white/10">
            <Subheading>Contact Information</Subheading>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-zinc-500 dark:text-zinc-400">Name</dt>
                <dd className="font-medium text-zinc-900 dark:text-white">
                  {ticket.firstName} {ticket.lastName}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500 dark:text-zinc-400">Email</dt>
                <dd>
                  <a
                    href={`mailto:${ticket.email}`}
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {ticket.email}
                  </a>
                </dd>
              </div>
              {ticket.phone && (
                <div>
                  <dt className="text-zinc-500 dark:text-zinc-400">Phone</dt>
                  <dd>
                    <a
                      href={`tel:${ticket.phone}`}
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {ticket.phone}
                    </a>
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-zinc-500 dark:text-zinc-400">Request Type</dt>
                <dd className="font-medium text-zinc-900 dark:text-white">
                  {ticket.requestType.replace(/_/g, ' ')}
                </dd>
              </div>
            </dl>
          </div>

          {/* Client Account */}
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm ring-1 ring-zinc-950/5 dark:ring-white/10">
            <Subheading>Client Account</Subheading>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-zinc-500 dark:text-zinc-400">Account Name</dt>
                <dd className="font-medium text-zinc-900 dark:text-white">
                  {ticket.client.user.name}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500 dark:text-zinc-400">Account Email</dt>
                <dd className="text-zinc-700 dark:text-zinc-300">
                  {ticket.client.user.email}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}
