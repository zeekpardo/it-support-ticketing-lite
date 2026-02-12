import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useOrganization } from '../../context/OrganizationContext'
import { api } from '../../api/client'
import { StatusBadge, PriorityBadge, TICKET_STATUSES } from '../../components/tickets'
import { Heading } from '@/components/ui/heading'
import { Text } from '@/components/ui/text'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PlusIcon, TicketIcon } from '@heroicons/react/24/outline'

interface Ticket {
  id: string
  subject: string
  status: string
  priorityLevel: string
  createdAt: string
  updatedAt: string
  project: { id: string; name: string; projectCode: string }
  owner?: { id: string; user: { name: string } } | null
  _count?: { comments: number }
}

interface Project {
  id: string
  name: string
  projectCode: string
}

export default function PortalTickets() {
  const { currentOrg } = useOrganization()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    projectId: '',
    status: ''
  })

  useEffect(() => {
    if (currentOrg) {
      loadData()
    }
  }, [currentOrg])

  useEffect(() => {
    if (currentOrg) {
      loadTickets()
    }
  }, [filters])

  const loadData = async () => {
    setLoading(true)
    try {
      const [ticketsData, projectsData] = await Promise.all([
        api.getPortalTickets(filters),
        api.getPortalProjects()
      ])
      setTickets(ticketsData)
      setProjects(projectsData)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadTickets = async () => {
    try {
      const ticketsData = await api.getPortalTickets(filters)
      setTickets(ticketsData)
    } catch (error) {
      console.error('Failed to load tickets:', error)
    }
  }

  if (!currentOrg) {
    return (
      <div className="flex h-full items-center justify-center">
        <Text>Loading...</Text>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Heading>My Tickets</Heading>
        <Link to="/portal/tickets/new">
          <Button>
            <PlusIcon className="w-4 h-4" />
            New Ticket
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <Select
          value={filters.projectId}
          onChange={e => setFilters({ ...filters, projectId: e.target.value })}
          className="w-48"
        >
          <option value="">All Projects</option>
          {projects.map(project => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </Select>

        <Select
          value={filters.status}
          onChange={e => setFilters({ ...filters, status: e.target.value })}
          className="w-48"
        >
          <option value="">All Statuses</option>
          {TICKET_STATUSES.map(status => (
            <option key={status.value} value={status.value}>
              {status.label}
            </option>
          ))}
        </Select>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Text>Loading...</Text>
        </div>
      ) : tickets.length > 0 ? (
        <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm ring-1 ring-zinc-950/5 dark:ring-white/10">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Subject</TableHeader>
                <TableHeader>Project</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Priority</TableHeader>
                <TableHeader>Updated</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {tickets.map(ticket => (
                <TableRow key={ticket.id}>
                  <TableCell>
                    <Link
                      to={`/portal/tickets/${ticket.id}`}
                      className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                    >
                      {ticket.subject}
                    </Link>
                    {ticket._count?.comments ? (
                      <span className="ml-2 text-xs text-zinc-500">
                        ({ticket._count.comments} messages)
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-zinc-600 dark:text-zinc-400">
                    {ticket.project.name}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={ticket.status as any} />
                  </TableCell>
                  <TableCell>
                    <PriorityBadge priority={ticket.priorityLevel as any} />
                  </TableCell>
                  <TableCell className="text-zinc-500 dark:text-zinc-400">
                    {new Date(ticket.updatedAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-800 rounded-xl p-12 shadow-sm ring-1 ring-zinc-950/5 dark:ring-white/10 text-center">
          <TicketIcon className="w-12 h-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-500 dark:text-zinc-400 mb-4">
            {filters.projectId || filters.status
              ? 'No tickets match your filters'
              : 'You haven\'t submitted any tickets yet'}
          </p>
          <Link to="/portal/tickets/new">
            <Button>
              <PlusIcon className="w-4 h-4" />
              Create a ticket
            </Button>
          </Link>
        </div>
      )}
    </div>
  )
}
