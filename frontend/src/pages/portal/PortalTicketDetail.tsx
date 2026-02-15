import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useOrganization } from '../../context/OrganizationContext'
import { api } from '../../api/client'
import { TicketComments, PriorityBadge, StatusBadge } from '../../components/tickets'
import { Heading, Subheading } from '@/components/ui/heading'
import { Text } from '@/components/ui/text'
import { ArrowLeftIcon, LinkIcon } from '@heroicons/react/24/outline'
import { EmailContent } from '../../components/EmailContent'

interface Ticket {
  id: string
  subject: string
  description: string
  descriptionHtml?: string | null
  firstName: string
  lastName: string
  email: string
  phone?: string
  requestType: string
  status: 'NEW_REQUEST' | 'IN_PROGRESS' | 'WAITING_FOR_INFO' | 'REVIEW' | 'RESOLVED'
  priorityLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  screenRecordingLink?: string
  createdAt: string
  updatedAt: string
  project: {
    id: string
    name: string
    projectCode: string
  }
  owner?: {
    id: string
    user: { id: string; name: string }
  } | null
  comments: any[]
  attachments: any[]
}

interface MentionableMember {
  id: string
  role: string
  user: { id: string; name: string; email: string }
}

export default function PortalTicketDetail() {
  const { id } = useParams<{ id: string }>()
  const { currentOrg } = useOrganization()
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [mentionableMembers, setMentionableMembers] = useState<MentionableMember[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (currentOrg && id) {
      loadTicket()
    }
  }, [currentOrg, id])

  const loadTicket = async () => {
    setLoading(true)
    try {
      const [ticketData, membersData] = await Promise.all([
        api.getPortalTicket(id!),
        api.getPortalTicketMentionableMembers(id!)
      ])
      setTicket(ticketData)
      setMentionableMembers(membersData)
    } catch (error) {
      console.error('Failed to load ticket:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddMessage = async (content: string, _isInternal: boolean, files?: File[]) => {
    if (!ticket) return
    try {
      const comment = await api.addPortalMessage(ticket.id, content, files)
      setTicket({ ...ticket, comments: [...ticket.comments, comment] })
    } catch (error) {
      console.error('Failed to add message:', error)
      throw error
    }
  }

  if (!currentOrg) {
    return (
      <div className="flex h-full items-center justify-center">
        <Text>Loading...</Text>
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link
          to="/portal/tickets"
          className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 mt-1"
        >
          <ArrowLeftIcon className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <Heading>{ticket.subject}</Heading>
          </div>
          <div className="flex items-center gap-3 text-sm text-zinc-500">
            <span>{ticket.project.name}</span>
            <span>·</span>
            <StatusBadge status={ticket.status} />
            <span>·</span>
            <PriorityBadge priority={ticket.priorityLevel} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm ring-1 ring-zinc-950/5 dark:ring-white/10">
            <Subheading>Your Request</Subheading>
            <div className="mt-3">
              <EmailContent text={ticket.description} html={ticket.descriptionHtml} />
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

          {/* Messages */}
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm ring-1 ring-zinc-950/5 dark:ring-white/10">
            <TicketComments
              comments={ticket.comments}
              onAddComment={handleAddMessage}
              isStaff={false}
              mentionableMembers={mentionableMembers}
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status Info */}
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm ring-1 ring-zinc-950/5 dark:ring-white/10">
            <Subheading>Ticket Status</Subheading>
            <dl className="mt-4 space-y-4">
              <div>
                <dt className="text-sm text-zinc-500 dark:text-zinc-400">Current Status</dt>
                <dd className="mt-1">
                  <StatusBadge status={ticket.status} />
                </dd>
              </div>
              <div>
                <dt className="text-sm text-zinc-500 dark:text-zinc-400">Priority</dt>
                <dd className="mt-1">
                  <PriorityBadge priority={ticket.priorityLevel} />
                </dd>
              </div>
              {ticket.owner && (
                <div>
                  <dt className="text-sm text-zinc-500 dark:text-zinc-400">Assigned To</dt>
                  <dd className="mt-1 text-sm font-medium text-zinc-900 dark:text-white">
                    {ticket.owner.user.name}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-sm text-zinc-500 dark:text-zinc-400">Submitted</dt>
                <dd className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
                  {new Date(ticket.createdAt).toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-zinc-500 dark:text-zinc-400">Last Updated</dt>
                <dd className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
                  {new Date(ticket.updatedAt).toLocaleString()}
                </dd>
              </div>
            </dl>
          </div>

          {/* Status Explanation */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
            <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
              What does this status mean?
            </h4>
            <p className="text-sm text-blue-800 dark:text-blue-200">
              {ticket.status === 'NEW_REQUEST' && 'Your ticket has been received and is waiting to be reviewed.'}
              {ticket.status === 'IN_PROGRESS' && 'Our team is actively working on your request.'}
              {ticket.status === 'WAITING_FOR_INFO' && 'We need more information from you. Please check the messages and respond.'}
              {ticket.status === 'REVIEW' && 'Your request has been completed and is under final review.'}
              {ticket.status === 'RESOLVED' && 'This ticket has been resolved. Please open a new ticket if you need further assistance.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
