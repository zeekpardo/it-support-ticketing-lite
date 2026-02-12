import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useOrganization } from '../context/OrganizationContext'
import { api } from '../api/client'
import { TicketForm } from '../components/tickets'
import { Heading } from '@/components/ui/heading'
import { Text } from '@/components/ui/text'
import { Select } from '@/components/ui/select'
import { Field, Label } from '@/components/ui/fieldset'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'

interface Project {
  id: string
  name: string
  projectCode: string
}

interface Client {
  id: string
  user: { id: string; name: string; email: string }
}

export default function NewTicket() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { currentOrg } = useOrganization()
  const [project, setProject] = useState<Project | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClientId, setSelectedClientId] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (currentOrg && projectId) {
      loadData()
    }
  }, [currentOrg, projectId])

  const loadData = async () => {
    setLoading(true)
    try {
      const [projectData, clientsData] = await Promise.all([
        api.getProject(projectId!),
        api.getClients()
      ])
      setProject(projectData)
      setClients(clientsData)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (data: any) => {
    if (!selectedClientId) {
      throw new Error('Please select a client')
    }

    try {
      const ticket = await api.createTicket({
        ...data,
        projectId: projectId!,
        clientId: selectedClientId
      })
      navigate(`/projects/${projectId}/tickets/${ticket.id}`)
    } catch (error) {
      console.error('Failed to create ticket:', error)
      throw error
    }
  }

  if (!currentOrg) {
    return (
      <div className="flex h-full items-center justify-center">
        <Text>Select an organization to create tickets</Text>
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

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center">
        <Text>Project not found</Text>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link
          to={`/projects/${projectId}/tickets`}
          className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <ArrowLeftIcon className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
        </Link>
        <div>
          <Heading>New Ticket</Heading>
          <Text className="text-zinc-500">{project.name}</Text>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm ring-1 ring-zinc-950/5 dark:ring-white/10">
        <Field className="mb-6">
          <Label>Client *</Label>
          <Select
            value={selectedClientId}
            onChange={e => setSelectedClientId(e.target.value)}
            required
          >
            <option value="">Select a client</option>
            {clients.map(client => (
              <option key={client.id} value={client.id}>
                {client.user.name} ({client.user.email})
              </option>
            ))}
          </Select>
          {clients.length === 0 && (
            <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
              No clients found. Invite a client first from the Clients page.
            </p>
          )}
        </Field>

        <TicketForm
          projects={[project]}
          onSubmit={handleSubmit}
          showPriority={true}
          preselectedProjectId={projectId}
        />
      </div>
    </div>
  )
}
