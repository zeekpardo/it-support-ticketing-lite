import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useOrganization } from '../../context/OrganizationContext'
import { api } from '../../api/client'
import { TicketForm } from '../../components/tickets'
import { Heading } from '@/components/ui/heading'
import { Text } from '@/components/ui/text'
import { ArrowLeftIcon, TicketIcon } from '@heroicons/react/24/outline'

interface Project {
  id: string
  name: string
  projectCode: string
}

export default function PortalNewTicket() {
  const navigate = useNavigate()
  const { currentOrg } = useOrganization()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (currentOrg) {
      loadProjects()
    }
  }, [currentOrg])

  const loadProjects = async () => {
    setLoading(true)
    try {
      const projectsData = await api.getPortalProjects()
      setProjects(projectsData)
    } catch (error) {
      console.error('Failed to load projects:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (data: any) => {
    try {
      const ticket = await api.submitPortalTicket(data)
      return ticket
    } catch (error) {
      console.error('Failed to submit ticket:', error)
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

  if (projects.length === 0) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link
            to="/portal/tickets"
            className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <ArrowLeftIcon className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
          </Link>
          <Heading>New Support Ticket</Heading>
        </div>

        <div className="bg-white dark:bg-zinc-800 rounded-xl p-12 shadow-sm ring-1 ring-zinc-950/5 dark:ring-white/10 text-center">
          <TicketIcon className="w-12 h-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-500 dark:text-zinc-400 mb-2">
            You don't have access to any projects yet.
          </p>
          <p className="text-sm text-zinc-400 dark:text-zinc-500">
            Please contact your service provider to be assigned to a project.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link
          to="/portal/tickets"
          className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <ArrowLeftIcon className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
        </Link>
        <div>
          <Heading>New Support Ticket</Heading>
          <Text className="text-zinc-500">Fill out the form below to submit a support request</Text>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm ring-1 ring-zinc-950/5 dark:ring-white/10">
        <TicketForm
          projects={projects}
          onSubmit={handleSubmit}
          showPriority={true}
          showContactFields={false}
          showAttachments={true}
          onUploadAttachments={(ticketId, files) => api.uploadPortalTicketAttachments(ticketId, files)}
          onSuccess={(ticket) => navigate(`/portal/tickets/${ticket.id}`)}
        />
      </div>
    </div>
  )
}
